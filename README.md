# HostsBlue

A white-label domain registration and WordPress hosting platform.

## Overview

HostsBlue is a white-label web services platform offering:
- **Domain Registration & Transfer** (via OpenSRS API)
- **WordPress Hosting** (via WPMUDEV API)
- **Payment Processing** (via SwipesBlue)

The platform maintains complete white-label branding with zero OpenSRS or WPMUDEV branding visible to customers.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** RS256 JWT tokens
- **Payments:** SwipesBlue API
- **Email:** Resend

## Project Structure

```
hostsblue/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Route pages
│   │   ├── hooks/            # React hooks
│   │   └── lib/              # Utilities
│   ├── index.html
│   └── vite.config.ts
├── server/                    # Express backend
│   ├── index.ts              # Server entry
│   ├── routes.ts             # API routes
│   ├── middleware/           # Auth, validation
│   └── services/             # Business logic
│       ├── openrs-integration.ts
│       ├── wpmudev-integration.ts
│       ├── swipesblue-payment.ts
│       └── order-orchestration.ts
├── shared/                    # Shared code
│   └── schema.ts             # Database schema
├── package.json
├── drizzle.config.ts
└── .env.example
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and database URL

# Start development server
npm run dev
```

### Database Setup

```bash
# Push schema to database
npm run db:push

# Generate migrations
npm run db:generate
```

### Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/hostsblue

# OpenSRS
OPENRS_API_KEY=your_key
OPENRS_USERNAME=your_username

# WPMUDEV
WPMUDEV_API_KEY=your_key

# SwipesBlue
SWIPESBLUE_API_KEY=your_key
SWIPESBLUE_WEBHOOK_SECRET=your_secret

# Resend
RESEND_API_KEY=your_key

# JWT
JWT_PRIVATE_KEY=your_private_key
JWT_PUBLIC_KEY=your_public_key

# Session
SESSION_SECRET=your_secret
```

## Payment Flow

1. Customer adds domains/hosting to cart
2. Creates order via `/api/v1/orders`
3. Initiates payment via `/api/v1/orders/:uuid/checkout`
4. Customer completes payment on SwipesBlue
5. SwipesBlue webhook confirms payment
6. OrderOrchestrator provisions domains (OpenSRS) and hosting (WPMUDEV)
7. Customer receives confirmation email

## API Endpoints

### Auth
- `POST /api/v1/auth/register` - Register new customer
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user

### Domains
- `GET /api/v1/domains/search?domain=example` - Search domain availability
- `GET /api/v1/domains/tlds` - Get TLD pricing
- `GET /api/v1/domains` - List customer's domains
- `GET /api/v1/domains/:uuid` - Get domain details
- `PATCH /api/v1/domains/:uuid` - Update domain

### Hosting
- `GET /api/v1/hosting/plans` - List hosting plans
- `GET /api/v1/hosting/accounts` - List customer's accounts
- `GET /api/v1/hosting/accounts/:uuid` - Get account details

### Orders
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders` - List orders
- `GET /api/v1/orders/:uuid` - Get order details
- `POST /api/v1/orders/:uuid/checkout` - Initiate checkout

### Webhooks
- `POST /api/v1/webhooks/payment` - SwipesBlue payment webhook

## Development

```bash
# Run both frontend and backend
npm run dev

# Run only backend
npm run server:dev

# Run only frontend
npm run client:dev

# Build for production
npm run build

# Start production server
npm start
```

## License

Copyright © 2024 HostsBlue. All rights reserved.
