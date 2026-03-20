import { Express } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { authenticateToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';
import { getPaymentProvider, getActiveProviderName, setActiveProvider } from '../services/payment/payment-service.js';
import type { PaymentProviderName } from '../services/payment/payment-service.js';

export function registerAdminRoutes(app: Express, ctx: RouteContext) {
  const { db } = ctx;

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
  app.get('/api/v1/admin/settings/payment-provider', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    if (!req.user!.isAdmin) return res.status(403).json(errorResponse('Admin only'));
    const stripeConfigured = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
    res.json(successResponse({
      activeProvider: getActiveProviderName(),
      stripeConfigured,
      providers: [
        { name: 'swipesblue', label: 'swipesblue.com', available: true },
        { name: 'stripe', label: 'Stripe', available: stripeConfigured },
      ],
    }));
  }));

  app.patch('/api/v1/admin/settings/payment-provider', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    if (!req.user!.isAdmin) return res.status(403).json(errorResponse('Admin only'));

    const { provider } = req.body;
    if (!provider || !['swipesblue', 'stripe'].includes(provider)) {
      return res.status(400).json(errorResponse('Invalid provider. Must be "swipesblue" or "stripe".'));
    }

    // If switching to Stripe, verify keys are configured
    if (provider === 'stripe') {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(400).json(errorResponse('Cannot switch to Stripe: STRIPE_SECRET_KEY is not set. Add it to your environment variables first.'));
      }
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(400).json(errorResponse('Cannot switch to Stripe: STRIPE_WEBHOOK_SECRET is not set. Add it to your environment variables first.'));
      }
    }

    await setActiveProvider(provider as PaymentProviderName);
    res.json(successResponse({ activeProvider: provider }, `Payment provider switched to ${provider}`));
  }));
}
