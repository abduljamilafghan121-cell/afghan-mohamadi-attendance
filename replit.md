# Attendix — Workforce Management System

## Overview
Attendix is a comprehensive workforce management system built with Next.js 14, Prisma, and PostgreSQL. Initially designed as an attendance tracker with GPS and QR code functionalities, it has evolved to include a full Sales, Order, and Collection module. The project aims to streamline field sales operations, improve administrative oversight, and provide robust analytics for businesses. Key capabilities include attendance tracking, sales visit planning, order management, payment collection, and detailed activity logging. The system is designed for both web and mobile platforms, offering a seamless experience for employees and administrators.

## User Preferences
I prefer that the agent focuses on understanding the existing codebase and architecture before proposing changes. When implementing new features or making modifications, prioritize maintaining the current coding style and design patterns. For any significant architectural decisions or major feature implementations, please ask for approval first. I prefer clear and concise explanations for any proposed solutions or changes, avoiding overly technical jargon where possible. Ensure all changes are well-documented within the code. Do not make changes to the existing `Attendance` module code unless explicitly instructed.

## System Architecture
The application is built on Next.js 14 using the App Router, with REST API routes (server actions are disabled). Data persistence is managed via PostgreSQL with Prisma ORM. Authentication is handled using JWTs, stored client-side. The UI is styled with Tailwind CSS v4, utilizing shared primitives and an `AppShell` for consistent navigation. Mobile deployment is achieved through a Capacitor 6 wrapper.

### UI/UX Decisions
- **Tailwind CSS v4**: For utility-first styling.
- **Shared UI Primitives**: Components in `src/components/ui/` ensure consistency.
- **AppShell**: `src/components/AppShell.tsx` provides a unified navigation and layout.
- **Mobile-First Design**: Responsive layouts, especially for tables on mobile-portrait, dynamically switch between stacked cards and traditional table views (`< sm` for cards, `≥ sm` for tables).
- **Color-coded badges**: Used for status indicators and activity log modules to enhance readability.

### Technical Implementations
- **Authentication**: JWT-based with `jose`, tokens stored in `localStorage`/`sessionStorage`. Helper functions are located in `src/lib/auth.ts`, `src/lib/clientAuth.ts`, `src/lib/apiAuth.ts`.
- **API Structure**: Segregated API routes by module and user role (e.g., `/api/admin`, `/api/sales`).
- **File Export**: `src/lib/exportUtils.ts` handles CSV downloads for web and share sheet functionality for native mobile.
- **Activity Logging**: Fire-and-forget mechanism (`src/lib/activityLog.ts`) for audit trails, designed to not impact request performance.
- **WhatsApp Integration**: Cross-platform `openWhatsApp` helper (`src/lib/clientWhatsapp.ts`) for reliable WhatsApp messaging via custom schemes on mobile and web.
- **Sales Visit Planning Engine**: `src/lib/visitPlans.ts` manages template-based plan generation, rotation cycles, and status updates.
- **Order Processing**: Includes features for per-line price override, dedicated "Pending Dispatch" page, and a dispatch workflow with WhatsApp notifications.
- **Phone Number Validation**: `src/lib/phone.ts` provides robust phone number validation and formatting.

### Feature Specifications
- **Attendance Module**: Existing functionality for employee attendance, leave requests, and corrections, with admin oversight.
- **Outstation Days**: Allows administrators to mark periods for salesmen traveling, affecting both attendance and visit plan generation. Includes a request/approval workflow for salesmen.
- **Visit Plans**:
    - Admin-driven weekly templates per salesman per weekday.
    - Multi-week rotation cycles (`User.planCycleWeeks`) for flexible plan generation.
    - Auto-generation of `VisitPlan` rows and cascade updates from template changes.
    - PDF export of weekly visit plans.
- **Sales Module**:
    - Salesman-facing pages for logging visits, creating orders, and recording collections.
    - Comprehensive customer history view.
    - Admin-facing dashboard, reports (with CSV + PDF export), and product CRUD.
    - Order dispatch with WhatsApp notifications.
    - Per-line item price override in orders.
- **Activity Log**: Admin-only audit trail of significant user actions across various modules.
- **HR Module**:
    - HR Reports page with CSV and PDF export (absent today, monthly summary, late arrivals, overtime).
    - Payroll & Salary: full payroll PDF export + per-record payslip PDF (print dialog). Employee HR profile page also has per-row Print Slip button (includes org logo, signatures, createdBy).
    - Salary notifications via `notifyUser` when salary is recorded or paid (`salary_recorded` enum type).
    - Emergency Contacts on employee HR profile page now has full CRUD (add/edit/delete) — modal with name, relationship, phone, phone2, notes.
    - Employee contract creation/update auto-deactivates previous active contract for that user (transaction).
    - Training PATCH no longer crashes when endDate is cleared (empty string → null instead of crash).
- **Mobile Bottom Nav**: Fixed bottom bar (md:hidden) with 4 tabs — Check In/Out, Sales, History, Profile — shown for all logged-in users.
- **Admin Nav**: Restructured admin dropdown with SVG icons + group separators (Staff, Attendance, Sales, HR, System). Scrollable with max-height on desktop.
- **Dashboard**: Live stat tiles now include On Outstation count; "Absent Today" tile is clickable to expand/collapse absent employee list. Holiday and weekly off-day banners shown when applicable. Absent count uses the same outstation/holiday/offday exclusion logic as HR Reports.
- **Leave System**: Overlap check added — employees cannot submit a new leave request that overlaps with an existing pending or approved request.
- **Manager Leave Approval**: Now mirrors admin logic — updates LeaveBalance (usedDays increment/decrement), notifies the employee via `notifyUser`, and logs the action via `logActivity`.
- **Manager Team View**: Attendance rows now include `isLateArrival`, `isEarlyDeparture`, `minutesLate` from the session. Manager page displays orange "Late Xm" and yellow "Early out" badges in the Flags column.
- **Late Check-In**: Also notifies the employee's direct manager (via `notifyUser`) in addition to all admins.
- **Corrections**: Fixed office selection bug (now uses user's actual `officeId`, falls back to first active office). Approved corrections recalculate `isLateArrival`/`minutesLate` for check-in corrections and `isEarlyDeparture` for check-out corrections.
- **Visit Duplicate Products**: Returns HTTP 400 with a clear error instead of a 500 crash when the same product is submitted twice in one visit.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Prisma ORM**: Used for database interaction and schema management.
- **Next.js 14**: The web application framework.
- **Tailwind CSS v4**: For styling the user interface.
- **Capacitor 6**: For wrapping the web application into native mobile apps (Android/iOS).
- **`jose`**: JavaScript Object Signing and Encryption library for JWT authentication.
- **WhatsApp**: Integrated for customer notifications (using `wa.me` URLs and custom schemes, not Business API).