// Prisma 7 configuration.
// The connection URL and seed command live here — Prisma 7 removed `url` from
// the datasource block and dropped the `prisma` key in package.json.
require('dotenv').config();

const path = require('node:path');

module.exports = {
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: path.join(__dirname, 'prisma', 'migrations'),
    seed: 'node prisma/seed.js',
  },
};
