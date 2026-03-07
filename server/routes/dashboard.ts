import { Express } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, type RouteContext } from './shared.js';

export function registerDashboardRoutes(app: Express, ctx: RouteContext) {
  const { db } = ctx;

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
}
