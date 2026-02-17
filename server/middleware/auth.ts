import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: number;
  email: string;
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// LRU-bounded cache (max 10000 entries) instead of unbounded Map
const MAX_CACHE_SIZE = 10000;
const tokenCache = new Map<string, { payload: JWTPayload; exp: number }>();

// Token blacklist for logout support
const tokenBlacklist = new Set<string>();

function evictOldest() {
  if (tokenCache.size >= MAX_CACHE_SIZE) {
    // Delete the first (oldest) entry
    const firstKey = tokenCache.keys().next().value;
    if (firstKey) {
      tokenCache.delete(firstKey);
    }
  }
}

// Load keys from environment or files
let privateKey: string;
let publicKey: string;

try {
  if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
    privateKey = process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
    publicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
  } else {
    console.warn('JWT keys not configured, using development fallback');
    privateKey = 'dev-private-key';
    publicKey = 'dev-private-key';
  }
} catch (error) {
  console.error('Failed to load JWT keys:', error);
  throw new Error('JWT configuration error');
}

/**
 * Generate access and refresh tokens
 */
export function generateTokens(payload: Omit<JWTPayload, 'iat' | 'exp'>): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  const accessToken = jwt.sign(payload, privateKey, {
    algorithm: process.env.NODE_ENV === 'production' ? 'RS256' : 'HS256',
    expiresIn: '15m',
    issuer: process.env.JWT_ISSUER || 'hostsblue.com',
    audience: process.env.JWT_AUDIENCE || 'hostsblue.com',
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, type: 'refresh' },
    privateKey,
    {
      algorithm: process.env.NODE_ENV === 'production' ? 'RS256' : 'HS256',
      expiresIn: '7d',
      issuer: process.env.JWT_ISSUER || 'hostsblue.com',
    }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
  };
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: [process.env.NODE_ENV === 'production' ? 'RS256' : 'HS256'],
      issuer: process.env.JWT_ISSUER || 'hostsblue.com',
      audience: process.env.JWT_AUDIENCE || 'hostsblue.com',
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Blacklist a token (for logout support)
 */
export function blacklistToken(token: string): void {
  tokenBlacklist.add(token);
  tokenCache.delete(token);
}

/**
 * Express middleware to authenticate JWT token
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Read token from cookie first, fallback to Authorization header
  const cookieToken = req.cookies?.accessToken;
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const token = cookieToken || headerToken;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access token required',
      code: 'TOKEN_MISSING',
    });
    return;
  }

  // Check blacklist
  if (tokenBlacklist.has(token)) {
    res.status(403).json({
      success: false,
      error: 'Token has been revoked',
      code: 'TOKEN_REVOKED',
    });
    return;
  }

  try {
    // Check cache first
    const cached = tokenCache.get(token);
    if (cached && cached.exp > Date.now() / 1000) {
      req.user = cached.payload;
      next();
      return;
    }

    const decoded = verifyToken(token);

    // Cache the decoded token (with LRU eviction)
    evictOldest();
    tokenCache.set(token, {
      payload: decoded,
      exp: decoded.exp!,
    });

    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'TOKEN_INVALID',
    });
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }
  next();
}

/**
 * Middleware to require admin role
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  if (req.user.isAdmin !== true) {
    res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
    });
    return;
  }

  next();
}

/**
 * Clear token from cache (useful for logout)
 */
export function invalidateToken(token: string): void {
  tokenCache.delete(token);
  tokenBlacklist.add(token);
}

/**
 * Clean up expired tokens periodically
 */
setInterval(() => {
  const now = Date.now() / 1000;
  for (const [token, data] of tokenCache.entries()) {
    if (data.exp < now) {
      tokenCache.delete(token);
    }
  }
}, 60000); // Clean up every minute
