/**
 * Billing Routes — Customer-facing subscription management
 */

import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { authenticateToken } from '../middleware/auth.js';
import type { RouteContext } from './shared.js';
import { asyncHandler, successResponse, errorResponse } from './shared.js';

export function registerBillingRoutes(app: Router, ctx: RouteContext) {
  const router = Router();
  router.use(authenticateToken);

  // GET /api/v1/billing/subscription — current user's subscriptions
  router.get(
    '/subscription',
    asyncHandler(async (req, res) => {
      const subs = await ctx.db
        .select({
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
          paymentMethodBrand: schema.subscriptions.paymentMethodBrand,
          paymentMethodLast4: schema.subscriptions.paymentMethodLast4,
          paymentMethodExpiry: schema.subscriptions.paymentMethodExpiry,
          createdAt: schema.subscriptions.createdAt,
        })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.customerId, req.user!.userId))
        .orderBy(desc(schema.subscriptions.createdAt));

      res.json(successResponse(subs));
    }),
  );

  // GET /api/v1/billing/history — billing history with pagination
  router.get(
    '/history',
    asyncHandler(async (req, res) => {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;

      // Get all subscription IDs for this user
      const userSubs = await ctx.db
        .select({ id: schema.subscriptions.id })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.customerId, req.user!.userId));

      const subIds = userSubs.map((s) => s.id);

      if (subIds.length === 0) {
        return res.json(successResponse({ history: [], total: 0 }));
      }

      const history = await ctx.db
        .select({
          id: schema.billingCycles.id,
          amount: schema.billingCycles.amount,
          currency: schema.billingCycles.currency,
          status: schema.billingCycles.status,
          paidAt: schema.billingCycles.paidAt,
          failedAt: schema.billingCycles.failedAt,
          periodStart: schema.billingCycles.periodStart,
          periodEnd: schema.billingCycles.periodEnd,
          createdAt: schema.billingCycles.createdAt,
          planName: schema.subscriptions.planName,
          planType: schema.subscriptions.planType,
        })
        .from(schema.billingCycles)
        .innerJoin(
          schema.subscriptions,
          eq(schema.billingCycles.subscriptionId, schema.subscriptions.id),
        )
        .where(eq(schema.subscriptions.customerId, req.user!.userId))
        .orderBy(desc(schema.billingCycles.createdAt))
        .limit(limit)
        .offset(offset);

      res.json(successResponse({ history, total: history.length }));
    }),
  );

  // POST /api/v1/billing/cancel — cancel subscription at period end
  router.post(
    '/cancel',
    asyncHandler(async (req, res) => {
      const { subscriptionId } = req.body;
      if (!subscriptionId) {
        return res.status(400).json(errorResponse('Subscription ID is required.'));
      }

      const sub = await ctx.db.query.subscriptions.findFirst({
        where: and(
          eq(schema.subscriptions.id, subscriptionId),
          eq(schema.subscriptions.customerId, req.user!.userId),
        ),
      });

      if (!sub) {
        return res.status(404).json(errorResponse('Subscription not found.'));
      }

      if (sub.status === 'cancelled') {
        return res.status(400).json(errorResponse('Subscription is already cancelled.'));
      }

      await ctx.db
        .update(schema.subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.subscriptions.id, subscriptionId));

      res.json(
        successResponse(
          {
            cancelAtPeriodEnd: true,
            accessEnds: sub.currentPeriodEnd,
          },
          'Your subscription will be cancelled at the end of the current billing period. You will continue to have access until then.',
        ),
      );
    }),
  );

  // POST /api/v1/billing/reactivate — reactivate a suspended subscription
  router.post(
    '/reactivate',
    asyncHandler(async (req, res) => {
      const { subscriptionId } = req.body;
      if (!subscriptionId) {
        return res.status(400).json(errorResponse('Subscription ID is required.'));
      }

      const sub = await ctx.db.query.subscriptions.findFirst({
        where: and(
          eq(schema.subscriptions.id, subscriptionId),
          eq(schema.subscriptions.customerId, req.user!.userId),
        ),
      });

      if (!sub) {
        return res.status(404).json(errorResponse('Subscription not found.'));
      }

      // Also allow undoing cancelAtPeriodEnd
      if (sub.cancelAtPeriodEnd && sub.status === 'active') {
        await ctx.db
          .update(schema.subscriptions)
          .set({
            cancelAtPeriodEnd: false,
            updatedAt: new Date(),
          })
          .where(eq(schema.subscriptions.id, subscriptionId));

        return res.json(successResponse(null, 'Cancellation reversed. Your subscription will continue.'));
      }

      const result = await ctx.billingEngine.reactivateSubscription(subscriptionId);
      if (!result.success) {
        return res.status(400).json(errorResponse(result.message));
      }

      res.json(successResponse(null, result.message));
    }),
  );

  // GET /api/v1/billing/upcoming — next charge info
  router.get(
    '/upcoming',
    asyncHandler(async (req, res) => {
      const activeSub = await ctx.db.query.subscriptions.findFirst({
        where: and(
          eq(schema.subscriptions.customerId, req.user!.userId),
          eq(schema.subscriptions.status, 'active'),
        ),
      });

      if (!activeSub) {
        return res.json(successResponse(null));
      }

      res.json(
        successResponse({
          nextChargeDate: activeSub.currentPeriodEnd,
          amount: activeSub.amount,
          currency: activeSub.currency,
          planName: activeSub.planName,
          cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd,
        }),
      );
    }),
  );

  app.use('/api/v1/billing', router);
}
