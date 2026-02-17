import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as schema from '../shared/schema.js';
import { registerRoutes } from './routes.js';

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

// CORS configuration
app.use((req, res, next) => {
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

// Register all API routes
registerRoutes(app, db);

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
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  
  // Try to send the file, or fallback to plain HTML
  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error(`[ERROR] Failed to read ${indexPath}:`, err.message);
      res.send('<h1>HostsBlue Server Running</h1><p>index.html not found, but server is online.</p>');
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🌐 HostsBlue Server                                      ║
║   Domain & Hosting Platform                                ║
║                                                            ║
║   Environment: ${NODE_ENV.padEnd(43)}║
║   Port: ${String(PORT).padEnd(50)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
