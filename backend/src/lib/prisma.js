/**
 * Shared PrismaClient instance.
 *
 * Prisma 7 requires a driver adapter rather than a bare connection string.
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
