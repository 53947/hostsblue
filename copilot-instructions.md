# HostsBlue.com – AI Coding Agent Instructions

## Overview
HostsBlue is a white-label web services platform offering domain registration/transfer (OpenSRS) and WordPress hosting (WPMUDEV) through a fully branded hostsblue.com interface. The platform integrates with SwipesBlue for payments and extends the TriadBlue ecosystem standards.

---

## Architecture & Core Concepts

### Tech Stack
- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js/Express + TypeScript  
- **Database:** PostgreSQL (via Replit Database)
- **ORM:** Drizzle ORM with TypeScript schema
- **Auth:** RS256 JWT (copy pattern from BusinessBlueprint)
- **Payments:** SwipesBlue API (via `swipesblue.com`)
- **Email:** Resend for transactional emails
- **Storage:** Replit App Storage (object storage)
- **Session:** PostgreSQL with connect-pg-simple

### High-Level Data Flow
```
Customer → HostsBlue Frontend → Express API → {
  OpenSRS API (domains)
  WPMUDEV API (hosting)
  SwipesBlue API (payments)
  PostgreSQL (customer accounts & orders)
}
```

### White-Label Requirements (CRITICAL)
- **Zero** OpenSRS or WPMUDEV branding visible to customers
- HostsBlue owns customer relationship & billing
- HostsBlue orchestrates orders with partners via their APIs
- Payment flows through SwipesBlue; HostsBlue retains margin
- Customer support, account management all through hostsblue.com

---

## Project Structure

```
hostsblue/
├── client/                      # Vite + React frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components (copy Triad standards)
│   │   ├── pages/              # Route pages
│   │   │   ├── dashboard.tsx   # Customer account portal
│   │   │   ├── domains.tsx     # Domain search, register, transfer
│   │   │   ├── hosting.tsx     # WordPress hosting products
│   │   │   └── checkout.tsx    # Cart & payment (integrate SwipesBlue)
│   │   ├── hooks/              # React hooks (auth, API calls)
│   │   └── lib/                # Utilities (API client, validators)
│   ├── vite.config.ts
│   └── index.html
├── server/                      # Express backend
│   ├── index.ts                # Server entry point
│   ├── routes.ts               # API endpoints
│   ├── storage.ts              # Database queries (Drizzle ORM)
│   ├── middleware/             # Auth, validation, etc.
│   ├── services/               # Business logic
│   │   ├── openrs-integration.ts    # Domain registration/transfer
│   │   ├── wpmudev-integration.ts   # WordPress hosting
│   │   ├── swipesblue-payment.ts    # Payment processing
│   │   └── order-orchestration.ts   # Coordinate partner APIs
│   └── payment-gateways/
│       └── swipesblue.ts       # SwipesBlue API wrapper
├── shared/
│   └── schema.ts               # Database schema (Drizzle)
├── package.json
├── drizzle.config.ts
├── .env.example
└── README.md
```

---

## Critical Developer Workflows

### Running Locally
```bash
# Install dependencies
npm install

# Configure environment (.env)
cp .env.example .env
# Edit with: DATABASE_URL, OPENRS_API_KEY, OPENRS_API_URL, 
#            WPMUDEV_API_KEY, SWIPESBLUE_API_KEY, RESEND_API_KEY

# Start dev server (Vite HMR + Express)
npm run dev

# Database management
npm run db:push      # Push schema changes to PostgreSQL
npm run db:generate  # Generate migration files
```

### Building & Deploying
```bash
npm run build        # Vite build + esbuild for server
npm start            # Production mode (NODE_ENV=production)
```

Production builds output to `/dist/` — these artifacts are deployed to Replit.

### Database Schema
Schema is centralized in `shared/schema.ts` using Drizzle ORM. Add tables here, then run `npm run db:push` to sync to PostgreSQL. Never modify database structure outside this file.

---

## Integration Patterns (How to Work with Partners)

### OpenSRS Domain Integration
**Service:** `server/services/openrs-integration.ts`

**Key Operations:**
- Domain availability check
- Domain registration (including WHOIS privacy)
- Domain transfer (authorization codes, EPP codes)
- DNS management
- Auto-renewal configuration

**Database Table:** `domains` (tracks domain orders, expiration, auto-renewal status)

**Pattern:**
```typescript
// 1. Check availability in OpenSRS
const available = await checkOpenRSAvailability(domain);

// 2. Create HostsBlue domain order record
const order = await db.insert(domainOrders).values({
  customerId, domainName, registrar: 'opensrs', status: 'pending'
});

// 3. After payment succeeds (webhook from SwipesBlue):
//    Call OpenSRS to register/transfer domain
await registerDomainWithOpenRS(order);
```

### WPMUDEV Hosting Integration
**Service:** `server/services/wpmudev-integration.ts`

**Key Operations:**
- List available hosting plans
- Provision WordPress site
- Manage subdomains
- Backup/restore sites
- SSL certificate provisioning

**Database Table:** `hosting_accounts` (tracks WordPress sites, plan, renewal)

**Pattern:**
```typescript
// 1. Customer selects hosting plan
// 2. Create HostsBlue hosting order
const order = await db.insert(hostingOrders).values({
  customerId, plan: 'pro', status: 'pending'
});

// 3. After payment:
//    Provision WordPress site on WPMUDEV
const wpmudevAccount = await provisionWithWPMUDEV(order);
// Store reference for future management
```

### SwipesBlue Payment Integration
**Service:** `server/services/swipesblue-payment.ts`

**Flow:**
1. Customer adds domains/hosting to cart
2. Checkout page calls `/api/v1/checkout` with items
3. Backend creates SwipesBlue payment request
4. Customer completes payment through SwipesBlue iframe/redirect
5. SwipesBlue webhook confirms payment → HostsBlue orchestrates partner APIs

**Database Tables:**
- `orders` (order header: customer, total, status)
- `order_items` (line items: domains, hosting plans)
- `payments` (payment records: amount, status, gateway_response)

**Pattern:**
```typescript
// Create order after customer checkout
const order = await db.insert(orders).values({
  customerId, totalAmount, items: [...], status: 'pending_payment'
});

// Initiate SwipesBlue payment
const paymentUrl = await initiateSwipesBluePayment({
  orderId: order.id,
  amount: order.totalAmount,
  webhookUrl: 'https://hostsblue.com/api/v1/webhooks/payment'
});

// Webhook handler for payment.success event:
async function handlePaymentSuccess(orderId) {
  // Orchestrate domain registrations & hosting provisioning
  for (const item of order.items) {
    if (item.type === 'domain') {
      await registerDomainWithOpenRS(item);
    } else if (item.type === 'hosting') {
      await provisionWithWPMUDEV(item);
    }
  }
  // Update order status
  await db.update(orders).set({ status: 'completed' });
  // Send confirmation email via Resend
  await sendOrderConfirmation(order);
}
```

---

## TriadBlue Standards (Non-Negotiable)

### Design & Branding
1. **Font:** Archivo (import from Google Fonts)
2. **Primary Color:** Purple (#A855F7) — HostsBlue brand color
3. **Secondary Colors:**
   - Triad Blue: #0000FF
   - Fluorescent Green: #84D71A (TLD accent)
4. **Logo Format:**
   - First word "hosts" = Archivo Semi Expanded + Purple
   - "blue" = Archivo Regular + Triad Blue
   - ".com" = Archivo Regular + Fluorescent Green
   - All with 5pt text shadow

**Reference:** [Triad_Blue_Standards.md](https://github.com/53947/swipesblue/blob/main/Triad_Blue_Standards.md)

### Navigation Structure
**Must match BusinessBlueprint exactly:**
- Header: Apps | Solutions | Pricing | Dashboard
- Sidebar (when logged in): Inbox, Tasks, SEO Mgmt, Social Media, AI Coach, Settings
- Footer: 5-column layout with sister platform logos

### Database & ORM Usage
- **Always use Drizzle ORM** — Never write raw SQL
- Define all tables in `shared/schema.ts`
- Use TypeScript types exported from schema
- Never add columns without updating schema file
- Run `npm run db:push` after schema changes

---

## Code Patterns & Conventions

### API Routes
```typescript
// server/routes.ts - Use RESTful conventions
// Domain search endpoint
app.get('/api/v1/domains/search', authMiddleware, async (req, res) => {
  const { domain } = req.query;
  // Validate input
  // Call OpenSRS
  // Return results
});

// Order creation endpoint  
app.post('/api/v1/orders', authMiddleware, async (req, res) => {
  // Validate auth token
  // Create order in database
  // Return order ID + SwipesBlue payment URL
});
```

### Error Handling
- All errors logged with context (userId, orderId, etc.)
- Sensitive data (API keys, card details) stripped from logs
- Return user-friendly error messages to frontend
- Use standard HTTP status codes (400, 401, 404, 500)

### Authentication
**Copy from BusinessBlueprint** — Don't rebuild:
- RS256 JWT tokens (access + refresh)
- Session store in PostgreSQL
- Protected routes middleware
- Impersonation support (for admin testing)

**Reference:** `server/routes.ts` (auth section) in BusinessBlueprint

### Async/Orchestration
When registering a domain + hosting + payment in sequence:
```typescript
try {
  // 1. Validate order exists
  const order = await getOrder(orderId);
  
  // 2. Process each item
  const results = await Promise.all(
    order.items.map(item => processOrderItem(item))
  );
  
  // 3. Handle partial failures (1 domain registered, 1 failed)
  const failures = results.filter(r => !r.success);
  if (failures.length) {
    await notifyAdminOfFailures(orderId, failures);
  }
  
  // 4. Update order status
  await updateOrder(orderId, { status: 'completed' });
} catch (error) {
  logger.error('Order orchestration failed', { orderId, error });
  // Trigger manual intervention workflow
}
```

---

## External API Integration Checklist

### Before Calling Any Partner API:
1. ✅ **Authenticate properly** — Store API keys in `.env`, never in code
2. ✅ **Rate limiting** — Check partner's limits; implement backoff
3. ✅ **Idempotency** — If registering a domain fails, retrying shouldn't create duplicates
4. ✅ **Error responses** — Log full response; determine if error is retriable
5. ✅ **Audit trail** — Record all partner API calls in database (for customer support)

### Files to Reference:
- **OpenSRS Docs:** You have API credentials; consult their API reference
- **WPMUDEV:** Check their reseller/partner API documentation
- **SwipesBlue:** Call your own payment gateway API

---

## Testing & Debugging

### Local Testing
- Use Postman/curl to test endpoints before frontend
- Test OpenSRS in their sandbox environment first
- Use SwipesBlue test mode for payments (no real charges)

### Logging
All requests/responses logged to console in development:
```typescript
// Example logging
logger.info('Domain search', { domain: 'example.com', results: [...] });
logger.error('OpenSRS API error', { domain, statusCode, message });
```

### Database Inspection
```bash
# Connect to PostgreSQL directly (if using Replit DB)
# Or query through application endpoints
```

---

## Deployment Notes

### Replit Deployment
- `.replit` file defines build & run commands
- Database: Replit PostgreSQL (auto-provisioned, no setup needed)
- Environment variables: Set in Replit Secrets UI
- Static assets: Served from Vite build output
- Route order matters (see Triad_Blue_Standards.md)

### Critical Checklist Before Pushing to Production:
- [ ] All `.env` secrets configured in Replit
- [ ] Database migrations applied (`npm run db:push`)
- [ ] SwipesBlue webhook URL configured in `.env`
- [ ] Resend email API key set
- [ ] OpenSRS + WPMUDEV API credentials stored
- [ ] Test one domain registration end-to-end
- [ ] Test one hosting provision end-to-end
- [ ] Verify webhook handlers work

---

## Known Patterns & Gotchas

### ✅ DO:
- Copy working code from BusinessBlueprint (auth, footer, brand studio, etc.)
- Use Drizzle ORM for all database queries
- Structure new features as isolated services
- Log extensively for debugging
- Test with Resend's sandbox before production

### ❌ DON'T:
- Modify Triad standards without architect approval
- Store sensitive data (API keys, card details) in logs
- Create circular API dependencies (HostsBlue → SwipesBlue → HostsBlue)
- Use raw SQL queries
- Change navigation menu without updating footer/header across all platforms

---

## Quick Reference: File Locations

| Purpose | File |
|---------|------|
| Database schema | `shared/schema.ts` |
| OpenSRS integration | `server/services/openrs-integration.ts` |
| WPMUDEV integration | `server/services/wpmudev-integration.ts` |
| SwipesBlue payment | `server/services/swipesblue-payment.ts` |
| API routes | `server/routes.ts` |
| Frontend pages | `client/src/pages/` |
| Shared components | `client/src/components/` |
| Environment config | `.env.example` |
| Drizzle config | `drizzle.config.ts` |

---

## Related Ecosystem Documentation
- **TriadBlue Standards:** Branding, navigation, design system
- **BusinessBlueprint Repo:** Copy auth system, footer, brand studio patterns
- **SwipesBlue Repo:** Payment gateway API reference, webhook examples
- **Replit Collaboration Guide:** Deployment, environment setup, syncing

---

## Questions? Ask the Architect
This document covers HostsBlue-specific patterns. For TriadBlue ecosystem questions, refer to the linked standards documentation or contact the architect.
