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
import { WebsiteAIService } from './services/website-ai.js';
import { AIProviderFactory, testProviderConnection } from './services/ai-provider.js';
import type { ProviderConfig } from './services/ai-provider.js';
import { AiCreditsService } from './services/ai-credits.js';
import { PlanEnforcement } from './services/plan-enforcement.js';
import { AnalyticsAggregation } from './services/analytics-aggregation.js';
import { HostingProvisioner } from './services/hosting-provisioner.js';
import { CLOUD_HOSTING_PLANS, DATACENTERS, OS_IMAGES, type CloudPlanSlug } from '../shared/hosting-plans.js';
import { renderPage } from './services/website-renderer.js';
import { encryptCredential, decryptCredential } from './services/wpmudev-integration.js';
import { getTemplateById, templates as allTemplates } from '../shared/templates/index.js';
import { defaultTheme, createDefaultBlock } from '../shared/block-types.js';
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
      'ai_credits', 'cloud_hosting',
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
  const aiCreditsService = new AiCreditsService(db);
  const hostingProvisioner = new HostingProvisioner(db);
  const planEnforcement = new PlanEnforcement(db);
  const analyticsAggregation = new AnalyticsAggregation(db);
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
  // CLOUD HOSTING ROUTES
  // ============================================================================

  // Get cloud hosting options (public)
  app.get('/api/v1/hosting/cloud/options', asyncHandler(async (req, res) => {
    res.json(successResponse({
      plans: Object.entries(CLOUD_HOSTING_PLANS).map(([slug, plan]) => ({
        slug,
        ...plan,
      })),
      datacenters: DATACENTERS,
      images: OS_IMAGES,
    }));
  }));

  // List customer's cloud servers
  app.get('/api/v1/hosting/cloud/servers', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const servers = await db
      .select({
        id: schema.cloudServers.id,
        uuid: schema.cloudServers.uuid,
        name: schema.cloudServers.name,
        planSlug: schema.cloudServers.planSlug,
        cpu: schema.cloudServers.cpu,
        ramMB: schema.cloudServers.ramMB,
        diskGB: schema.cloudServers.diskGB,
        datacenter: schema.cloudServers.datacenter,
        os: schema.cloudServers.os,
        ipv4: schema.cloudServers.ipv4,
        status: schema.cloudServers.status,
        monthlyPrice: schema.cloudServers.monthlyPrice,
        createdAt: schema.cloudServers.createdAt,
      })
      .from(schema.cloudServers)
      .where(eq(schema.cloudServers.customerId, customerId))
      .orderBy(desc(schema.cloudServers.createdAt));

    res.json(successResponse(servers));
  }));

  // Get cloud server details
  app.get('/api/v1/hosting/cloud/servers/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    // Strip provider-internal fields
    const { providerServerId, provider, provisionCommandId, ...safeServer } = server;
    res.json(successResponse(safeServer));
  }));

  // Provision new cloud server
  app.post('/api/v1/hosting/cloud/servers', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const body = z.object({
      planSlug: z.enum(['cloud-developer', 'cloud-startup', 'cloud-scale', 'cloud-enterprise'] as const),
      name: z.string().min(1).max(63),
      datacenter: z.string().min(2),
      os: z.string().min(1),
    }).parse(req.body);

    const result = await hostingProvisioner.provisionServer({
      customerId,
      planSlug: body.planSlug,
      name: body.name,
      datacenter: body.datacenter,
      os: body.os,
    });

    res.status(201).json(successResponse(result, 'Server provisioning started'));
  }));

  // Power control (on/off/reboot)
  app.post('/api/v1/hosting/cloud/servers/:uuid/power', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const { action } = z.object({ action: z.enum(['on', 'off', 'reboot']) }).parse(req.body);

    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.powerAction(server.id, customerId, action);
    res.json(successResponse(null, `Power ${action} initiated`));
  }));

  // Terminate cloud server
  app.delete('/api/v1/hosting/cloud/servers/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.terminateServer(server.id, customerId);
    res.json(successResponse(null, 'Server terminated'));
  }));

  // Resize cloud server
  app.put('/api/v1/hosting/cloud/servers/:uuid/resize', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const { planSlug } = z.object({
      planSlug: z.enum(['cloud-developer', 'cloud-startup', 'cloud-scale', 'cloud-enterprise'] as const),
    }).parse(req.body);

    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.resizeServer(server.id, customerId, planSlug);
    res.json(successResponse(null, 'Server resize initiated'));
  }));

  // List snapshots for a cloud server
  app.get('/api/v1/hosting/cloud/servers/:uuid/snapshots', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    const snapshots = await hostingProvisioner.listSnapshots(server.id, customerId);
    res.json(successResponse(snapshots));
  }));

  // Create snapshot
  app.post('/api/v1/hosting/cloud/servers/:uuid/snapshots', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);

    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    const snapshot = await hostingProvisioner.createSnapshot(server.id, customerId, name);
    res.status(201).json(successResponse(snapshot, 'Snapshot creation started'));
  }));

  // Revert snapshot
  app.put('/api/v1/hosting/cloud/servers/:uuid/snapshots/:snapId', requireAuth, asyncHandler(async (req, res) => {
    const customerId = (req as any).user.id;
    const snapId = parseInt(req.params.snapId);

    const server = await db.query.cloudServers.findFirst({
      where: and(
        eq(schema.cloudServers.uuid, req.params.uuid),
        eq(schema.cloudServers.customerId, customerId)
      ),
    });
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.revertSnapshot(server.id, customerId, snapId);
    res.json(successResponse(null, 'Snapshot revert initiated'));
  }));

  // Admin: list all cloud servers
  app.get('/api/v1/admin/cloud/servers', requireAuth, asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json(errorResponse('Admin access required'));

    const servers = await db
      .select({
        id: schema.cloudServers.id,
        uuid: schema.cloudServers.uuid,
        name: schema.cloudServers.name,
        planSlug: schema.cloudServers.planSlug,
        cpu: schema.cloudServers.cpu,
        ramMB: schema.cloudServers.ramMB,
        diskGB: schema.cloudServers.diskGB,
        datacenter: schema.cloudServers.datacenter,
        ipv4: schema.cloudServers.ipv4,
        status: schema.cloudServers.status,
        monthlyPrice: schema.cloudServers.monthlyPrice,
        createdAt: schema.cloudServers.createdAt,
        customerId: schema.cloudServers.customerId,
        customerEmail: schema.customers.email,
      })
      .from(schema.cloudServers)
      .leftJoin(schema.customers, eq(schema.cloudServers.customerId, schema.customers.id))
      .orderBy(desc(schema.cloudServers.createdAt));

    res.json(successResponse(servers));
  }));

  // Admin — cloud server power action
  app.post('/api/v1/admin/cloud/servers/:uuid/power', requireAuth, asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json(errorResponse('Admin access required'));

    const { uuid } = req.params;
    const { action } = req.body;
    if (!['on', 'off', 'reboot'].includes(action)) {
      return res.status(400).json(errorResponse('Invalid action'));
    }

    const [server] = await db.select().from(schema.cloudServers).where(eq(schema.cloudServers.uuid, uuid));
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.powerAction(server.id, server.customerId, action);

    await db.insert(schema.auditLogs).values({
      customerId: user.id,
      action: `admin_cloud_power_${action}`,
      entityType: 'cloud_server',
      entityId: String(server.id),
      description: `Admin power ${action} on ${server.name}`,
    });

    res.json(successResponse({ message: `Power ${action} initiated` }));
  }));

  // Admin — cloud server terminate
  app.delete('/api/v1/admin/cloud/servers/:uuid', requireAuth, asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json(errorResponse('Admin access required'));

    const { uuid } = req.params;
    const [server] = await db.select().from(schema.cloudServers).where(eq(schema.cloudServers.uuid, uuid));
    if (!server) return res.status(404).json(errorResponse('Server not found'));

    await hostingProvisioner.terminateServer(server.id, server.customerId);

    await db.insert(schema.auditLogs).values({
      customerId: user.id,
      action: 'admin_cloud_terminate',
      entityType: 'cloud_server',
      entityId: String(server.id),
      description: `Admin terminated server ${server.name}`,
    });

    res.json(successResponse({ message: 'Server terminated' }));
  }));

  // ============================================================================
  // ADMIN — BUILDER PROJECTS
  // ============================================================================

  app.get('/api/v1/admin/builder/projects', requireAuth, asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json(errorResponse('Admin access required'));

    const projects = await db
      .select({
        id: schema.websiteProjects.id,
        uuid: schema.websiteProjects.uuid,
        name: schema.websiteProjects.name,
        slug: schema.websiteProjects.slug,
        templateSlug: schema.websiteProjects.template,
        status: schema.websiteProjects.status,
        customerId: schema.websiteProjects.customerId,
        customerEmail: schema.customers.email,
        updatedAt: schema.websiteProjects.updatedAt,
        createdAt: schema.websiteProjects.createdAt,
      })
      .from(schema.websiteProjects)
      .leftJoin(schema.customers, eq(schema.websiteProjects.customerId, schema.customers.id))
      .orderBy(desc(schema.websiteProjects.updatedAt));

    res.json(successResponse(projects));
  }));

  // Admin — unpublish builder project
  app.post('/api/v1/admin/builder/projects/:uuid/unpublish', requireAuth, asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json(errorResponse('Admin access required'));

    const { uuid } = req.params;
    await db.update(schema.websiteProjects)
      .set({ status: 'draft', publishedAt: null, updatedAt: new Date() })
      .where(eq(schema.websiteProjects.uuid, uuid));

    res.json(successResponse({ message: 'Project unpublished' }));
  }));

  // ============================================================================
  // ADMIN — OVERVIEW STATS
  // ============================================================================

  app.get('/api/v1/admin/overview', requireAuth, asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'admin') return res.status(403).json(errorResponse('Admin access required'));

    const [customerCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.customers);
    const [domainCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.domains);
    const [hostingCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.hostingAccounts);
    const [cloudCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.cloudServers)
      .where(sql`${schema.cloudServers.status} != 'terminated'`);
    const [builderCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.websiteProjects);

    // Monthly revenue from active cloud servers
    const [cloudMRR] = await db.select({ total: sql<number>`coalesce(sum(${schema.cloudServers.monthlyPrice}), 0)` })
      .from(schema.cloudServers)
      .where(eq(schema.cloudServers.status, 'active'));

    // Recent orders
    const recentOrders = await db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        total: schema.orders.total,
        status: schema.orders.status,
        createdAt: schema.orders.createdAt,
        customerEmail: schema.customers.email,
      })
      .from(schema.orders)
      .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
      .orderBy(desc(schema.orders.createdAt))
      .limit(8);

    res.json(successResponse({
      customers: Number(customerCount.count),
      domains: Number(domainCount.count),
      hosting: Number(hostingCount.count),
      cloudServers: Number(cloudCount.count),
      builderProjects: Number(builderCount.count),
      monthlyRevenue: Number(cloudMRR.total),
      recentOrders,
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

      } else if (item.type === 'ai_credits') {
        const amountCents = item.options?.amountCents || 500;
        if (amountCents < 500) {
          return res.status(400).json(errorResponse('Minimum credit purchase is $5.00'));
        }
        price = amountCents;
        description = `AI Credits: $${(amountCents / 100).toFixed(2)}`;
        configuration = { amountCents };
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
        // Handle AI credits fulfillment
        try {
          const creditOrder = await db.query.orders.findFirst({
            where: eq(schema.orders.id, data.orderId),
            with: { items: true },
          });
          if (creditOrder) {
            for (const item of creditOrder.items) {
              if (item.itemType === 'ai_credits') {
                const config = item.configuration as any;
                const amountCents = config?.amountCents || item.totalPrice;
                await aiCreditsService.addCredits(creditOrder.customerId, amountCents, data.paymentReference, creditOrder.id);
              }
            }
          }
        } catch (err) {
          console.error('AI credits fulfillment error:', err);
        }
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

    // Cloud server count
    const cloudServerCount = await db.select({
      count: sql<number>`count(*)`,
    })
    .from(schema.cloudServers)
    .where(and(
      eq(schema.cloudServers.customerId, req.user!.userId),
      sql`${schema.cloudServers.status} != 'terminated'`
    ));

    // Website builder project count
    const builderProjectCount = await db.select({
      count: sql<number>`count(*)`,
    })
    .from(schema.websiteProjects)
    .where(and(
      eq(schema.websiteProjects.customerId, req.user!.userId),
      sql`${schema.websiteProjects.deletedAt} IS NULL`
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
      cloudServers: {
        total: Number(cloudServerCount[0]?.count || 0),
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
      builder: {
        total: Number(builderProjectCount[0]?.count || 0),
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

  // Helper: get platform API key for credits mode
  function getPlatformApiKey(provider: string): string | undefined {
    const envMap: Record<string, string> = {
      deepseek: 'PLATFORM_DEEPSEEK_API_KEY',
      openai: 'PLATFORM_OPENAI_API_KEY',
      anthropic: 'PLATFORM_ANTHROPIC_API_KEY',
      groq: 'PLATFORM_GROQ_API_KEY',
      gemini: 'PLATFORM_GEMINI_API_KEY',
    };
    return process.env[envMap[provider] || ''];
  }

  // Helper: get AI service for current customer (supports credits + BYOK)
  async function getAIService(customerId: number): Promise<{ ai: WebsiteAIService; billingMode: string; provider: string; modelName: string }> {
    const balance = await aiCreditsService.getBalance(customerId);
    const settings = await db.query.aiProviderSettings.findFirst({
      where: and(eq(schema.aiProviderSettings.customerId, customerId), eq(schema.aiProviderSettings.isActive, true)),
    });

    const provider = settings?.provider || 'deepseek';
    const modelName = settings?.modelName || 'deepseek-chat';
    let config: ProviderConfig | null = null;

    if (balance.billingMode === 'credits') {
      // Credits mode: use platform API keys
      const platformKey = getPlatformApiKey(provider);
      if (platformKey) {
        config = { provider: provider as any, apiKey: platformKey, modelName, baseUrl: settings?.baseUrl || undefined };
      }
    } else {
      // BYOK mode: use customer's encrypted API key
      if (settings && settings.apiKey) {
        let apiKey = settings.apiKey;
        try { apiKey = decryptCredential(settings.apiKey); } catch { /* use as-is */ }
        config = { provider: provider as any, apiKey, modelName, baseUrl: settings?.baseUrl || undefined };
      }
    }

    return { ai: new WebsiteAIService(config), billingMode: balance.billingMode, provider, modelName };
  }

  // Helper: verify project ownership
  async function getOwnedProject(uuid: string, customerId: number) {
    return db.query.websiteProjects.findFirst({
      where: and(
        eq(schema.websiteProjects.uuid, uuid),
        eq(schema.websiteProjects.customerId, customerId),
        sql`${schema.websiteProjects.deletedAt} IS NULL`,
      ),
    });
  }

  // ---- Templates list ----
  app.get('/api/v1/website-builder/templates', asyncHandler(async (_req, res) => {
    res.json(successResponse(allTemplates.map(t => ({ id: t.id, name: t.name, description: t.description, category: t.category, thumbnail: t.thumbnail }))));
  }));

  // ---- Project CRUD ----
  app.get('/api/v1/website-builder/projects', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const projects = await db.query.websiteProjects.findMany({
      where: and(eq(schema.websiteProjects.customerId, req.user!.userId), sql`${schema.websiteProjects.deletedAt} IS NULL`),
      orderBy: desc(schema.websiteProjects.createdAt),
    });
    // Attach page count
    const result = [];
    for (const p of projects) {
      const pages = await db.query.websitePages.findMany({ where: eq(schema.websitePages.projectId, p.id) });
      result.push({ ...p, pagesCount: pages.length });
    }
    res.json(successResponse(result));
  }));

  app.post('/api/v1/website-builder/projects', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    // Plan enforcement: check site limit
    const siteCheck = await planEnforcement.checkSiteLimit(req.user!.userId);
    if (!siteCheck.allowed) return res.status(403).json(errorResponse(siteCheck.reason!));

    const { name, template, customDomain, businessType, businessDescription } = req.body;

    // Generate slug from name
    const baseSlug = (name || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
    const existing = await db.query.websiteProjects.findFirst({ where: eq(schema.websiteProjects.slug, baseSlug) });
    const slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

    const [project] = await db.insert(schema.websiteProjects).values({
      customerId: req.user!.userId,
      name,
      slug,
      template: template || 'blank',
      customDomain,
      businessType,
      businessDescription,
      status: 'draft',
      theme: defaultTheme,
    }).returning();

    // If template selected, populate pages from template
    if (template && template !== 'blank') {
      const tpl = getTemplateById(template);
      if (tpl) {
        await db.update(schema.websiteProjects).set({ theme: tpl.theme }).where(eq(schema.websiteProjects.id, project.id));
        for (let i = 0; i < tpl.pages.length; i++) {
          const page = tpl.pages[i];
          // Replace {businessName} placeholders
          const blocks = JSON.parse(JSON.stringify(page.blocks).replace(/\{businessName\}/g, name || 'My Website'));
          await db.insert(schema.websitePages).values({
            projectId: project.id,
            slug: page.slug,
            title: page.title,
            sortOrder: i,
            isHomePage: page.isHomePage,
            showInNav: page.showInNav,
            blocks,
          });
        }
      }
    }

    res.status(201).json(successResponse(project));
  }));

  app.get('/api/v1/website-builder/projects/:uuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const pages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    res.json(successResponse({ ...project, pages }));
  }));

  app.patch('/api/v1/website-builder/projects/:uuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { name, theme, globalSeo, businessType, businessDescription } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (theme !== undefined) updates.theme = theme;
    if (globalSeo !== undefined) updates.globalSeo = globalSeo;
    if (businessType !== undefined) updates.businessType = businessType;
    if (businessDescription !== undefined) updates.businessDescription = businessDescription;

    const [updated] = await db.update(schema.websiteProjects).set(updates).where(eq(schema.websiteProjects.id, project.id)).returning();
    res.json(successResponse(updated));
  }));

  app.delete('/api/v1/website-builder/projects/:uuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    await db.update(schema.websiteProjects).set({ deletedAt: new Date(), status: 'archived' }).where(eq(schema.websiteProjects.id, project.id));
    res.json(successResponse(null, 'Project deleted'));
  }));

  // ---- Page CRUD ----
  app.get('/api/v1/website-builder/projects/:uuid/pages', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const pages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });
    res.json(successResponse(pages));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/pages', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    // Plan enforcement: check page limit
    const pageCheck = await planEnforcement.checkPageLimit(req.user!.userId, project.id);
    if (!pageCheck.allowed) return res.status(403).json(errorResponse(pageCheck.reason!));

    const { slug, title, blocks, isHomePage, showInNav } = req.body;
    const maxSort = await db.query.websitePages.findFirst({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: desc(schema.websitePages.sortOrder),
    });

    const [page] = await db.insert(schema.websitePages).values({
      projectId: project.id,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title,
      sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      isHomePage: isHomePage || false,
      showInNav: showInNav !== false,
      blocks: blocks || [],
    }).returning();

    res.status(201).json(successResponse(page));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/pages/:pageSlug', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, req.params.pageSlug)),
    });
    if (!page) return res.status(404).json(errorResponse('Page not found'));
    res.json(successResponse(page));
  }));

  app.patch('/api/v1/website-builder/projects/:uuid/pages/:pageSlug', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, req.params.pageSlug)),
    });
    if (!page) return res.status(404).json(errorResponse('Page not found'));

    const { title, blocks, seo, showInNav } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (blocks !== undefined) updates.blocks = blocks;
    if (seo !== undefined) updates.seo = seo;
    if (showInNav !== undefined) updates.showInNav = showInNav;

    const [updated] = await db.update(schema.websitePages).set(updates).where(eq(schema.websitePages.id, page.id)).returning();
    res.json(successResponse(updated));
  }));

  app.delete('/api/v1/website-builder/projects/:uuid/pages/:pageSlug', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, req.params.pageSlug)),
    });
    if (!page) return res.status(404).json(errorResponse('Page not found'));

    await db.delete(schema.websitePages).where(eq(schema.websitePages.id, page.id));
    res.json(successResponse(null, 'Page deleted'));
  }));

  app.patch('/api/v1/website-builder/projects/:uuid/pages/reorder', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { order } = req.body; // array of { slug, sortOrder }
    for (const item of order || []) {
      await db.update(schema.websitePages)
        .set({ sortOrder: item.sortOrder })
        .where(and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, item.slug)));
    }
    res.json(successResponse(null, 'Pages reordered'));
  }));

  // ---- AI Endpoints ----
  // Helper: log AI usage and deduct credits if applicable
  async function logAiUsageAndDeduct(customerId: number, billingMode: string, provider: string, modelName: string, action: string, usage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined, projectId?: number, startTime?: number) {
    if (!usage || (usage.inputTokens === 0 && usage.outputTokens === 0)) return;

    const cost = aiCreditsService.calculateCost(modelName, usage.inputTokens, usage.outputTokens);
    const durationMs = startTime ? Date.now() - startTime : undefined;

    // Log usage
    const [log] = await db.insert(schema.aiUsageLogs).values({
      customerId,
      provider,
      modelName,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      inputCostCents: cost.inputCostCents,
      outputCostCents: cost.outputCostCents,
      totalCostCents: cost.totalCostCents,
      marginCents: cost.marginCents,
      action,
      projectId: projectId ?? null,
      billingMode,
      durationMs: durationMs ?? null,
      success: true,
    }).returning();

    // Deduct credits if in credits mode
    if (billingMode === 'credits' && cost.totalCostCents > 0) {
      await aiCreditsService.deductCredits({
        customerId,
        amountCents: cost.totalCostCents,
        description: `${action} — ${modelName} (${usage.totalTokens} tokens)`,
        aiUsageLogId: log.id,
        metadata: { provider, modelName, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      });
      // Check auto-top-up
      await aiCreditsService.checkAutoTopup(customerId);
    }
  }

  app.post('/api/v1/website-builder/projects/:uuid/ai/generate', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    // Check credits before proceeding
    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 5); // estimate ~5 cents
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const { businessName, businessType, businessDescription, style, selectedPages } = req.body;
    const startTime = Date.now();

    const result = await ai.generateWebsite({
      businessName: businessName || project.name,
      businessType: businessType || project.businessType || 'business',
      businessDescription: businessDescription || project.businessDescription,
      style,
      selectedPages,
    });

    // Log usage and deduct credits
    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'generate_website', result.usage, project.id, startTime);

    // Save theme to project
    await db.update(schema.websiteProjects).set({
      theme: result.theme,
      aiGenerated: true,
      businessType: businessType || project.businessType,
      businessDescription: businessDescription || project.businessDescription,
      updatedAt: new Date(),
    }).where(eq(schema.websiteProjects.id, project.id));

    // Delete existing pages and replace with generated ones
    await db.delete(schema.websitePages).where(eq(schema.websitePages.projectId, project.id));
    for (let i = 0; i < result.pages.length; i++) {
      const page = result.pages[i];
      await db.insert(schema.websitePages).values({
        projectId: project.id,
        slug: page.slug,
        title: page.title,
        sortOrder: i,
        isHomePage: page.isHomePage,
        showInNav: page.showInNav,
        blocks: page.blocks,
      });
    }

    res.json(successResponse(result));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/ai/chat', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 2);
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const pages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    const { message, history } = req.body;
    const siteContext = {
      businessName: project.name,
      businessType: project.businessType || 'business',
      pages: pages.map(p => ({ slug: p.slug, title: p.title, blocks: (p.blocks || []) as any[] })),
    };

    const startTime = Date.now();
    const result = await ai.coachChat(message, siteContext, history || []);

    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'coach_chat', result.usage, project.id, startTime);

    // Store in AI session
    let session = await db.query.websiteAiSessions.findFirst({
      where: eq(schema.websiteAiSessions.projectId, project.id),
    });

    const newMessages = [
      ...(history || []),
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: result.message, timestamp: new Date().toISOString() },
    ];

    if (session) {
      await db.update(schema.websiteAiSessions).set({ messages: newMessages, updatedAt: new Date() }).where(eq(schema.websiteAiSessions.id, session.id));
    } else {
      await db.insert(schema.websiteAiSessions).values({ projectId: project.id, messages: newMessages });
    }

    res.json(successResponse(result));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/ai/generate-block', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 1);
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const { type } = req.body;
    const startTime = Date.now();
    const block = await ai.generateBlock(type, { businessName: project.name, businessType: project.businessType || 'business' });

    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'generate_block', (block as any).usage, project.id, startTime);

    res.json(successResponse(block));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/ai/rewrite', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 1);
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const { block, instruction } = req.body;
    const startTime = Date.now();
    const result = await ai.rewriteContent(block, instruction);

    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'rewrite_content', (result as any).usage, project.id, startTime);

    res.json(successResponse(result));
  }));

  // ---- AI Generate SEO ----
  app.post('/api/v1/website-builder/projects/:uuid/ai/generate-seo', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { ai, billingMode, provider, modelName } = await getAIService(req.user!.userId);

    if (billingMode === 'credits') {
      const check = await aiCreditsService.canAfford(req.user!.userId, 1);
      if (!check.allowed) return res.status(402).json(errorResponse(check.reason!));
    }

    const pages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    const startTime = Date.now();
    const result = await ai.generateSeo(
      pages.map(p => ({ slug: p.slug, title: p.title, blocks: (p.blocks || []) as any[] })),
      { businessName: project.name, businessType: project.businessType || 'business' },
    );

    await logAiUsageAndDeduct(req.user!.userId, billingMode, provider, modelName, 'generate_seo', result.usage, project.id, startTime);

    res.json(successResponse(result));
  }));

  // ---- AI Provider Settings ----
  app.get('/api/v1/ai/settings', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const settings = await db.query.aiProviderSettings.findFirst({
      where: eq(schema.aiProviderSettings.customerId, req.user!.userId),
    });
    if (!settings) return res.json(successResponse(null));
    // Don't send full API key to client
    const masked = settings.apiKey ? `${settings.apiKey.substring(0, 8)}${'*'.repeat(20)}` : '';
    res.json(successResponse({ ...settings, apiKey: masked }));
  }));

  app.put('/api/v1/ai/settings', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { provider, apiKey, modelName, baseUrl } = req.body;

    const existing = await db.query.aiProviderSettings.findFirst({
      where: eq(schema.aiProviderSettings.customerId, req.user!.userId),
    });

    const encryptedKey = apiKey && !apiKey.includes('*') ? encryptCredential(apiKey) : undefined;

    if (existing) {
      const updates: Record<string, any> = { provider, modelName, baseUrl, updatedAt: new Date() };
      if (encryptedKey) updates.apiKey = encryptedKey;
      const [updated] = await db.update(schema.aiProviderSettings).set(updates).where(eq(schema.aiProviderSettings.id, existing.id)).returning();
      res.json(successResponse(updated));
    } else {
      const [created] = await db.insert(schema.aiProviderSettings).values({
        customerId: req.user!.userId,
        provider,
        apiKey: encryptedKey || '',
        modelName,
        baseUrl,
      }).returning();
      res.json(successResponse(created));
    }
  }));

  app.post('/api/v1/ai/settings/test', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { provider, apiKey, modelName, baseUrl } = req.body;
    const result = await testProviderConnection({ provider, apiKey, modelName, baseUrl });
    res.json(successResponse(result));
  }));

  // ---- AI Models ----
  app.get('/api/v1/ai/models', authenticateToken, requireAuth, asyncHandler(async (_req, res) => {
    res.json(successResponse({
      models: aiCreditsService.getAvailableModels(),
      pricing: aiCreditsService.getModelPricing(),
    }));
  }));

  // ---- AI Credits / Billing ----
  app.get('/api/v1/ai/credits/balance', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const balance = await aiCreditsService.getBalance(req.user!.userId);
    res.json(successResponse(balance));
  }));

  app.post('/api/v1/ai/credits/purchase', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { amountCents } = req.body;
    if (!amountCents || amountCents < 500) {
      return res.status(400).json(errorResponse('Minimum purchase is $5.00 (500 cents)'));
    }

    // Create order through the existing pipeline
    const orderNumber = `HB${Date.now().toString(36).toUpperCase()}`;
    const [order] = await db.insert(schema.orders).values({
      customerId: req.user!.userId,
      orderNumber,
      status: 'draft',
      subtotal: amountCents,
      discountAmount: 0,
      taxAmount: 0,
      total: amountCents,
      currency: 'USD',
    }).returning();

    await db.insert(schema.orderItems).values({
      orderId: order.id,
      itemType: 'ai_credits',
      description: `AI Credits: $${(amountCents / 100).toFixed(2)}`,
      unitPrice: amountCents,
      quantity: 1,
      totalPrice: amountCents,
      configuration: { amountCents },
    });

    res.status(201).json(successResponse({ order }));
  }));

  app.get('/api/v1/ai/credits/transactions', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const transactions = await aiCreditsService.getTransactions(req.user!.userId, limit, offset);
    res.json(successResponse(transactions));
  }));

  app.get('/api/v1/ai/credits/usage/daily', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const usage = await aiCreditsService.getDailyUsage(req.user!.userId, days);
    res.json(successResponse(usage));
  }));

  app.get('/api/v1/ai/credits/usage/models', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const breakdown = await aiCreditsService.getModelBreakdown(req.user!.userId, days);
    res.json(successResponse(breakdown));
  }));

  app.put('/api/v1/ai/credits/auto-topup', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { enabled, thresholdCents, amountCents } = req.body;
    const balance = await aiCreditsService.updateAutoTopupSettings(req.user!.userId, {
      enabled: !!enabled,
      thresholdCents,
      amountCents,
    });
    res.json(successResponse(balance));
  }));

  app.put('/api/v1/ai/credits/spending-limit', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { limitCents, period } = req.body;
    const balance = await aiCreditsService.updateSpendingLimit(
      req.user!.userId,
      limitCents === null || limitCents === undefined ? null : parseInt(limitCents),
      period || 'monthly',
    );
    res.json(successResponse(balance));
  }));

  app.put('/api/v1/ai/credits/billing-mode', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { mode } = req.body;
    if (mode !== 'credits' && mode !== 'byok') {
      return res.status(400).json(errorResponse('Mode must be "credits" or "byok"'));
    }
    const balance = await aiCreditsService.updateBillingMode(req.user!.userId, mode);
    res.json(successResponse(balance));
  }));

  // ---- Publishing ----
  app.post('/api/v1/website-builder/projects/:uuid/publish', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const slug = project.slug || project.uuid;
    const publishedUrl = `${slug}.sites.hostsblue.com`;

    const [updated] = await db.update(schema.websiteProjects)
      .set({ status: 'published', publishedUrl, publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.websiteProjects.id, project.id))
      .returning();

    res.json(successResponse(updated, 'Project published'));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/preview', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const pageSlug = (req.query.page as string) || 'home';
    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, pageSlug)),
    });
    if (!page) return res.status(404).json(errorResponse('Page not found'));

    const theme = (project.theme || defaultTheme) as any;
    const html = renderPage((page.blocks || []) as any[], {
      theme,
      businessName: project.name,
      seo: (page.seo || {}) as any,
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }));

  // ---- Form Submissions ----
  app.post('/api/v1/sites/:slug/forms', rateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Too many form submissions' }), asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).json(errorResponse('Site not found'));

    const { name, email, message, pageSlug, ...extra } = req.body;
    const [submission] = await db.insert(schema.formSubmissions).values({
      projectId: project.id,
      pageSlug: pageSlug || null,
      name: (name || '').slice(0, 200),
      email: (email || '').slice(0, 255),
      message: (message || '').slice(0, 5000),
      data: extra || {},
      ipAddress: (req.ip || req.socket.remoteAddress || '').slice(0, 45),
    }).returning();

    res.status(201).json(successResponse({ id: submission.uuid }, 'Submission received'));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/submissions', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const submissions = await db.query.formSubmissions.findMany({
      where: eq(schema.formSubmissions.projectId, project.id),
      orderBy: desc(schema.formSubmissions.createdAt),
    });
    res.json(successResponse(submissions));
  }));

  app.delete('/api/v1/website-builder/projects/:uuid/submissions/:id', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const subId = parseInt(req.params.id);
    if (isNaN(subId)) return res.status(400).json(errorResponse('Invalid submission ID'));

    await db.delete(schema.formSubmissions).where(
      and(eq(schema.formSubmissions.id, subId), eq(schema.formSubmissions.projectId, project.id)),
    );
    res.json(successResponse(null, 'Submission deleted'));
  }));

  // ---- Builder Plan ----
  app.get('/api/v1/website-builder/plan', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const sub = await db.query.builderSubscriptions.findFirst({
      where: eq(schema.builderSubscriptions.customerId, req.user!.userId),
    });

    const { getPlanLimits } = await import('../shared/builder-plans.js');
    const plan = sub?.plan || 'starter';
    const limits = getPlanLimits(plan);

    // Count current sites
    const projects = await db.query.websiteProjects.findMany({
      where: and(eq(schema.websiteProjects.customerId, req.user!.userId), sql`${schema.websiteProjects.deletedAt} IS NULL`),
    });

    res.json(successResponse({
      plan,
      status: sub?.status || 'active',
      limits,
      usage: { sites: projects.length },
      expiresAt: sub?.expiresAt,
    }));
  }));

  // ---- Agency Clients ----
  app.get('/api/v1/website-builder/clients', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const featureCheck = await planEnforcement.checkFeatureGate(req.user!.userId, 'client-management');
    if (!featureCheck.allowed) return res.status(403).json(errorResponse(featureCheck.reason!));

    const clients = await db.query.agencyClients.findMany({
      where: eq(schema.agencyClients.agencyCustomerId, req.user!.userId),
      orderBy: desc(schema.agencyClients.createdAt),
    });
    res.json(successResponse(clients));
  }));

  app.post('/api/v1/website-builder/clients/invite', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const featureCheck = await planEnforcement.checkFeatureGate(req.user!.userId, 'client-management');
    if (!featureCheck.allowed) return res.status(403).json(errorResponse(featureCheck.reason!));

    const { email } = req.body;
    if (!email) return res.status(400).json(errorResponse('Email is required'));

    // Check for existing invite
    const existing = await db.query.agencyClients.findFirst({
      where: and(
        eq(schema.agencyClients.agencyCustomerId, req.user!.userId),
        eq(schema.agencyClients.clientEmail, email),
      ),
    });
    if (existing) return res.status(409).json(errorResponse('Client already invited'));

    const inviteToken = crypto.randomBytes(32).toString('hex');

    // Check if the email matches an existing customer
    const existingCustomer = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });

    const [client] = await db.insert(schema.agencyClients).values({
      agencyCustomerId: req.user!.userId,
      clientCustomerId: existingCustomer?.id || null,
      clientEmail: email,
      inviteToken,
      inviteStatus: existingCustomer ? 'accepted' : 'pending',
      permissions: ['view', 'edit'],
    }).returning();

    res.status(201).json(successResponse(client));
  }));

  app.delete('/api/v1/website-builder/clients/:id', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json(errorResponse('Invalid ID'));

    await db.delete(schema.agencyClients).where(
      and(eq(schema.agencyClients.id, id), eq(schema.agencyClients.agencyCustomerId, req.user!.userId)),
    );
    res.json(successResponse(null, 'Client removed'));
  }));

  app.post('/api/v1/website-builder/clients/accept-invite', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json(errorResponse('Token is required'));

    const invite = await db.query.agencyClients.findFirst({
      where: and(eq(schema.agencyClients.inviteToken, token), eq(schema.agencyClients.inviteStatus, 'pending')),
    });
    if (!invite) return res.status(404).json(errorResponse('Invalid or expired invitation'));

    const [updated] = await db.update(schema.agencyClients)
      .set({ clientCustomerId: req.user!.userId, inviteStatus: 'accepted', inviteToken: null, updatedAt: new Date() })
      .where(eq(schema.agencyClients.id, invite.id))
      .returning();

    res.json(successResponse(updated));
  }));

  // ---- Store Settings ----
  app.get('/api/v1/website-builder/projects/:uuid/store/settings', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    let settings = await db.query.storeSettings.findFirst({
      where: eq(schema.storeSettings.projectId, project.id),
    });

    if (!settings) {
      [settings] = await db.insert(schema.storeSettings).values({ projectId: project.id }).returning();
    }

    res.json(successResponse(settings));
  }));

  app.put('/api/v1/website-builder/projects/:uuid/store/settings', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const featureCheck = await planEnforcement.checkFeatureGate(req.user!.userId, 'ecommerce');
    if (!featureCheck.allowed) return res.status(403).json(errorResponse(featureCheck.reason!));

    const { currency, taxRate, shippingOptions, paymentEnabled } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (currency !== undefined) updates.currency = currency;
    if (taxRate !== undefined) updates.taxRate = String(taxRate);
    if (shippingOptions !== undefined) updates.shippingOptions = shippingOptions;
    if (paymentEnabled !== undefined) updates.paymentEnabled = paymentEnabled;

    let settings = await db.query.storeSettings.findFirst({
      where: eq(schema.storeSettings.projectId, project.id),
    });

    if (settings) {
      [settings] = await db.update(schema.storeSettings).set(updates).where(eq(schema.storeSettings.id, settings.id)).returning();
    } else {
      [settings] = await db.insert(schema.storeSettings).values({ projectId: project.id, ...updates }).returning();
    }

    res.json(successResponse(settings));
  }));

  // ---- Store Products ----
  app.get('/api/v1/website-builder/projects/:uuid/store/products', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const products = await db.query.storeProducts.findMany({
      where: eq(schema.storeProducts.projectId, project.id),
      orderBy: desc(schema.storeProducts.createdAt),
    });
    res.json(successResponse(products));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/store/products', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { name, description, price, compareAtPrice, images, variants, inventory, categoryId } = req.body;
    if (!name || price === undefined) return res.status(400).json(errorResponse('Name and price are required'));

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200);

    const [product] = await db.insert(schema.storeProducts).values({
      projectId: project.id,
      name,
      slug,
      description,
      price: parseInt(price),
      compareAtPrice: compareAtPrice ? parseInt(compareAtPrice) : null,
      images: images || [],
      variants: variants || [],
      inventory: inventory ?? null,
      categoryId: categoryId || null,
    }).returning();

    res.status(201).json(successResponse(product));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/store/products/:productUuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const product = await db.query.storeProducts.findFirst({
      where: and(eq(schema.storeProducts.uuid, req.params.productUuid), eq(schema.storeProducts.projectId, project.id)),
    });
    if (!product) return res.status(404).json(errorResponse('Product not found'));
    res.json(successResponse(product));
  }));

  app.patch('/api/v1/website-builder/projects/:uuid/store/products/:productUuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const product = await db.query.storeProducts.findFirst({
      where: and(eq(schema.storeProducts.uuid, req.params.productUuid), eq(schema.storeProducts.projectId, project.id)),
    });
    if (!product) return res.status(404).json(errorResponse('Product not found'));

    const { name, description, price, compareAtPrice, images, variants, inventory, categoryId, isActive } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) { updates.name = name; updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200); }
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = parseInt(price);
    if (compareAtPrice !== undefined) updates.compareAtPrice = compareAtPrice ? parseInt(compareAtPrice) : null;
    if (images !== undefined) updates.images = images;
    if (variants !== undefined) updates.variants = variants;
    if (inventory !== undefined) updates.inventory = inventory;
    if (categoryId !== undefined) updates.categoryId = categoryId;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db.update(schema.storeProducts).set(updates).where(eq(schema.storeProducts.id, product.id)).returning();
    res.json(successResponse(updated));
  }));

  app.delete('/api/v1/website-builder/projects/:uuid/store/products/:productUuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    await db.delete(schema.storeProducts).where(
      and(eq(schema.storeProducts.uuid, req.params.productUuid), eq(schema.storeProducts.projectId, project.id)),
    );
    res.json(successResponse(null, 'Product deleted'));
  }));

  // ---- Store Categories ----
  app.get('/api/v1/website-builder/projects/:uuid/store/categories', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const categories = await db.query.storeCategories.findMany({
      where: eq(schema.storeCategories.projectId, project.id),
      orderBy: schema.storeCategories.sortOrder,
    });
    res.json(successResponse(categories));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/store/categories', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const { name } = req.body;
    if (!name) return res.status(400).json(errorResponse('Name is required'));

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const [category] = await db.insert(schema.storeCategories).values({ projectId: project.id, name, slug }).returning();
    res.status(201).json(successResponse(category));
  }));

  // ---- Store Orders ----
  app.get('/api/v1/website-builder/projects/:uuid/store/orders', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const orders = await db.query.storeOrders.findMany({
      where: eq(schema.storeOrders.projectId, project.id),
      orderBy: desc(schema.storeOrders.createdAt),
      with: { items: true },
    });
    res.json(successResponse(orders));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/store/orders/:orderUuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const order = await db.query.storeOrders.findFirst({
      where: and(eq(schema.storeOrders.uuid, req.params.orderUuid), eq(schema.storeOrders.projectId, project.id)),
      with: { items: true },
    });
    if (!order) return res.status(404).json(errorResponse('Order not found'));
    res.json(successResponse(order));
  }));

  app.patch('/api/v1/website-builder/projects/:uuid/store/orders/:orderUuid', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const order = await db.query.storeOrders.findFirst({
      where: and(eq(schema.storeOrders.uuid, req.params.orderUuid), eq(schema.storeOrders.projectId, project.id)),
    });
    if (!order) return res.status(404).json(errorResponse('Order not found'));

    const { status } = req.body;
    const [updated] = await db.update(schema.storeOrders).set({ status, updatedAt: new Date() }).where(eq(schema.storeOrders.id, order.id)).returning();
    res.json(successResponse(updated));
  }));

  // ---- Public Storefront API ----
  app.get('/api/v1/sites/:slug/store/products', asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).json(errorResponse('Site not found'));

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const category = req.query.category as string;

    let products = await db.query.storeProducts.findMany({
      where: and(eq(schema.storeProducts.projectId, project.id), eq(schema.storeProducts.isActive, true)),
      orderBy: desc(schema.storeProducts.createdAt),
    });

    if (category) {
      const cat = await db.query.storeCategories.findFirst({
        where: and(eq(schema.storeCategories.projectId, project.id), eq(schema.storeCategories.slug, category)),
      });
      if (cat) products = products.filter(p => p.categoryId === cat.id);
    }

    res.json(successResponse(products.slice(0, limit)));
  }));

  app.post('/api/v1/sites/:slug/store/checkout', rateLimiter({ windowMs: 60 * 1000, max: 10 }), asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).json(errorResponse('Site not found'));

    const { items, customerEmail, customerName, shippingAddress } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json(errorResponse('Items are required'));
    if (!customerEmail) return res.status(400).json(errorResponse('Email is required'));

    const storeConf = await db.query.storeSettings.findFirst({
      where: eq(schema.storeSettings.projectId, project.id),
    });

    let subtotal = 0;
    const orderItems: Array<{ productId: number; productName: string; quantity: number; unitPrice: number; totalPrice: number; variant: any }> = [];

    for (const item of items) {
      const product = await db.query.storeProducts.findFirst({
        where: and(eq(schema.storeProducts.projectId, project.id), eq(schema.storeProducts.slug, item.slug), eq(schema.storeProducts.isActive, true)),
      });
      if (!product) continue;
      const qty = Math.max(1, Math.min(item.quantity || 1, 99));
      const lineTotal = product.price * qty;
      subtotal += lineTotal;
      orderItems.push({ productId: product.id, productName: product.name, quantity: qty, unitPrice: product.price, totalPrice: lineTotal, variant: item.variant || null });
    }

    if (orderItems.length === 0) return res.status(400).json(errorResponse('No valid products'));

    const taxRate = parseFloat(String(storeConf?.taxRate || '0'));
    const tax = Math.round(subtotal * (taxRate / 100));
    const total = subtotal + tax;
    const orderNumber = `SO-${Date.now().toString(36).toUpperCase()}`;

    const [order] = await db.insert(schema.storeOrders).values({
      projectId: project.id,
      orderNumber,
      status: 'pending',
      customerEmail,
      customerName,
      shippingAddress,
      subtotal,
      tax,
      shipping: 0,
      total,
    }).returning();

    for (const item of orderItems) {
      await db.insert(schema.storeOrderItems).values({ orderId: order.id, ...item });
    }

    res.status(201).json(successResponse({ order: { uuid: order.uuid, orderNumber, total } }));
  }));

  // ---- Custom Domain Binding ----
  app.patch('/api/v1/website-builder/projects/:uuid/domain', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const featureCheck = await planEnforcement.checkFeatureGate(req.user!.userId, 'custom-domain');
    if (!featureCheck.allowed) return res.status(403).json(errorResponse(featureCheck.reason!));

    const { domain } = req.body;
    if (!domain || domain.length > 253) return res.status(400).json(errorResponse('Invalid domain'));

    const verifyToken = crypto.randomBytes(16).toString('hex');

    const [updated] = await db.update(schema.websiteProjects)
      .set({
        customDomain: domain,
        settings: { ...(project.settings as any || {}), domainVerifyToken: verifyToken, domainVerified: false },
        updatedAt: new Date(),
      })
      .where(eq(schema.websiteProjects.id, project.id))
      .returning();

    res.json(successResponse({
      domain,
      verifyToken,
      dnsInstructions: `Add a TXT record to ${domain} with value: hostsblue-verify=${verifyToken}`,
    }));
  }));

  app.post('/api/v1/website-builder/projects/:uuid/domain/verify', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const settings = (project.settings || {}) as any;
    const verifyToken = settings.domainVerifyToken;
    const domain = project.customDomain;
    if (!domain || !verifyToken) return res.status(400).json(errorResponse('No domain configured'));

    try {
      const dns = await import('dns');
      const records = await dns.promises.resolveTxt(domain);
      const found = records.flat().some(r => r === `hostsblue-verify=${verifyToken}`);

      if (found) {
        await db.update(schema.websiteProjects)
          .set({ settings: { ...settings, domainVerified: true }, updatedAt: new Date() })
          .where(eq(schema.websiteProjects.id, project.id));
        res.json(successResponse({ verified: true }));
      } else {
        res.json(successResponse({ verified: false, message: 'TXT record not found. It may take up to 48 hours for DNS to propagate.' }));
      }
    } catch {
      res.json(successResponse({ verified: false, message: 'Could not resolve DNS for this domain.' }));
    }
  }));

  // ---- Project Settings (White-Label, etc.) ----
  app.patch('/api/v1/website-builder/projects/:uuid/settings', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const currentSettings = (project.settings || {}) as any;
    const newSettings = { ...currentSettings, ...req.body };

    // White-label requires agency plan
    if (req.body.whiteLabel !== undefined) {
      const featureCheck = await planEnforcement.checkFeatureGate(req.user!.userId, 'white-label');
      if (!featureCheck.allowed) return res.status(403).json(errorResponse(featureCheck.reason!));
    }

    const [updated] = await db.update(schema.websiteProjects)
      .set({ settings: newSettings, updatedAt: new Date() })
      .where(eq(schema.websiteProjects.id, project.id))
      .returning();

    res.json(successResponse(updated));
  }));

  // ---- Analytics ----
  app.post('/api/v1/analytics/collect', rateLimiter({ windowMs: 60 * 1000, max: 60, message: 'Too many requests' }), asyncHandler(async (req, res) => {
    const { slug, pageSlug, sessionId, referrer } = req.body;
    if (!slug) return res.status(400).json(errorResponse('Missing slug'));

    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).json(errorResponse('Site not found'));

    const ua = req.headers['user-agent'] || '';
    let device = 'desktop';
    if (/mobile/i.test(ua)) device = 'mobile';
    else if (/tablet|ipad/i.test(ua)) device = 'tablet';

    let browser = 'other';
    if (/chrome/i.test(ua) && !/edge/i.test(ua)) browser = 'Chrome';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/edge/i.test(ua)) browser = 'Edge';

    await db.insert(schema.siteAnalytics).values({
      projectId: project.id,
      pageSlug: (pageSlug || 'home').slice(0, 100),
      sessionId: (sessionId || '').slice(0, 64),
      referrer: (referrer || '').slice(0, 500),
      device,
      browser,
    });

    // Trigger daily aggregation async
    const today = new Date().toISOString().slice(0, 10);
    analyticsAggregation.aggregateDaily(project.id, today).catch(() => {});

    res.json(successResponse(null));
  }));

  app.get('/api/v1/website-builder/projects/:uuid/analytics', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const project = await getOwnedProject(req.params.uuid, req.user!.userId);
    if (!project) return res.status(404).json(errorResponse('Project not found'));

    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const analytics = await analyticsAggregation.getDailySummary(project.id, days);
    res.json(successResponse(analytics));
  }));

  // ---- Published Site Serving ----
  app.get('/sites/:slug', asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).send('<h1>Site not found</h1>');

    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.isHomePage, true)),
    });
    if (!page) return res.status(404).send('<h1>No home page found</h1>');

    const allPages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    const theme = (project.theme || defaultTheme) as any;
    const html = renderPage((page.blocks || []) as any[], {
      theme,
      businessName: project.name,
      seo: (page.seo || {}) as any,
      siteSlug: project.slug || '',
      pages: allPages.map(p => ({ slug: p.slug, title: p.title, showInNav: p.showInNav })),
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }));

  app.get('/sites/:slug/:pageSlug', asyncHandler(async (req, res) => {
    const project = await db.query.websiteProjects.findFirst({
      where: and(eq(schema.websiteProjects.slug, req.params.slug), eq(schema.websiteProjects.status, 'published')),
    });
    if (!project) return res.status(404).send('<h1>Site not found</h1>');

    const page = await db.query.websitePages.findFirst({
      where: and(eq(schema.websitePages.projectId, project.id), eq(schema.websitePages.slug, req.params.pageSlug)),
    });
    if (!page) return res.status(404).send('<h1>Page not found</h1>');

    const allPages = await db.query.websitePages.findMany({
      where: eq(schema.websitePages.projectId, project.id),
      orderBy: schema.websitePages.sortOrder,
    });

    const theme = (project.theme || defaultTheme) as any;
    const html = renderPage((page.blocks || []) as any[], {
      theme,
      businessName: project.name,
      seo: (page.seo || {}) as any,
      siteSlug: project.slug || '',
      pages: allPages.map(p => ({ slug: p.slug, title: p.title, showInNav: p.showInNav })),
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
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
