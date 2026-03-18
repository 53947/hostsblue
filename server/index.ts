import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import compression from 'compression';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema.js';
import { registerRoutes } from './routes.js';
import { registerWidgetRoutes } from './routes/widget.js';
import { loadActiveProviderFromDB } from './services/payment/payment-service.js';
import cron from 'node-cron';
import { SwipesBluePayment } from './services/swipesblue-payment.js';
import { EmailService } from './services/email-service.js';
import { BillingEngine } from './services/billing-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 5001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });

const app = express();

// Compression
app.use(compression());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration
const PgSession = ConnectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// CORS configuration — includes dynamic widget origins
app.use(async (req, res, next) => {
  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];
  const allowedOrigins = envOrigins.length > 0
    ? envOrigins
    : [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'https://hostsblue.com',
        'https://www.hostsblue.com',
      ];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (origin && req.path.startsWith('/api/widget/')) {
    // For widget routes, dynamically check against widget token origins
    try {
      const tokens = await db.query.widgetTokens.findMany({
        where: eq(schema.widgetTokens.isActive, true),
      });
      const widgetOrigins = tokens.flatMap(t => (t.allowedOrigins as string[]) || []);
      if (widgetOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
    } catch {}
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Custom domain middleware: serve published sites on custom domains
app.use(async (req, res, next) => {
  const hostname = req.hostname;
  // Skip API requests, localhost, and hostsblue domains
  if (req.path.startsWith('/api/') || req.path.startsWith('/sites/') || req.path.startsWith('/dashboard') ||
      hostname === 'localhost' || hostname.includes('hostsblue') || hostname.includes('replit')) {
    return next();
  }

  try {
    const { eq, and } = await import('drizzle-orm');

    // Check customDomains table for a verified domain
    const domainRecord = await db.query.customDomains.findFirst({
      where: and(
        eq(schema.customDomains.domain, hostname),
        eq(schema.customDomains.verified, true),
      ),
    });
    if (!domainRecord) return next();

    const project = await db.query.websiteProjects.findFirst({
      where: and(
        eq(schema.websiteProjects.id, domainRecord.projectId),
        eq(schema.websiteProjects.status, 'published'),
      ),
    });
    if (!project) return next();

    const pageSlug = req.path === '/' ? undefined : req.path.replace(/^\//, '').replace(/\/$/, '');
    const { websitePages } = schema;
    const page = pageSlug
      ? await db.query.websitePages.findFirst({ where: and(eq(websitePages.projectId, project.id), eq(websitePages.slug, pageSlug)) })
      : await db.query.websitePages.findFirst({ where: and(eq(websitePages.projectId, project.id), eq(websitePages.isHomePage, true)) });

    if (page) {
      const { renderPage } = await import('./services/website-renderer.js');
      const { defaultTheme } = await import('../shared/block-types.js');
      const allPages = await db.query.websitePages.findMany({ where: eq(websitePages.projectId, project.id), orderBy: websitePages.sortOrder });
      const theme = (project.theme || defaultTheme) as any;
      const html = renderPage((page.blocks || []) as any[], {
        theme,
        businessName: project.name,
        seo: (page.seo || {}) as any,
        siteSlug: project.slug || '',
        pages: allPages.map(p => ({ slug: p.slug, title: p.title, showInNav: p.showInNav })),
      });
      return res.type('html').send(html);
    }
  } catch {
    // Fall through to normal routing
  }

  next();
});

// Register all API routes
registerRoutes(app, db);
registerWidgetRoutes(app, db as any);

// Load payment provider setting from DB (non-blocking)
loadActiveProviderFromDB().catch(() => {});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working', timestamp: new Date().toISOString() });
});

// One-time setup endpoint — run against production DB via the deployed app
// DELETE THIS AFTER USE
app.get('/api/v1/admin/setup-production', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== 'hostsblue-setup-2026') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const results: string[] = [];

  try {
    // Step 1: Fix missing columns
    const columns = [
      { name: 'magic_link_token', sql: `ALTER TABLE customers ADD COLUMN IF NOT EXISTS magic_link_token VARCHAR(255)` },
      { name: 'magic_link_expires_at', sql: `ALTER TABLE customers ADD COLUMN IF NOT EXISTS magic_link_expires_at TIMESTAMP` },
    ];
    for (const col of columns) {
      try {
        await pool.query(col.sql);
        results.push(`Column ${col.name}: added`);
      } catch (err: any) {
        results.push(`Column ${col.name}: ${err.code === '42701' ? 'already exists' : err.message}`);
      }
    }

    // Step 2: Create customer if not exists
    const email = (req.query.email as string) || 'deanlaskowski@hostsblue.com';
    const password = (req.query.password as string) || 'HostsBlue2026!';
    const firstName = (req.query.first as string) || 'Dean';
    const lastName = (req.query.last as string) || 'Laskowski';

    const existing = await pool.query('SELECT id, email FROM customers WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      results.push(`Customer ${email}: already exists (id: ${existing.rows[0].id})`);
    } else {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash(password, 10);
      const inserted = await pool.query(
        `INSERT INTO customers (email, password_hash, first_name, last_name, is_active, is_admin, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, false, true, NOW(), NOW()) RETURNING id, email`,
        [email, hash, firstName, lastName]
      );
      results.push(`Customer ${email}: created (id: ${inserted.rows[0].id})`);
    }

    // Step 3: Show DATABASE_URL info (masked)
    const dbUrl = process.env.DATABASE_URL || 'NOT SET';
    const masked = dbUrl.length > 20 ? dbUrl.substring(0, 25) + '...' : dbUrl;
    results.push(`DATABASE_URL starts with: ${masked}`);

    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, results });
  }
});

// Serve static files from public folder (fallback) or dist (built frontend)
let distPath = path.resolve(process.cwd(), 'dist/client');
if (!fs.existsSync(distPath)) {
  distPath = path.resolve(process.cwd(), 'public');
  console.log(`[STARTUP] dist/client not found, using public folder instead`);
}
console.log(`[STARTUP] Serving static files from: ${distPath}`);
console.log(`[STARTUP] Directory exists: ${fs.existsSync(distPath)}`);
console.log(`[STARTUP] index.html exists: ${fs.existsSync(path.join(distPath, 'index.html'))}`);

app.use(express.static(distPath));

// SPA fallback: serve index.html for all non-API routes
app.get('/{*path}', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  
  // Try to send the file, or fallback to plain HTML
  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error(`[ERROR] Failed to read ${indexPath}:`, err.message);
      res.send('<h1>hostsblue server running</h1><p>index.html not found, but server is online.</p>');
    } else {
      res.type('html').send(data);
    }
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  // Don't leak error details in production
  const message = NODE_ENV === 'production' 
    ? 'An unexpected error occurred' 
    : err.message || 'Internal server error';
  
  res.status(err.status || 500).json({
    success: false,
    error: message,
    ...(NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// Daily billing cron — 2:00 AM UTC
const billingEngine = new BillingEngine(db as any, new SwipesBluePayment(), new EmailService());
cron.schedule('0 2 * * *', () => {
  console.log('[Cron] Running daily billing cycle...');
  billingEngine.runBillingCycle().catch((err) => {
    console.error('[Cron] Billing cycle error:', err);
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   hostsblue server                                            ║
║   Domain & Hosting Platform                                ║
║                                                            ║
║   Environment: ${NODE_ENV.padEnd(43)}║
║   Port: ${String(PORT).padEnd(50)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
