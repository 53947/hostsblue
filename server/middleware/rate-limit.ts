import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

export function rateLimiter(options: RateLimiterOptions = {}) {
  const { windowMs = 60000, max = 100, message = 'Too many requests' } = options;
  const store = new Map<string, RateLimitEntry>();

  // Cleanup expired entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 60000);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > max) {
      res.status(429).json({ success: false, error: message, code: 'RATE_LIMITED' });
      return;
    }

    next();
  };
}
