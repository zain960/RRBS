# CLAUDE.md — Restaurant & Room Booking System (RRBS)

Guidance for Claude Code when working in this repository.

**Source of truth for requirements:** `Restaurant_Room_Booking_SRS.docx` at the project root. Section references below (§) point into that document. When a request conflicts with the SRS, flag it rather than silently deviating.

**Status:** greenfield. No application code exists yet.

---

## 1. Tech stack

| Layer | Choice |
|---|---|
| Backend | Node.js + Express + Prisma ORM |
| Frontend | React (Vite) + Tailwind CSS + React Router |
| Database | PostgreSQL — dev DB `rrbs_dev`, user `rrbs_user` |
| Auth | JWT, 8-hour expiry; passwords hashed with bcryptjs at 10 rounds |

Auth notes:
- Never store or log plaintext passwords (§8 Security).
- JWT payload carries user identity + role; role checks are enforced server-side on **every** back-office endpoint — never trust a role claim rendered by the frontend.
- Staff (`users`) and customers (`customers`) are separate tables; both may authenticate, but only staff with an assigned role get back-office access (§3).

## 2. Folder conventions

```
backend/
  prisma/            # schema.prisma, migrations, seed
  src/
    routes/          # Express routers — path wiring only, no business logic
    controllers/     # request/response handling, input validation, calls services
    middleware/      # auth (JWT), role guards, error handler, request logging
    services/        # business rules: availability, pricing, coupons, status transitions
frontend/
  src/
    pages/           # route-level screens
    components/      # reusable presentational + shared UI
    api/             # HTTP client wrappers, one module per resource
    context/         # React context providers (auth, cart, toasts)
```

Rules of thumb:
- Domain rules (§5) live in `services/`, not in controllers or routes. Availability checks, pricing math, and status-transition validation must be callable without an HTTP request.
- `routes/` files stay thin: path + middleware + controller reference.
- Frontend `api/` modules are the only place `fetch`/axios is called; pages and components consume those.

## 3. Coding conventions

- **REST paths:** `/api/<resource>` — plural, kebab-case for multi-word (`/api/room-types`, `/api/booking-durations`). Sub-resources nest: `/api/bookings/:id/check-in`.
- **Response shape:** every JSON response is `{ data, error, meta }`.
  - Success: `{ data: <payload>, error: null, meta: {...} }`
  - Failure: `{ data: null, error: { code, message, details? }, meta: {} }`
  - `meta` carries pagination (`page`, `pageSize`, `total`) and similar envelope info.
  - Errors surface a machine-readable `code` — coupon rejection, overlap conflict, and invalid status transition all need clear, distinguishable errors (§5.3).
- **Money:** `Decimal(10,2)` everywhere — Prisma `Decimal`, PostgreSQL `NUMERIC(10,2)`. Never use JS floats for currency; do arithmetic with a decimal library and round only at the final total.
- **Datetimes:** stored in UTC in the database (`timestamptz`). Convert to the client locale at the presentation layer only (§8 Localization).
- **Naming:** Prisma models are `PascalCase` singular (`RoomType`, `BookingDetail`); database tables are `snake_case` plural (`room_types`, `booking_details`) via `@@map`; columns are `snake_case` via `@map`. JS/TS identifiers stay `camelCase`.
- **Auditing:** all transactional tables carry `created_at` / `updated_at`, and bookings/orders/payments record the staff user who performed the action (§8 Auditability).

## 4. Domain rules (SRS §5) — non-negotiable

### Bookings
- **No double-booking.** A new booking is blocked if its time window overlaps an existing `Confirmed` or `Checked-in` booking for the same room. Enforce in a service-layer check inside the same transaction as the insert — a read-then-write without a transaction is a race condition.
- **Fixed duration options only:** 2 hr, 4 hr, 6 hr, 8 hr, Full Day, Full Night, Day & Night. Each maps to a fixed rate per room type (`rate_2hr` … `rate_day_night`). Arbitrary custom durations are not accepted through the standard flow.
- **Lifecycle:** `Pending → Confirmed → Checked-in → Checked-out`, plus `Cancelled` (reachable from `Pending` or `Confirmed`) and `No-show`. Transitions are validated centrally; no controller sets `status` directly.
- A booking must be paid in full or in part before it moves `Pending → Confirmed`.
- Check-in is allowed only on/after the scheduled start time and only while `Confirmed`.
- Checkout requires all linked room-service orders to be `Billed to Room` before the final bill is generated.
- Rooms under `Maintenance` are excluded from availability results. Room status updates automatically at check-in/checkout and can be overridden manually by staff.
- No-show = customer did not check in within a grace period after the scheduled start; releases the room and is logged separately from a cancellation.
- Refund/cancellation windows are **configurable system settings**, not constants in code (exact thresholds pending client confirmation, §10).

### Food ordering
- **Room Service orders are permitted only while the associated booking is `Checked-in`.** Reject otherwise.
- Order pipeline: `Placed → Preparing → Ready → (Served | Picked Up | Dispatched → Delivered | Billed to Room)`, plus `Cancelled`.
- A dine-in order links to a table that is `Free` or `Reserved` for that customer; the table becomes `Occupied` once the order is placed.
- A food item marked unavailable cannot be added to a new order (it still appears in historical orders).
- Delivery orders require a delivery address, plus a configurable minimum order amount.

### Pricing, tax & discounts
- **Calculation order is always: Subtotal − Discount + Tax = Total.** Tax is applied *after* the discount, never before.
- **At most one coupon per booking or order.** Coupon and loyalty-point redemption cannot be combined unless the client explicitly enables it.
- A coupon must satisfy validity window, minimum amount, applicability (`Rooms` / `Food` / `Both`), and remaining usage limit at checkout, or it is rejected with a clear error.
- **Prices are locked at confirmation time.** Store the amounts actually charged (`subtotal`, `discount_amount`, `tax_amount`, `total_amount`, and per-line `unit_price`) on the record. Later changes to base rates or tax rates must never retroactively alter confirmed bookings/orders — always read historical figures from the stored columns, never recompute from current master data.
- Tax rates are configurable per module: rooms and food may carry different rates.

### Roles & access (§3, §5.4)
Seven roles, each user assigned exactly one:

| Role | Scope |
|---|---|
| Super Admin | Full access, including staff accounts, roles, taxes, system settings |
| Manager | Rooms, menu, coupons, all reports; no system-level settings |
| Receptionist | Bookings, check-in/out, payments, customer registration, availability |
| Waiter | Dine-in orders, table assignment, order status, restaurant payments |
| Kitchen Staff | View orders by status; update `Preparing` / `Ready` only |
| Accountant | View/export payments and revenue reports; no booking/order editing |
| Customer | Own bookings, orders, history, reviews |

- Roles and their permissions live in the database (`roles.permissions`), so they can be renamed/adjusted without a code change. Do not hard-code role names in business logic where a permission lookup is appropriate.
- Only Super Admin creates/deactivates staff accounts or changes role permissions.
- Financial reports: Manager, Accountant, Super Admin only.
- A customer may view and manage only their own bookings, orders and reviews — enforce ownership checks server-side.
- A user with no assigned role cannot log into the back office; `Customer` is implicit for public registrants and grants no back-office access.

## 5. Data model reference (SRS §7)

Core tables: `roles`, `users`, `customers`, `room_types`, `rooms`, `booking_durations`, `bookings`, `booking_details`, `dining_tables`, `categories`, `foods`, `orders`, `order_items`, `payments`, `coupons`, `reviews`, `notifications`.

Shape notes worth remembering when writing the Prisma schema:
- `orders.booking_id` is set only for Room Service; `orders.table_id` only for Dine-in; `orders.delivery_address` required for Delivery.
- `payments` links to a booking, an order, or both — supports Full / Advance / Balance / Refund.
- `reviews` links to a booking **or** an order.
- `customers.password_hash` is nullable — guest checkout creates a lightweight customer record without an account.
- Bookings and orders both store the full pricing breakdown as `Decimal(10,2)`.

## 6. Scope boundaries (§1.2, §10, §11)

Out of scope for this phase — do not build unless asked: payment-gateway certification, native mobile apps (responsive web only), channel-manager integrations, multi-branch support, KDS screen, dynamic/seasonal pricing, combinable coupon + loyalty discounts, live delivery tracking.

Single property/branch is assumed, though the schema should not preclude multi-branch later (§8 Scalability).

## 7. Working agreements

- Read the SRS section before implementing a module; it is more specific than this summary.
- Anything the SRS marks "to be confirmed with the client" (tax rates, refund windows, loyalty earn rate, delivery minimum) belongs in configurable settings with a documented default — never a magic number inline.
- Prefer adding a service function with tests over inlining a rule into a controller; the business rules in §4 above are the ones most likely to be tested.
