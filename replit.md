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

### Outstation Days (new)
- **Concept**: Admin marks a date range during which a salesman is travelling.
  On those days both modules respect the entry:
  - **Attendance**: status is `outstation` (sky-blue) instead of `absent`.
    Filter "Outstation" added to `/admin/attendance`.
  - **Visit Plans**: template plans are not generated for those days; any
    pending template plans already in the range are auto-cancelled, so
    `markPastPlansMissed` will not flip them to `missed`. Manual one-off
    plans are preserved (admin may have planned outstation visits).
- Table: `OutstationDay` (userId, startDate, endDate, reason, createdById).
- Admin UI: `/admin/outstation` — add / list / delete outstation entries,
  split into "Current & upcoming" and "Past".
- Salesman UI: `/sales/plan` shows a sky-blue banner for outstation days.
- API:
  - `GET/POST/PATCH/DELETE /api/admin/outstation` — admin direct entries.
  - `GET/POST/DELETE /api/sales/outstation` — salesman submits / cancels
    own pending requests.
  - `GET/PATCH /api/admin/outstation-requests` — admin reviews and decides
    (approve creates the OutstationDay + cancels pending plans + notifies
    user; reject just notifies).
- Salesman request flow: `/sales/outstation` (form + own request history).
  Admin sees pending requests on `/admin/outstation` with Approve/Reject.
  Notifications fire on submit (to admins) and on decision (to requester).
- Table: `OutstationRequest` (status, decidedById, decisionNote,
  outstationDayId back-link). Reuses `LeaveRequestStatus` enum.
- Engine: `getOutstationUserIdsForDate`, `getOutstationForUserDate`,
  `cancelPendingPlansForOutstation` in `src/lib/visitPlans.ts`.
  `ensurePlansForDate` skips outstation users; `markPastPlansMissed`
  cancels (instead of missing) plans that fall inside an outstation range.

### Visit Plans (new — admin-driven weekly templates)
- **Concept**: Admin sets up a weekly template per salesman per weekday
  ("Saturday → Ahmed → Downtown region → these customers"). System
  auto-generates the actual `VisitPlan` rows for each day from the matching
  weekday template. One-off plans for special dates also supported.
- **Rotation cycle (new — multi-week templates)**: Each user has
  `User.planCycleWeeks` (1 = weekly default, 2 = bi-weekly, 4 = monthly).
  Each `WeeklyPlanTemplate` has a `weekIndex` (1..planCycleWeeks). For users
  with cycle > 1, the engine computes the date's "week-of-cycle" using a
  fixed Sunday epoch (1970-01-04) and only uses the template whose
  `weekIndex` matches. Lets a salesman with too many customers for one
  week rotate them across 2 or 4 weeks. Helper:
  `getWeekIndexForDate(date, cycleWeeks)` in `src/lib/visitPlans.ts`.
  Migration: `20260427150000_add_plan_cycle_weeks` (default 1 keeps
  existing setups unchanged). Cycle is changed via
  `PATCH /api/admin/sales/users { id, planCycleWeeks }` which also drops
  templates whose `weekIndex` no longer fits the new cycle.
- Tables: `Region`, `WeeklyPlanTemplate`, `WeeklyPlanCustomer`, `VisitPlan`.
  Plus `Shop.regionId` and `Visit.planId` (back-link to plan).
- Statuses: `pending` → `done` (auto-set when matching visit logged) /
  `missed` (auto-set at end of day) / `cancelled`.
- Admin UI:
  - `/admin/sales/regions` — Region CRUD.
  - `/admin/sales/customers` — assign region to each customer.
  - `/admin/sales/weekly-plans` — grid editor (rows=salesmen, cols=weekdays).
    Editing a weekday template cascades to today's already-generated plan.
  - `/admin/sales/plans` — daily plans calendar/list, filters, one-off creation,
    cancel/reopen/delete.
- Salesman UI:
  - `/sales/plan` — "My Plan" with date switcher; each row has Log Visit button
    that pre-fills `/sales/visits/new?shopId=…&planId=…`.
- API routes:
  - Admin: `GET/POST/PATCH/DELETE /api/admin/sales/regions`,
    `GET/PATCH /api/admin/sales/shops` (region tagging),
    `GET/POST/DELETE /api/admin/sales/weekly-plans`,
    `GET/POST/PATCH/DELETE /api/admin/sales/plans`.
  - Salesman: `GET /api/sales/regions`, `GET /api/sales/my-plan?date=YYYY-MM-DD`.
- Generation engine: `src/lib/visitPlans.ts` — `ensurePlansForDate` (idempotent),
  `syncTodayFromTemplate` (cascade-on-edit), `markPastPlansMissed`,
  `linkVisitToPlan` (called from `POST /api/sales/visits`).
- Permissions: regions, customer regions, templates, all plans → admin only.
  Salesmen are read-only on their own day's plan.

### Sales (new)
- Hub page: `/sales` (visible to every authenticated user).
- Salesman pages:
  - `/sales/visits/new` — Add Visit (customer selection + create-on-the-fly + GPS).
  - `/sales/orders/new` — New Order (multi-line items, auto total, cash/credit).
  - `/sales/payments/new` — Add Collection (Customer required, Received From for payer).
  - `/sales/customers` — searchable customer list.
  - `/sales/customers/[id]` — full per-customer history (visits, orders, collections,
    summary stats incl. outstanding credit). Admin can toggle "All salesmen" scope.
  - `/sales/report` — My Daily Report (per-date summary).
- Note: DB tables remain `Shop` etc.; UI uses "Customer" label so the app fits
  any business type (medical clinics, retail, etc.).
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
  - `GET /api/sales/customers/[id]/history?scope=mine|all`
  - `GET /api/admin/sales/dashboard?date=...`
  - `GET /api/admin/sales/reports?from=...&to=...&userId=...`
  - `GET /api/admin/sales/users`
  - `GET/POST/PATCH/DELETE /api/admin/products`
- Tables: `Shop`, `Product`, `Visit`, `Order`, `OrderItem`, `Payment`.
  See migration `prisma/migrations/20260421055808_add_sales_module`.
- Each user only sees / manages their own visits, orders and payments;
  admins can view everything via the admin pages.

### Activity Log (new — admin-only audit trail)
- **Concept**: Fire-and-forget logging of every meaningful user action so admins
  have a full audit trail without impacting request performance.
- Table: `ActivityLog` (id, userId, action, module, details?, createdAt).
  Indexed on `(userId, createdAt)`, `(module, createdAt)`, `createdAt`.
  Cascade-deletes when user is deleted.
- Helper: `src/lib/activityLog.ts` — `logActivity(userId, action, module, details?)`.
  Errors are swallowed so logging never breaks the main flow.
- Instrumented actions (module → action):
  - `auth` → `login`
  - `attendance` → `check_in`, `check_out`
  - `leave` → `leave_submitted`
  - `correction` → `correction_submitted`
  - `sales` → `visit_logged`, `order_created`, `payment_recorded`
  - `admin` → `leave_approved/rejected`, `correction_approved/rejected`,
    `order_approved/rejected`, `user_created`
- API: `GET /api/admin/activity-log` — filters: userId, module, from, to, limit (max 500).
- Admin UI: `/admin/activity-log` — table with colour-coded module badges,
  filterable by user, module, date range, and row limit. Accessible from sidebar.

### Per-line Price Override on Orders (Apr 2026)
- During order creation (salesman) and order edit (admin), each line item now
  has an editable Price field that defaults to the product's catalogue price
  but can be overridden if a different price was negotiated with the customer.
- API: `POST /api/sales/orders` and `PUT /api/admin/sales/orders/[id]` accept
  optional `unitPrice` per item (Zod: `number().nonnegative().optional()`).
  When omitted, falls back to `Product.price`. `lineTotal` is recomputed from
  the effective price.
- UI: changing the product clears any prior override (so a fresh product picks
  up its catalogue price). When a line has an override that differs from the
  catalogue, an amber "List: X.XX" hint is shown beneath the price input.
- No schema change required — `OrderItem.unitPrice` already existed.

### Order Dispatch + WhatsApp Notification (Apr 2026)
- **Concept**: After admin approval, the salesman (or admin) clicks "Dispatch &
  notify customer". The system marks the order dispatched and opens WhatsApp
  on the dispatcher's device with a bilingual (English + Pashto) message
  pre-filled to the customer's phone. Free — no WhatsApp Business API.
- Schema:
  - `OrderApprovalStatus` enum extended with `dispatched`.
  - New `OrderMessageStatus` enum: `not_attempted | link_opened | invalid_phone`.
  - New fields on `Order`: `dispatchedAt`, `dispatchedById` (FK→User, set null),
    `messageStatus` (default `not_attempted`), `messageReason`.
  - Migration: `20260427180000_add_order_dispatch`.
- Helpers:
  - `src/lib/phone.ts` — `validatePhone(raw, defaultCountryCode='93')` strips
    non-digits, drops leading 0, prepends country code, validates against
    `/^93\d{9}$/`.
  - `src/lib/whatsapp.ts` — `buildDispatchMessage()` (bilingual EN+PS) and
    `buildWhatsappUrl(phone, msg)` → `https://wa.me/<phone>?text=...`.
- Endpoint: `POST /api/sales/orders/[id]/dispatch` — allowed for admin OR
  the salesman who created the order. Validates `status==="approved"`,
  rejects if already dispatched. Updates DB transactionally; returns
  `{ success, messageStatus, messageReason, whatsappUrl, order }`.
  Frontend opens `whatsappUrl` in a new tab AFTER receiving the response.
  Logs to `ActivityLog` (action `order_dispatched`) and notifies the
  counterparty (admin → salesman, or salesman → admins).
- UI:
  - Admin `/admin/sales/orders` — added "Dispatched" tab; status badges now
    include `dispatched` (indigo); message-status pill (✓ link opened / ⚠
    phone invalid); Dispatch button on approved orders.
  - Salesman `/sales/report` — per-order status badge + Dispatch button on
    approved orders + message-status pill on dispatched orders.
- **Sales totals exclude rejected orders** (and now correctly include
  dispatched ones). Filter `status: { in: ["approved", "dispatched"] }`
  applied in: `/api/admin/sales/dashboard`, `/api/admin/sales/reports`,
  `/api/sales/my-report`, `/api/sales/customers/[id]/history`.
  Pending orders also excluded from revenue (still shown in counts).

## Running

```
npm install
npx prisma migrate deploy
npm run dev   # serves on 0.0.0.0:5000
```

Required env: `DATABASE_URL`, `JWT_SECRET` (already configured).
