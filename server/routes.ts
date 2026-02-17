import { Express, Request, Response } from 'express';
import { eq, and, desc, like, sql, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../shared/schema.js';
import { authenticateToken, requireAuth, generateTokens, blacklistToken } from './middleware/auth.js';
import { rateLimiter } from './middleware/rate-limit.js';
import { OpenSRSIntegration } from './services/openrs-integration.js';
import { WPMUDevIntegration } from './services/wpmudev-integration.js';
import { SwipesBluePayment } from './services/swipesblue-payment.js';
import { OrderOrchestrator } from './services/order-orchestration.js';
import { Resend } from 'resend';
import crypto from 'crypto';
import { ZodError, z } from 'zod';

// Validation schemas
const domainSearchSchema = z.object({
  domain: z.string().min(1).max(253),
});

const createOrderSchema = z.object({
  items: z.array(z.object({
    type: z.enum(['domain_registration', 'domain_transfer', 'hosting_plan', 'privacy_protection']),
    domain: z.string().optional(),
    tld: z.string().optional(),
    planId: z.number().optional(),
    termYears: z.number().min(1).max(10).default(1),
    options: z.record(z.any()).optional(),
  })).min(1),
  couponCode: z.string().optional(),
});

// Helper for consistent responses
const successResponse = (data: any, message?: string) => ({
  success: true,
  data,
  ...(message && { message }),
});

const errorResponse = (message: string, code?: string, details?: any) => ({
  success: false,
  error: message,
  ...(code && { code }),
  ...(details && { details }),
});

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>) => {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
};

export function registerRoutes(app: Express, db: PostgresJsDatabase<typeof schema>) {
  // Initialize services
  const openSRS = new OpenSRSIntegration();
  const wpmudev = new WPMUDevIntegration();
  const swipesblue = new SwipesBluePayment();
  const orchestrator = new OrderOrchestrator(db, openSRS, wpmudev);
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  // Rate limiters
  const authLoginLimiter = rateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Too many login attempts' });
  const authRegisterLimiter = rateLimiter({ windowMs: 60 * 1000, max: 5, message: 'Too many registration attempts' });
  const generalLimiter = rateLimiter({ windowMs: 60 * 1000, max: 100 });

  // Cookie config
  const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  function clearAuthCookies(res: Response) {
    res.clearCookie('accessToken', COOKIE_OPTIONS);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
  }

  // ============================================================================
  // AUTH ROUTES
  // ============================================================================
  
  app.post('/api/v1/auth/register', authRegisterLimiter, asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName } = req.body;

    // Check if user exists
    const existing = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });

    if (existing) {
      return res.status(409).json(errorResponse('Email already registered', 'EMAIL_EXISTS'));
    }

    // Hash password
    const passwordHash = await Bun.password.hash(password, 'bcrypt');

    // Create customer
    const [customer] = await db.insert(schema.customers).values({
      email,
      passwordHash,
      firstName,
      lastName,
    }).returning();

    // Generate tokens and set cookies
    const tokens = generateTokens({ userId: customer.id, email: customer.email });
    setAuthCookies(res, tokens);

    // Log audit
    await db.insert(schema.auditLogs).values({
      customerId: customer.id,
      action: 'customer.register',
      entityType: 'customer',
      entityId: String(customer.id),
      description: 'Customer registered',
    });

    res.status(201).json(successResponse({
      customer: {
        id: customer.id,
        uuid: customer.uuid,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
    }, 'Registration successful'));
  }));
  
  app.post('/api/v1/auth/login', authLoginLimiter, asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });

    if (!customer || !customer.isActive) {
      return res.status(401).json(errorResponse('Invalid credentials', 'INVALID_CREDENTIALS'));
    }

    // Verify password
    const valid = await Bun.password.verify(password, customer.passwordHash);
    if (!valid) {
      return res.status(401).json(errorResponse('Invalid credentials', 'INVALID_CREDENTIALS'));
    }

    // Update last login
    await db.update(schema.customers)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.customers.id, customer.id));

    const tokens = generateTokens({ userId: customer.id, email: customer.email, isAdmin: customer.isAdmin });
    setAuthCookies(res, tokens);

    res.json(successResponse({
      customer: {
        id: customer.id,
        uuid: customer.uuid,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        isAdmin: customer.isAdmin,
      },
    }));
  }));
  
  app.post('/api/v1/auth/refresh', asyncHandler(async (req, res) => {
    const refreshTokenValue = req.cookies?.refreshToken;
    if (!refreshTokenValue) {
      return res.status(401).json(errorResponse('Refresh token required', 'TOKEN_MISSING'));
    }
    try {
      const { default: jwt } = await import('jsonwebtoken');
      const decoded = jwt.verify(refreshTokenValue, process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n') || 'dev-private-key', {
        algorithms: [process.env.NODE_ENV === 'production' ? 'RS256' : 'HS256'],
      }) as any;
      const tokens = generateTokens({ userId: decoded.userId, email: decoded.email || '' });
      setAuthCookies(res, tokens);
      res.json(successResponse({ refreshed: true }));
    } catch {
      clearAuthCookies(res);
      return res.status(401).json(errorResponse('Invalid refresh token', 'TOKEN_INVALID'));
    }
  }));

  // Logout
  app.post('/api/v1/auth/logout', asyncHandler(async (req, res) => {
    const token = req.cookies?.accessToken;
    if (token) {
      blacklistToken(token);
    }
    clearAuthCookies(res);
    res.json(successResponse(null, 'Logged out'));
  }));

  // Forgot password
  app.post('/api/v1/auth/forgot-password', rateLimiter({ windowMs: 60000, max: 3 }), asyncHandler(async (req, res) => {
    const { email } = req.body;
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });

    // Always return success (don't reveal if email exists)
    if (customer) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.update(schema.customers)
        .set({
          resetToken,
          resetTokenExpiresAt: resetExpiry,
        })
        .where(eq(schema.customers.id, customer.id));

      if (resend) {
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
            to: email,
            subject: 'Reset Your HostsBlue Password',
            html: `<p>Click the link below to reset your password:</p>
                   <p><a href="${process.env.CLIENT_URL}/reset-password?token=${resetToken}">Reset Password</a></p>
                   <p>This link expires in 1 hour.</p>`,
          });
        } catch (err) {
          console.error('Failed to send reset email:', err);
        }
      }
    }

    res.json(successResponse(null, 'If that email exists, a reset link has been sent'));
  }));

  // Reset password
  app.post('/api/v1/auth/reset-password', asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json(errorResponse('Token and password required'));
    }

    const customer = await db.query.customers.findFirst({
      where: sql`${schema.customers.email} IS NOT NULL AND reset_token = ${token} AND reset_token_expires_at > NOW()`,
    });

    if (!customer) {
      return res.status(400).json(errorResponse('Invalid or expired reset token'));
    }

    const passwordHash = await Bun.password.hash(password, 'bcrypt');
    await db.update(schema.customers)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      })
      .where(eq(schema.customers.id, customer.id));

    res.json(successResponse(null, 'Password reset successful'));
  }));

  // Update profile
  app.patch('/api/v1/auth/profile', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { firstName, lastName, companyName, phone, address1, address2, city, state, postalCode, countryCode } = req.body;

    const [updated] = await db.update(schema.customers)
      .set({
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(companyName !== undefined && { companyName }),
        ...(phone !== undefined && { phone }),
        ...(address1 !== undefined && { address1 }),
        ...(address2 !== undefined && { address2 }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(postalCode !== undefined && { postalCode }),
        ...(countryCode !== undefined && { countryCode }),
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.id, req.user!.userId))
      .returning();

    res.json(successResponse({
      id: updated.id,
      uuid: updated.uuid,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      companyName: updated.companyName,
      phone: updated.phone,
      address1: updated.address1,
      city: updated.city,
      state: updated.state,
      postalCode: updated.postalCode,
      countryCode: updated.countryCode,
    }));
  }));

  // Change password
  app.patch('/api/v1/auth/password', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json(errorResponse('Current and new password required'));
    }

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, req.user!.userId),
    });

    if (!customer) {
      return res.status(404).json(errorResponse('User not found'));
    }

    const valid = await Bun.password.verify(currentPassword, customer.passwordHash);
    if (!valid) {
      return res.status(400).json(errorResponse('Current password is incorrect'));
    }

    const passwordHash = await Bun.password.hash(newPassword, 'bcrypt');
    await db.update(schema.customers)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.customers.id, customer.id));

    res.json(successResponse(null, 'Password changed successfully'));
  }));

  app.get('/api/v1/auth/me', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, req.user!.userId),
    });
    
    if (!customer) {
      return res.status(404).json(errorResponse('User not found'));
    }
    
    res.json(successResponse({
      id: customer.id,
      uuid: customer.uuid,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      companyName: customer.companyName,
      phone: customer.phone,
      address1: customer.address1,
      city: customer.city,
      state: customer.state,
      postalCode: customer.postalCode,
      countryCode: customer.countryCode,
      emailVerified: customer.emailVerified,
    }));
  }));
  
  // ============================================================================
  // DOMAIN ROUTES
  // ============================================================================
  
  // Search domain availability
  app.get('/api/v1/domains/search', asyncHandler(async (req, res) => {
    const { domain } = domainSearchSchema.parse(req.query);
    
    // Get pricing for suggestions
    const tlds = await db.query.tldPricing.findMany({
      where: and(
        eq(schema.tldPricing.isActive, true),
        inArray(schema.tldPricing.tld, ['.com', '.net', '.org', '.io', '.co'])
      ),
    });
    
    // Check availability with OpenSRS
    const results = await openSRS.checkAvailability(domain, tlds.map(t => t.tld));
    
    res.json(successResponse({
      query: domain,
      results: results.map((r: any) => ({
        domain: r.domain,
        available: r.available,
        price: r.available ? tlds.find(t => t.tld === r.tld)?.registrationPrice : null,
        tld: r.tld,
      })),
    }));
  }));
  
  // Get TLD pricing
  app.get('/api/v1/domains/tlds', asyncHandler(async (req, res) => {
    const tlds = await db.query.tldPricing.findMany({
      where: eq(schema.tldPricing.isActive, true),
      orderBy: [
        desc(schema.tldPricing.isFeatured),
        schema.tldPricing.tld,
      ],
    });
    
    res.json(successResponse(tlds));
  }));
  
  // Get customer's domains
  app.get('/api/v1/domains', requireAuth, asyncHandler(async (req, res) => {
    const domains = await db.query.domains.findMany({
      where: and(
        eq(schema.domains.customerId, req.user!.userId),
        sql`${schema.domains.deletedAt} IS NULL`
      ),
      with: {
        ownerContact: true,
      },
      orderBy: desc(schema.domains.createdAt),
    });
    
    res.json(successResponse(domains));
  }));
  
  // Get single domain
  app.get('/api/v1/domains/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
        sql`${schema.domains.deletedAt} IS NULL`
      ),
      with: {
        ownerContact: true,
        adminContact: true,
        techContact: true,
        billingContact: true,
        dnsRecords: true,
      },
    });
    
    if (!domain) {
      return res.status(404).json(errorResponse('Domain not found'));
    }
    
    res.json(successResponse(domain));
  }));
  
  // Update domain (nameservers, contacts, etc)
  app.patch('/api/v1/domains/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const { nameservers, privacyEnabled, autoRenew } = req.body;
    
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    
    if (!domain) {
      return res.status(404).json(errorResponse('Domain not found'));
    }
    
    // Update in OpenSRS if needed
    if (nameservers) {
      await openSRS.updateNameservers(domain.domainName, nameservers);
    }
    
    // Update local database
    const [updated] = await db.update(schema.domains)
      .set({
        ...(nameservers && { nameservers }),
        ...(privacyEnabled !== undefined && { privacyEnabled }),
        ...(autoRenew !== undefined && { autoRenew }),
        updatedAt: new Date(),
      })
      .where(eq(schema.domains.id, domain.id))
      .returning();
    
    res.json(successResponse(updated));
  }));
  
  // ============================================================================
  // HOSTING ROUTES
  // ============================================================================
  
  // Get hosting plans
  app.get('/api/v1/hosting/plans', asyncHandler(async (req, res) => {
    const plans = await db.query.hostingPlans.findMany({
      where: eq(schema.hostingPlans.isActive, true),
      orderBy: schema.hostingPlans.sortOrder,
    });
    
    res.json(successResponse(plans));
  }));
  
  // Get customer's hosting accounts
  app.get('/api/v1/hosting/accounts', requireAuth, asyncHandler(async (req, res) => {
    const accounts = await db.query.hostingAccounts.findMany({
      where: and(
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
      with: {
        plan: true,
      },
      orderBy: desc(schema.hostingAccounts.createdAt),
    });
    
    res.json(successResponse(accounts));
  }));
  
  // Get single hosting account
  app.get('/api/v1/hosting/accounts/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
      with: {
        plan: true,
      },
    });
    
    if (!account) {
      return res.status(404).json(errorResponse('Hosting account not found'));
    }
    
    res.json(successResponse(account));
  }));
  
  // ============================================================================
  // ORDER ROUTES
  // ============================================================================
  
  // Create order (cart checkout)
  app.post('/api/v1/orders', requireAuth, asyncHandler(async (req, res) => {
    const { items, couponCode } = createOrderSchema.parse(req.body);
    
    // Calculate pricing
    let subtotal = 0;
    const orderItems: any[] = [];
    
    for (const item of items) {
      let price = 0;
      let description = '';
      let configuration: any = {};
      
      if (item.type === 'domain_registration' && item.domain && item.tld) {
        const tld = await db.query.tldPricing.findFirst({
          where: eq(schema.tldPricing.tld, item.tld),
        });
        
        if (!tld) {
          return res.status(400).json(errorResponse(`Invalid TLD: ${item.tld}`));
        }
        
        price = tld.registrationPrice * item.termYears;
        description = `Domain Registration: ${item.domain}${item.tld} (${item.termYears} year${item.termYears > 1 ? 's' : ''})`;
        configuration = { domain: item.domain, tld: item.tld };
        
      } else if (item.type === 'hosting_plan' && item.planId) {
        const plan = await db.query.hostingPlans.findFirst({
          where: eq(schema.hostingPlans.id, item.planId),
        });
        
        if (!plan) {
          return res.status(400).json(errorResponse(`Invalid hosting plan`));
        }
        
        // For hosting: termYears actually means months (1 = monthly, 12 = yearly)
        const termMonths = item.termYears;
        price = termMonths >= 12 ? plan.yearlyPrice : plan.monthlyPrice * termMonths;
        description = `${plan.name} Hosting (${termMonths} month${termMonths > 1 ? 's' : ''})`;
        configuration = { planId: plan.id, planSlug: plan.slug };
      }
      
      subtotal += price;
      orderItems.push({
        type: item.type,
        description,
        unitPrice: price,
        quantity: 1,
        totalPrice: price,
        termMonths: item.termYears * (item.type === 'domain_registration' ? 12 : 1),
        configuration,
      });
    }
    
    // Apply coupon if provided
    let discountAmount = 0;
    // TODO: Implement coupon validation
    
    const total = subtotal - discountAmount;
    const orderNumber = `HB${Date.now().toString(36).toUpperCase()}`;
    
    // Create order
    const [order] = await db.insert(schema.orders).values({
      customerId: req.user!.userId,
      orderNumber,
      status: 'draft',
      subtotal,
      discountAmount,
      taxAmount: 0,
      total,
      currency: 'USD',
      couponCode,
    }).returning();
    
    // Create order items
    for (const item of orderItems) {
      await db.insert(schema.orderItems).values({
        orderId: order.id,
        ...item,
      });
    }
    
    res.status(201).json(successResponse({
      order: {
        ...order,
        items: orderItems,
      },
    }, 'Order created'));
  }));
  
  // Get customer's orders
  app.get('/api/v1/orders', requireAuth, asyncHandler(async (req, res) => {
    const orders = await db.query.orders.findMany({
      where: eq(schema.orders.customerId, req.user!.userId),
      with: {
        items: true,
      },
      orderBy: desc(schema.orders.createdAt),
    });
    
    res.json(successResponse(orders));
  }));
  
  // Get single order
  app.get('/api/v1/orders/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const order = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.uuid, req.params.uuid),
        eq(schema.orders.customerId, req.user!.userId),
      ),
      with: {
        items: {
          with: {
            domain: true,
            hostingAccount: true,
          },
        },
      },
    });
    
    if (!order) {
      return res.status(404).json(errorResponse('Order not found'));
    }
    
    res.json(successResponse(order));
  }));
  
  // Submit order for payment
  app.post('/api/v1/orders/:uuid/checkout', requireAuth, asyncHandler(async (req, res) => {
    const order = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.uuid, req.params.uuid),
        eq(schema.orders.customerId, req.user!.userId),
      ),
      with: {
        items: true,
      },
    });
    
    if (!order) {
      return res.status(404).json(errorResponse('Order not found'));
    }
    
    if (order.status !== 'draft') {
      return res.status(400).json(errorResponse('Order already processed'));
    }
    
    // Update order status
    await db.update(schema.orders)
      .set({ status: 'pending_payment', submittedAt: new Date() })
      .where(eq(schema.orders.id, order.id));
    
    // Initiate payment with SwipesBlue
    const paymentUrl = await swipesblue.createPaymentSession({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.total,
      currency: order.currency,
      customerEmail: req.user!.email,
      successUrl: `${process.env.CLIENT_URL}/checkout/success?order=${order.uuid}`,
      cancelUrl: `${process.env.CLIENT_URL}/checkout/cancel?order=${order.uuid}`,
      webhookUrl: `${process.env.APP_URL}/api/v1/webhooks/payment`,
    });
    
    res.json(successResponse({
      paymentUrl,
      orderId: order.uuid,
    }, 'Proceed to payment'));
  }));
  
  // ============================================================================
  // PAYMENT WEBHOOK
  // ============================================================================
  
  app.post('/api/v1/webhooks/payment', asyncHandler(async (req, res) => {
    const signature = req.headers['x-swipesblue-signature'];
    
    // Verify webhook signature
    if (!swipesblue.verifyWebhookSignature(req.body, signature as string)) {
      return res.status(401).json(errorResponse('Invalid signature'));
    }
    
    const { event, data } = req.body;
    
    // Store webhook event (strip sensitive headers)
    const safeHeaders = { ...req.headers };
    delete safeHeaders.authorization;
    delete safeHeaders.cookie;

    await db.insert(schema.webhookEvents).values({
      source: 'swipesblue',
      eventType: event,
      payload: data,
      headers: safeHeaders,
      idempotencyKey: data.idempotency_key,
    });
    
    switch (event) {
      case 'payment.success':
        await orchestrator.handlePaymentSuccess(data.orderId, data);
        break;
        
      case 'payment.failed':
        await orchestrator.handlePaymentFailure(data.orderId, data);
        break;
        
      case 'payment.refunded':
        await orchestrator.handlePaymentRefund(data.orderId, data);
        break;
    }
    
    res.json({ received: true });
  }));
  
  // ============================================================================
  // DASHBOARD STATS
  // ============================================================================
  
  app.get('/api/v1/dashboard/stats', requireAuth, asyncHandler(async (req, res) => {
    // Domain counts
    const domainStats = await db.select({
      status: schema.domains.status,
      count: sql<number>`count(*)`,
    })
    .from(schema.domains)
    .where(and(
      eq(schema.domains.customerId, req.user!.userId),
      sql`${schema.domains.deletedAt} IS NULL`
    ))
    .groupBy(schema.domains.status);
    
    // Hosting counts
    const hostingStats = await db.select({
      status: schema.hostingAccounts.status,
      count: sql<number>`count(*)`,
    })
    .from(schema.hostingAccounts)
    .where(and(
      eq(schema.hostingAccounts.customerId, req.user!.userId),
      sql`${schema.hostingAccounts.deletedAt} IS NULL`
    ))
    .groupBy(schema.hostingAccounts.status);
    
    // Recent orders
    const recentOrders = await db.query.orders.findMany({
      where: eq(schema.orders.customerId, req.user!.userId),
      orderBy: desc(schema.orders.createdAt),
      limit: 5,
    });
    
    // Domains expiring soon
    const expiringDomains = await db.query.domains.findMany({
      where: and(
        eq(schema.domains.customerId, req.user!.userId),
        eq(schema.domains.status, 'active'),
        sql`${schema.domains.expiryDate} < NOW() + INTERVAL '30 days'`,
        sql`${schema.domains.deletedAt} IS NULL`
      ),
      orderBy: schema.domains.expiryDate,
      limit: 5,
    });
    
    res.json(successResponse({
      domains: {
        total: domainStats.reduce((acc, s) => acc + Number(s.count), 0),
        byStatus: domainStats,
        expiringSoon: expiringDomains,
      },
      hosting: {
        total: hostingStats.reduce((acc, s) => acc + Number(s.count), 0),
        byStatus: hostingStats,
      },
      recentOrders,
    }));
  }));
  
  // ============================================================================
  // EMAIL ROUTES
  // ============================================================================

  // Get email plans (public)
  app.get('/api/v1/email/plans', asyncHandler(async (req, res) => {
    const plans = await db.query.emailPlans.findMany({
      where: eq(schema.emailPlans.isActive, true),
      orderBy: schema.emailPlans.sortOrder,
    });
    res.json(successResponse(plans));
  }));

  // Get customer's email accounts
  app.get('/api/v1/email/accounts', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const accounts = await db.query.emailAccounts.findMany({
      where: eq(schema.emailAccounts.customerId, req.user!.userId),
      with: { plan: true },
      orderBy: desc(schema.emailAccounts.createdAt),
    });
    res.json(successResponse(accounts));
  }));

  // Create email account
  app.post('/api/v1/email/accounts', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { email, planId, domainId } = req.body;
    const [account] = await db.insert(schema.emailAccounts).values({
      customerId: req.user!.userId,
      email,
      planId,
      domainId,
      status: 'active',
    }).returning();
    res.status(201).json(successResponse(account));
  }));

  // Delete email account
  app.delete('/api/v1/email/accounts/:id', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const account = await db.query.emailAccounts.findFirst({
      where: and(eq(schema.emailAccounts.id, id), eq(schema.emailAccounts.customerId, req.user!.userId)),
    });
    if (!account) return res.status(404).json(errorResponse('Email account not found'));

    await db.update(schema.emailAccounts)
      .set({ status: 'suspended' })
      .where(eq(schema.emailAccounts.id, id));
    res.json(successResponse(null, 'Email account deleted'));
  }));

  // ============================================================================
  // SSL CERTIFICATE ROUTES
  // ============================================================================

  // Get customer's SSL certificates
  app.get('/api/v1/ssl/certificates', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const certs = await db.query.sslCertificates.findMany({
      where: eq(schema.sslCertificates.customerId, req.user!.userId),
      orderBy: desc(schema.sslCertificates.createdAt),
    });
    res.json(successResponse(certs));
  }));

  // Create SSL certificate
  app.post('/api/v1/ssl/certificates', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { domainName, type } = req.body;
    const [cert] = await db.insert(schema.sslCertificates).values({
      customerId: req.user!.userId,
      domainName,
      type: type || 'dv',
      status: 'pending',
      provider: 'hostsblue',
    }).returning();
    res.status(201).json(successResponse(cert));
  }));

  // Renew SSL certificate
  app.post('/api/v1/ssl/certificates/:id/renew', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const cert = await db.query.sslCertificates.findFirst({
      where: and(eq(schema.sslCertificates.id, id), eq(schema.sslCertificates.customerId, req.user!.userId)),
    });
    if (!cert) return res.status(404).json(errorResponse('Certificate not found'));

    const [updated] = await db.update(schema.sslCertificates)
      .set({
        status: 'pending',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(schema.sslCertificates.id, id))
      .returning();
    res.json(successResponse(updated, 'Certificate renewal initiated'));
  }));

  // ============================================================================
  // SITELOCK ROUTES
  // ============================================================================

  // Get customer's SiteLock accounts
  app.get('/api/v1/sitelock/accounts', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const accounts = await db.query.sitelockAccounts.findMany({
      where: eq(schema.sitelockAccounts.customerId, req.user!.userId),
      orderBy: desc(schema.sitelockAccounts.createdAt),
    });
    res.json(successResponse(accounts));
  }));

  // Trigger SiteLock scan
  app.post('/api/v1/sitelock/accounts/:id/scan', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const account = await db.query.sitelockAccounts.findFirst({
      where: and(eq(schema.sitelockAccounts.id, id), eq(schema.sitelockAccounts.customerId, req.user!.userId)),
    });
    if (!account) return res.status(404).json(errorResponse('SiteLock account not found'));

    await db.update(schema.sitelockAccounts)
      .set({ lastScanAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.sitelockAccounts.id, id));
    res.json(successResponse(null, 'Scan initiated'));
  }));

  // ============================================================================
  // WEBSITE BUILDER ROUTES
  // ============================================================================

  // Get customer's website builder projects
  app.get('/api/v1/website-builder/projects', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const projects = await db.query.websiteProjects.findMany({
      where: eq(schema.websiteProjects.customerId, req.user!.userId),
      orderBy: desc(schema.websiteProjects.createdAt),
    });
    res.json(successResponse(projects));
  }));

  // Create website builder project
  app.post('/api/v1/website-builder/projects', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { name, template, customDomain } = req.body;
    const [project] = await db.insert(schema.websiteProjects).values({
      customerId: req.user!.userId,
      name,
      template: template || 'blank',
      customDomain,
      status: 'draft',
    }).returning();
    res.status(201).json(successResponse(project));
  }));

  // Publish website builder project
  app.post('/api/v1/website-builder/projects/:id/publish', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.id, id), eq(schema.websiteProjects.customerId, req.user!.userId)),
    });
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const [updated] = await db.update(schema.websiteProjects)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(schema.websiteProjects.id, id))
      .returning();
    res.json(successResponse(updated, 'Project published'));
  }));

  // ============================================================================
  // SUPPORT TICKET ROUTES
  // ============================================================================

  // Get customer's support tickets
  app.get('/api/v1/support/tickets', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const tickets = await db.query.supportTickets.findMany({
      where: eq(schema.supportTickets.customerId, req.user!.userId),
      orderBy: desc(schema.supportTickets.updatedAt),
    });
    res.json(successResponse(tickets));
  }));

  // Get single ticket with messages
  app.get('/api/v1/support/tickets/:uuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const ticket = await db.query.supportTickets.findFirst({
      where: and(
        eq(schema.supportTickets.uuid, req.params.uuid),
        eq(schema.supportTickets.customerId, req.user!.userId),
      ),
      with: { messages: true },
    });
    if (!ticket) return res.status(404).json(errorResponse('Ticket not found'));
    res.json(successResponse(ticket));
  }));

  // Create support ticket
  app.post('/api/v1/support/tickets', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { subject, category, priority, body } = req.body;

    const [ticket] = await db.insert(schema.supportTickets).values({
      customerId: req.user!.userId,
      subject,
      category: category || 'general',
      priority: priority || 'normal',
      status: 'open',
    }).returning();

    // Create the initial message
    if (body) {
      await db.insert(schema.ticketMessages).values({
        ticketId: ticket.id,
        senderId: req.user!.userId,
        senderType: 'customer',
        body,
      });
    }

    res.status(201).json(successResponse(ticket, 'Ticket created'));
  }));

  // Add message to ticket
  app.post('/api/v1/support/tickets/:uuid/messages', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { body } = req.body;
    const ticket = await db.query.supportTickets.findFirst({
      where: and(
        eq(schema.supportTickets.uuid, req.params.uuid),
        eq(schema.supportTickets.customerId, req.user!.userId),
      ),
    });
    if (!ticket) return res.status(404).json(errorResponse('Ticket not found'));

    const [message] = await db.insert(schema.ticketMessages).values({
      ticketId: ticket.id,
      senderId: req.user!.userId,
      senderType: 'customer',
      body,
    }).returning();

    // Update ticket timestamp
    await db.update(schema.supportTickets)
      .set({ updatedAt: new Date(), status: 'open' })
      .where(eq(schema.supportTickets.id, ticket.id));

    res.status(201).json(successResponse(message));
  }));

  // Validation error handler
  app.use((err: any, req: Request, res: Response, next: any) => {
    if (err instanceof ZodError) {
      return res.status(400).json(errorResponse(
        'Validation error',
        'VALIDATION_ERROR',
        err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      ));
    }
    next(err);
  });
}
