# RRBS UI Guide

How the Restaurant & Room Booking System looks and why. This is the reference
for anyone adding a screen: use what is here, and if the primitive you need does
not exist, add it to `frontend/src/components/ui/` rather than styling one
inline.

**The one rule:** every screen composes the shared component library. A page that
hand-rolls a button, a table or an empty state has introduced a second design
system, and the two will drift.

- Tokens live in `frontend/tailwind.config.js` and `frontend/src/index.css`
- Primitives live in `frontend/src/components/ui/`, exported from `ui/index.js`
- Status labels and colours live in `frontend/src/lib/statuses.js`
- Display formatting lives in `frontend/src/lib/format.js`

---

## 1. Design direction

Hospitality-grade: warm, confident, trustworthy. The customer side takes its cue
from Booking.com and Airbnb — photography, generous space, a serif display face
for the moments that should feel like a hotel. The back office takes its cue from
Linear and Stripe — dense, quiet, fast to scan, no decoration that does not carry
information.

Deep navy carries structure and intent. Warm amber carries action. Surfaces are a
warm off-white rather than cold grey, which is the single choice that most keeps
the product from reading as generic SaaS.

---

## 2. Tokens

### Colour

| Ramp | Base | Used for |
|---|---|---|
| `primary` 50–900 | `#0F2942` (800) | Primary buttons, admin sidebar, links, headings |
| `accent` 50–900 | `#B8823A` (500) | CTAs, highlights, active states, the focus ring |
| `neutral` 50–900 | `#FAF7F2` (50) surface, `#0A0A0A` (900) ink | Every surface, border and body text |

Semantic colours are single values, not ramps — they only ever appear as a state
signal, never as a surface: `success #16A34A`, `danger #DC2626`,
`warning #EA580C`, `info #0284C7`.

Nothing is themeable at runtime. One property, one brand (SRS §1.2).

### Typography

| Token | Stack | Where |
|---|---|---|
| `font-sans` | Inter, system-ui | All UI text, both sides |
| `font-display` | Playfair Display, Georgia, serif | Public-side hero and hospitality headings **only** — never in the back office |

Scale: `xs` 12 · `sm` 14 · `base` 15 · `lg` 17 · `xl` 20 · `2xl` 24 · `3xl` 30 ·
`4xl` 40 · `5xl` 56. Headings tighten (`3xl`+ carry negative tracking); prose
stays relaxed.

Both faces load from Google Fonts in `index.html`, behind `preconnect` so a cold
load is not a render-blocking round trip.

### Radius, shadow, motion

```
radius   sm 6px · DEFAULT 10px · lg 14px · xl 20px · 2xl 28px

shadow   card   0 1px 3px rgba(15,41,66,.08), 0 1px 2px rgba(15,41,66,.04)
         hover  0 8px 24px rgba(15,41,66,.10)
         modal  0 20px 60px rgba(15,41,66,.20)

duration hover 150ms ease-out      (hover, colour)
         state 200ms ease-in-out   (open/close, route change)
```

Durations are named for intent, so a screen asks for `duration-hover` rather
than remembering `150ms`.

Animations available: `fade-in`, `fade-in-up`, `scale-in`, `slide-in-right`,
`pulse-highlight` (kitchen status change), `shimmer` (skeletons).

`prefers-reduced-motion: reduce` collapses every transition to ~0ms rather than
removing it, so a state change is still perceivable without motion.

### Focus

One ring everywhere: `2px accent-500` with a `2px` offset, applied globally to
`:focus-visible` in `index.css`. Browser default outlines are removed. It is
`:focus-visible`, not `:focus`, so a mouse click never paints a ring but keyboard
and screen-reader navigation always does.

---

## 3. Component library

`frontend/src/components/ui/` — import from `components/ui`, never from the
individual file, so a primitive can be split or renamed without touching pages.

### Actions

| Component | Notes |
|---|---|
| `Button` | Variants `primary` `secondary` `accent` `ghost` `danger` `link`; sizes `sm` `md` `lg`; `loading` (label holds its width behind the spinner), `iconLeft` / `iconRight`, `iconOnly`, `fullWidth`. Pass `to` to render a router `Link` or `href` for an `<a>` — a button that navigates stays a link. A disabled link falls back to a real disabled `<button>`. |
| `DropdownMenu` | Menus needing search or multi-select; anything a native `<select>` cannot do. |

### Forms

| Component | Notes |
|---|---|
| `Field` | The label / hint / error / required scaffolding all controls share. Owns the ids and wires `aria-describedby` + `aria-invalid`. Errors announce via `aria-live="polite"`. |
| `Input` / `InputControl` | `iconLeft`, `iconRight`, `suffix` (a unit like `%`). `InputControl` is the bare control for callers supplying their own `Field`. |
| `Textarea` / `TextareaControl` | Same contract as Input. |
| `Select` / `SelectControl` | Native `<select>` with a token-coloured arrow — opens the platform picker on a phone and is keyboard-accessible for free. `options` is `[{ value, label, disabled? }]`. **Order matters:** `options` render before `children`, so an "All …" entry belongs at the head of the `options` array, not as a child `<option>`. |
| `DatePicker` / `TimePicker` / `DateTimePicker` | Wrap the native pickers. Value is local wall time; converting to/from UTC is the caller's job via `toLocalInputValue`. |
| `Checkbox` / `Radio` / `Switch` | A real native input underneath, `sr-only` rather than `display:none`, so it stays focusable and announced. **Switch vs Checkbox:** a switch applies immediately (a room going into Maintenance, a coupon going live); a checkbox is a value submitted with a form. |
| `ToggleGroup` | Segmented control, up to ~5 options. One tab stop with roving arrow-key focus, `role="radiogroup"`. |
| `FormSection` | Title + description + field grid (`columns` 1–3). Every field is full width on a phone regardless. `FullWidth` spans one field; `FormActions` is the button row (reversed on mobile so the primary action sits under the thumb); `FormDivider` separates without a heading. |

### Data display

| Component | Notes |
|---|---|
| `Table` | Columns declared as objects, not JSX children, so one definition drives both the desktop table and the mobile card list. Supports `sortable` (controlled — the caller owns the order, because server-side pagination means the table cannot sort correctly alone), `align`, `width`, `hideBelow`, `primary`, sticky header, skeleton rows, and built-in loading / error / empty rendering. |
| `TableCards` | The same columns as a stacked card list. Uses the `primary` column as the title. |
| `ResponsiveTable` | Table at `md`+, cards below. **The default for every admin list** — the responsive behaviour is one import rather than a decision per screen. |
| `Card` + `CardHeader` / `CardBody` / `CardFooter` | Variants `default` (hairline border), `elevated` (shadow, no border), `outlined` (heavier border, inert). `interactive` adds the hover lift and should only be set when the whole card is genuinely clickable. |
| `Badge` / `StatusChip` | `Badge` is the primitive (tone + label). **`StatusChip` is what pages should use** — hand it a map from `lib/statuses` and a raw enum value and it resolves label and tone itself. |
| `Avatar` | Initials fallback via `initials()`. |
| `Image` | Skeleton while loading, fallback if broken. |
| `Pagination` | Page / pageSize / total, from the response `meta`. |
| `Tabs`, `Breadcrumbs`, `Stepper` | Navigation within a page or a flow. |
| `Tooltip` | |

### Feedback & states

| Component | Notes |
|---|---|
| `EmptyState` | Icon, title, description, optional CTA. **Copy convention: the title states the fact, the description says what to do next.** |
| `ErrorState` | A failed load with a retry. Omit `onRetry` where retrying cannot help. |
| `InlineError` | A failure beside content that is still usable, where blanking the panel would lose more than it explains. |
| `TableState` | Wraps any of the above in a full-width `<tbody>` row. |
| `Skeleton` + `SkeletonText` / `SkeletonCard` / `SkeletonImage` / `SkeletonRows` / `SkeletonGroup` | Shimmer over a neutral block, not a pulse, so ten loading rows read as one surface instead of ten blinking lights. |
| `Spinner` | Button actions only — never a list. |
| `Modal` / `ConfirmDialog` | Portalled to `document.body` so a dialog opened inside a card is never clipped by an ancestor's `overflow`. Backdrop fades, card scales 0.95 → 1, focus trapped, Escape closes. Set `closeOnBackdrop={false}` for any form with unsaved input. `ConfirmDialog` defaults to `tone="danger"`; pass `tone="primary"` for merely significant actions so red keeps its meaning. |
| `Drawer` | Side sheet for row detail. |
| `PageHeader` + `FilterBar` | The top of every admin screen and the filter strip beneath it. |
| Toasts | Via `useToast()` from `context/ToastContext` — `toast.success/error/info/warning`. Top-right, slide-in from the right, auto-dismiss 4s. |

### Icons

`lucide-react` throughout. **18px** in buttons, **20px** in nav, **16px** in
badges and inline labels. Decorative icons carry `aria-hidden="true"`; an
icon-only button carries an `aria-label`.

### Domain components

`components/domain/` — composed from the primitives, shared across screens:
`RoomTypeCard`, `FoodCard`, `CouponField`, `Rating`, `ReviewDialog`.

---

## 4. Layout shells

### `PublicLayout` (customer-facing)

Sticky top nav — serif wordmark left, links centre, account/login right.
`transparentHeader` renders it transparent over a hero and solid white on
scroll; the landing page is the only route that passes it. Footer is four
columns (about, quick links, contact, newsletter) plus a copyright bar. Pages sit
on `neutral-50`, cards on white.

### `AdminLayout` (back office)

Fixed 240px left sidebar: brand at top, grouped nav sections, user card at
bottom. Top bar carries page title + breadcrumbs left, search + notifications +
user dropdown right. Content is `neutral-50`, centred, generously padded.
Three responsive modes, because a back office is used on all three: at `xl`+ the
sidebar is always visible at 240px; between `lg` and `xl` it collapses to icons
so a 1280px laptop keeps the full content width; below `lg` it is off-canvas
behind a hamburger. The collapsed preference deliberately follows the viewport
rather than being persisted, so resizing never strands the layout in a state the
user cannot explain.

Navigation is data, in `components/layout/adminNav.js`: `NAV_SECTIONS` declares
the groups, `navForRole(role)` filters them, `findNavItem(pathname)` resolves the
current page. Adding an admin screen means adding a nav entry there — not editing
the layout.

### `SplitScreen`

Brand and illustration left, form card right. Used by `/login`, `/register`,
`/403` and `/404`. Warm and welcoming, deliberately not corporate-cold.

---

## 5. Status colour mapping

One canonical mapping, in `lib/statuses.js`. Every chip, badge, filter dropdown
and legend reads from it, so adding a status is one edit rather than a hunt.

Tones are semantic (`neutral` `info` `progress` `success` `warning` `danger`
`accent`), never colour names — `PREPARING` asks for "progress" and the palette
decides that means orange.

| Family | Mapping |
|---|---|
| `BOOKING_STATUS` | Pending → warning (waiting on the guest) · Confirmed → info · Checked-in → success (live) · Checked-out → neutral (closed) · Cancelled → danger · No-show → warning (a normal operational outcome, not an error) |
| `ORDER_STATUS` | Placed → warning · Preparing → progress · Ready → info · Served / Picked up / Delivered → success · Dispatched → info · Billed to room → accent (the one outcome that moves money onto a booking) · Cancelled → danger |
| `ROOM_STATUS` | Available → success · Occupied → info · Reserved → warning · Maintenance → danger (it removes the room from sale) |
| `TABLE_STATUS` | Free → success · Occupied → info · Reserved → warning |
| `PAYMENT_STATUS` | Pending → warning · Completed → success · Failed → danger · Refunded → neutral |
| `PAYMENT_TYPE` | Full → success · Advance / Balance → info · Refund → danger |
| `COUPON_APPLICABILITY` | Rooms → info · Food → accent · Both → neutral |
| `FOOD_AVAILABILITY`, `USER_STATUS` | Available / Active → success · Unavailable / Inactive → neutral |

`statusMeta(map, value)` falls back to a de-underscored, neutral-toned label
rather than throwing: a status the API adds before the UI knows about it renders
legibly instead of crashing the screen. `statusOptions(map)` returns
`{ value, label }` pairs for a Select or filter chip row.

**`PENDING` is not one thing.** A booking awaiting payment and a payment awaiting
settlement are different chips — which is why `StatusChip` requires an explicit
`map`.

---

## 6. Formatting

All display formatting goes through `lib/format.js`; nothing formats inline.

| Helper | Output |
|---|---|
| `money(value)` | `PKR 6,000` — whole amounts drop decimals, anything with paisa keeps both digits so a bill line never looks rounded. `{ alwaysDecimals: true }` forces two. |
| `signedMoney`, `number`, `percent` | Signed deltas, thousands separators, trimmed percentages |
| `dateOnly` | `Aug 5, 2026` |
| `dateTime` | `Aug 5, 8:24 PM` — the workhorse |
| `dateTimeLong` | `Aug 5, 2026, 8:24 PM` |
| `timeOnly`, `relativeTime`, `minutesSince` | `8:24 PM`, `12 minutes ago`, wait-time colour coding |
| `dateRange(from, to)` | A check-in → check-out window on one line, collapsing the date when both fall on the same day |
| `toLocalInputValue` | UTC ISO → the local wall time a `datetime-local` input wants |
| `initials` | Avatar fallback |

Money arrives from the API as decimal **strings**, never numbers, because the
backend stores `Decimal(10,2)` and JS floats would round it. `format.js` parses
for display only — no arithmetic.

Where a running total genuinely has to be summed client-side (the paid-to-date
figure on a booking), use `lib/money.js`, which works in integer paisa and
converts back at the end so no intermediate value is ever a fraction. Anything
*charged* is computed server-side and read from the stored columns — never
recomputed in the browser, because prices are locked at confirmation
(CLAUDE.md §4).

Datetimes are UTC in the database and converted to the viewer's locale at this
layer and nowhere else.

Capitalisation: **sentence case** for buttons, labels and hints; **Title Case**
for page headings.

---

## 7. Data states

Every list and detail screen renders all four. An empty list and a failed load
look identical if both render as blank space, and a guest cannot tell whether
they have no bookings or the server is down.

| State | Treatment |
|---|---|
| Loading | **Skeleton** for lists and detail panels — never a spinner. Spinners are for button actions only. |
| Empty | `EmptyState` with a meaningful icon, a title stating the fact, a description saying what to do next, and a CTA where one exists. Filtered-empty and truly-empty get different copy. |
| Error | `ErrorState` (or `InlineError` beside still-usable content) with a retry that re-runs the same request. |
| Success | Toast, plus inline confirmation where the result is not visible on screen. |

`Table` / `ResponsiveTable` render all three of loading, error and empty
internally — pass `loading`, `error`, `onRetry` and `empty` and the states are
handled.

### Coverage

Public: `/` Landing · `/rooms` · `/book` (5-step flow) · `/menu` · `/order` ·
`/my-bookings` · `/my-orders` · `/account`
Admin: `/admin/dashboard` · `bookings` · `bookings/:id` · `customers` ·
`room-types` · `rooms` · `tables` · `categories` · `menu` · `orders` ·
`kitchen` · `coupons` · `payments` · `reports` · `settings/tax`
Standalone: `/login` · `/register` · `/403` · `/404`

Admin list screens all follow one pattern: `PageHeader` (title, subtitle,
breadcrumbs, primary action top-right) → `FilterBar` (search, filters, date range)
→ `Card` wrapping a `ResponsiveTable` → `Pagination`. Row click opens a `Drawer`
with full detail; add/edit opens a `Modal` laid out with `FormSection`;
destructive actions go through `ConfirmDialog`.

---

## 8. Responsive

Breakpoints are Tailwind defaults: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 ·
`2xl` 1536. Every page is checked at **375 / 768 / 1440**.

- **Public** is mobile-first. The hero rebalances, and the room filter sidebar
  becomes a bottom sheet.
- **Admin** sidebar collapses to icons between `lg` and `xl`, and goes off-canvas
  below `lg`. Data tables become card lists below `md` via `ResponsiveTable`.
- Wide content that cannot reflow (a report with many columns) scrolls inside its
  own container. The page body never scrolls horizontally.

Imagery: rooms 16:9, food 4:3, both `object-cover`, rooms `rounded-xl` and food
`rounded-lg`. Every `<img>` goes through `Image` for its skeleton and broken
fallback. Placeholders are Unsplash URLs referenced from seed data.

### Responsive images

The seed picks one width per photo — 1200px for a room, 800px for a dish — and
that width is wrong nearly everywhere it is used: the same room photo is a 300px
card on the public grid and a 64px thumbnail in the admin table. `lib/images.js`
rewrites the Unsplash `w=` parameter across a ladder of widths and hands the
browser a `srcset`, which also covers high-DPR screens for free.

**Always pass `sizes`** — it is how wide the image actually renders in CSS terms.
Without it the browser assumes `100vw` and fetches a file far larger than the
slot needs, which defeats the whole mechanism. Pass `maxWidth` to cap the ladder
where a bigger file could never be used.

| Slot | `sizes` | `maxWidth` |
|---|---|---|
| Card in a 4-up grid | `(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw` | 768 |
| Fixed-width strip (horizontal food card) | `128px` | 384 |
| Table / cart thumbnail | `56px` or `64px` | 256 |
| Half-screen panel (`SplitScreen`) | `(min-width: 1024px) 50vw, 0px` | 1024 |
| Full-bleed hero | `100vw` | — |

`priority` is for the one image the first screen is judged on — the landing hero.
It loads eagerly at high fetch priority; everything else stays `loading="lazy"`.
Lazy-loading the LCP image only delays it.

Only Unsplash URLs are rewritten. A future uploaded photo on our own storage
passes through untouched.

---

## 9. Accessibility

- WCAG AA contrast on all text.
- Every interactive element is keyboard-navigable with the tokenised focus ring.
  Clickable table rows are real tab stops with `role="button"` and Enter/Space
  handlers, so a detail drawer is reachable without a mouse.
- Modals trap focus and close on Escape (`lib/useFocusTrap.js`).
- Form errors are announced via `aria-live="polite"` — a validation failure
  reaches a screen reader without stealing focus mid-typing.
- Icon-only buttons carry `aria-label`; decorative icons carry `aria-hidden`.
- Tables carry an `sr-only` `<caption>`; live-updating counts carry `aria-live`.
- Loading regions carry `role="status"` and `aria-busy`.

---

## 10. Screenshots

> **Not yet captured.** Populated screenshots need the app running against the dev
> database, and `rrbs_dev` (localhost:**5434**) was not up when this guide was
> written. The procedure below regenerates them; save into `docs/screenshots/`
> and link them from this section.

```bash
# 1. start the dev database (port 5434, per backend/.env)
# 2. migrate and seed it
cd backend && npm run db:deploy && npm run db:seed

# 3. run both sides
cd backend  && npm run dev     # :4000
cd frontend && npm run dev     # :5173
```

Capture at **1440×900** (desktop) and **375×812** (mobile) for each row below.
Loading and error states are easiest to capture by throttling to *Slow 3G* and by
stopping the backend respectively.

| Screen | States to capture |
|---|---|
| `/` Landing | default, mobile |
| `/rooms` | loaded, filtered-empty, loading skeleton |
| `/book` | each of the 5 steps, coupon rejected, confirmation |
| `/menu`, `/order` | loaded, cart drawer open |
| `/my-bookings`, `/my-orders` | loaded, empty |
| `/admin/dashboard` | loaded, loading |
| Each admin list | loaded, empty, filtered-empty, error, row drawer, edit modal |
| `/admin/kitchen` | busy queue, empty queue |
| `/admin/reports` | report selected, no data in range |
| `/login`, `/register`, `/403`, `/404` | default |

---

## 11. Adding a screen

1. Read the SRS section for the module — it is more specific than CLAUDE.md.
2. Add the route in `App.jsx` behind the right `ProtectedRoute` role guard.
3. Add the nav entry to `components/layout/adminNav.js` (admin screens).
4. Render `PageMeta` for the document title; `noIndex` for anything in the back
   office or any guest's own records.
5. Compose `PageHeader` → `FilterBar` → `Card` + `ResponsiveTable` → `Pagination`.
6. Wire all four data states. Do not ship a screen that renders blank while
   loading.
7. Take status labels from `lib/statuses.js` and formatting from `lib/format.js`.
8. Check 375 / 768 / 1440, then tab through the whole screen without a mouse.
