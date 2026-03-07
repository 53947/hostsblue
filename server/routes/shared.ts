import { Request, Response } from 'express';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../shared/schema.js';
import { z } from 'zod';

export type DB = PostgresJsDatabase<typeof schema>;

// Helper for consistent responses
export const successResponse = (data: any, message?: string) => ({
  success: true,
  data,
  ...(message && { message }),
});

export const errorResponse = (message: string, code?: string, details?: any) => ({
  success: false,
  error: message,
  ...(code && { code }),
  ...(details && { details }),
});

// Async handler wrapper
export const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>) => {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
};

// Validation schemas
export const domainSearchSchema = z.object({
  domain: z.string().min(1).max(253),
});

export const createOrderSchema = z.object({
  items: z.array(z.object({
    type: z.enum([
      'domain_registration', 'domain_transfer', 'domain_renewal',
      'hosting_plan', 'hosting_addon', 'privacy_protection',
      'email_service', 'ssl_certificate', 'sitelock', 'website_builder',
      'ai_credits', 'cloud_hosting',
    ]),
    domain: z.string().optional(),
    tld: z.string().optional(),
    planId: z.number().optional(),
    termYears: z.number().min(1).max(10).default(1),
    options: z.record(z.any()).optional(),
  })).min(1),
  couponCode: z.string().optional(),
});

export function site404Html(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page Not Found</title>
<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#09080E}
.c{text-align:center;padding:2rem}.c h1{font-size:6rem;margin:0;color:#064A6C;font-weight:800}.c p{color:#4b5563;margin:1rem 0}
.c a{display:inline-block;background:#064A6C;color:#fff;padding:10px 24px;border-radius:7px;text-decoration:none;font-weight:600;margin-top:8px}
.c a:hover{background:#053C58}</style></head><body><div class="c"><h1>404</h1><p>The page you're looking for doesn't exist.</p><a href="/">Go Home</a></div></body></html>`;
}

// Cookie config factory
export function createAuthHelpers(COOKIE_OPTIONS: any) {
  return {
    setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
      res.cookie('accessToken', tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refreshToken', tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    },
    clearAuthCookies(res: Response) {
      res.clearCookie('accessToken', COOKIE_OPTIONS);
      res.clearCookie('refreshToken', COOKIE_OPTIONS);
    },
  };
}

// Services context passed to each route module
export interface RouteContext {
  db: DB;
  openSRS: any;
  wpmudev: any;
  swipesblue: any;
  opensrsEmail: any;
  opensrsSSL: any;
  sitelockService: any;
  orchestrator: any;
  aiCreditsService: any;
  hostingProvisioner: any;
  planEnforcement: any;
  analyticsAggregation: any;
  resend: any;
  emailService: any;
  authLoginLimiter: any;
  authRegisterLimiter: any;
  generalLimiter: any;
  COOKIE_OPTIONS: any;
  setAuthCookies: (res: Response, tokens: { accessToken: string; refreshToken: string }) => void;
  clearAuthCookies: (res: Response) => void;
}
