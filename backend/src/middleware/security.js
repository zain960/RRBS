/**
 * Transport-level hardening (SRS §8 Security).
 *
 * Two pieces: response headers on everything, and a throttle on the endpoints
 * that accept credentials.
 */
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('../lib/config');
const { fail } = require('../lib/http');

/**
 * Security headers.
 *
 * The Content-Security-Policy is tuned for this app rather than left at the
 * default, for two reasons:
 *
 *   - `img-src` has to allow remote https images: menu items carry an
 *     `image_url` the client fills in (SRS §7.2), and those live wherever the
 *     client hosts them.
 *   - `upgrade-insecure-requests` is switched off. It would rewrite every
 *     subresource to https, which breaks a deployment that has not put TLS in
 *     front of the app yet. TLS belongs at the proxy — see docs/DEPLOY.md — and
 *     HSTS (still on by default here) is the header that enforces it.
 *
 * Everything else is helmet's default: same-origin scripts only, no framing,
 * no object embeds.
 */
function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'https:'],
        'upgrade-insecure-requests': null,
      },
    },
    // The API is called cross-origin in a split deployment; the default
    // same-origin policy would block those responses.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

/**
 * Brute-force throttle for /api/auth/*.
 *
 * Counts every request to the auth routes, not just failures: a caller
 * hammering /auth/login with valid credentials is still a caller to slow down.
 * Both the window and the ceiling are configurable (CLAUDE.md §7) — the
 * defaults, 20 requests per 15 minutes per IP, leave normal sign-in and
 * registration well clear while making a password sweep impractical.
 *
 * Rejections use the standard envelope so the client renders them like any
 * other error.
 */
const authLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMinutes * 60 * 1000,
  limit: config.authRateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) =>
    fail(
      res,
      429,
      'RATE_LIMITED',
      'Too many attempts. Please wait a few minutes and try again.',
      { retryAfterMinutes: config.authRateLimit.windowMinutes }
    ),
});

module.exports = { securityHeaders, authLimiter };
