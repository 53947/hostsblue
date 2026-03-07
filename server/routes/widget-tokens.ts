import { Express } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { authenticateToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';
import crypto from 'crypto';

export function registerWidgetTokenRoutes(app: Express, ctx: RouteContext) {
  const { db } = ctx;

  app.post('/api/v1/widget-tokens', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { label, allowedOrigins } = req.body;
    const token = `wt_${crypto.randomBytes(28).toString('hex')}`;

    const [widgetToken] = await db.insert(schema.widgetTokens).values({
      customerId: req.user!.userId,
      token,
      label: label || 'Default',
      allowedOrigins: allowedOrigins || [],
    }).returning();

    res.status(201).json(successResponse(widgetToken));
  }));

  app.get('/api/v1/widget-tokens', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const tokens = await db.query.widgetTokens.findMany({
      where: eq(schema.widgetTokens.customerId, req.user!.userId),
      orderBy: desc(schema.widgetTokens.createdAt),
    });
    res.json(successResponse(tokens));
  }));

  app.delete('/api/v1/widget-tokens/:id', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const [token] = await db.select().from(schema.widgetTokens)
      .where(and(eq(schema.widgetTokens.id, id), eq(schema.widgetTokens.customerId, req.user!.userId)));

    if (!token) return res.status(404).json(errorResponse('Token not found'));

    await db.delete(schema.widgetTokens).where(eq(schema.widgetTokens.id, id));
    res.json(successResponse(null, 'Token revoked'));
  }));
}
