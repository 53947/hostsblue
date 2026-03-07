import { Express } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';

export function registerSiteLockRoutes(app: Express, ctx: RouteContext) {
  const { db, sitelockService } = ctx;

  app.get('/api/v1/sitelock/plans', asyncHandler(async (_req, res) => {
    // SiteLock pricing: 40% margin over wholesale ($85/$130/$190)
    const plans = [
      {
        slug: 'basic',
        name: 'SiteLock Basic',
        monthlyPrice: 1158,
        yearlyPrice: 13900,
        features: ['Daily malware scan', 'Trust seal', 'Up to 5 pages'],
      },
      {
        slug: 'pro',
        name: 'SiteLock Pro',
        monthlyPrice: 1825,
        yearlyPrice: 21900,
        features: ['Daily malware scan', 'Automatic malware removal', 'Trust seal', 'WAF protection', 'Up to 500 pages'],
      },
      {
        slug: 'business',
        name: 'SiteLock Business',
        monthlyPrice: 2658,
        yearlyPrice: 31900,
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
}
