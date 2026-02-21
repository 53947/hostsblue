import { Express, Request, Response } from 'express';
import { eq, and, desc, like, sql, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../shared/schema.js';
import { authenticateToken, requireAuth, generateTokens, blacklistToken } from './middleware/auth.js';
import { rateLimiter } from './middleware/rate-limit.js';
import { OpenSRSIntegration } from './services/opensrs-integration.js';
import { WPMUDevIntegration } from './services/wpmudev-integration.js';
import { SwipesBluePayment } from './services/swipesblue-payment.js';
import { OpenSRSEmailIntegration } from './services/opensrs-email-integration.js';
import { OpenSRSSSLIntegration } from './services/opensrs-ssl-integration.js';
import { SiteLockIntegration } from './services/sitelock-integration.js';
import { OrderOrchestrator } from './services/order-orchestration.js';
import { Resend } from 'resend';
import crypto from 'crypto';
import { ZodError, z } from 'zod';
import bcrypt from 'bcrypt';

// Validation schemas
const domainSearchSchema = z.object({
  domain: z.string().min(1).max(253),
});

const createOrderSchema = z.object({
  items: z.array(z.object({
    type: z.enum([
      'domain_registration', 'domain_transfer', 'domain_renewal',
      'hosting_plan', 'hosting_addon', 'privacy_protection',
      'email_service', 'ssl_certificate', 'sitelock', 'website_builder',
    ]),
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
  const opensrsEmail = new OpenSRSEmailIntegration();
  const opensrsSSL = new OpenSRSSSLIntegration();
  const sitelockService = new SiteLockIntegration();
  const orchestrator = new OrderOrchestrator(db, openSRS, wpmudev, opensrsEmail, opensrsSSL, sitelockService);
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
    const passwordHash = await bcrypt.hash(password, 10);

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
    const valid = await bcrypt.compare(password, customer.passwordHash);
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
            subject: 'Reset Your hostsblue Password',
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

    const passwordHash = await bcrypt.hash(password, 10);
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

    const valid = await bcrypt.compare(currentPassword, customer.passwordHash);
    if (!valid) {
      return res.status(400).json(errorResponse('Current password is incorrect'));
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
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
  // DNS MANAGEMENT ROUTES
  // ============================================================================

  // Get DNS records for a domain
  app.get('/api/v1/domains/:uuid/dns', requireAuth, asyncHandler(async (req, res) => {
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) return res.status(404).json(errorResponse('Domain not found'));

    const records = await db.query.dnsRecords.findMany({
      where: eq(schema.dnsRecords.domainId, domain.id),
      orderBy: [schema.dnsRecords.type, schema.dnsRecords.name],
    });

    res.json(successResponse(records));
  }));

  // Create DNS record
  app.post('/api/v1/domains/:uuid/dns', requireAuth, asyncHandler(async (req, res) => {
    const { type, name, content, ttl, priority } = req.body;
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) return res.status(404).json(errorResponse('Domain not found'));

    const [record] = await db.insert(schema.dnsRecords).values({
      domainId: domain.id,
      type,
      name: name || '@',
      content,
      ttl: ttl || 3600,
      priority: priority || null,
    }).returning();

    // Sync to OpenSRS if using our nameservers
    if (domain.useHostsBlueNameservers) {
      try {
        await openSRS.updateDnsRecords(domain.domainName, [{ type, name: name || '@', content, ttl: ttl || 3600, priority }]);
        await db.update(schema.dnsRecords)
          .set({ syncedToOpensrs: true, lastSyncAt: new Date() })
          .where(eq(schema.dnsRecords.id, record.id));
      } catch (err: any) {
        await db.update(schema.dnsRecords)
          .set({ syncError: err.message })
          .where(eq(schema.dnsRecords.id, record.id));
      }
    }

    res.status(201).json(successResponse(record));
  }));

  // Update DNS record
  app.patch('/api/v1/domains/:uuid/dns/:recordId', requireAuth, asyncHandler(async (req, res) => {
    const { content, ttl, priority } = req.body;
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) return res.status(404).json(errorResponse('Domain not found'));

    const recordId = parseInt(req.params.recordId);
    const existing = await db.query.dnsRecords.findFirst({
      where: and(eq(schema.dnsRecords.id, recordId), eq(schema.dnsRecords.domainId, domain.id)),
    });
    if (!existing) return res.status(404).json(errorResponse('DNS record not found'));

    const [updated] = await db.update(schema.dnsRecords)
      .set({
        ...(content !== undefined && { content }),
        ...(ttl !== undefined && { ttl }),
        ...(priority !== undefined && { priority }),
        syncedToOpensrs: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.dnsRecords.id, recordId))
      .returning();

    // Re-sync to OpenSRS
    if (domain.useHostsBlueNameservers) {
      try {
        const allRecords = await db.query.dnsRecords.findMany({
          where: and(eq(schema.dnsRecords.domainId, domain.id), eq(schema.dnsRecords.isActive, true)),
        });
        await openSRS.updateDnsRecords(domain.domainName, allRecords.map(r => ({
          type: r.type, name: r.name, content: r.content, ttl: r.ttl, priority: r.priority ?? undefined,
        })));
        await db.update(schema.dnsRecords)
          .set({ syncedToOpensrs: true, lastSyncAt: new Date(), syncError: null })
          .where(eq(schema.dnsRecords.id, recordId));
      } catch (err: any) {
        await db.update(schema.dnsRecords)
          .set({ syncError: err.message })
          .where(eq(schema.dnsRecords.id, recordId));
      }
    }

    res.json(successResponse(updated));
  }));

  // Delete DNS record
  app.delete('/api/v1/domains/:uuid/dns/:recordId', requireAuth, asyncHandler(async (req, res) => {
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) return res.status(404).json(errorResponse('Domain not found'));

    const recordId = parseInt(req.params.recordId);
    const existing = await db.query.dnsRecords.findFirst({
      where: and(eq(schema.dnsRecords.id, recordId), eq(schema.dnsRecords.domainId, domain.id)),
    });
    if (!existing) return res.status(404).json(errorResponse('DNS record not found'));

    await db.delete(schema.dnsRecords).where(eq(schema.dnsRecords.id, recordId));

    // Re-sync remaining records
    if (domain.useHostsBlueNameservers) {
      try {
        const remaining = await db.query.dnsRecords.findMany({
          where: and(eq(schema.dnsRecords.domainId, domain.id), eq(schema.dnsRecords.isActive, true)),
        });
        await openSRS.updateDnsRecords(domain.domainName, remaining.map(r => ({
          type: r.type, name: r.name, content: r.content, ttl: r.ttl, priority: r.priority ?? undefined,
        })));
      } catch (err: any) {
        console.error(`DNS sync error after delete for ${domain.domainName}:`, err);
      }
    }

    res.json(successResponse(null, 'DNS record deleted'));
  }));

  // Sync all DNS records with OpenSRS
  app.post('/api/v1/domains/:uuid/dns/sync', requireAuth, asyncHandler(async (req, res) => {
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(schema.domains.uuid, req.params.uuid),
        eq(schema.domains.customerId, req.user!.userId),
      ),
    });
    if (!domain) return res.status(404).json(errorResponse('Domain not found'));

    const remoteRecords = await openSRS.getDnsRecords(domain.domainName);

    res.json(successResponse({
      localRecords: await db.query.dnsRecords.findMany({
        where: eq(schema.dnsRecords.domainId, domain.id),
      }),
      remoteRecords,
    }));
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

  // Trigger hosting backup
  app.post('/api/v1/hosting/accounts/:uuid/backup', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    if (account.wpmudevSiteId) {
      await wpmudev.createBackup(account.wpmudevSiteId);
    }

    await db.update(schema.hostingAccounts)
      .set({ lastBackupAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.hostingAccounts.id, account.id));

    res.json(successResponse(null, 'Backup initiated'));
  }));

  // List hosting backups
  app.get('/api/v1/hosting/accounts/:uuid/backups', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    let backups: any[] = [];
    if (account.wpmudevSiteId) {
      backups = await wpmudev.listBackups(account.wpmudevSiteId);
    }

    res.json(successResponse(backups));
  }));

  // Restore from backup
  app.post('/api/v1/hosting/accounts/:uuid/restore/:backupId', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    if (!account.wpmudevSiteId) {
      return res.status(400).json(errorResponse('Hosting account not provisioned'));
    }

    await wpmudev.restoreBackup(account.wpmudevSiteId, req.params.backupId);

    await db.insert(schema.auditLogs).values({
      customerId: req.user!.userId,
      action: 'hosting_backup_restored',
      entityType: 'hosting_account',
      entityId: String(account.id),
      description: `Restored backup ${req.params.backupId} for ${account.primaryDomain}`,
      ipAddress: req.ip,
    });

    res.json(successResponse(null, 'Backup restore initiated'));
  }));

  // Clear hosting cache
  app.delete('/api/v1/hosting/accounts/:uuid/cache', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    if (account.wpmudevSiteId) {
      await wpmudev.clearCache(account.wpmudevSiteId);
    }

    res.json(successResponse(null, 'Cache cleared'));
  }));

  // Toggle staging environment
  app.post('/api/v1/hosting/accounts/:uuid/staging', requireAuth, asyncHandler(async (req, res) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    if (!account.wpmudevSiteId) {
      return res.status(400).json(errorResponse('Hosting account not provisioned'));
    }

    await wpmudev.toggleStaging(account.wpmudevSiteId, enabled);

    res.json(successResponse({ enabled }, `Staging ${enabled ? 'enabled' : 'disabled'}`));
  }));

  // Get hosting usage stats
  app.get('/api/v1/hosting/accounts/:uuid/stats', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.hostingAccounts.findFirst({
      where: and(
        eq(schema.hostingAccounts.uuid, req.params.uuid),
        eq(schema.hostingAccounts.customerId, req.user!.userId),
        sql`${schema.hostingAccounts.deletedAt} IS NULL`
      ),
      with: { plan: true },
    });
    if (!account) return res.status(404).json(errorResponse('Hosting account not found'));

    let liveStats: any = null;
    if (account.wpmudevSiteId) {
      liveStats = await wpmudev.getSiteStats(account.wpmudevSiteId);
    }

    res.json(successResponse({
      storageUsedMB: account.storageUsedMB,
      bandwidthUsedMB: account.bandwidthUsedMB,
      lastStatsUpdate: account.lastStatsUpdate,
      plan: account.plan,
      liveStats,
    }));
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

        const termMonths = item.termYears;
        price = termMonths >= 12 ? plan.yearlyPrice : plan.monthlyPrice * termMonths;
        description = `${plan.name} Hosting (${termMonths} month${termMonths > 1 ? 's' : ''})`;
        configuration = { planId: plan.id, planSlug: plan.slug };

      } else if (item.type === 'domain_transfer' && item.domain && item.tld) {
        const tld = await db.query.tldPricing.findFirst({
          where: eq(schema.tldPricing.tld, item.tld),
        });
        if (!tld) {
          return res.status(400).json(errorResponse(`Invalid TLD: ${item.tld}`));
        }
        price = tld.transferPrice;
        description = `Domain Transfer: ${item.domain}${item.tld}`;
        configuration = { domain: item.domain, tld: item.tld, authCode: item.options?.authCode };

      } else if (item.type === 'domain_renewal' && item.domain && item.tld) {
        const tld = await db.query.tldPricing.findFirst({
          where: eq(schema.tldPricing.tld, item.tld),
        });
        if (!tld) {
          return res.status(400).json(errorResponse(`Invalid TLD: ${item.tld}`));
        }
        price = tld.renewalPrice * item.termYears;
        description = `Domain Renewal: ${item.domain}${item.tld} (${item.termYears} year${item.termYears > 1 ? 's' : ''})`;
        configuration = { domain: item.domain, tld: item.tld, domainName: `${item.domain}${item.tld}`, domainId: item.options?.domainId };

      } else if (item.type === 'email_service' && item.planId) {
        const emailPlan = await db.query.emailPlans.findFirst({
          where: eq(schema.emailPlans.id, item.planId),
        });
        if (!emailPlan) {
          return res.status(400).json(errorResponse('Invalid email plan'));
        }
        const termMonths = item.termYears;
        price = termMonths >= 12 ? emailPlan.yearlyPrice : emailPlan.monthlyPrice * termMonths;
        description = `${emailPlan.name} Email (${termMonths} month${termMonths > 1 ? 's' : ''})`;
        configuration = { planId: emailPlan.id, domain: item.domain, username: item.options?.username || 'admin', storageQuotaMB: (emailPlan.storageGB || 1) * 1024 };

      } else if (item.type === 'ssl_certificate') {
        const sslPrice = item.options?.price || 4999;
        price = sslPrice * item.termYears;
        const productType = item.options?.productType || 'dv';
        description = `SSL Certificate (${productType.toUpperCase()}) - ${item.domain || 'TBD'} (${item.termYears} year${item.termYears > 1 ? 's' : ''})`;
        configuration = { domain: item.domain, productType, provider: item.options?.provider || 'sectigo', termYears: item.termYears, approverEmail: item.options?.approverEmail, productId: item.options?.productId };

      } else if (item.type === 'sitelock') {
        const slPrice = item.options?.price || 1999;
        const termMonths = item.termYears;
        price = slPrice * termMonths;
        const planSlug = item.options?.planSlug || 'basic';
        description = `SiteLock ${planSlug.charAt(0).toUpperCase() + planSlug.slice(1)} - ${item.domain || 'TBD'} (${termMonths} month${termMonths > 1 ? 's' : ''})`;
        configuration = { domain: item.domain, planSlug, domainId: item.options?.domainId };

      } else if (item.type === 'privacy_protection' && item.domain && item.tld) {
        const tld = await db.query.tldPricing.findFirst({
          where: eq(schema.tldPricing.tld, item.tld),
        });
        if (!tld || !tld.supportsPrivacy) {
          return res.status(400).json(errorResponse(`Privacy not available for ${item.tld}`));
        }
        price = (tld.privacyPrice || 0) * item.termYears;
        description = `WHOIS Privacy: ${item.domain}${item.tld} (${item.termYears} year${item.termYears > 1 ? 's' : ''})`;
        configuration = { domain: item.domain, tld: item.tld, domainId: item.options?.domainId };
      }

      subtotal += price;
      const isDomainType = ['domain_registration', 'domain_transfer', 'domain_renewal', 'privacy_protection'].includes(item.type);
      orderItems.push({
        type: item.type,
        description,
        unitPrice: price,
        quantity: 1,
        totalPrice: price,
        termMonths: isDomainType ? item.termYears * 12 : item.termYears,
        configuration,
      });
    }
    
    // Apply coupon if provided
    let discountAmount = 0;
    // Coupon validation deferred — no active coupon system yet
    
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
    
    // Email account count
    const emailCount = await db.select({
      count: sql<number>`count(*)`,
    })
    .from(schema.emailAccounts)
    .where(and(
      eq(schema.emailAccounts.customerId, req.user!.userId),
      eq(schema.emailAccounts.status, 'active'),
      sql`${schema.emailAccounts.deletedAt} IS NULL`
    ));

    // SSL certificate count
    const sslCount = await db.select({
      count: sql<number>`count(*)`,
    })
    .from(schema.sslCertificates)
    .where(eq(schema.sslCertificates.customerId, req.user!.userId));

    // SiteLock account count
    const sitelockCount = await db.select({
      count: sql<number>`count(*)`,
    })
    .from(schema.sitelockAccounts)
    .where(and(
      eq(schema.sitelockAccounts.customerId, req.user!.userId),
      eq(schema.sitelockAccounts.status, 'active'),
      sql`${schema.sitelockAccounts.deletedAt} IS NULL`
    ));

    // SSL certificates expiring within 30 days
    const sslExpiring = await db.query.sslCertificates.findMany({
      where: and(
        eq(schema.sslCertificates.customerId, req.user!.userId),
        sql`${schema.sslCertificates.status} = 'issued'`,
        sql`${schema.sslCertificates.expiresAt} IS NOT NULL`,
        sql`${schema.sslCertificates.expiresAt} < NOW() + INTERVAL '30 days'`
      ),
      orderBy: schema.sslCertificates.expiresAt,
      limit: 5,
    });

    // Active SSL certs
    const sslActiveCount = await db.select({
      count: sql<number>`count(*)`,
    })
    .from(schema.sslCertificates)
    .where(and(
      eq(schema.sslCertificates.customerId, req.user!.userId),
      sql`${schema.sslCertificates.status} IN ('issued', 'pending')`
    ));

    // Monthly spend estimate (sum of active subscriptions)
    const monthlySpend = await db.select({
      total: sql<number>`COALESCE(SUM(CASE WHEN ${schema.hostingPlans.monthlyPrice} IS NOT NULL THEN ${schema.hostingPlans.monthlyPrice} ELSE 0 END), 0)`,
    })
    .from(schema.hostingAccounts)
    .leftJoin(schema.hostingPlans, eq(schema.hostingAccounts.planId, schema.hostingPlans.id))
    .where(and(
      eq(schema.hostingAccounts.customerId, req.user!.userId),
      eq(schema.hostingAccounts.status, 'active'),
      sql`${schema.hostingAccounts.deletedAt} IS NULL`
    ));

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
      email: {
        total: Number(emailCount[0]?.count || 0),
      },
      ssl: {
        total: Number(sslCount[0]?.count || 0),
        active: Number(sslActiveCount[0]?.count || 0),
        expiringSoon: sslExpiring,
      },
      sitelock: {
        total: Number(sitelockCount[0]?.count || 0),
      },
      recentOrders,
      monthlySpendEstimate: Number(monthlySpend[0]?.total || 0),
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
  app.get('/api/v1/email/accounts', requireAuth, asyncHandler(async (req, res) => {
    const accounts = await db.query.emailAccounts.findMany({
      where: and(
        eq(schema.emailAccounts.customerId, req.user!.userId),
        sql`${schema.emailAccounts.deletedAt} IS NULL`
      ),
      with: { plan: true, domain: true },
      orderBy: desc(schema.emailAccounts.createdAt),
    });
    res.json(successResponse(accounts));
  }));

  // Get single email account
  app.get('/api/v1/email/accounts/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(schema.emailAccounts.uuid, req.params.uuid),
        eq(schema.emailAccounts.customerId, req.user!.userId),
        sql`${schema.emailAccounts.deletedAt} IS NULL`
      ),
      with: { plan: true, domain: true },
    });
    if (!account) return res.status(404).json(errorResponse('Email account not found'));

    // Fetch live usage from OpenSRS
    let usage: any = null;
    if (account.mailDomain && account.username) {
      try {
        usage = await opensrsEmail.getMailboxUsage(account.mailDomain, account.username);
      } catch { /* non-critical */ }
    }

    res.json(successResponse({ ...account, usage }));
  }));

  // Create email account (provisions through OpenSRS)
  app.post('/api/v1/email/accounts', requireAuth, asyncHandler(async (req, res) => {
    const createEmailSchema = z.object({
      domain: z.string().min(1).max(253),
      username: z.string().min(1).max(64),
      password: z.string().min(8).max(128).optional(),
      planId: z.number().optional(),
      domainId: z.number().optional(),
      storageQuotaMB: z.number().optional(),
      forwardingAddress: z.string().email().optional(),
    });
    const data = createEmailSchema.parse(req.body);

    // Ensure mail domain exists
    try {
      await opensrsEmail.createMailDomain(data.domain);
    } catch { /* may already exist */ }

    // Create mailbox in OpenSRS
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, req.user!.userId),
    });
    const generatedPassword = data.password || crypto.randomBytes(16).toString('base64url');
    const mailboxResult = await opensrsEmail.createMailbox(data.domain, data.username, generatedPassword, {
      storageQuotaMB: data.storageQuotaMB,
      firstName: customer?.firstName || undefined,
      lastName: customer?.lastName || undefined,
      forwardingAddress: data.forwardingAddress,
    });

    const [account] = await db.insert(schema.emailAccounts).values({
      customerId: req.user!.userId,
      email: `${data.username}@${data.domain}`,
      planId: data.planId || 1,
      domainId: data.domainId || null,
      status: 'active',
      openSrsMailboxId: mailboxResult.email || `${data.username}@${data.domain}`,
      mailDomain: data.domain,
      username: data.username,
      forwardingAddress: data.forwardingAddress || null,
    }).returning();

    await db.insert(schema.auditLogs).values({
      customerId: req.user!.userId,
      action: 'email_account_created',
      entityType: 'email_account',
      entityId: String(account.id),
      description: `Created email account ${data.username}@${data.domain}`,
      ipAddress: req.ip,
    });

    res.status(201).json(successResponse(account, 'Email account created'));
  }));

  // Update email account settings
  app.patch('/api/v1/email/accounts/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const updateEmailSchema = z.object({
      password: z.string().min(8).max(128).optional(),
      forwardingAddress: z.string().email().nullable().optional(),
      spamFilterLevel: z.enum(['low', 'medium', 'high']).optional(),
      autoResponderEnabled: z.boolean().optional(),
      autoResponder: z.object({
        enabled: z.boolean(),
        subject: z.string(),
        body: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
    });
    const updates = updateEmailSchema.parse(req.body);

    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(schema.emailAccounts.uuid, req.params.uuid),
        eq(schema.emailAccounts.customerId, req.user!.userId),
        sql`${schema.emailAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Email account not found'));

    // Push changes to OpenSRS
    if (account.mailDomain && account.username) {
      const mailboxUpdates: Record<string, any> = {};
      if (updates.password) mailboxUpdates.password = updates.password;
      if (updates.forwardingAddress !== undefined) mailboxUpdates.forwardingAddress = updates.forwardingAddress || '';
      if (updates.autoResponder) {
        mailboxUpdates.autoResponder = {
          ...updates.autoResponder,
          ...(updates.autoResponder.startDate && { startDate: new Date(updates.autoResponder.startDate) }),
          ...(updates.autoResponder.endDate && { endDate: new Date(updates.autoResponder.endDate) }),
        };
      }
      if (Object.keys(mailboxUpdates).length > 0) {
        await opensrsEmail.updateMailbox(account.mailDomain, account.username, mailboxUpdates);
      }
      if (updates.spamFilterLevel) {
        await opensrsEmail.updateSpamSettings(account.mailDomain, account.username, {
          spamFilterLevel: updates.spamFilterLevel,
        });
      }
    }

    const autoResponderEnabled = updates.autoResponder?.enabled ?? updates.autoResponderEnabled;
    const [updated] = await db.update(schema.emailAccounts)
      .set({
        ...(updates.forwardingAddress !== undefined && { forwardingAddress: updates.forwardingAddress }),
        ...(updates.spamFilterLevel !== undefined && { spamFilterLevel: updates.spamFilterLevel }),
        ...(autoResponderEnabled !== undefined && { autoResponderEnabled }),
        updatedAt: new Date(),
      })
      .where(eq(schema.emailAccounts.id, account.id))
      .returning();

    res.json(successResponse(updated));
  }));

  // Delete email account
  app.delete('/api/v1/email/accounts/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(schema.emailAccounts.uuid, req.params.uuid),
        eq(schema.emailAccounts.customerId, req.user!.userId),
        sql`${schema.emailAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('Email account not found'));

    // Delete from OpenSRS
    if (account.mailDomain && account.username) {
      try {
        await opensrsEmail.deleteMailbox(account.mailDomain, account.username);
      } catch { /* best effort */ }
    }

    await db.update(schema.emailAccounts)
      .set({ status: 'suspended', deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.emailAccounts.id, account.id));

    await db.insert(schema.auditLogs).values({
      customerId: req.user!.userId,
      action: 'email_account_deleted',
      entityType: 'email_account',
      entityId: String(account.id),
      description: `Deleted email account ${account.email}`,
      ipAddress: req.ip,
    });

    res.json(successResponse(null, 'Email account deleted'));
  }));

  // ============================================================================
  // SSL CERTIFICATE ROUTES
  // ============================================================================

  // Get available SSL products
  app.get('/api/v1/ssl/products', asyncHandler(async (req, res) => {
    const products = await opensrsSSL.getProducts();
    res.json(successResponse(products));
  }));

  // Get customer's SSL certificates
  app.get('/api/v1/ssl/certificates', requireAuth, asyncHandler(async (req, res) => {
    const certs = await db.query.sslCertificates.findMany({
      where: eq(schema.sslCertificates.customerId, req.user!.userId),
      orderBy: desc(schema.sslCertificates.createdAt),
    });
    res.json(successResponse(certs));
  }));

  // Get single SSL certificate
  app.get('/api/v1/ssl/certificates/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const cert = await db.query.sslCertificates.findFirst({
      where: and(
        eq(schema.sslCertificates.uuid, req.params.uuid),
        eq(schema.sslCertificates.customerId, req.user!.userId),
      ),
    });
    if (!cert) return res.status(404).json(errorResponse('Certificate not found'));

    // Fetch live DCV status from OpenSRS
    let dcvStatus: any = null;
    if (cert.openSrsOrderId && cert.status === 'pending') {
      try {
        dcvStatus = await opensrsSSL.getDcvStatus(cert.openSrsOrderId);
      } catch { /* non-critical */ }
    }

    res.json(successResponse({ ...cert, liveDcvStatus: dcvStatus }));
  }));

  // Order SSL certificate (provisions through OpenSRS)
  app.post('/api/v1/ssl/certificates', requireAuth, asyncHandler(async (req, res) => {
    const orderSslSchema = z.object({
      domainName: z.string().min(1).max(253),
      productType: z.enum(['dv', 'ov', 'ev', 'wildcard', 'san']).default('dv'),
      provider: z.string().default('sectigo'),
      csr: z.string().optional(),
      approverEmail: z.string().email().optional(),
      termYears: z.number().min(1).max(3).default(1),
      domainId: z.number().optional(),
      productId: z.string().optional(),
    });
    const { domainName, productType, provider, csr, approverEmail, termYears, domainId, productId } = orderSslSchema.parse(req.body);

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, req.user!.userId),
    });
    if (!customer) return res.status(404).json(errorResponse('Customer not found'));

    const orderResult = await opensrsSSL.orderCertificate({
      productType: productType || 'dv',
      provider: provider || 'sectigo',
      domain: domainName,
      period: termYears || 1,
      csr: csr || '',
      approverEmail: approverEmail || customer.email,
      contacts: {
        admin: {
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          email: customer.email,
          phone: customer.phone || '',
        },
      },
    });

    const [cert] = await db.insert(schema.sslCertificates).values({
      customerId: req.user!.userId,
      domainId: domainId || null,
      domainName,
      type: productType || 'dv',
      provider: provider || 'sectigo',
      status: 'pending',
      openSrsOrderId: orderResult.orderId,
      productId: productId || null,
      providerName: provider || 'sectigo',
      validationLevel: productType || 'dv',
      csrPem: csr || null,
      approverEmail: approverEmail || customer.email,
      dcvMethod: 'email',
      dcvStatus: 'pending',
      termYears: termYears || 1,
    }).returning();

    res.status(201).json(successResponse(cert, 'SSL certificate ordered'));
  }));

  // Generate CSR for a certificate
  app.post('/api/v1/ssl/certificates/:uuid/generate-csr', requireAuth, asyncHandler(async (req, res) => {
    const cert = await db.query.sslCertificates.findFirst({
      where: and(
        eq(schema.sslCertificates.uuid, req.params.uuid),
        eq(schema.sslCertificates.customerId, req.user!.userId),
      ),
    });
    if (!cert) return res.status(404).json(errorResponse('Certificate not found'));

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, req.user!.userId),
    });

    const { commonName, organization, country, state, locality } = req.body;
    const csrResult = await opensrsSSL.generateCSR({
      domain: commonName || cert.domainName || '',
      organization: organization || customer?.companyName || customer?.firstName || '',
      country: country || customer?.countryCode || 'US',
      state: state || customer?.state || '',
      city: locality || customer?.city || '',
    });

    // Store CSR and encrypted private key
    await db.update(schema.sslCertificates)
      .set({
        csrPem: csrResult.csr,
        privateKeyEncrypted: csrResult.privateKey,
        updatedAt: new Date(),
      })
      .where(eq(schema.sslCertificates.id, cert.id));

    res.json(successResponse({ csr: csrResult.csr }, 'CSR generated'));
  }));

  // Reissue SSL certificate
  app.post('/api/v1/ssl/certificates/:uuid/reissue', requireAuth, asyncHandler(async (req, res) => {
    const cert = await db.query.sslCertificates.findFirst({
      where: and(
        eq(schema.sslCertificates.uuid, req.params.uuid),
        eq(schema.sslCertificates.customerId, req.user!.userId),
      ),
    });
    if (!cert || !cert.openSrsOrderId) return res.status(404).json(errorResponse('Certificate not found'));

    const { newCsr } = req.body;
    if (!newCsr) return res.status(400).json(errorResponse('New CSR is required'));

    await opensrsSSL.reissueCertificate(cert.openSrsOrderId, newCsr);

    await db.update(schema.sslCertificates)
      .set({ csrPem: newCsr, status: 'pending', dcvStatus: 'pending', updatedAt: new Date() })
      .where(eq(schema.sslCertificates.id, cert.id));

    res.json(successResponse(null, 'Certificate reissue initiated'));
  }));

  // Generate CSR (standalone — not tied to an existing certificate)
  app.post('/api/v1/ssl/generate-csr', requireAuth, asyncHandler(async (req, res) => {
    const generateCsrSchema = z.object({
      domain: z.string().min(1).max(253),
      organization: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().max(2).optional(),
    });
    const data = generateCsrSchema.parse(req.body);

    const csrResult = await opensrsSSL.generateCSR(data);
    res.json(successResponse({ csr: csrResult.csr, privateKeyEncrypted: csrResult.privateKey }, 'CSR generated'));
  }));

  // Resend DCV email
  app.post('/api/v1/ssl/certificates/:uuid/resend-dcv', requireAuth, asyncHandler(async (req, res) => {
    const cert = await db.query.sslCertificates.findFirst({
      where: and(
        eq(schema.sslCertificates.uuid, req.params.uuid),
        eq(schema.sslCertificates.customerId, req.user!.userId),
      ),
    });
    if (!cert || !cert.openSrsOrderId) return res.status(404).json(errorResponse('Certificate not found'));

    await opensrsSSL.resendDcvEmail(cert.openSrsOrderId);

    res.json(successResponse(null, 'DCV email resent'));
  }));

  // ============================================================================
  // SITELOCK ROUTES
  // ============================================================================

  // Get SiteLock plans
  app.get('/api/v1/sitelock/plans', asyncHandler(async (_req, res) => {
    const plans = [
      {
        slug: 'basic',
        name: 'SiteLock Basic',
        monthlyPrice: 1999,
        yearlyPrice: 19990,
        features: ['Daily malware scan', 'Trust seal', 'Up to 5 pages'],
      },
      {
        slug: 'professional',
        name: 'SiteLock Professional',
        monthlyPrice: 3999,
        yearlyPrice: 39990,
        features: ['Daily malware scan', 'Automatic malware removal', 'Trust seal', 'WAF protection', 'Up to 500 pages'],
      },
      {
        slug: 'enterprise',
        name: 'SiteLock Enterprise',
        monthlyPrice: 7999,
        yearlyPrice: 79990,
        features: ['Continuous malware scan', 'Automatic malware removal', 'Trust seal', 'WAF protection', 'DDoS protection', 'Unlimited pages'],
      },
    ];
    res.json(successResponse(plans));
  }));

  // Get customer's SiteLock accounts
  app.get('/api/v1/sitelock/accounts', requireAuth, asyncHandler(async (req, res) => {
    const accounts = await db.query.sitelockAccounts.findMany({
      where: and(
        eq(schema.sitelockAccounts.customerId, req.user!.userId),
        sql`${schema.sitelockAccounts.deletedAt} IS NULL`
      ),
      with: { domain: true },
      orderBy: desc(schema.sitelockAccounts.createdAt),
    });
    res.json(successResponse(accounts));
  }));

  // Get single SiteLock account with scan results
  app.get('/api/v1/sitelock/accounts/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.sitelockAccounts.findFirst({
      where: and(
        eq(schema.sitelockAccounts.uuid, req.params.uuid),
        eq(schema.sitelockAccounts.customerId, req.user!.userId),
        sql`${schema.sitelockAccounts.deletedAt} IS NULL`
      ),
      with: { domain: true },
    });
    if (!account) return res.status(404).json(errorResponse('SiteLock account not found'));

    // Fetch live scan results if we have a SiteLock account ID
    let scanResults: any = null;
    if (account.sitelockAccountId) {
      try {
        scanResults = await sitelockService.getScanResults(account.sitelockAccountId);
      } catch { /* non-critical */ }
    }

    res.json(successResponse({ ...account, scanResults }));
  }));

  // Trigger SiteLock scan
  app.post('/api/v1/sitelock/accounts/:uuid/scan', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.sitelockAccounts.findFirst({
      where: and(
        eq(schema.sitelockAccounts.uuid, req.params.uuid),
        eq(schema.sitelockAccounts.customerId, req.user!.userId),
        sql`${schema.sitelockAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('SiteLock account not found'));

    let scanResult: any = null;
    if (account.sitelockAccountId) {
      scanResult = await sitelockService.initiateScan(account.sitelockAccountId, req.body.scanType || 'full');
    }

    await db.update(schema.sitelockAccounts)
      .set({ lastScanAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.sitelockAccounts.id, account.id));

    res.json(successResponse(scanResult, 'Scan initiated'));
  }));

  // Get trust seal
  app.get('/api/v1/sitelock/accounts/:uuid/seal', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.sitelockAccounts.findFirst({
      where: and(
        eq(schema.sitelockAccounts.uuid, req.params.uuid),
        eq(schema.sitelockAccounts.customerId, req.user!.userId),
        sql`${schema.sitelockAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('SiteLock account not found'));

    if (!account.sitelockAccountId) {
      return res.status(400).json(errorResponse('SiteLock account not provisioned'));
    }

    const seal = await sitelockService.getTrustSeal(account.sitelockAccountId);
    res.json(successResponse(seal));
  }));

  // Toggle firewall
  app.post('/api/v1/sitelock/accounts/:uuid/firewall', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.sitelockAccounts.findFirst({
      where: and(
        eq(schema.sitelockAccounts.uuid, req.params.uuid),
        eq(schema.sitelockAccounts.customerId, req.user!.userId),
        sql`${schema.sitelockAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('SiteLock account not found'));

    if (!account.sitelockAccountId) {
      return res.status(400).json(errorResponse('SiteLock account not provisioned'));
    }

    const enabled = req.body.enabled !== false;
    await sitelockService.toggleFirewall(account.sitelockAccountId, enabled);

    await db.update(schema.sitelockAccounts)
      .set({ firewallEnabled: enabled, updatedAt: new Date() })
      .where(eq(schema.sitelockAccounts.id, account.id));

    res.json(successResponse({ enabled }, `Firewall ${enabled ? 'enabled' : 'disabled'}`));
  }));

  // Get firewall status
  app.get('/api/v1/sitelock/accounts/:uuid/firewall', requireAuth, asyncHandler(async (req, res) => {
    const account = await db.query.sitelockAccounts.findFirst({
      where: and(
        eq(schema.sitelockAccounts.uuid, req.params.uuid),
        eq(schema.sitelockAccounts.customerId, req.user!.userId),
        sql`${schema.sitelockAccounts.deletedAt} IS NULL`
      ),
    });
    if (!account) return res.status(404).json(errorResponse('SiteLock account not found'));

    if (!account.sitelockAccountId) {
      return res.status(400).json(errorResponse('SiteLock account not provisioned'));
    }

    const status = await sitelockService.getFirewallStatus(account.sitelockAccountId);
    res.json(successResponse(status));
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

  // ============================================================================
  // WEBHOOK HANDLERS (Phase 6)
  // ============================================================================

  // OpenSRS Domain webhook (transfer status, renewal notifications, expiry alerts)
  app.post('/api/v1/webhooks/opensrs', asyncHandler(async (req, res) => {
    const safeHeaders = { ...req.headers };
    delete safeHeaders.authorization;
    delete safeHeaders.cookie;

    const idempotencyKey = req.body.id ? `opensrs-${req.body.id}` : `opensrs-${crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')}`;

    // Check idempotency — skip if already processed
    const existing = await db.query.webhookEvents.findFirst({
      where: and(
        eq(schema.webhookEvents.idempotencyKey, idempotencyKey),
        eq(schema.webhookEvents.status, 'processed'),
      ),
    });
    if (existing) {
      return res.json({ received: true, duplicate: true });
    }

    const [webhookEvent] = await db.insert(schema.webhookEvents).values({
      source: 'opensrs',
      eventType: req.body.action || req.body.type || 'unknown',
      payload: req.body,
      headers: safeHeaders,
      idempotencyKey,
    }).returning();

    const action = req.body.action || req.body.type || '';
    const data = req.body.attributes || req.body.data || req.body;

    switch (action) {
      case 'TRANSFER_COMPLETED':
      case 'transfer_completed': {
        const domainName = data.domain || data.domain_name;
        if (domainName) {
          const [domain] = await db.update(schema.domains)
            .set({
              status: 'active',
              transferStatus: 'completed',
              registrationDate: new Date(),
              expiryDate: data.expiry_date ? new Date(data.expiry_date) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              isTransfer: true,
              updatedAt: new Date(),
            })
            .where(eq(schema.domains.domainName, domainName))
            .returning();

          if (domain) {
            await db.insert(schema.auditLogs).values({
              customerId: domain.customerId,
              action: 'domain_transfer_completed',
              entityType: 'domain',
              entityId: String(domain.id),
              description: `Domain transfer completed for ${domainName}`,
            });

            // Notify customer via email
            if (resend) {
              const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, domain.customerId) });
              if (customer) {
                try {
                  await resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
                    to: customer.email,
                    subject: `Domain Transfer Complete: ${domainName}`,
                    html: `<p>Your domain transfer for <strong>${domainName}</strong> has been completed successfully. You can now manage it from your <a href="${process.env.CLIENT_URL}/dashboard/domains">hostsblue dashboard</a>.</p>`,
                  });
                } catch { /* non-critical */ }
              }
            }
          }
        }
        break;
      }

      case 'TRANSFER_FAILED':
      case 'transfer_failed': {
        const domainName = data.domain || data.domain_name;
        if (domainName) {
          const [domain] = await db.update(schema.domains)
            .set({
              status: 'pending',
              transferStatus: 'failed',
              updatedAt: new Date(),
            })
            .where(eq(schema.domains.domainName, domainName))
            .returning();

          if (domain) {
            await db.insert(schema.auditLogs).values({
              customerId: domain.customerId,
              action: 'domain_transfer_failed',
              entityType: 'domain',
              entityId: String(domain.id),
              description: `Domain transfer failed for ${domainName}: ${data.reason || 'Unknown reason'}`,
            });

            if (resend) {
              const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, domain.customerId) });
              if (customer) {
                try {
                  await resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
                    to: customer.email,
                    subject: `Domain Transfer Failed: ${domainName}`,
                    html: `<p>The transfer for <strong>${domainName}</strong> has failed. Reason: ${data.reason || 'Please contact support for details.'}. Visit your <a href="${process.env.CLIENT_URL}/dashboard/domains">hostsblue dashboard</a> to retry.</p>`,
                  });
                } catch { /* non-critical */ }
              }
            }
          }
        }
        break;
      }

      case 'DOMAIN_RENEWED':
      case 'domain_renewed':
      case 'auto_renewed': {
        const domainName = data.domain || data.domain_name;
        if (domainName) {
          const [domain] = await db.update(schema.domains)
            .set({
              status: 'active',
              expiryDate: data.new_expiry_date ? new Date(data.new_expiry_date) : undefined,
              updatedAt: new Date(),
            })
            .where(eq(schema.domains.domainName, domainName))
            .returning();

          if (domain) {
            await db.insert(schema.auditLogs).values({
              customerId: domain.customerId,
              action: 'domain_renewed',
              entityType: 'domain',
              entityId: String(domain.id),
              description: `Domain ${domainName} auto-renewed`,
            });
          }
        }
        break;
      }

      case 'DOMAIN_EXPIRED':
      case 'domain_expired': {
        const domainName = data.domain || data.domain_name;
        if (domainName) {
          const [domain] = await db.update(schema.domains)
            .set({
              status: 'expired',
              updatedAt: new Date(),
            })
            .where(eq(schema.domains.domainName, domainName))
            .returning();

          if (domain) {
            await db.insert(schema.auditLogs).values({
              customerId: domain.customerId,
              action: 'domain_expired',
              entityType: 'domain',
              entityId: String(domain.id),
              description: `Domain ${domainName} has expired`,
            });
          }
        }
        break;
      }

      case 'ABOUT_TO_EXPIRE':
      case 'about_to_expire': {
        const domainName = data.domain || data.domain_name;
        if (domainName && resend) {
          const domain = await db.query.domains.findFirst({
            where: eq(schema.domains.domainName, domainName),
          });
          if (domain) {
            const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, domain.customerId) });
            if (customer) {
              try {
                await resend.emails.send({
                  from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
                  to: customer.email,
                  subject: `Domain Expiring Soon: ${domainName}`,
                  html: `<p>Your domain <strong>${domainName}</strong> is about to expire on ${domain.expiryDate ? new Date(domain.expiryDate).toLocaleDateString() : 'soon'}. <a href="${process.env.CLIENT_URL}/dashboard/domains">Renew now</a> to avoid losing it.</p>`,
                });
              } catch { /* non-critical */ }
            }
          }
        }
        break;
      }
    }

    // Mark webhook as processed
    await db.update(schema.webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(schema.webhookEvents.id, webhookEvent.id));

    res.json({ received: true });
  }));

  // OpenSRS Email webhook (mailbox events)
  app.post('/api/v1/webhooks/opensrs-email', asyncHandler(async (req, res) => {
    const safeHeaders = { ...req.headers };
    delete safeHeaders.authorization;
    delete safeHeaders.cookie;

    const idempotencyKey = req.body.id ? `opensrs-email-${req.body.id}` : `opensrs-email-${crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')}`;

    const existing = await db.query.webhookEvents.findFirst({
      where: and(
        eq(schema.webhookEvents.idempotencyKey, idempotencyKey),
        eq(schema.webhookEvents.status, 'processed'),
      ),
    });
    if (existing) {
      return res.json({ received: true, duplicate: true });
    }

    const [webhookEvent] = await db.insert(schema.webhookEvents).values({
      source: 'opensrs-email',
      eventType: req.body.event || req.body.type || 'unknown',
      payload: req.body,
      headers: safeHeaders,
      idempotencyKey,
    }).returning();

    const event = req.body.event || req.body.type || '';
    const data = req.body.data || req.body;

    switch (event) {
      case 'mailbox.suspended':
      case 'mailbox.disabled': {
        const email = data.email || data.mailbox;
        if (email) {
          const [account] = await db.update(schema.emailAccounts)
            .set({ status: 'suspended', updatedAt: new Date() })
            .where(eq(schema.emailAccounts.email, email))
            .returning();
          if (account) {
            await db.insert(schema.auditLogs).values({
              customerId: account.customerId,
              action: 'email_mailbox_suspended',
              entityType: 'email_account',
              entityId: String(account.id),
              description: `Mailbox ${email} suspended via webhook`,
            });
          }
        }
        break;
      }

      case 'mailbox.quota_exceeded': {
        const email = data.email || data.mailbox;
        if (email) {
          await db.update(schema.emailAccounts)
            .set({ storageUsedMB: data.storage_used_mb || 0, updatedAt: new Date() })
            .where(eq(schema.emailAccounts.email, email));
        }
        break;
      }

      case 'domain.deleted': {
        const mailDomain = data.domain;
        if (mailDomain) {
          await db.update(schema.emailAccounts)
            .set({ status: 'suspended', deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.emailAccounts.mailDomain, mailDomain));
          await db.insert(schema.auditLogs).values({
            action: 'email_domain_deleted',
            entityType: 'email_domain',
            description: `Mail domain ${mailDomain} deleted via webhook — all mailboxes suspended`,
          });
        }
        break;
      }
    }

    await db.update(schema.webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(schema.webhookEvents.id, webhookEvent.id));

    res.json({ received: true });
  }));

  // SiteLock webhook (scan results, malware detection, firewall events)
  app.post('/api/v1/webhooks/sitelock', asyncHandler(async (req, res) => {
    // Verify signature
    const signature = req.headers['x-sitelock-signature'] as string;
    if (signature && !sitelockService.verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json(errorResponse('Invalid signature'));
    }

    const safeHeaders = { ...req.headers };
    delete safeHeaders.authorization;
    delete safeHeaders.cookie;

    const idempotencyKey = req.body.id ? `sitelock-${req.body.id}` : `sitelock-${crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')}`;

    const existing = await db.query.webhookEvents.findFirst({
      where: and(
        eq(schema.webhookEvents.idempotencyKey, idempotencyKey),
        eq(schema.webhookEvents.status, 'processed'),
      ),
    });
    if (existing) {
      return res.json({ received: true, duplicate: true });
    }

    const [webhookEvent] = await db.insert(schema.webhookEvents).values({
      source: 'sitelock',
      eventType: req.body.event || req.body.type || 'unknown',
      payload: req.body,
      headers: safeHeaders,
      idempotencyKey,
    }).returning();

    const event = req.body.event || req.body.type || '';
    const data = req.body.data || req.body;
    const accountId = data.account_id || data.accountId;

    // Helper to get SiteLock account and customer for notifications
    const getAccountAndCustomer = async (slAccountId: string) => {
      const account = await db.query.sitelockAccounts.findFirst({
        where: eq(schema.sitelockAccounts.sitelockAccountId, slAccountId),
      });
      if (!account) return { account: null, customer: null };
      const customer = await db.query.customers.findFirst({
        where: eq(schema.customers.id, account.customerId),
      });
      return { account, customer };
    };

    switch (event) {
      case 'scan.completed': {
        if (accountId) {
          const [updated] = await db.update(schema.sitelockAccounts)
            .set({
              lastScanAt: new Date(),
              lastScanResult: data.results || data,
              malwareFound: data.malware_found || false,
              riskLevel: data.risk_level || 'low',
              updatedAt: new Date(),
            })
            .where(eq(schema.sitelockAccounts.sitelockAccountId, accountId))
            .returning();
          if (updated) {
            await db.insert(schema.auditLogs).values({
              customerId: updated.customerId,
              action: 'sitelock_scan_completed',
              entityType: 'sitelock_account',
              entityId: String(updated.id),
              description: `SiteLock scan completed — risk level: ${data.risk_level || 'low'}`,
            });
          }
        }
        break;
      }

      case 'malware.detected': {
        if (accountId) {
          const [updated] = await db.update(schema.sitelockAccounts)
            .set({
              malwareFound: true,
              riskLevel: data.risk_level || 'high',
              lastScanResult: data,
              updatedAt: new Date(),
            })
            .where(eq(schema.sitelockAccounts.sitelockAccountId, accountId))
            .returning();

          if (updated) {
            await db.insert(schema.auditLogs).values({
              customerId: updated.customerId,
              action: 'sitelock_malware_detected',
              entityType: 'sitelock_account',
              entityId: String(updated.id),
              description: `Malware detected — ${data.malware_count || 'multiple'} threat(s) found`,
            });

            // Alert customer via email
            if (resend) {
              const { customer } = await getAccountAndCustomer(accountId);
              if (customer) {
                try {
                  await resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
                    to: customer.email,
                    subject: 'Security Alert: Malware Detected on Your Site',
                    html: `<p><strong>Malware has been detected</strong> on your website. We recommend taking immediate action. Visit your <a href="${process.env.CLIENT_URL}/dashboard/security">hostsblue security dashboard</a> for details and remediation options.</p>`,
                  });
                } catch { /* non-critical */ }
              }
            }
          }
        }
        break;
      }

      case 'malware.cleaned':
      case 'malware.removed': {
        if (accountId) {
          const [updated] = await db.update(schema.sitelockAccounts)
            .set({
              malwareFound: false,
              riskLevel: 'low',
              updatedAt: new Date(),
            })
            .where(eq(schema.sitelockAccounts.sitelockAccountId, accountId))
            .returning();

          if (updated) {
            await db.insert(schema.auditLogs).values({
              customerId: updated.customerId,
              action: 'sitelock_malware_removed',
              entityType: 'sitelock_account',
              entityId: String(updated.id),
              description: 'Malware successfully removed',
            });

            if (resend) {
              const { customer } = await getAccountAndCustomer(accountId);
              if (customer) {
                try {
                  await resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
                    to: customer.email,
                    subject: 'Malware Removed from Your Site',
                    html: `<p>The malware detected on your website has been <strong>successfully removed</strong>. Your site is now clean. Visit your <a href="${process.env.CLIENT_URL}/dashboard/security">hostsblue security dashboard</a> for details.</p>`,
                  });
                } catch { /* non-critical */ }
              }
            }
          }
        }
        break;
      }

      case 'firewall.event': {
        await db.insert(schema.auditLogs).values({
          action: 'sitelock_firewall_event',
          entityType: 'sitelock_account',
          description: `Firewall event for account ${accountId}: ${data.description || 'unknown'}`,
        });
        break;
      }
    }

    await db.update(schema.webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(schema.webhookEvents.id, webhookEvent.id));

    res.json({ received: true });
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
