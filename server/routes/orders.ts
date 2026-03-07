import { Express } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, errorResponse, createOrderSchema, type RouteContext } from './shared.js';
import { getPaymentProvider } from '../services/payment/payment-service.js';

export function registerOrderRoutes(app: Express, ctx: RouteContext) {
  const { db, orchestrator, aiCreditsService, emailService } = ctx;

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
        const sslPrice = item.options?.price || 13900;
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
    
    // Initiate payment with active provider
    const paymentProvider = getPaymentProvider();
    const paymentUrl = await paymentProvider.createPaymentSession({
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
    const signature = req.headers['x-swipesblue-signature'] || req.headers['stripe-signature'];

    // Verify webhook signature
    const paymentProvider = getPaymentProvider();
    if (!paymentProvider.verifyWebhookSignature(req.body, signature as string)) {
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
        // Send payment failure email
        try {
          const failedOrder = await db.query.orders.findFirst({
            where: eq(schema.orders.id, data.orderId),
            with: { customer: true },
          });
          if (failedOrder?.customer) {
            emailService.sendPaymentFailed(failedOrder.customer.email, {
              customerName: [failedOrder.customer.firstName, failedOrder.customer.lastName].filter(Boolean).join(' ') || 'Customer',
              orderNumber: failedOrder.orderNumber,
              amount: failedOrder.total,
              currency: failedOrder.currency,
              reason: data.failure_message || 'Payment was declined',
            }).catch(() => {});
          }
        } catch { /* non-critical */ }
        break;
        
      case 'payment.refunded':
        await orchestrator.handlePaymentRefund(data.orderId, data);
        break;
    }
    
    res.json({ received: true });
  }));
  
  // Stripe-specific webhook endpoint (for raw body signature verification)
  app.post('/api/v1/webhooks/stripe', asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) return res.status(400).json(errorResponse('Missing stripe-signature header'));

    const stripeProvider = getPaymentProvider('stripe' as any);
    if (!stripeProvider.verifyWebhookSignature(JSON.stringify(req.body), sig)) {
      return res.status(401).json(errorResponse('Invalid Stripe signature'));
    }

    const event = req.body;

    // Store webhook event
    await db.insert(schema.webhookEvents).values({
      source: 'stripe',
      eventType: event.type,
      payload: event.data,
      idempotencyKey: event.id,
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderId = parseInt(session.metadata?.orderId);
        if (orderId) {
          await orchestrator.handlePaymentSuccess(orderId, {
            paymentReference: session.payment_intent || session.id,
            amount: session.amount_total,
            currency: session.currency,
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        const orderId = parseInt(intent.metadata?.orderId);
        if (orderId) {
          await orchestrator.handlePaymentFailure(orderId, {
            failure_message: intent.last_payment_error?.message || 'Payment failed',
          });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const orderId = parseInt(charge.metadata?.orderId);
        if (orderId) {
          await orchestrator.handlePaymentRefund(orderId, {
            amount: charge.amount_refunded,
            refundId: charge.id,
          });
        }
        break;
      }
    }

    res.json({ received: true });
  }));
}
