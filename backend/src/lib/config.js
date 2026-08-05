/**
 * Tunable business settings.
 *
 * SRS §10 leaves tax rates, refund windows and advance-payment policy to the
 * client. CLAUDE.md §7 requires these live in configuration with a documented
 * default rather than as inline constants.
 *
 * NOTE: SRS §9 calls for a Tax Settings screen backed by configurable tax
 * records, but §7.2 defines no `taxes` table, so rates are read from the
 * environment for now. Moving them into the database is a schema change.
 */

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

/** Comma-separated list, lower-cased and trimmed. */
function list(value, fallback) {
  if (!value) return fallback;
  const items = String(value)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

const config = {
  /** `production` switches on the stricter deployment defaults below. */
  nodeEnv: process.env.NODE_ENV || 'development',

  /**
   * Browser origins allowed to call the API. `*` (the default) suits local
   * development and a single-service deployment, where the frontend is served
   * by this same process and never makes a cross-origin request. A split
   * deployment must name its frontend origin(s) explicitly (SRS §8 Security).
   */
  corsOrigins: list(process.env.CORS_ORIGIN, ['*']),

  /**
   * Number of reverse proxies in front of the API. Nginx, Render and Railway
   * all add one. It has to be a count rather than `true`: rate limiting keys on
   * the client IP, and blindly trusting X-Forwarded-For would let a caller
   * spoof their way around the limit.
   */
  trustProxy: num(process.env.TRUST_PROXY, 0),

  /**
   * Throttle for /api/auth/* — the only unauthenticated endpoints that accept
   * credentials, and so the ones worth protecting from brute force.
   */
  authRateLimit: {
    windowMinutes: num(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES, 15),
    max: num(process.env.AUTH_RATE_LIMIT_MAX, 20),
  },

  /** Tax percentage applied to room bookings, after discount (SRS §5.3). */
  roomTaxPercent: num(process.env.ROOM_TAX_PERCENT, 0),

  /** Tax percentage applied to food orders, after discount. */
  foodTaxPercent: num(process.env.FOOD_TAX_PERCENT, 0),

  /**
   * Minimum share of the total that must be paid before a booking may move
   * Pending -> Confirmed. SRS §5.1 allows "in full or in part", so the default
   * of 0 means any payment above zero is enough. Raise to e.g. 25 to require a
   * quarter up front.
   */
  minAdvancePercent: num(process.env.BOOKING_MIN_ADVANCE_PERCENT, 0),

  /** Minutes after the scheduled start before a booking counts as a no-show. */
  noShowGraceMinutes: num(process.env.BOOKING_NO_SHOW_GRACE_MINUTES, 120),

  /**
   * Minimum order subtotal for a Delivery order (SRS §5.2 — "if configured by
   * the client"). The default of 0 imposes no minimum.
   */
  deliveryMinAmount: num(process.env.FOOD_DELIVERY_MIN_AMOUNT, 0),

  /** Default page size for list endpoints. */
  defaultPageSize: num(process.env.DEFAULT_PAGE_SIZE, 20),
  maxPageSize: num(process.env.MAX_PAGE_SIZE, 100),

  /**
   * Transports a notification is pushed through once its row is written
   * (SRS §4.8). `log` writes a structured line to the server log and is the
   * default, so a development install needs no mail server; `email` adds
   * delivery through the SMTP settings below. Order matters only for logging.
   *
   * Every notification is recorded in `notifications` regardless — the channels
   * decide whether it also leaves the building.
   */
  notificationChannels: list(process.env.NOTIFICATION_CHANNELS, ['log']),

  /**
   * SMTP credentials for the `email` channel. Blank `host` means "not
   * configured": the transport is skipped rather than treated as an error, so
   * the log channel still runs (SRS §10 — the mail provider is a client
   * decision).
   */
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'RRBS <no-reply@rrbs.local>',
  },
};

module.exports = config;
