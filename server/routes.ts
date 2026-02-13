import { Express, Request, Response } from 'express';
import { eq, and, desc, like, sql, inArray } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from '../shared/schema.js';
import { authenticateToken, requireAuth, generateTokens } from './middleware/auth.js';
import { OpenSRSIntegration } from './services/openrs-integration.js';
import { WPMUDevIntegration } from './services/wpmudev-integration.js';
import { SwipesBluePayment } from './services/swipesblue-payment.js';
import { OrderOrchestrator } from './services/order-orchestration.js';
import { ZodError, z } from 'zod';

// Initialize services
const openSRS = new OpenSRSIntegration();
const wpmudev = new WPMUDevIntegration();
const swipesblue = new SwipesBluePayment();
const orchestrator = new OrderOrchestrator(db, openSRS, wpmudev);

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

export function registerRoutes(app: Express) {
  
  // ============================================================================
  // AUTH ROUTES
  // ============================================================================
  
  app.post('/api/v1/auth/register', asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    
    // Check if user exists
    const existing = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });
    
    if (existing) {
      return res.status(409).json(errorResponse('Email already registered', 'EMAIL_EXISTS'));
    }
    
    // Hash password (in production, use bcrypt)
    const passwordHash = await Bun.password.hash(password, 'bcrypt');
    
    // Create customer
    const [customer] = await db.insert(schema.customers).values({
      email,
      passwordHash,
      firstName,
      lastName,
    }).returning();
    
    // Generate tokens
    const tokens = generateTokens({ userId: customer.id, email: customer.email });
    
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
      tokens,
    }, 'Registration successful'));
  }));
  
  app.post('/api/v1/auth/login', asyncHandler(async (req, res) => {
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
    
    const tokens = generateTokens({ userId: customer.id, email: customer.email });
    
    res.json(successResponse({
      customer: {
        id: customer.id,
        uuid: customer.uuid,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        isAdmin: customer.isAdmin,
      },
      tokens,
    }));
  }));
  
  app.post('/api/v1/auth/refresh', authenticateToken, asyncHandler(async (req, res) => {
    const tokens = generateTokens({ userId: req.user!.userId, email: req.user!.email });
    res.json(successResponse({ tokens }));
  }));
  
  app.get('/api/v1/auth/me', requireAuth, asyncHandler(async (req, res) => {
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
        
        price = item.termYears >= 12 ? plan.yearlyPrice : plan.monthlyPrice * item.termYears;
        description = `${plan.name} Hosting (${item.termYears} month${item.termYears > 1 ? 's' : ''})`;
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
    
    // Store webhook event
    await db.insert(schema.webhookEvents).values({
      source: 'swipesblue',
      eventType: event,
      payload: data,
      headers: req.headers,
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
