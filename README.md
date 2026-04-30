# Attendix — Workforce Management System

A Next.js 14 (App Router) + Prisma + PostgreSQL application for workforce management. Combines attendance tracking (GPS + Daily QR) with a full Sales / Order / Collection module.

## Tech Stack

- **Framework:** Next.js 14 (App Router, REST API routes)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT (`jose`), stored client-side
- **UI:** Tailwind CSS v4
- **Mobile:** Capacitor 6 wrapper

## Modules

| Module | Description |
|--------|-------------|
| **Attendance** | GPS + QR-based check-in/out, late tracking, overtime |
| **Leave Management** | Leave requests, approvals, balance tracking, carry-over |
| **Sales** | Visits, orders, collections, customer management |
| **Visit Plans** | Admin-driven weekly templates with rotation cycles |
| **Outstation** | Travel day tracking across attendance & visit plans |
| **Order Dispatch** | Approval workflow + WhatsApp notifications |
| **Activity Log** | Full audit trail of user actions |
| **Notifications** | In-app notification system |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Setup

```bash
# Clone the repository
git clone https://github.com/abduljamilafghan121-cell/afghan-mohamadi-attendance.git
cd afghan-mohamadi-attendance

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Run database migrations
npx prisma migrate deploy

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5000`.

### First-Time Setup

Visit `/setup` to create the initial admin account and organization.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 5000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing (min 32 chars) |

## Project Structure

```
src/
├── app/                  # Next.js App Router pages & API routes
│   ├── admin/            # Admin pages (dashboard, users, attendance, sales)
│   ├── api/              # REST API endpoints
│   ├── employee/         # Employee check-in/out pages
│   ├── manager/          # Manager team view
│   ├── sales/            # Salesman pages (visits, orders, payments)
│   └── login/            # Authentication page
├── components/           # Shared React components
│   ├── ui/               # Primitives (Button, Card, Input, etc.)
│   ├── AppShell.tsx      # Navigation shell
│   └── ErrorBoundary.tsx # Global error boundary
├── lib/                  # Server & client utilities
│   ├── auth.ts           # JWT signing/verification
│   ├── apiAuth.ts        # API route auth helper
│   ├── prisma.ts         # Prisma client singleton
│   ├── rateLimit.ts      # In-memory rate limiter
│   ├── visitPlans.ts     # Visit plan generation engine
│   └── ...
└── middleware.ts          # Route protection middleware
prisma/
├── schema.prisma         # Database schema
└── migrations/           # Migration history
```

## Roles

| Role | Access |
|------|--------|
| **Admin** | Full access to all modules, user management, approvals |
| **Manager** | Team view, attendance overview |
| **Employee** | Check-in/out, leave requests, sales actions |
