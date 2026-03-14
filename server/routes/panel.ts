/**
 * Panel (Admin) API Routes
 * All routes require authenticateToken + requireAdmin middleware
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, asc, like, sql, gte, lte, count, sum, or, ne, inArray, isNull } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type DB = NodePgDatabase<typeof schema>;

function successResponse(data: any, message?: string) {
  return { success: true, data, ...(message && { message }) };
}

function errorResponse(msg: string) {
  return { success: false, error: msg };
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: any) => fn(req, res).catch(next);
}

export function registerPanelRoutes(app: any, db: DB) {
  const router = Router();

  // ========================================================================
  // PAYMENT MODE
  // ========================================================================

  router.get('/payment-mode', asyncHandler(async (_req, res) => {
    const liveMode = process.env.SWIPESBLUE_LIVE_MODE === 'true';
    const hasApiKey = !!process.env.SWIPESBLUE_API_KEY
      && process.env.SWIPESBLUE_API_KEY !== 'test'
      && process.env.SWIPESBLUE_API_KEY !== 'your_swipesblue_api_key';
    const mode = liveMode && hasApiKey ? 'live' : 'mock';
    res.json(successResponse({ mode }));
  }));

  // ========================================================================
  // STATS & OVERVIEW
  // ========================================================================

  router.get('/stats', asyncHandler(async (req, res) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Counts
    const [customerCount] = await db.select({ count: count() }).from(schema.customers);
    const [newCustomers] = await db.select({ count: count() }).from(schema.customers).where(gte(schema.customers.createdAt, thirtyDaysAgo));
    const [domainCount] = await db.select({ count: count() }).from(schema.domains).where(eq(schema.domains.status, 'active'));
    const [hostingCount] = await db.select({ count: count() }).from(schema.hostingAccounts).where(eq(schema.hostingAccounts.status, 'active'));
    const [pendingHosting] = await db.select({ count: count() }).from(schema.hostingAccounts).where(eq(schema.hostingAccounts.status, 'pending'));

    // Revenue this month
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [thisMonthRev] = await db.select({ total: sql<number>`COALESCE(SUM(total), 0)` }).from(schema.orders).where(and(gte(schema.orders.completedAt, firstOfMonth), eq(schema.orders.status, 'completed')));
    const [lastMonthRev] = await db.select({ total: sql<number>`COALESCE(SUM(total), 0)` }).from(schema.orders).where(and(gte(schema.orders.completedAt, firstOfLastMonth), lte(schema.orders.completedAt, firstOfMonth), eq(schema.orders.status, 'completed')));

    // Recent orders
    const recentOrders = await db.select({
      id: schema.orders.id,
      uuid: schema.orders.uuid,
      orderNumber: schema.orders.orderNumber,
      total: schema.orders.total,
      status: schema.orders.status,
      createdAt: schema.orders.createdAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
    }).from(schema.orders)
      .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
      .orderBy(desc(schema.orders.createdAt))
      .limit(10);

    // Alerts
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [expiringDomains] = await db.select({ count: count() }).from(schema.domains).where(and(lte(schema.domains.expiryDate, thirtyDaysFromNow), gte(schema.domains.expiryDate, now)));
    const [expiringSSL] = await db.select({ count: count() }).from(schema.sslCertificates).where(and(lte(schema.sslCertificates.expiresAt, thirtyDaysFromNow), gte(schema.sslCertificates.expiresAt, now)));
    const [openTickets] = await db.select({ count: count() }).from(schema.supportTickets).where(or(eq(schema.supportTickets.status, 'open'), eq(schema.supportTickets.status, 'in_progress')));
    const [failedPayments] = await db.select({ count: count() }).from(schema.orders).where(and(eq(schema.orders.status, 'failed'), gte(schema.orders.createdAt, sevenDaysAgo)));

    res.json(successResponse({
      totalCustomers: customerCount.count,
      newCustomersThisMonth: newCustomers.count,
      activeDomains: domainCount.count,
      activeHosting: hostingCount.count,
      pendingHosting: pendingHosting.count,
      monthlyRevenue: Number(thisMonthRev.total),
      lastMonthRevenue: Number(lastMonthRev.total),
      recentOrders,
      alerts: {
        expiringDomains: expiringDomains.count,
        expiringSSL: expiringSSL.count,
        openTickets: openTickets.count,
        failedPayments: failedPayments.count,
      },
    }));
  }));

  // ========================================================================
  // CUSTOMERS
  // ========================================================================

  router.get('/customers', asyncHandler(async (req, res) => {
    const { search, status, sort, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db.select({
      id: schema.customers.id,
      uuid: schema.customers.uuid,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
      email: schema.customers.email,
      companyName: schema.customers.companyName,
      isActive: schema.customers.isActive,
      isAdmin: schema.customers.isAdmin,
      createdAt: schema.customers.createdAt,
      lastLoginAt: schema.customers.lastLoginAt,
    }).from(schema.customers).$dynamic();

    const conditions: any[] = [];
    if (search) {
      conditions.push(or(
        like(schema.customers.email, `%${search}%`),
        like(schema.customers.firstName, `%${search}%`),
        like(schema.customers.lastName, `%${search}%`),
        like(schema.customers.companyName, `%${search}%`),
      ));
    }
    if (status && status !== 'all') {
      if (status === 'active') conditions.push(eq(schema.customers.isActive, true));
      else if (status === 'suspended' || status === 'inactive') conditions.push(eq(schema.customers.isActive, false));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const orderBy = sort === 'name' ? asc(schema.customers.firstName)
      : sort === 'oldest' ? asc(schema.customers.createdAt)
      : desc(schema.customers.createdAt);

    const customers = await (query as any).orderBy(orderBy).limit(Number(limit)).offset(offset);
    const [totalResult] = await db.select({ count: count() }).from(schema.customers);

    res.json(successResponse({
      customers,
      total: totalResult.count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(totalResult.count) / Number(limit)),
    }));
  }));

  router.get('/customers/:id', asyncHandler(async (req, res) => {
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, Number(req.params.id)),
    });
    if (!customer) return res.status(404).json(errorResponse('Customer not found'));

    // Get service counts
    const [domainCount] = await db.select({ count: count() }).from(schema.domains).where(eq(schema.domains.customerId, customer.id));
    const [hostingCount] = await db.select({ count: count() }).from(schema.hostingAccounts).where(eq(schema.hostingAccounts.customerId, customer.id));
    const [emailCount] = await db.select({ count: count() }).from(schema.emailAccounts).where(eq(schema.emailAccounts.customerId, customer.id));
    const [sslCount] = await db.select({ count: count() }).from(schema.sslCertificates).where(eq(schema.sslCertificates.customerId, customer.id));
    const [projectCount] = await db.select({ count: count() }).from(schema.websiteProjects).where(eq(schema.websiteProjects.customerId, customer.id));
    const [ticketCount] = await db.select({ count: count() }).from(schema.supportTickets).where(eq(schema.supportTickets.customerId, customer.id));
    const [totalSpent] = await db.select({ total: sql<number>`COALESCE(SUM(total), 0)` }).from(schema.orders).where(and(eq(schema.orders.customerId, customer.id), eq(schema.orders.status, 'completed')));

    // Recent orders
    const orders = await db.select().from(schema.orders).where(eq(schema.orders.customerId, customer.id)).orderBy(desc(schema.orders.createdAt)).limit(20);

    const { passwordHash, ...safeCustomer } = customer as any;

    res.json(successResponse({
      ...safeCustomer,
      services: { domains: domainCount.count, hosting: hostingCount.count, email: emailCount.count, ssl: sslCount.count, projects: projectCount.count },
      ticketCount: ticketCount.count,
      totalSpent: Number(totalSpent.total),
      orders,
    }));
  }));

  router.patch('/customers/:id', asyncHandler(async (req, res) => {
    const { firstName, lastName, email, company, phone, status } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (company !== undefined) updates.companyName = company;
    if (phone !== undefined) updates.phone = phone;
    if (status !== undefined) updates.isActive = status === 'active';

    const [updated] = await db.update(schema.customers).set(updates).where(eq(schema.customers.id, Number(req.params.id))).returning();
    if (!updated) return res.status(404).json(errorResponse('Customer not found'));
    res.json(successResponse(updated));
  }));

  router.post('/customers/:id/suspend', asyncHandler(async (req, res) => {
    await db.update(schema.customers).set({ isActive: false, updatedAt: new Date() }).where(eq(schema.customers.id, Number(req.params.id)));
    res.json(successResponse(null, 'Customer suspended'));
  }));

  router.post('/customers/:id/activate', asyncHandler(async (req, res) => {
    await db.update(schema.customers).set({ isActive: true, updatedAt: new Date() }).where(eq(schema.customers.id, Number(req.params.id)));
    res.json(successResponse(null, 'Customer activated'));
  }));

  router.delete('/customers/:id', asyncHandler(async (req, res) => {
    await db.update(schema.customers).set({ isActive: false, updatedAt: new Date() }).where(eq(schema.customers.id, Number(req.params.id)));
    res.json(successResponse(null, 'Customer deleted'));
  }));

  // Customer notes
  router.get('/customers/:id/notes', asyncHandler(async (req, res) => {
    const notes = await db.select({
      id: schema.customerNotes.id,
      content: schema.customerNotes.content,
      createdAt: schema.customerNotes.createdAt,
      adminName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
    }).from(schema.customerNotes)
      .leftJoin(schema.customers, eq(schema.customerNotes.adminId, schema.customers.id))
      .where(eq(schema.customerNotes.customerId, Number(req.params.id)))
      .orderBy(desc(schema.customerNotes.createdAt));
    res.json(successResponse(notes));
  }));

  router.post('/customers/:id/notes', asyncHandler(async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json(errorResponse('Content required'));
    const [note] = await db.insert(schema.customerNotes).values({
      customerId: Number(req.params.id),
      adminId: req.user!.userId,
      content: content.trim(),
    }).returning();
    res.json(successResponse(note));
  }));

  // Customer services (sub-routes)
  router.get('/customers/:id/domains', asyncHandler(async (req, res) => {
    const domains = await db.select().from(schema.domains).where(eq(schema.domains.customerId, Number(req.params.id))).orderBy(desc(schema.domains.createdAt));
    res.json(successResponse(domains));
  }));

  router.get('/customers/:id/hosting', asyncHandler(async (req, res) => {
    const accounts = await db.select().from(schema.hostingAccounts).where(eq(schema.hostingAccounts.customerId, Number(req.params.id))).orderBy(desc(schema.hostingAccounts.createdAt));
    res.json(successResponse(accounts));
  }));

  router.get('/customers/:id/email', asyncHandler(async (req, res) => {
    const accounts = await db.select().from(schema.emailAccounts).where(eq(schema.emailAccounts.customerId, Number(req.params.id))).orderBy(desc(schema.emailAccounts.createdAt));
    res.json(successResponse(accounts));
  }));

  router.get('/customers/:id/ssl', asyncHandler(async (req, res) => {
    const certs = await db.select().from(schema.sslCertificates).where(eq(schema.sslCertificates.customerId, Number(req.params.id))).orderBy(desc(schema.sslCertificates.createdAt));
    res.json(successResponse(certs));
  }));

  router.get('/customers/:id/projects', asyncHandler(async (req, res) => {
    const projects = await db.select().from(schema.websiteProjects).where(eq(schema.websiteProjects.customerId, Number(req.params.id))).orderBy(desc(schema.websiteProjects.createdAt));
    res.json(successResponse(projects));
  }));

  router.get('/customers/:id/tickets', asyncHandler(async (req, res) => {
    const tickets = await db.select().from(schema.supportTickets).where(eq(schema.supportTickets.customerId, Number(req.params.id))).orderBy(desc(schema.supportTickets.createdAt));
    res.json(successResponse(tickets));
  }));

  // ========================================================================
  // ORDERS
  // ========================================================================

  router.get('/orders', asyncHandler(async (req, res) => {
    const { search, status, type, dateFrom, dateTo, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);

    const orders = await db.select({
      id: schema.orders.id,
      uuid: schema.orders.uuid,
      orderNumber: schema.orders.orderNumber,
      total: schema.orders.total,
      currency: schema.orders.currency,
      status: schema.orders.status,
      paymentStatus: schema.orders.paymentStatus,
      createdAt: schema.orders.createdAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
      customerId: schema.orders.customerId,
    }).from(schema.orders)
      .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
      .orderBy(desc(schema.orders.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(schema.orders);

    res.json(successResponse({
      orders,
      total: totalResult.count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(totalResult.count) / Number(limit)),
    }));
  }));

  router.get('/orders/:id', asyncHandler(async (req, res) => {
    const order = await db.select({
      id: schema.orders.id,
      uuid: schema.orders.uuid,
      orderNumber: schema.orders.orderNumber,
      total: schema.orders.total,
      subtotal: schema.orders.subtotal,
      taxAmount: schema.orders.taxAmount,
      discountAmount: schema.orders.discountAmount,
      currency: schema.orders.currency,
      status: schema.orders.status,
      paymentStatus: schema.orders.paymentStatus,
      paymentMethod: schema.orders.paymentMethod,
      paymentReference: schema.orders.paymentReference,
      paidAt: schema.orders.paidAt,
      createdAt: schema.orders.createdAt,
      completedAt: schema.orders.completedAt,
      customerNote: schema.orders.customerNote,
      adminNote: schema.orders.adminNote,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
      customerId: schema.orders.customerId,
    }).from(schema.orders)
      .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
      .where(eq(schema.orders.id, Number(req.params.id)));

    if (!order.length) return res.status(404).json(errorResponse('Order not found'));

    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, Number(req.params.id)));

    res.json(successResponse({ ...order[0], items }));
  }));

  router.patch('/orders/:id', asyncHandler(async (req, res) => {
    const { status, adminNote } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (status) {
      updates.status = status;
      if (status === 'completed') updates.completedAt = new Date();
    }
    if (adminNote !== undefined) updates.adminNote = adminNote;

    const [updated] = await db.update(schema.orders).set(updates).where(eq(schema.orders.id, Number(req.params.id))).returning();
    res.json(successResponse(updated));
  }));

  router.post('/orders/:id/refund', asyncHandler(async (req, res) => {
    const { amount, reason } = req.body;
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, Number(req.params.id)) });
    if (!order) return res.status(404).json(errorResponse('Order not found'));

    await db.update(schema.orders).set({
      status: 'refunded',
      adminNote: `Refund: $${(amount / 100).toFixed(2)} — ${reason || 'No reason given'}`,
      updatedAt: new Date(),
    }).where(eq(schema.orders.id, order.id));

    res.json(successResponse(null, 'Refund processed'));
  }));

  // ========================================================================
  // DOMAINS
  // ========================================================================

  router.get('/domains', asyncHandler(async (req, res) => {
    const { search, status, expiring, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);
    const now = new Date();

    const domains = await db.select({
      id: schema.domains.id,
      uuid: schema.domains.uuid,
      domainName: schema.domains.domainName,
      tld: schema.domains.tld,
      status: schema.domains.status,
      registrationDate: schema.domains.registrationDate,
      expiryDate: schema.domains.expiryDate,
      autoRenew: schema.domains.autoRenew,
      privacyEnabled: schema.domains.privacyEnabled,
      createdAt: schema.domains.createdAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
      customerId: schema.domains.customerId,
    }).from(schema.domains)
      .leftJoin(schema.customers, eq(schema.domains.customerId, schema.customers.id))
      .orderBy(desc(schema.domains.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(schema.domains);
    const expiringDays = 30;
    const cutoff = new Date(now.getTime() + expiringDays * 24 * 60 * 60 * 1000);
    const [expiringCount] = await db.select({ count: count() }).from(schema.domains).where(and(lte(schema.domains.expiryDate, cutoff), gte(schema.domains.expiryDate, now)));

    res.json(successResponse({
      domains,
      total: totalResult.count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(totalResult.count) / Number(limit)),
      expiringCount: expiringCount.count,
    }));
  }));

  router.post('/domains/:id/suspend', asyncHandler(async (req, res) => {
    await db.update(schema.domains).set({ status: 'suspended' }).where(eq(schema.domains.id, Number(req.params.id)));
    res.json(successResponse(null, 'Domain suspended'));
  }));

  router.post('/domains/:id/activate', asyncHandler(async (req, res) => {
    await db.update(schema.domains).set({ status: 'active' }).where(eq(schema.domains.id, Number(req.params.id)));
    res.json(successResponse(null, 'Domain activated'));
  }));

  // ========================================================================
  // HOSTING
  // ========================================================================

  router.get('/hosting', asyncHandler(async (req, res) => {
    const { search, status, plan, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);

    const accounts = await db.select({
      id: schema.hostingAccounts.id,
      uuid: schema.hostingAccounts.uuid,
      primaryDomain: schema.hostingAccounts.primaryDomain,
      siteName: schema.hostingAccounts.siteName,
      planId: schema.hostingAccounts.planId,
      status: schema.hostingAccounts.status,
      storageUsedMB: schema.hostingAccounts.storageUsedMB,
      createdAt: schema.hostingAccounts.createdAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
      customerId: schema.hostingAccounts.customerId,
    }).from(schema.hostingAccounts)
      .leftJoin(schema.customers, eq(schema.hostingAccounts.customerId, schema.customers.id))
      .orderBy(desc(schema.hostingAccounts.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(schema.hostingAccounts);

    res.json(successResponse({
      accounts,
      total: totalResult.count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(totalResult.count) / Number(limit)),
    }));
  }));

  router.post('/hosting/:id/suspend', asyncHandler(async (req, res) => {
    await db.update(schema.hostingAccounts).set({ status: 'suspended' }).where(eq(schema.hostingAccounts.id, Number(req.params.id)));
    res.json(successResponse(null, 'Hosting suspended'));
  }));

  router.post('/hosting/:id/activate', asyncHandler(async (req, res) => {
    await db.update(schema.hostingAccounts).set({ status: 'active' }).where(eq(schema.hostingAccounts.id, Number(req.params.id)));
    res.json(successResponse(null, 'Hosting activated'));
  }));

  // ========================================================================
  // EMAIL
  // ========================================================================

  router.get('/email', asyncHandler(async (req, res) => {
    const { search, status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);

    const accounts = await db.select({
      id: schema.emailAccounts.id,
      uuid: schema.emailAccounts.uuid,
      email: schema.emailAccounts.email,
      mailDomain: schema.emailAccounts.mailDomain,
      planId: schema.emailAccounts.planId,
      storageUsedMB: schema.emailAccounts.storageUsedMB,
      status: schema.emailAccounts.status,
      createdAt: schema.emailAccounts.createdAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
      customerId: schema.emailAccounts.customerId,
    }).from(schema.emailAccounts)
      .leftJoin(schema.customers, eq(schema.emailAccounts.customerId, schema.customers.id))
      .orderBy(desc(schema.emailAccounts.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(schema.emailAccounts);

    res.json(successResponse({
      accounts,
      total: totalResult.count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(totalResult.count) / Number(limit)),
    }));
  }));

  router.post('/email/:id/suspend', asyncHandler(async (req, res) => {
    await db.update(schema.emailAccounts).set({ status: 'suspended' }).where(eq(schema.emailAccounts.id, Number(req.params.id)));
    res.json(successResponse(null, 'Email suspended'));
  }));

  router.post('/email/:id/activate', asyncHandler(async (req, res) => {
    await db.update(schema.emailAccounts).set({ status: 'active' }).where(eq(schema.emailAccounts.id, Number(req.params.id)));
    res.json(successResponse(null, 'Email activated'));
  }));

  // ========================================================================
  // SSL
  // ========================================================================

  router.get('/ssl', asyncHandler(async (req, res) => {
    const { search, status, type, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);
    const now = new Date();

    const certs = await db.select({
      id: schema.sslCertificates.id,
      uuid: schema.sslCertificates.uuid,
      domainName: schema.sslCertificates.domainName,
      productId: schema.sslCertificates.productId,
      status: schema.sslCertificates.status,
      issuedAt: schema.sslCertificates.issuedAt,
      expiresAt: schema.sslCertificates.expiresAt,
      autoRenew: schema.sslCertificates.autoRenew,
      createdAt: schema.sslCertificates.createdAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
      customerId: schema.sslCertificates.customerId,
    }).from(schema.sslCertificates)
      .leftJoin(schema.customers, eq(schema.sslCertificates.customerId, schema.customers.id))
      .orderBy(desc(schema.sslCertificates.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(schema.sslCertificates);
    const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [expiringCount] = await db.select({ count: count() }).from(schema.sslCertificates).where(and(lte(schema.sslCertificates.expiresAt, cutoff), gte(schema.sslCertificates.expiresAt, now)));

    res.json(successResponse({
      certificates: certs,
      total: totalResult.count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(totalResult.count) / Number(limit)),
      expiringCount: expiringCount.count,
    }));
  }));

  // ========================================================================
  // WEBSITE BUILDER
  // ========================================================================

  router.get('/builder', asyncHandler(async (req, res) => {
    const { search, status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);

    const projects = await db.select({
      id: schema.websiteProjects.id,
      uuid: schema.websiteProjects.uuid,
      name: schema.websiteProjects.name,
      slug: schema.websiteProjects.slug,
      businessType: schema.websiteProjects.businessType,
      status: schema.websiteProjects.status,
      publishedUrl: schema.websiteProjects.publishedUrl,
      aiGenerated: schema.websiteProjects.aiGenerated,
      createdAt: schema.websiteProjects.createdAt,
      updatedAt: schema.websiteProjects.updatedAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
      customerId: schema.websiteProjects.customerId,
    }).from(schema.websiteProjects)
      .leftJoin(schema.customers, eq(schema.websiteProjects.customerId, schema.customers.id))
      .orderBy(desc(schema.websiteProjects.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(schema.websiteProjects);

    res.json(successResponse({
      projects,
      total: totalResult.count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(totalResult.count) / Number(limit)),
    }));
  }));

  router.post('/builder/:id/suspend', asyncHandler(async (req, res) => {
    await db.update(schema.websiteProjects).set({ status: 'suspended', updatedAt: new Date() }).where(eq(schema.websiteProjects.id, Number(req.params.id)));
    res.json(successResponse(null, 'Project suspended'));
  }));

  router.post('/builder/:id/activate', asyncHandler(async (req, res) => {
    await db.update(schema.websiteProjects).set({ status: 'draft', updatedAt: new Date() }).where(eq(schema.websiteProjects.id, Number(req.params.id)));
    res.json(successResponse(null, 'Project activated'));
  }));

  // ========================================================================
  // SUPPORT TICKETS
  // ========================================================================

  router.get('/tickets', asyncHandler(async (req, res) => {
    const { search, status, priority, category, assignedTo, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);

    const tickets = await db.select({
      id: schema.supportTickets.id,
      uuid: schema.supportTickets.uuid,
      subject: schema.supportTickets.subject,
      category: schema.supportTickets.category,
      priority: schema.supportTickets.priority,
      status: schema.supportTickets.status,
      assignedTo: schema.supportTickets.assignedTo,
      createdAt: schema.supportTickets.createdAt,
      updatedAt: schema.supportTickets.updatedAt,
      closedAt: schema.supportTickets.closedAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
      customerId: schema.supportTickets.customerId,
    }).from(schema.supportTickets)
      .leftJoin(schema.customers, eq(schema.supportTickets.customerId, schema.customers.id))
      .orderBy(desc(schema.supportTickets.updatedAt))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(schema.supportTickets);
    const [openCount] = await db.select({ count: count() }).from(schema.supportTickets).where(eq(schema.supportTickets.status, 'open'));
    const [inProgressCount] = await db.select({ count: count() }).from(schema.supportTickets).where(eq(schema.supportTickets.status, 'in_progress'));

    res.json(successResponse({
      tickets,
      total: totalResult.count,
      openCount: openCount.count,
      inProgressCount: inProgressCount.count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(totalResult.count) / Number(limit)),
    }));
  }));

  router.get('/tickets/:id', asyncHandler(async (req, res) => {
    const ticket = await db.select({
      id: schema.supportTickets.id,
      uuid: schema.supportTickets.uuid,
      subject: schema.supportTickets.subject,
      category: schema.supportTickets.category,
      priority: schema.supportTickets.priority,
      status: schema.supportTickets.status,
      assignedTo: schema.supportTickets.assignedTo,
      createdAt: schema.supportTickets.createdAt,
      updatedAt: schema.supportTickets.updatedAt,
      closedAt: schema.supportTickets.closedAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
      customerId: schema.supportTickets.customerId,
    }).from(schema.supportTickets)
      .leftJoin(schema.customers, eq(schema.supportTickets.customerId, schema.customers.id))
      .where(eq(schema.supportTickets.id, Number(req.params.id)));

    if (!ticket.length) return res.status(404).json(errorResponse('Ticket not found'));

    const messages = await db.select({
      id: schema.ticketMessages.id,
      body: schema.ticketMessages.body,
      senderType: schema.ticketMessages.senderType,
      isInternal: schema.ticketMessages.isInternal,
      attachments: schema.ticketMessages.attachments,
      createdAt: schema.ticketMessages.createdAt,
      senderName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      senderEmail: schema.customers.email,
    }).from(schema.ticketMessages)
      .leftJoin(schema.customers, eq(schema.ticketMessages.senderId, schema.customers.id))
      .where(eq(schema.ticketMessages.ticketId, Number(req.params.id)))
      .orderBy(asc(schema.ticketMessages.createdAt));

    // Related tickets from same customer
    const relatedTickets = await db.select({
      id: schema.supportTickets.id,
      subject: schema.supportTickets.subject,
      status: schema.supportTickets.status,
    }).from(schema.supportTickets)
      .where(and(
        eq(schema.supportTickets.customerId, ticket[0].customerId),
        ne(schema.supportTickets.id, Number(req.params.id)),
      ))
      .limit(5);

    res.json(successResponse({ ...ticket[0], messages, relatedTickets }));
  }));

  router.post('/tickets/:id/messages', asyncHandler(async (req, res) => {
    const { body, isInternal } = req.body;
    if (!body?.trim()) return res.status(400).json(errorResponse('Message body required'));

    const [message] = await db.insert(schema.ticketMessages).values({
      ticketId: Number(req.params.id),
      senderId: req.user!.userId,
      senderType: 'agent',
      body: body.trim(),
      isInternal: isInternal || false,
    }).returning();

    // Update ticket timestamp
    await db.update(schema.supportTickets).set({ updatedAt: new Date() }).where(eq(schema.supportTickets.id, Number(req.params.id)));

    res.json(successResponse(message));
  }));

  router.patch('/tickets/:id', asyncHandler(async (req, res) => {
    const { status, priority, category, assignedTo } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (status) {
      updates.status = status;
      if (status === 'closed' || status === 'resolved') updates.closedAt = new Date();
    }
    if (priority) updates.priority = priority;
    if (category) updates.category = category;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;

    const [updated] = await db.update(schema.supportTickets).set(updates).where(eq(schema.supportTickets.id, Number(req.params.id))).returning();
    res.json(successResponse(updated));
  }));

  router.post('/tickets/:id/close', asyncHandler(async (req, res) => {
    await db.update(schema.supportTickets).set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() }).where(eq(schema.supportTickets.id, Number(req.params.id)));
    res.json(successResponse(null, 'Ticket closed'));
  }));

  // ========================================================================
  // REVENUE
  // ========================================================================

  router.get('/revenue', asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query as Record<string, string>;
    const now = new Date();

    let daysBack = 30;
    if (period === '90d') daysBack = 90;
    else if (period === '12m') daysBack = 365;
    else if (period === 'all') daysBack = 3650;

    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const prevStartDate = new Date(startDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // MRR (completed orders in last 30 days)
    const [currentRev] = await db.select({ total: sql<number>`COALESCE(SUM(total), 0)` }).from(schema.orders).where(and(gte(schema.orders.completedAt, startDate), eq(schema.orders.status, 'completed')));
    const [prevRev] = await db.select({ total: sql<number>`COALESCE(SUM(total), 0)` }).from(schema.orders).where(and(gte(schema.orders.completedAt, prevStartDate), lte(schema.orders.completedAt, startDate), eq(schema.orders.status, 'completed')));

    const mrr = Number(currentRev.total);
    const prevMrr = Number(prevRev.total);
    const mrrChange = prevMrr > 0 ? ((mrr - prevMrr) / prevMrr * 100) : 0;

    // Customer count for ARPC
    const [activeCustomers] = await db.select({ count: count() }).from(schema.customers).where(eq(schema.customers.isActive, true));
    const arpc = Number(activeCustomers.count) > 0 ? mrr / Number(activeCustomers.count) : 0;

    // Daily revenue chart data
    const chartData = await db.select({
      date: sql<string>`DATE(${schema.orders.completedAt})`,
      revenue: sql<number>`COALESCE(SUM(${schema.orders.total}), 0)`,
    }).from(schema.orders)
      .where(and(gte(schema.orders.completedAt, startDate), eq(schema.orders.status, 'completed')))
      .groupBy(sql`DATE(${schema.orders.completedAt})`)
      .orderBy(sql`DATE(${schema.orders.completedAt})`);

    // Revenue by service type
    const byService = await db.select({
      type: schema.orderItems.itemType,
      revenue: sql<number>`COALESCE(SUM(${schema.orderItems.totalPrice}), 0)`,
    }).from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(and(gte(schema.orders.completedAt, startDate), eq(schema.orders.status, 'completed')))
      .groupBy(schema.orderItems.itemType);

    // Recent transactions
    const transactions = await db.select({
      id: schema.orders.id,
      orderNumber: schema.orders.orderNumber,
      total: schema.orders.total,
      status: schema.orders.status,
      createdAt: schema.orders.createdAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
    }).from(schema.orders)
      .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
      .orderBy(desc(schema.orders.createdAt))
      .limit(50);

    res.json(successResponse({
      mrr,
      mrrChange: Math.round(mrrChange * 10) / 10,
      arr: mrr * 12,
      arpc: Math.round(arpc),
      churnRate: 0,
      chartData,
      byService,
      transactions,
    }));
  }));

  // ========================================================================
  // SETTINGS
  // ========================================================================

  router.get('/settings', asyncHandler(async (req, res) => {
    const settings = await db.select().from(schema.platformSettings);
    const templates = await db.select().from(schema.emailTemplates).orderBy(asc(schema.emailTemplates.slug));

    // Group settings by section
    const grouped: Record<string, Record<string, string>> = {};
    for (const s of settings) {
      if (!grouped[s.section]) grouped[s.section] = {};
      // Mask API keys
      if (s.key.toLowerCase().includes('key') || s.key.toLowerCase().includes('secret')) {
        grouped[s.section][s.key] = s.value.length > 8 ? `${s.value.substring(0, 4)}${'*'.repeat(20)}` : '****';
      } else {
        grouped[s.section][s.key] = s.value;
      }
    }

    res.json(successResponse({ settings: grouped, templates }));
  }));

  router.patch('/settings/:section', asyncHandler(async (req, res) => {
    const { section } = req.params;
    const data = req.body;

    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'string') continue;
      // Skip masked values
      if (value.includes('****')) continue;

      const existing = await db.query.platformSettings.findFirst({
        where: and(eq(schema.platformSettings.key, key), eq(schema.platformSettings.section, section)),
      });

      if (existing) {
        await db.update(schema.platformSettings).set({ value, updatedAt: new Date() }).where(eq(schema.platformSettings.id, existing.id));
      } else {
        await db.insert(schema.platformSettings).values({ key, value, section });
      }
    }

    res.json(successResponse(null, 'Settings updated'));
  }));

  // Email templates
  router.patch('/settings/templates/:slug', asyncHandler(async (req, res) => {
    const { subject, body, isActive } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db.update(schema.emailTemplates).set(updates).where(eq(schema.emailTemplates.slug, req.params.slug)).returning();
    if (!updated) return res.status(404).json(errorResponse('Template not found'));
    res.json(successResponse(updated));
  }));

  // ========================================================================
  // SUBSCRIPTIONS
  // ========================================================================

  router.get('/subscriptions', asyncHandler(async (req, res) => {
    const { search, status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions: any[] = [];
    if (status && status !== 'all') {
      conditions.push(eq(schema.subscriptions.status, status as any));
    }

    let query = db.select({
      id: schema.subscriptions.id,
      planType: schema.subscriptions.planType,
      planName: schema.subscriptions.planName,
      status: schema.subscriptions.status,
      billingInterval: schema.subscriptions.billingInterval,
      amount: schema.subscriptions.amount,
      currency: schema.subscriptions.currency,
      currentPeriodStart: schema.subscriptions.currentPeriodStart,
      currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: schema.subscriptions.cancelAtPeriodEnd,
      createdAt: schema.subscriptions.createdAt,
      customerName: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      customerEmail: schema.customers.email,
      customerId: schema.subscriptions.customerId,
    }).from(schema.subscriptions)
      .leftJoin(schema.customers, eq(schema.subscriptions.customerId, schema.customers.id))
      .$dynamic();

    if (search) {
      conditions.push(or(
        like(schema.customers.email, `%${search}%`),
        like(schema.customers.firstName, `%${search}%`),
        like(schema.customers.lastName, `%${search}%`),
        like(schema.subscriptions.planName, `%${search}%`),
      ));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const subscriptionsList = await (query as any)
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(schema.subscriptions);

    res.json(successResponse({
      subscriptions: subscriptionsList,
      total: totalResult.count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(totalResult.count) / Number(limit)),
    }));
  }));

  router.get('/subscriptions/summary', asyncHandler(async (req, res) => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [activeResult] = await db.select({
      count: count(),
      totalAmount: sql<number>`COALESCE(SUM(${schema.subscriptions.amount}), 0)`,
    }).from(schema.subscriptions).where(eq(schema.subscriptions.status, 'active'));

    const [pastDueResult] = await db.select({ count: count() }).from(schema.subscriptions).where(eq(schema.subscriptions.status, 'past_due'));

    const [churnedResult] = await db.select({ count: count() }).from(schema.subscriptions).where(and(
      eq(schema.subscriptions.status, 'cancelled'),
      gte(schema.subscriptions.cancelledAt, firstOfMonth),
    ));

    const [upcomingResult] = await db.select({ count: count() }).from(schema.subscriptions).where(and(
      eq(schema.subscriptions.status, 'active'),
      lte(schema.subscriptions.currentPeriodEnd, sevenDaysFromNow),
    ));

    res.json(successResponse({
      mrr: Number(activeResult.totalAmount),
      activeCount: Number(activeResult.count),
      pastDueCount: Number(pastDueResult.count),
      churnedThisMonth: Number(churnedResult.count),
      upcomingRenewals: Number(upcomingResult.count),
    }));
  }));

  router.post('/subscriptions/:id/suspend', asyncHandler(async (req, res) => {
    const now = new Date();
    await db.update(schema.subscriptions).set({
      status: 'suspended',
      suspendedAt: now,
      updatedAt: now,
    }).where(eq(schema.subscriptions.id, Number(req.params.id)));

    await db.insert(schema.billingEvents).values({
      subscriptionId: Number(req.params.id),
      eventType: 'status_changed',
      newStatus: 'suspended',
      metadata: { reason: 'admin_action' },
    });

    res.json(successResponse(null, 'Subscription suspended'));
  }));

  router.post('/subscriptions/:id/reactivate', asyncHandler(async (req, res) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.id, Number(req.params.id)),
    });
    if (!sub) return res.status(404).json(errorResponse('Subscription not found'));

    const now = new Date();
    const interval = sub.billingInterval as 'monthly' | 'yearly';
    const newEnd = new Date(now);
    if (interval === 'yearly') {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      newEnd.setMonth(newEnd.getMonth() + 1);
    }

    await db.update(schema.subscriptions).set({
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: newEnd,
      suspendedAt: null,
      cancelAtPeriodEnd: false,
      updatedAt: now,
    }).where(eq(schema.subscriptions.id, Number(req.params.id)));

    await db.insert(schema.billingEvents).values({
      subscriptionId: Number(req.params.id),
      eventType: 'status_changed',
      previousStatus: sub.status,
      newStatus: 'active',
      metadata: { reason: 'admin_reactivation' },
    });

    res.json(successResponse(null, 'Subscription reactivated'));
  }));

  router.post('/subscriptions/:id/cancel', asyncHandler(async (req, res) => {
    const now = new Date();
    await db.update(schema.subscriptions).set({
      status: 'cancelled',
      cancelledAt: now,
      updatedAt: now,
    }).where(eq(schema.subscriptions.id, Number(req.params.id)));

    await db.insert(schema.billingEvents).values({
      subscriptionId: Number(req.params.id),
      eventType: 'subscription_cancelled',
      newStatus: 'cancelled',
      metadata: { reason: 'admin_action' },
    });

    res.json(successResponse(null, 'Subscription cancelled'));
  }));

  router.get('/subscriptions/:id/history', asyncHandler(async (req, res) => {
    const cycles = await db.select()
      .from(schema.billingCycles)
      .where(eq(schema.billingCycles.subscriptionId, Number(req.params.id)))
      .orderBy(desc(schema.billingCycles.createdAt));

    const events = await db.select()
      .from(schema.billingEvents)
      .where(eq(schema.billingEvents.subscriptionId, Number(req.params.id)))
      .orderBy(desc(schema.billingEvents.createdAt))
      .limit(50);

    res.json(successResponse({ cycles, events }));
  }));

  // Global search
  router.get('/search', asyncHandler(async (req, res) => {
    const { q } = req.query as Record<string, string>;
    if (!q || q.length < 2) return res.json(successResponse({ customers: [], orders: [], domains: [] }));

    const pattern = `%${q}%`;

    const customers = await db.select({
      id: schema.customers.id,
      name: sql<string>`CONCAT(${schema.customers.firstName}, ' ', ${schema.customers.lastName})`,
      email: schema.customers.email,
    }).from(schema.customers)
      .where(or(
        like(schema.customers.email, pattern),
        like(schema.customers.firstName, pattern),
        like(schema.customers.lastName, pattern),
      ))
      .limit(5);

    const orders = await db.select({
      id: schema.orders.id,
      orderNumber: schema.orders.orderNumber,
      total: schema.orders.total,
      status: schema.orders.status,
    }).from(schema.orders)
      .where(like(schema.orders.orderNumber, pattern))
      .limit(5);

    const domains = await db.select({
      id: schema.domains.id,
      domainName: schema.domains.domainName,
      status: schema.domains.status,
    }).from(schema.domains)
      .where(like(schema.domains.domainName, pattern))
      .limit(5);

    res.json(successResponse({ customers, orders, domains }));
  }));

  // Mount all routes under /api/panel with auth + admin middleware
  app.use('/api/panel', authenticateToken, requireAdmin, router);
}
