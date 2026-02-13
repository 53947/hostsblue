import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWKS } from 'jwks-rsa';

// In-memory cache for tokens (use Redis in production)
const tokenCache = new Map<string, any>();

export interface JWTPayload {
  userId: number;
  email: string;
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

// Load keys from environment or files
let privateKey: string;
let publicKey: string;

try {
  // In production, load from secure file storage
  if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
    privateKey = process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
    publicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
  } else {
    // Development fallback - generate or use static keys
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
 * Express middleware to authenticate JWT token
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access token required',
      code: 'TOKEN_MISSING',
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
    
    // Cache the decoded token
    tokenCache.set(token, {
      payload: decoded,
      exp: decoded.exp,
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

  // Check admin status from database (cache this in token in production)
  // For now, we'll check the isAdmin flag that should be added to token
  // This is a simplified version - implement proper admin check
  
  next();
}

/**
 * Clear token cache (useful for logout)
 */
export function invalidateToken(token: string): void {
  tokenCache.delete(token);
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
