/**
 * Publishes the built frontend into backend/public, where server.js serves it.
 *
 * Why a copy step rather than pointing Vite's outDir at backend/public: the
 * frontend keeps its conventional `dist/` output, so a split deployment
 * (Vercel/Netlify building the frontend on its own — docs/DEPLOY.md option B)
 * works with zero configuration. This script is what turns that same build into
 * the single-service layout, and it is the only thing that knows the two
 * directories are related.
 *
 * The target is emptied first: a stale index.html or an orphaned hashed asset
 * left over from a previous build would otherwise be served forever.
 *
 * Run via `npm run build` from the repo root.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'frontend', 'dist');
const TARGET = path.join(ROOT, 'backend', 'public');

if (!fs.existsSync(path.join(SOURCE, 'index.html'))) {
  console.error(
    `\nNo build found at ${path.relative(ROOT, SOURCE)}.\n` +
      'Run the frontend build first — `npm run build` from the repo root does both steps.\n'
  );
  process.exit(1);
}

fs.rmSync(TARGET, { recursive: true, force: true });
fs.cpSync(SOURCE, TARGET, { recursive: true });

console.log(`Frontend published to ${path.relative(ROOT, TARGET)}/ — the backend will serve it.`);
