import { Express } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';
import { z } from 'zod';
import crypto from 'crypto';

export function registerEmailRoutes(app: Express, ctx: RouteContext) {
  const { db, opensrsEmail } = ctx;

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
}
