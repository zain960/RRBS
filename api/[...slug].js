/**
 * Vercel serverless entry point for the API.
 *
 * A catch-all (`[...slug]`) so every `/api/*` request lands here with `req.url`
 * still holding the original path — which is what the Express router expects,
 * since routes/index.js is mounted at `/api`. A plain `api/index.js` plus a
 * rewrite would work too, but rewrites rewrite the path, and then every route
 * would need re-mounting.
 *
 * Deliberately `[...slug]` and not the optional `[[...slug]]`: with the optional
 * form Vercel matched only a single segment, so `/api/health` resolved but
 * `/api/health/db` and `/api/auth/login` returned Vercel's own 404 before ever
 * reaching Express.
 *
 * An Express app is already a `(req, res)` handler, so it can be exported
 * directly as the function. server.js only calls `listen()` when it is the main
 * module, so requiring it here starts no server — Vercel owns the lifecycle.
 *
 * Used only on Vercel (docs/DEPLOY.md option C). The single-service deployment
 * ignores this file and runs server.js as a long-lived process.
 */
module.exports = require('../backend/src/server.js');
