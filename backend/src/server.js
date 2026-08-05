require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const express = require('express');
const cors = require('cors');

const config = require('./lib/config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { securityHeaders, authLimiter } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 4000;

/**
 * Where the built frontend lands (`npm run build` from the repo root).
 * Present in a single-service deployment, absent in development and in a split
 * deployment where the frontend is hosted separately — both are fine.
 */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Behind a reverse proxy, the client IP arrives in X-Forwarded-For. Express is
// told exactly how many proxies to trust so rate limiting cannot be spoofed.
app.set('trust proxy', config.trustProxy);

app.disable('x-powered-by');
app.use(securityHeaders());

app.use(
  cors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  })
);

app.use(express.json());

// Credential endpoints are throttled before the router sees them (SRS §8).
app.use('/api/auth', authLimiter);

// All responses use the { data, error, meta } envelope — see CLAUDE.md §3.
app.use('/api', routes);

// --- Static frontend --------------------------------------------------------
// Hashed assets are safe to cache for a year; index.html never is, or a
// deployment would keep serving the previous bundle.
if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '1y' }));

  // SPA fallback: any non-API path renders the app, so a deep link like
  // /my-bookings works on a hard refresh. /api/* is excluded so an unknown
  // endpoint still answers with a JSON 404 rather than the HTML shell.
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RRBS API listening on http://localhost:${PORT} (${config.nodeEnv})`);
    if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
      console.log('Serving the built frontend from backend/public');
    }
  });
}

module.exports = app;
