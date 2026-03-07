import { Express, Request, Response } from 'express';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../shared/schema.js';
import { registerPanelRoutes } from './routes/panel.js';
import { rateLimiter } from './middleware/rate-limit.js';
import { OpenSRSIntegration } from './services/opensrs-integration.js';
import { WPMUDevIntegration } from './services/wpmudev-integration.js';
import { SwipesBluePayment } from './services/swipesblue-payment.js';
import { getPaymentProvider, getActiveProviderName, setActiveProvider, loadActiveProviderFromDB } from './services/payment/payment-service.js';
import { EmailService } from './services/email-service.js';
import { OpenSRSEmailIntegration } from './services/opensrs-email-integration.js';
import { OpenSRSSSLIntegration } from './services/opensrs-ssl-integration.js';
import { SiteLockIntegration } from './services/sitelock-integration.js';
import { OrderOrchestrator } from './services/order-orchestration.js';
import { AiCreditsService } from './services/ai-credits.js';
import { PlanEnforcement } from './services/plan-enforcement.js';
import { AnalyticsAggregation } from './services/analytics-aggregation.js';
import { HostingProvisioner } from './services/hosting-provisioner.js';
import { Resend } from 'resend';
import { ZodError } from 'zod';

import { type RouteContext, errorResponse } from './routes/shared.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerDomainRoutes } from './routes/domains.js';
import { registerHostingRoutes } from './routes/hosting.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { registerEmailRoutes } from './routes/email.js';
import { registerSSLRoutes } from './routes/ssl.js';
import { registerSiteLockRoutes } from './routes/sitelock.js';
import { registerBuilderRoutes } from './routes/builder.js';
import { registerSupportRoutes } from './routes/support.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerWidgetTokenRoutes } from './routes/widget-tokens.js';
import { registerCoachGreenRoutes } from './routes/coachgreen.js';

export function registerRoutes(app: Express, db: PostgresJsDatabase<typeof schema>) {
  // Initialize services
  const openSRS = new OpenSRSIntegration();
  const wpmudev = new WPMUDevIntegration();
  const swipesblue = new SwipesBluePayment();
  const opensrsEmail = new OpenSRSEmailIntegration();
  const opensrsSSL = new OpenSRSSSLIntegration();
  const sitelockService = new SiteLockIntegration();
  const orchestrator = new OrderOrchestrator(db, openSRS, wpmudev, opensrsEmail, opensrsSSL, sitelockService);
  const aiCreditsService = new AiCreditsService(db);
  const hostingProvisioner = new HostingProvisioner(db);
  const planEnforcement = new PlanEnforcement(db);
  const analyticsAggregation = new AnalyticsAggregation(db);
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const emailService = new EmailService();

  // Rate limiters
  const authLoginLimiter = rateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Too many login attempts' });
  const authRegisterLimiter = rateLimiter({ windowMs: 60 * 1000, max: 5, message: 'Too many registration attempts' });
  const generalLimiter = rateLimiter({ windowMs: 60 * 1000, max: 100 });

  // Cookie config
  const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  function clearAuthCookies(res: Response) {
    res.clearCookie('accessToken', COOKIE_OPTIONS);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
  }

  // Shared context for all route modules
  const ctx: RouteContext = {
    db,
    openSRS,
    wpmudev,
    swipesblue,
    opensrsEmail,
    opensrsSSL,
    sitelockService,
    orchestrator,
    aiCreditsService,
    hostingProvisioner,
    planEnforcement,
    analyticsAggregation,
    resend,
    emailService,
    authLoginLimiter,
    authRegisterLimiter,
    generalLimiter,
    COOKIE_OPTIONS,
    setAuthCookies,
    clearAuthCookies,
  };

  // Register all route modules
  registerAuthRoutes(app, ctx);
  registerDomainRoutes(app, ctx);
  registerHostingRoutes(app, ctx);
  registerAdminRoutes(app, ctx);
  registerOrderRoutes(app, ctx);
  registerDashboardRoutes(app, ctx);
  registerEmailRoutes(app, ctx);
  registerSSLRoutes(app, ctx);
  registerSiteLockRoutes(app, ctx);
  registerBuilderRoutes(app, ctx);
  registerSupportRoutes(app, ctx);
  registerWebhookRoutes(app, ctx);
  registerWidgetTokenRoutes(app, ctx);
  registerCoachGreenRoutes(app, ctx);

  // Validation error handler
  app.use((err: any, req: Request, res: Response, next: any) => {
    if (err instanceof ZodError) {
      return res.status(400).json(errorResponse(
        'Validation error',
        'VALIDATION_ERROR',
        err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      ));
    }
    next(err);
  });

  // Mount admin panel routes
  registerPanelRoutes(app, db as any);
}
