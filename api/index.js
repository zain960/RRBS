/**
 * Vercel serverless entry point for the API.
 *
 * An Express app is already a `(req, res)` handler, and server.js calls
 * `listen()` only when it is the main module, so requiring it here starts no
 * server — Vercel owns the lifecycle.
 *
 * Why the path juggling: Vercel's filesystem routing did not give us a working
 * catch-all on this project. Both `[...slug]` and `[[...slug]]` matched exactly
 * one segment, so `/api/health` reached Express while `/api/health/db` and
 * `/api/auth/login` returned Vercel's own 404. vercel.json therefore rewrites
 * `/api/(.*)` here explicitly and passes the original path as `__path`.
 *
 * A rewrite replaces `req.url` with the destination, which would leave Express
 * — whose router is mounted at `/api` — seeing `/api/index` for every request.
 * So the original path is rebuilt before the app ever sees it, with any real
 * query string preserved. If `__path` is absent the request came in unrewritten
 * and `req.url` is already correct, so it is left alone.
 *
 * Used only on Vercel (docs/DEPLOY.md option C). The single-service deployment
 * ignores this file and runs server.js as a long-lived process.
 */
const app = require('../backend/src/server.js');

module.exports = (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const original = url.searchParams.get('__path');

  if (original !== null) {
    url.searchParams.delete('__path');
    const query = url.searchParams.toString();
    req.url = `/api/${original}${query ? `?${query}` : ''}`;
  }

  return app(req, res);
};
