# Attendix — Workforce Management System

A Next.js 14 (App Router) + Prisma + PostgreSQL application for workforce
management. Originally an attendance tracker (GPS + Daily QR), now extended
with a full Sales / Order / Collection module.

## Stack

- **Framework**: Next.js 14 (App Router, server actions disabled, REST API routes)
- **DB**: PostgreSQL via Prisma ORM
- **Auth**: JWT (`jose`), token stored client-side in `localStorage` /
  `sessionStorage`. Helpers in `src/lib/auth.ts`, `src/lib/clientAuth.ts`,
  `src/lib/apiAuth.ts`.
- **UI**: Tailwind CSS v4, shared primitives in `src/components/ui/`,
  navigation shell in `src/components/AppShell.tsx`.
- **Mobile**: Capacitor 6 wrapper. File export goes through
  `src/lib/exportUtils.ts` (web download → CSV; native → share sheet).

## Modules

### Attendance (existing — untouched)
- Routes under `src/app/employee`, `src/app/manager`, `src/app/admin/{...}`
- APIs under `src/app/api/attendance`, `src/app/api/admin`,
  `src/app/api/manager`, `src/app/api/leave`, `src/app/api/corrections`, etc.
- Tables: `User`, `Office`, `DailyQrToken`, `AttendanceSession`,
  `AttendanceEvent`, `LeaveRequest`, `Holiday`, `WorkdayOverride`,
  `LeaveBalance`, `CorrectionRequest`, `AttendanceAuditLog`, `Organization`.

### Sales (new)
- Hub page: `/sales` (visible to every authenticated user).
- Salesman pages:
  - `/sales/visits/new` — Add Visit (shop selection + create-on-the-fly + GPS).
  - `/sales/orders/new` — New Order (multi-line items, auto total, cash/credit).
  - `/sales/payments/new` — Add Collection.
  - `/sales/report` — My Daily Report (per-date summary).
- Admin pages:
  - `/admin/sales/dashboard` — Today's totals, top performers, per-employee rows.
  - `/admin/sales/reports` — Date + salesman filter, CSV export of orders /
    collections / visits.
  - `/admin/sales/products` — Product CRUD (soft delete via `isActive`).
- API routes:
  - `GET/POST /api/sales/shops`
  - `GET /api/sales/products`
  - `GET/POST /api/sales/visits`
  - `GET/POST /api/sales/orders`
  - `GET/POST /api/sales/payments`
  - `GET /api/sales/my-report?date=YYYY-MM-DD`
  - `GET /api/admin/sales/dashboard?date=...`
  - `GET /api/admin/sales/reports?from=...&to=...&userId=...`
  - `GET /api/admin/sales/users`
  - `GET/POST/PATCH/DELETE /api/admin/products`
- Tables: `Shop`, `Product`, `Visit`, `Order`, `OrderItem`, `Payment`.
  See migration `prisma/migrations/20260421055808_add_sales_module`.
- Each user only sees / manages their own visits, orders and payments;
  admins can view everything via the admin pages.

## Running

```
npm install
npx prisma migrate deploy
npm run dev   # serves on 0.0.0.0:5000
```

Required env: `DATABASE_URL`, `JWT_SECRET` (already configured).
