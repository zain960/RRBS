# Restaurant & Room Booking System (RRBS)

An integrated platform combining short/long-duration room bookings (hourly and daily stays) with a full restaurant operation — dine-in, takeaway, delivery, and in-room service for checked-in guests — sharing one customer, payment, coupon and reporting model.

Requirements: [`Restaurant_Room_Booking_SRS.docx`](./Restaurant_Room_Booking_SRS.docx)
Build conventions and domain rules: [`CLAUDE.md`](./CLAUDE.md)

> **Status:** Phase 10 — auth, rooms, bookings, restaurant setup, food ordering, payments, coupons, tax settings, the dashboard, reports, notifications, reviews and the public landing page are implemented.
>
> The project's own `rrbs_dev` database has still never been migrated (see [Database setup](#3-create-the-development-database)), but all three migrations, the seed and the phase-10 flows were exercised against a throwaway PostgreSQL 18 cluster: `prisma migrate deploy` applied cleanly and `prisma migrate diff` reports **no difference** between the migrations and `schema.prisma`, so the two hand-written migrations are confirmed correct. Phases 6–9 remain verified by domain-logic checks and a clean build rather than by a UI run-through.

## Tech stack

- **Backend:** Node.js, Express 5, Prisma ORM
- **Frontend:** React 19 (Vite), Tailwind CSS 3, React Router, axios
- **Database:** PostgreSQL
- **Auth:** JWT (8h expiry), bcryptjs password hashing

## Modules

Customer management · Room & room type management · Room booking · Restaurant setup (tables, categories, menu) · Food ordering (dine-in / takeaway / delivery / room service) · Payments · Coupons & discounts · Taxes · Notifications · Reviews & ratings · Admin dashboard · Reports · Roles & permissions

## Project structure

```
backend/
  prisma.config.js # Prisma 7 config: connection URL + seed command
  prisma/
    schema.prisma  # 17 models / 16 enums, mirrors SRS §7.2
    migrations/    # init_schema, settings_and_coupon_active, review_one_per_target
    seed.js        # roles, durations, room types, rooms, menu, tables, admin
  src/
    server.js      # Express entry point
    routes/        # path + middleware wiring only
    controllers/   # request handling and validation
    middleware/    # auth, role guards, error handling
    services/      # business rules and domain logic
    lib/           # envelope, validation, money, config, mailer, Prisma client
frontend/
  src/
    App.jsx        # routes
    pages/         # route-level screens (public, customer, admin/)
    components/    # reusable UI: states, icons, ratings, dialogs, layout
    api/           # backend HTTP clients, one module per resource
    context/       # auth and toast providers
```

## Getting started

### Prerequisites

- Node.js 18+ (developed on v22)
- PostgreSQL 14+
- npm 9+

### 1. Install dependencies

From the project root:

```sh
npm run install:all
```

This installs the root tooling (`concurrently`) plus both workspaces. To do it manually:

```sh
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 2. Configure environment

```sh
cp backend/.env.example backend/.env
```

Then edit `backend/.env` and set a real `JWT_SECRET` and database password:

```sh
openssl rand -base64 32   # paste the result as JWT_SECRET
```

`backend/.env` is gitignored and must never be committed.

### 3. Create the development database

Make sure PostgreSQL is running, then create the role and database:

```sh
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE USER rrbs_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE rrbs_dev OWNER rrbs_user;"
```

The password here must match the one in `DATABASE_URL`. Check which port your
cluster listens on (`pg_lsclusters`) — it is not always 5432 — and set the port
in `DATABASE_URL` to match.

### 4. Apply migrations and seed

```sh
cd backend
npm run db:migrate     # applies the init_schema migration
npm run db:seed        # loads roles, durations, rooms, menu, tables, admin
```

Inspect the result with Prisma Studio:

```sh
npm run db:studio
```

Seeded data:

| Table | Rows |
|---|---|
| `roles` | 7 (Super Admin, Manager, Receptionist, Waiter, Kitchen Staff, Accountant, Customer) |
| `booking_durations` | 7 (2/4/6/8 hr, Full Day, Full Night, Day & Night) |
| `room_types` | 4 (Standard, Deluxe, Suite, Family) with a rate per duration |
| `rooms` | 10 |
| `categories` | 6 |
| `foods` | 20 |
| `dining_tables` | 8 |
| `users` | 1 Super Admin |

The seed is idempotent — re-running it updates rather than duplicates. It does
**not** reset the admin password once the account exists.

**Default login:** `admin@rrbs.local` / `Admin@123` (bcrypt, 10 rounds).
Change this before any deployment.

The remaining tables (`customers`, `bookings`, `booking_details`, `orders`,
`order_items`, `payments`, `reviews`, `notifications`) are transactional and are
intentionally left empty.

### 5. Run both apps

```sh
npm run dev
```

| App | URL |
|---|---|
| Backend API | http://localhost:4000 |
| Frontend | http://localhost:5173 |

The frontend opens on the public landing page; `/account` shows **API: ok** for a
signed-in user, and `GET http://localhost:4000/api/health` returns `200`:

```json
{ "data": { "status": "ok" }, "error": null, "meta": { "uptime": 1.23 } }
```

Vite proxies `/api/*` to `http://localhost:4000` in development, so frontend code can use relative URLs.

## Scripts

| Command (from root) | Description |
|---|---|
| `npm run dev` | Run backend + frontend together via `concurrently` |
| `npm run dev:backend` | Backend only (nodemon, port 4000) |
| `npm run dev:frontend` | Frontend only (Vite, port 5173) |
| `npm run build` | Production build of the frontend |
| `npm run install:all` | Install root + both workspace dependencies |

Database scripts run from `backend/`:

| Command | Description |
|---|---|
| `npm run db:migrate` | Create/apply migrations (`prisma migrate dev`) |
| `npm run db:deploy` | Apply pending migrations without prompting (CI/prod) |
| `npm run db:seed` | Run `prisma/seed.js` |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Drop, re-migrate and re-seed — destroys all data |
| `npm run prisma:generate` | Regenerate the Prisma client |

## Notes on Prisma 7

This project uses Prisma 7, which changed two conventions you may expect from
older tutorials:

- The datasource block in `schema.prisma` no longer accepts `url`. The
  connection string lives in `backend/prisma.config.js`.
- The `prisma` key in `package.json` is no longer read. The seed command is
  declared as `migrations.seed` in `prisma.config.js`; `npm run db:seed` is
  provided as a direct equivalent.

`PrismaClient` is instantiated with the `@prisma/adapter-pg` driver adapter
rather than a bare connection string — see `prisma/seed.js` for the pattern to
follow in application code.

## Environment variables

Defined in `backend/.env` — see [`backend/.env.example`](./backend/.env.example).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Backend listen port (default `4000`) |
| `JWT_SECRET` | Signing secret for access tokens |
| `JWT_EXPIRES_IN` | Token lifetime (`8h`) |
| `NOTIFICATION_CHANNELS` | Transports for notifications: `log` (default), `email`, or both |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | SMTP settings for the `email` channel. Blank `SMTP_HOST` keeps email off |

Business settings (tax rates, advance-payment share, no-show grace, delivery
minimum, page sizes) are also environment-driven — see
[`backend/.env.example`](./backend/.env.example) for the full list and defaults.

## Authentication

JWT bearer tokens, 8-hour expiry, passwords hashed with bcryptjs (10 rounds).

| Method | Path | Access |
|---|---|---|
| `POST` | `/api/auth/register` | Public — self-registration, always Customer role |
| `POST` | `/api/auth/login` | Public — staff and customers |
| `POST` | `/api/auth/logout` | Authenticated |
| `GET` | `/api/auth/me` | Authenticated |
| `GET` | `/api/roles` | Super Admin only |

Token claims: `user_id`, `role_id`, `role_name`, `account_type`.
`account_type` (`staff` | `customer`) is required because staff live in `users`
and customers in `customers` — the two id spaces overlap.

Guarding a route:

```js
const { requireAuth, requireRole } = require('./middleware/auth')

router.get('/', requireAuth, requireRole(['Super Admin', 'Manager']), handler)
```

Error codes: `UNAUTHENTICATED`, `INVALID_TOKEN` and `TOKEN_EXPIRED` return 401;
`FORBIDDEN` and `ACCOUNT_INACTIVE` return 403; `INVALID_CREDENTIALS` returns
401; `EMAIL_TAKEN` returns 409; `VALIDATION_ERROR` returns 422.

On the frontend, `AuthContext` exposes `{ user, role, isAuthenticated, loading,
login, register, logout }`. `<ProtectedRoute>` redirects unauthenticated users
to `/login` and wrong-role users to `/403`; `<RoleGate>` conditionally renders
UI. Both are UX affordances — the API enforces the same rules independently.

## Restaurant & ordering endpoints

| Method | Path | Access |
|---|---|---|
| `GET` | `/api/menu` | Public — grouped by category, `Available` items only |
| `GET` | `/api/tables/available` | Public — free tables, for the dine-in picker |
| `GET/POST/PUT/DELETE` | `/api/tables`, `PATCH /:id/status` | Read + status: Manager, Waiter · create/edit/delete: Manager |
| `GET/POST/PUT/DELETE` | `/api/categories` | Read: Manager, Waiter, Kitchen Staff · write: Manager |
| `GET/POST/PUT/DELETE` | `/api/foods`, `PATCH /:id/availability` | Same split as categories |
| `POST/GET` | `/api/orders` | Authenticated; customers see only their own |
| `PATCH` | `/api/orders/:id/status` | Role depends on the target status (below) |
| `POST/GET` | `/api/orders/:id/payments` | Waiter, front desk, or the customer paying their own bill |
| `GET` | `/api/orders/room-service-bookings` | The caller's checked-in stays |

`GET /api/orders` accepts `status`, `order_type`, `kitchen_queue=true`, `customer_id`,
`table_id`, `booking_id` and pagination. `kitchen_queue=true` returns `Placed` +
`Preparing` oldest-first.

Order status transitions are gated by role (SRS §4.5):

| Target status | Roles |
|---|---|
| `Preparing`, `Ready` | Kitchen Staff, Super Admin |
| `Served`, `Picked Up` | Waiter, Super Admin |
| `Dispatched`, `Delivered`, `Billed to Room` | Manager, Receptionist, Super Admin |
| `Cancelled` | Waiter, Manager, Receptionist, Super Admin |

The legal next status also depends on order type: from `Ready`, a dine-in order
goes to `Served`, takeaway to `Picked Up`, delivery to `Dispatched → Delivered`,
and room service to `Billed to Room`. Cancellation is only possible before the
food is cooked (`Placed`, `Preparing`).

Order error codes: `FOOD_UNAVAILABLE`, `TABLE_OCCUPIED`, `BOOKING_NOT_CHECKED_IN`,
`DELIVERY_MINIMUM_NOT_MET`, `INVALID_STATUS_TRANSITION`, `ORDER_BILLED_TO_ROOM`,
plus the shared coupon codes (`COUPON_EXPIRED`, `COUPON_NOT_APPLICABLE`, …).

## Money endpoints (SRS §4.6–§4.7, §9)

| Method | Path | Access |
|---|---|---|
| `GET` | `/api/settings/tax` | Public (rates appear on every receipt); who last changed them is staff-only |
| `PUT` | `/api/settings/tax` | Super Admin — system-level setting |
| `GET/POST/PUT/DELETE` | `/api/coupons`, `PATCH /:id/active` | Manager, Super Admin |
| `POST` | `/api/coupons/validate` | Any signed-in caller — checks a code without applying it |
| `POST` | `/api/payments` | Manager, Receptionist, Waiter, Super Admin |
| `GET` | `/api/payments` | Manager, Accountant, Super Admin (financial report, SRS §5.4) |

`POST /api/coupons/validate` takes `{ code, target: 'ROOMS'|'FOOD', subtotal }` and always
returns 200 — a rejected coupon is `{ valid: false, code, message }`, so the checkout can
show the reason inline. `GET /api/payments` filters on `method`, `payment_type`, `status`,
`booking_id`, `order_id`, `from`, `to`, and its `meta` carries `received`, `refunded` and
`settledTotal` across the whole filtered set.

Pricing lives in one place — `services/pricingService.js`. `applyDiscountAndTax()` is the
single implementation of `Subtotal − Discount + Tax = Total`; `priceBooking()` and
`priceOrder()` differ only in how the subtotal is reached, which coupon applicability
applies, and which tax rate is passed in. The rate is a parameter rather than a global,
so the calculation stays testable without a database.

Tax rates are a single-row `settings` table, read when something is priced and then locked
onto the record. Changing a rate never alters an already-confirmed booking or order.

A payment that brings a Pending booking up to its full total confirms it automatically. If
that confirmation fails (the room was taken in the meantime) the payment is still recorded
and the response reports why under `autoConfirm` — money already taken is never rolled back.

Coupon error codes: `COUPON_NOT_FOUND`, `COUPON_INACTIVE`, `COUPON_NOT_YET_VALID`,
`COUPON_EXPIRED`, `COUPON_NOT_APPLICABLE`, `COUPON_MIN_AMOUNT`, `COUPON_LIMIT_REACHED`,
`COUPON_CODE_TAKEN`, `COUPON_IN_USE`.

## Dashboard & reports (SRS §4.10–§4.11)

| Method | Path | Access |
|---|---|---|
| `GET` | `/api/dashboard/summary` | Manager, Receptionist, Accountant, Super Admin |
| `GET` | `/api/reports` | Manager, Accountant, Super Admin — the catalogue this role may run |
| `GET` | `/api/reports/:slug?from=&to=&format=json\|csv` | as above; `staff-performance` narrows to Manager + Super Admin |

Report slugs: `bookings`, `occupancy`, `revenue`, `food-sales`, `payments`,
`staff-performance`. Every one returns the same `{ columns, rows, summary }` shape, so
the CSV serialiser and the report table work off one description. The range defaults to
the last 30 days; `to` is pushed to the end of its day.

**Billed vs collected.** The revenue report reports both, because they diverge whenever a
bill is unpaid or partly paid:

- *billed* — what was charged, read from bookings/orders, using the figures locked at
  confirmation.
- *collected* — what was actually taken, read from payments, net of refunds. This
  reconciles exactly against the `payments` table.

Two limitations worth knowing:

- **Staff performance covers bookings only.** `bookings.created_by` exists, but SRS §7.2
  gives `orders` and `payments` no staff column, so orders taken and payments processed
  cannot be attributed. Adding `created_by` to those two tables is a migration.
- **"Low stock" means "marked unavailable."** SRS §4.10 asks for low-stock or unavailable
  items, but §7.2 defines no stock levels, so unavailability is the only signal available.

Occupancy utilisation is `rooms occupied that day / rooms in service that day`, using the
same half-open overlap test as the booking engine. Rooms under maintenance are excluded
from the denominator — they were never sellable. Maintenance status is current rather than
historical, so the figure is approximate for past dates.

## Notifications (SRS §4.8)

| Method | Path | Access |
|---|---|---|
| `GET` | `/api/notifications?recipient_id=&recipient_type=&status=` | Own notifications by default; Manager and Super Admin may read another recipient's |

Five domain events raise a notification for the customer they concern:

| Event | Raised by |
|---|---|
| `booking.confirmed` | `Pending → Confirmed`, whether pressed by staff or triggered by a settling payment |
| `booking.checked_in` | check-in |
| `booking.checked_out` | checkout |
| `order.status_changed` | every step of the order pipeline |
| `payment.received` | a completed payment or refund against a booking or an order |

Recording and delivering are separate on purpose:

1. The `notifications` row is written **inside the transaction that caused it**, so
   a confirmation and its notification commit together or not at all. It starts
   as `Pending` — recorded, not yet delivered.
2. Once that transaction has committed, the row is pushed through the configured
   channels and marked `Sent` or `Failed`.

Delivery never throws back into the request: a mail server being down must not
roll back a check-in that already happened. `NOTIFICATION_CHANNELS` decides the
transports — `log` writes a structured server-log line and is the default, so a
development install needs no mail server; `email` adds nodemailer over SMTP and
is skipped rather than failed when `SMTP_HOST` is blank. Rows whose channels all
skipped stay `Pending`.

`channel` records the channel a message was *addressed* to. Only email is
implemented; `SMS` and `Push` exist in the schema (SRS §7.2) but are out of scope
this phase.

## Reviews & ratings (SRS §4.9)

| Method | Path | Access |
|---|---|---|
| `POST` | `/api/reviews` | Customer — their own completed booking or order |
| `GET` | `/api/reviews?food_id=` \| `?room_type_id=` | Public — aggregate rating + recent comments |
| `GET` | `/api/reviews?group_by=food` \| `room_type` | Public — one aggregate per item, for the admin listings |
| `GET` | `/api/reviews?mine=true` | The caller's own reviews |
| `GET` | `/api/reviews` | Manager, Receptionist, Super Admin — the full review log |

- A review targets a booking **or** an order, never both, and only once the stay
  is `Checked-out` or the order reached the end of its pipeline (`Served`,
  `Picked Up`, `Delivered`, `Billed to Room`).
- **One review per target**, enforced by a unique index rather than a read-then-
  write, so two concurrent submissions cannot both land. The second gets
  `REVIEW_EXISTS`.
- Ratings are aggregated on read, not cached on `room_types` / `foods`: a room
  type averages the reviews of stays in its rooms, a menu item averages the
  reviews of orders it appeared on (counted once per review, however many lines
  it occupies).

Review error codes: `REVIEW_EXISTS`, `REVIEW_TARGET_NOT_COMPLETE`, plus
`FORBIDDEN` for someone else's booking or order.

## Frontend routes

| Path | Access | Screen |
|---|---|---|
| `/` | Public | Landing — hero, quick availability search, featured menu items |
| `/book`, `/order` | Public | Booking and ordering flows (an account is needed to complete either) |
| `/login`, `/register` | Public | Sign in / self-registration |
| `/my-bookings`, `/my-orders` | Customer | Own stays and orders, with "Leave review" on completed ones |
| `/account` | Authenticated | Session details |
| `/admin/*` | Staff, per role | Back office (SRS §4.2–§4.11) |

The landing search hands its criteria to `/book` in the query string
(`check_in`, `duration_id`, `guests`), which runs the search on arrival rather
than asking for the same three fields twice.

Shared UI: `AsyncState.jsx` provides the one loading / error / empty rendering
every listing uses, `Icon.jsx` the inline icon set (no icon dependency, no
network request), `Rating.jsx` the read-only stars and the 1–5 picker, and
`ToastContext` the four toast variants. Layouts are responsive from 375px up —
wide tables scroll inside their own container so the page itself never scrolls
sideways.

## API conventions

- Paths are namespaced under `/api/<resource>`.
- All responses use the envelope `{ data, error, meta }`.
- Money is `Decimal(10,2)`; datetimes are stored and transmitted in UTC.

See [`CLAUDE.md`](./CLAUDE.md) for the full conventions and business rules.

## Out of scope (this phase)

Payment-gateway certification, native mobile apps, third-party channel-manager integration, multi-branch support, kitchen display system, dynamic pricing, combinable coupon + loyalty discounts.
