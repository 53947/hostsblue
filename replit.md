# HostsBlue

## Overview

HostsBlue is a white-label domain registration and WordPress hosting platform. It provides customers with domain registration/transfer (via OpenSRS API), WordPress hosting (via WPMUDEV API), professional email, SSL certificates, SiteLock security, and website builder services — all under the HostsBlue brand with zero visibility of upstream provider branding.

The platform processes payments through SwipesBlue, sends transactional emails via Resend, and stores all customer/order data in PostgreSQL. The frontend is a React SPA served by an Express backend in production.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript (run via `tsx`)
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** RS256 JWT tokens (access + refresh) stored in HTTP-only cookies, with session backup via `connect-pg-simple`
- **State Management:** TanStack React Query for server state, local state for cart (localStorage)
- **Routing:** React Router v6 with `createBrowserRouter`

### Project Structure
```
hostsblue/
├── client/                    # Vite + React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI (button, card, badge, input, layout components)
│   │   ├── pages/            # Route pages organized by feature
│   │   ├── hooks/            # use-auth, use-cart
│   │   └── lib/              # api.ts (fetch wrapper), router.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── postcss.config.js
├── server/                    # Express backend
│   ├── index.ts              # Server entry, DB connection, middleware setup, static file serving
│   ├── routes.ts             # All API routes (auth, domains, hosting, orders, etc.)
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication, token generation, blacklisting
│   │   └── rate-limit.ts     # In-memory rate limiter
│   └── services/
│       ├── openrs-integration.ts    # OpenSRS domain API client
│       ├── wpmudev-integration.ts   # WPMUDEV hosting API client
│       ├── swipesblue-payment.ts    # SwipesBlue payment gateway client
│       └── order-orchestration.ts   # Coordinates fulfillment after payment
├── shared/
│   └── schema.ts             # Drizzle ORM schema (single source of truth)
├── public/                    # Static assets (logos, favicons)
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

### Frontend Architecture
- **Component Library:** Custom UI components (`Button`, `Card`, `Badge`, `Input`, `LoadingSpinner`, `SectionHeading`, `Divider`) in `client/src/components/ui/`
- **Layouts:** `RootLayout` (public pages with header/footer) and `DashboardLayout` (authenticated pages with sidebar navigation)
- **Protected Routes:** `ProtectedRoute` component wraps dashboard pages, redirects to `/login` if unauthenticated
- **API Layer:** Centralized `fetchApi` wrapper in `client/src/lib/api.ts` with automatic token refresh on 401 responses
- **Cart:** Client-side cart stored in localStorage via `useCart` hook
- **Styling:** Tailwind CSS with custom theme (HostsBlue brand colors: teal `#064A6C`, green `#008060`, blue `#0000FF`), Archivo font family, `7px` border radius convention
- **Build Output:** Vite builds to `dist/client/`, served as static files by Express in production

### Backend Architecture
- **Server Entry:** Express listens on `PORT` env var (default 5001), serves API at `/api/v1/*` and static frontend files from `dist/client/`
- **Database:** PostgreSQL via `pg` Pool, wrapped with Drizzle ORM. Schema defined in `shared/schema.ts` with enums for domain status, hosting status, order status, etc.
- **Sessions:** PostgreSQL-backed sessions via `connect-pg-simple` with auto table creation
- **Auth Flow:** Registration/login returns JWT tokens (access + refresh) in HTTP-only cookies. Token cache with LRU eviction (max 10,000). Token blacklist for logout.
- **API Design:** RESTful routes with Zod validation schemas, consistent `successResponse`/`errorResponse` helpers, `asyncHandler` wrapper for error handling
- **Rate Limiting:** In-memory per-IP rate limiter middleware with configurable window and max requests

### Development vs Production
- **Development:** `npm run dev` runs both Vite dev server (port 5000) and Express (port 5001) concurrently. Vite proxies `/api` to Express.
- **Production:** `npm run build` builds the Vite frontend, then `npm start` runs Express which serves both API and static files. Server binds to `0.0.0.0`.

### Database Schema
Defined in `shared/schema.ts` using Drizzle's `pgTable` with:
- PostgreSQL enums for statuses (`domain_status`, `hosting_status`, `order_status`)
- Tables for customers, domains, hosting accounts, orders, order items, email accounts, SSL certificates, SiteLock accounts, website builder projects, support tickets
- Relations defined via Drizzle's `relations()` API
- Zod schemas auto-generated via `drizzle-zod` for insert/select validation
- Schema push via `drizzle-kit push:pg`

### White-Label Requirements (Critical)
- Zero OpenSRS or WPMUDEV branding visible anywhere in the UI
- HostsBlue owns the entire customer relationship, billing, and support experience
- All partner API interactions happen server-side only
- Payment flows through SwipesBlue; HostsBlue retains margin

## External Dependencies

### Database
- **PostgreSQL** — Primary data store. Connection via `DATABASE_URL` environment variable. Drizzle ORM for schema management and queries. Sessions stored in PostgreSQL via `connect-pg-simple`.

### Third-Party APIs
- **OpenSRS API** — Domain registration, transfers, renewals, DNS management. Configured via `OPENRS_API_URL`, `OPENRS_API_KEY`, `OPENRS_USERNAME`. Custom nameservers via `HOSTSBLUE_NS1`/`HOSTSBLUE_NS2`.
- **WPMUDEV API** — WordPress hosting provisioning and management. Configured via `WPMUDEV_API_URL`, `WPMUDEV_API_KEY`. Credentials encrypted with AES-256-GCM using `CREDENTIAL_ENCRYPTION_KEY`.
- **SwipesBlue API** — Payment processing (checkout sessions, refunds, webhook verification). Configured via `SWIPESBLUE_API_URL`, `SWIPESBLUE_API_KEY`, `SWIPESBLUE_WEBHOOK_SECRET`. Includes retry logic with exponential backoff.
- **Resend** — Transactional email delivery (order confirmations, password resets, etc.). Configured via `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

### Key Environment Variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Server port (default 5001) |
| `NODE_ENV` | Environment (development/production) |
| `SESSION_SECRET` | Express session secret |
| `JWT_PRIVATE_KEY` | RS256 private key for signing JWTs |
| `JWT_PUBLIC_KEY` | RS256 public key for verifying JWTs |
| `OPENRS_API_URL` | OpenSRS API endpoint |
| `OPENRS_API_KEY` | OpenSRS API key |
| `OPENRS_USERNAME` | OpenSRS username |
| `HOSTSBLUE_NS1` / `HOSTSBLUE_NS2` | Custom nameservers |
| `WPMUDEV_API_URL` | WPMUDEV API endpoint |
| `WPMUDEV_API_KEY` | WPMUDEV API key |
| `CREDENTIAL_ENCRYPTION_KEY` | 32-byte hex key for encrypting hosting credentials |
| `SWIPESBLUE_API_URL` | SwipesBlue payment gateway URL |
| `SWIPESBLUE_API_KEY` | SwipesBlue API key |
| `SWIPESBLUE_WEBHOOK_SECRET` | SwipesBlue webhook signature verification |
| `RESEND_API_KEY` | Resend email service API key |
| `RESEND_FROM_EMAIL` | From address for transactional emails |

### NPM Dependencies (Key)
- `drizzle-orm` + `drizzle-zod` + `drizzle-kit` — ORM, validation, migrations
- `pg` — PostgreSQL client
- `express` + `express-session` + `connect-pg-simple` — Server framework + sessions
- `jsonwebtoken` + `jwks-rsa` — JWT auth
- `bcrypt` — Password hashing
- `@tanstack/react-query` — Server state management
- `react-router-dom` — Client routing
- `resend` — Email API client
- `zod` — Runtime validation
- `lucide-react` — Icon library
- `tailwindcss` + `autoprefixer` + `postcss` — CSS framework
- `tsx` — TypeScript runner for server
- `concurrently` — Run dev servers in parallel