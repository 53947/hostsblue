import { Express } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { authenticateToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';

export function registerSupportRoutes(app: Express, ctx: RouteContext) {
  const { db } = ctx;

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
}
