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

// Debug login — DELETE AFTER USE
app.get('/api/v1/admin/debug-login', async (req, res) => {
  if (req.query.secret !== 'hostsblue-setup-2026') return res.status(403).json({ error: 'Forbidden' });
  const email = req.query.email as string;
  try {
    const result = await pool.query('SELECT id, email, password_hash, is_active FROM customers WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.json({ found: false, email });
    const customer = result.rows[0];
    const bcrypt = await import('bcrypt');
    const passwordMatch = await bcrypt.default.compare(req.query.password as string, customer.password_hash);
    const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'customers' ORDER BY ordinal_position`);
    res.json({ found: true, id: customer.id, is_active: customer.is_active, passwordMatch, columns: cols.rows.map((r: any) => r.column_name) });
  } catch (err: any) {
    res.json({ error: err.message });
  }
});

// Reset password — DELETE AFTER USE
app.get('/api/v1/admin/reset-password', async (req, res) => {
  if (req.query.secret !== 'hostsblue-setup-2026') return res.status(403).json({ error: 'Forbidden' });
  const email = req.query.email as string;
  const password = req.query.password as string;
  try {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.default.hash(password, 10);
    await pool.query('UPDATE customers SET password_hash = $1 WHERE email = $2', [hash, email]);
    res.json({ success: true, message: `Password reset for ${email}` });
  } catch (err: any) {
    res.json({ error: err.message });
  }
});

// Check table — DELETE AFTER USE
app.get('/api/v1/admin/check-table', async (req, res) => {
  if (req.query.secret !== 'hostsblue-setup-2026') return res.status(403).json({ error: 'Forbidden' });
  const table = req.query.table as string;
  try {
    const exists = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`, [table]);
    if (!exists.rows[0].exists) {
      return res.json({ table, exists: false });
    }
    const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table]);
    res.json({ table, exists: true, columns: cols.rows });
  } catch (err: any) {
    res.json({ error: err.message });
  }
});

// Create missing tables — DELETE AFTER USE
app.get('/api/v1/admin/sync-tables', async (req, res) => {
  if (req.query.secret !== 'hostsblue-setup-2026') return res.status(403).json({ error: 'Forbidden' });
  const results: string[] = [];
  const tables = [
    {
      name: 'widget_tokens',
      sql: `CREATE TABLE IF NOT EXISTS widget_tokens (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        token VARCHAR(64) NOT NULL UNIQUE,
        label VARCHAR(255),
        allowed_origins JSONB DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP
      )`,
    },
    {
      name: 'platform_settings',
      sql: `CREATE TABLE IF NOT EXISTS platform_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        section VARCHAR(100) NOT NULL DEFAULT 'general',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: 'support_tickets',
      sql: `CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        subject VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'normal',
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        assigned_to INTEGER REFERENCES customers(id),
        closed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: 'ticket_messages',
      sql: `CREATE TABLE IF NOT EXISTS ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES support_tickets(id),
        sender_id INTEGER REFERENCES customers(id),
        sender_type VARCHAR(20) NOT NULL DEFAULT 'customer',
        body TEXT NOT NULL,
        is_internal BOOLEAN NOT NULL DEFAULT false,
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
  ];

  for (const t of tables) {
    try {
      await pool.query(t.sql);
      results.push(`${t.name}: created or already exists`);
    } catch (err: any) {
      results.push(`${t.name}: ERROR - ${err.message}`);
    }
  }

  // Also check all expected tables
  const expected = ['customers','domains','domain_contacts','tld_pricing','dns_records','hosting_plans','hosting_accounts','orders','order_items','payments','email_plans','email_accounts','ssl_certificates','sitelock_accounts','website_projects','website_pages','website_assets','website_ai_sessions','audit_logs','webhook_events','cart_sessions','builder_subscriptions','ai_credit_balances','ai_credit_transactions','widget_tokens','support_tickets','ticket_messages','platform_settings','cloud_servers','cloud_snapshots','custom_domains','store_products','store_categories','store_orders','store_order_items','store_settings','agency_clients','ai_usage_logs','ai_provider_settings','form_submissions','site_analytics','site_analytics_daily'];
  const missing: string[] = [];
  for (const name of expected) {
    const r = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`, [name]);
    if (!r.rows[0].exists) missing.push(name);
  }
  if (missing.length > 0) results.push(`Still missing tables: ${missing.join(', ')}`);
  else results.push('All expected tables exist');

  res.json({ success: true, results });
});

// Promote to admin — DELETE AFTER USE
app.get('/api/v1/admin/make-admin', async (req, res) => {
  if (req.query.secret !== 'hostsblue-setup-2026') return res.status(403).json({ error: 'Forbidden' });
  const email = (req.query.email as string) || 'deanlaskowski@hostsblue.com';
  try {
    await pool.query('UPDATE customers SET is_admin = true WHERE email = $1', [email]);
    res.json({ success: true, message: `${email} is now admin` });
  } catch (err: any) {
    res.json({ error: err.message });
  }
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
