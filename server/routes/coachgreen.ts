import { Express } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { authenticateToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';

export function registerCoachGreenRoutes(app: Express, ctx: RouteContext) {
  const { db } = ctx;

  app.post('/api/v1/coach-green/chat', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { message, context, sessionId } = req.body;
    if (!message) return res.status(400).json(errorResponse('Message is required'));

    const validContexts = ['editor', 'dashboard', 'widget'];
    const ctx = validContexts.includes(context) ? context : 'dashboard';

    // Load or create session
    let session: any;
    if (sessionId) {
      session = await db.query.coachGreenSessions.findFirst({
        where: and(
          eq(schema.coachGreenSessions.id, sessionId),
          eq(schema.coachGreenSessions.customerId, req.user!.userId),
        ),
      });
    }

    if (!session) {
      [session] = await db.insert(schema.coachGreenSessions).values({
        customerId: req.user!.userId,
        context: ctx,
        messages: [],
      }).returning();
    }

    const messages: any[] = (session.messages as any[]) || [];
    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

    // Get customer context for better responses
    const activeServices = [];
    const domainCount = await db.select({ count: sql<number>`count(*)` }).from(schema.domains).where(eq(schema.domains.customerId, req.user!.userId));
    if (Number(domainCount[0]?.count) > 0) activeServices.push('domains');
    const hostingCount = await db.select({ count: sql<number>`count(*)` }).from(schema.hostingAccounts).where(eq(schema.hostingAccounts.customerId, req.user!.userId));
    if (Number(hostingCount[0]?.count) > 0) activeServices.push('hosting');
    const projectCount = await db.select({ count: sql<number>`count(*)` }).from(schema.websiteProjects).where(eq(schema.websiteProjects.customerId, req.user!.userId));
    if (Number(projectCount[0]?.count) > 0) activeServices.push('website-builder');

    const aiResponse = `Thanks for reaching out! Based on your active services (${activeServices.join(', ') || 'none yet'}), here are some things you might want to do next. How can I help?`;

    messages.push({ role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() });

    await db.update(schema.coachGreenSessions)
      .set({ messages, updatedAt: new Date() })
      .where(eq(schema.coachGreenSessions.id, session.id));

    res.json(successResponse({
      sessionId: session.id,
      message: aiResponse,
      context: ctx,
    }));
  }));

  app.get('/api/v1/coach-green/suggestions', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const customerId = req.user!.userId;

    // Gather what the customer subscribes to
    const [domainRows, hostingRows, projectRows, emailRows, sslRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.domains).where(eq(schema.domains.customerId, customerId)),
      db.select({ count: sql<number>`count(*)` }).from(schema.hostingAccounts).where(eq(schema.hostingAccounts.customerId, customerId)),
      db.select({ count: sql<number>`count(*)` }).from(schema.websiteProjects).where(eq(schema.websiteProjects.customerId, customerId)),
      db.select({ count: sql<number>`count(*)` }).from(schema.emailAccounts).where(eq(schema.emailAccounts.customerId, customerId)),
      db.select({ count: sql<number>`count(*)` }).from(schema.sslCertificates).where(eq(schema.sslCertificates.customerId, customerId)),
    ]);

    const suggestions: Array<{ title: string; description: string; action: string; priority: string }> = [];

    if (Number(domainRows[0]?.count) === 0) {
      suggestions.push({ title: 'Register your first domain', description: 'Search and register a domain name for your business.', action: '/domains/search', priority: 'high' });
    }
    if (Number(hostingRows[0]?.count) === 0) {
      suggestions.push({ title: 'Set up hosting', description: 'Launch a WordPress site with managed hosting.', action: '/hosting', priority: 'high' });
    }
    if (Number(projectRows[0]?.count) === 0) {
      suggestions.push({ title: 'Build a website', description: 'Use the website builder to create a site with AI assistance.', action: '/dashboard/website-builder', priority: 'high' });
    }
    if (Number(emailRows[0]?.count) === 0 && Number(domainRows[0]?.count) > 0) {
      suggestions.push({ title: 'Set up professional email', description: 'Create email accounts on your domain.', action: '/dashboard/email', priority: 'medium' });
    }
    if (Number(sslRows[0]?.count) === 0 && Number(domainRows[0]?.count) > 0) {
      suggestions.push({ title: 'Secure your site with SSL', description: 'Install an SSL certificate for HTTPS security.', action: '/dashboard/ssl', priority: 'medium' });
    }
    if (Number(projectRows[0]?.count) > 0) {
      suggestions.push({ title: 'Review your analytics', description: 'Check how visitors interact with your website.', action: '/dashboard/website-builder', priority: 'low' });
    }

    // Always add these general suggestions
    if (suggestions.length < 3) {
      suggestions.push({ title: 'Explore cloud servers', description: 'Deploy a cloud server for custom applications.', action: '/dashboard/servers', priority: 'low' });
    }

    res.json(successResponse(suggestions));
  }));
}
