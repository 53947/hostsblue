import { Express } from 'express';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { authenticateToken, requireAuth, generateTokens, blacklistToken } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { asyncHandler, successResponse, errorResponse, type RouteContext } from './shared.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export function registerAuthRoutes(app: Express, ctx: RouteContext) {
  const { db, emailService, resend, authRegisterLimiter, authLoginLimiter, setAuthCookies, clearAuthCookies } = ctx;

  app.post('/api/v1/auth/register', authRegisterLimiter, asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName } = req.body;

    const existing = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });

    if (existing) {
      return res.status(409).json(errorResponse('Email already registered', 'EMAIL_EXISTS'));
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [customer] = await db.insert(schema.customers).values({
      email,
      passwordHash,
      firstName,
      lastName,
    }).returning();

    const tokens = generateTokens({ userId: customer.id, email: customer.email });
    setAuthCookies(res, tokens);

    await db.insert(schema.auditLogs).values({
      customerId: customer.id,
      action: 'customer.register',
      entityType: 'customer',
      entityId: String(customer.id),
      description: 'Customer registered',
    });

    emailService.sendWelcome(customer.email, customer.firstName || 'there').catch(() => {});

    res.status(201).json(successResponse({
      customer: {
        id: customer.id,
        uuid: customer.uuid,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
    }, 'Registration successful'));
  }));

  app.post('/api/v1/auth/login', authLoginLimiter, asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });

    if (!customer || !customer.isActive) {
      return res.status(401).json(errorResponse('Invalid credentials', 'INVALID_CREDENTIALS'));
    }

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) {
      return res.status(401).json(errorResponse('Invalid credentials', 'INVALID_CREDENTIALS'));
    }

    await db.update(schema.customers)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.customers.id, customer.id));

    const tokens = generateTokens({ userId: customer.id, email: customer.email, isAdmin: customer.isAdmin });
    setAuthCookies(res, tokens);

    res.json(successResponse({
      customer: {
        id: customer.id,
        uuid: customer.uuid,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        isAdmin: customer.isAdmin,
      },
    }));
  }));

  app.post('/api/v1/auth/refresh', asyncHandler(async (req, res) => {
    const refreshTokenValue = req.cookies?.refreshToken;
    if (!refreshTokenValue) {
      return res.status(401).json(errorResponse('Refresh token required', 'TOKEN_MISSING'));
    }
    try {
      const { default: jwt } = await import('jsonwebtoken');
      const decoded = jwt.verify(refreshTokenValue, process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n') || 'dev-private-key', {
        algorithms: [process.env.NODE_ENV === 'production' ? 'RS256' : 'HS256'],
      }) as any;
      const tokens = generateTokens({ userId: decoded.userId, email: decoded.email || '' });
      setAuthCookies(res, tokens);
      res.json(successResponse({ refreshed: true }));
    } catch {
      clearAuthCookies(res);
      return res.status(401).json(errorResponse('Invalid refresh token', 'TOKEN_INVALID'));
    }
  }));

  app.post('/api/v1/auth/logout', asyncHandler(async (req, res) => {
    const token = req.cookies?.accessToken;
    if (token) {
      blacklistToken(token);
    }
    clearAuthCookies(res);
    res.json(successResponse(null, 'Logged out'));
  }));

  app.post('/api/v1/auth/magic-link/request', rateLimiter({ windowMs: 60000, max: 5, message: 'Too many magic link requests' }), asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json(errorResponse('Email is required'));

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });

    if (customer && customer.isActive) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.update(schema.customers)
        .set({ magicLinkToken: token, magicLinkExpiresAt: expiresAt })
        .where(eq(schema.customers.id, customer.id));

      const clientUrl = process.env.CLIENT_URL || 'https://hostsblue.com';
      const loginUrl = `${clientUrl}/auth/magic-link?token=${token}`;

      emailService.sendMagicLink(customer.email, {
        customerName: customer.firstName || 'there',
        loginUrl,
      }).catch(() => {});
    }

    res.json(successResponse(null, 'If that email is registered, a login link has been sent.'));
  }));

  app.get('/api/v1/auth/magic-link/verify', asyncHandler(async (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json(errorResponse('Token is required'));
    }

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.magicLinkToken, token),
    });

    if (!customer || !customer.magicLinkExpiresAt || customer.magicLinkExpiresAt < new Date()) {
      return res.status(400).json(errorResponse('Invalid or expired magic link', 'MAGIC_LINK_INVALID'));
    }

    if (!customer.isActive) {
      return res.status(403).json(errorResponse('Account is suspended'));
    }

    await db.update(schema.customers)
      .set({ magicLinkToken: null, magicLinkExpiresAt: null, lastLoginAt: new Date() })
      .where(eq(schema.customers.id, customer.id));

    const tokens = generateTokens({ userId: customer.id, email: customer.email, isAdmin: customer.isAdmin });
    setAuthCookies(res, tokens);

    res.json(successResponse({
      customer: {
        id: customer.id,
        uuid: customer.uuid,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        isAdmin: customer.isAdmin,
      },
    }, 'Login successful'));
  }));

  app.post('/api/v1/auth/forgot-password', rateLimiter({ windowMs: 60000, max: 3 }), asyncHandler(async (req, res) => {
    const { email } = req.body;
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });

    if (customer) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

      await db.update(schema.customers)
        .set({
          resetToken,
          resetTokenExpiresAt: resetExpiry,
        })
        .where(eq(schema.customers.id, customer.id));

      if (resend) {
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'noreply@hostsblue.com',
            to: email,
            subject: 'Reset Your hostsblue Password',
            html: `<p>Click the link below to reset your password:</p>
                   <p><a href="${process.env.CLIENT_URL}/reset-password?token=${resetToken}">Reset Password</a></p>
                   <p>This link expires in 1 hour.</p>`,
          });
        } catch (err) {
          console.error('Failed to send reset email:', err);
        }
      }
    }

    res.json(successResponse(null, 'If that email exists, a reset link has been sent'));
  }));

  app.post('/api/v1/auth/reset-password', asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json(errorResponse('Token and password required'));
    }

    const customer = await db.query.customers.findFirst({
      where: sql`${schema.customers.email} IS NOT NULL AND reset_token = ${token} AND reset_token_expires_at > NOW()`,
    });

    if (!customer) {
      return res.status(400).json(errorResponse('Invalid or expired reset token'));
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(schema.customers)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      })
      .where(eq(schema.customers.id, customer.id));

    res.json(successResponse(null, 'Password reset successful'));
  }));

  app.patch('/api/v1/auth/profile', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { firstName, lastName, companyName, phone, address1, address2, city, state, postalCode, countryCode } = req.body;

    const [updated] = await db.update(schema.customers)
      .set({
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(companyName !== undefined && { companyName }),
        ...(phone !== undefined && { phone }),
        ...(address1 !== undefined && { address1 }),
        ...(address2 !== undefined && { address2 }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(postalCode !== undefined && { postalCode }),
        ...(countryCode !== undefined && { countryCode }),
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.id, req.user!.userId))
      .returning();

    res.json(successResponse({
      id: updated.id,
      uuid: updated.uuid,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      companyName: updated.companyName,
      phone: updated.phone,
      address1: updated.address1,
      city: updated.city,
      state: updated.state,
      postalCode: updated.postalCode,
      countryCode: updated.countryCode,
    }));
  }));

  app.patch('/api/v1/auth/password', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json(errorResponse('Current and new password required'));
    }

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, req.user!.userId),
    });

    if (!customer) {
      return res.status(404).json(errorResponse('User not found'));
    }

    const valid = await bcrypt.compare(currentPassword, customer.passwordHash);
    if (!valid) {
      return res.status(400).json(errorResponse('Current password is incorrect'));
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(schema.customers)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.customers.id, customer.id));

    res.json(successResponse(null, 'Password changed successfully'));
  }));

  app.get('/api/v1/auth/me', authenticateToken, requireAuth, asyncHandler(async (req, res) => {
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, req.user!.userId),
    });

    if (!customer) {
      return res.status(404).json(errorResponse('User not found'));
    }

    res.json(successResponse({
      id: customer.id,
      uuid: customer.uuid,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      companyName: customer.companyName,
      phone: customer.phone,
      address1: customer.address1,
      city: customer.city,
      state: customer.state,
      postalCode: customer.postalCode,
      countryCode: customer.countryCode,
      emailVerified: customer.emailVerified,
      isAdmin: customer.isAdmin,
    }));
  }));
}
