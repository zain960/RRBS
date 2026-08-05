/**
 * Dining table management (SRS §4.4, §5.2).
 *
 * A table carries a number, capacity, location and a live status. The status is
 * what the floor works from: a dine-in order may only be attached to a table
 * that is Free, or Reserved for that same customer, and placing the order moves
 * it to Occupied (SRS §5.2). That transition lands with the ordering module —
 * this service owns the manual status changes staff make from the floor plan.
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');

const TABLE_STATUSES = ['FREE', 'OCCUPIED', 'RESERVED'];
const TABLE_LOCATIONS = ['INDOOR', 'OUTDOOR'];

/**
 * Order states that still hold the table. An order in any of these is being
 * worked on, so the table cannot be freed or deleted from under it.
 */
const OPEN_ORDER_STATUSES = ['PLACED', 'PREPARING', 'READY'];

function publicTable(table, orderCount) {
  return {
    id: table.tableId,
    tableNumber: table.tableNumber,
    capacity: table.capacity,
    location: table.location,
    status: table.status,
    ...(orderCount === undefined ? {} : { orderCount }),
  };
}

async function list({ status, location } = {}) {
  const where = {};
  if (status) where.status = status;
  if (location) where.location = location;

  const tables = await prisma.diningTable.findMany({
    where,
    orderBy: { tableNumber: 'asc' },
  });

  return tables.map((table) => publicTable(table));
}

/**
 * Tables a guest may be seated at right now — Free only.
 *
 * Public, like the room availability search: a customer placing a dine-in order
 * has to be able to name a table, and the full floor plan (with Occupied and
 * Reserved tables) is staff information.
 */
async function listAvailable() {
  const tables = await prisma.diningTable.findMany({
    where: { status: 'FREE' },
    orderBy: { tableNumber: 'asc' },
  });

  return tables.map((table) => publicTable(table));
}

async function getById(tableId) {
  const table = await prisma.diningTable.findUnique({
    where: { tableId },
    include: { _count: { select: { orders: true } } },
  });

  if (!table) throw new AppError(404, 'NOT_FOUND', 'Table not found.');
  return publicTable(table, table._count.orders);
}

async function assertNumberFree(tableNumber, exceptTableId) {
  const duplicate = await prisma.diningTable.findUnique({ where: { tableNumber } });
  if (duplicate && duplicate.tableId !== exceptTableId) {
    throw new AppError(409, 'TABLE_NUMBER_TAKEN', 'A table with this number already exists.', {
      tableNumber: 'This table number is already in use.',
    });
  }
}

async function create(payload) {
  await assertNumberFree(payload.tableNumber);

  const created = await prisma.diningTable.create({ data: payload });
  return publicTable(created, 0);
}

async function update(tableId, payload) {
  const existing = await prisma.diningTable.findUnique({ where: { tableId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Table not found.');

  if (payload.tableNumber !== undefined && payload.tableNumber !== existing.tableNumber) {
    await assertNumberFree(payload.tableNumber, tableId);
  }

  const updated = await prisma.diningTable.update({
    where: { tableId },
    data: payload,
    include: { _count: { select: { orders: true } } },
  });

  return publicTable(updated, updated._count.orders);
}

/**
 * Manual status change from the floor plan — seating walk-ins, holding a table
 * for a reservation, or clearing it once guests leave.
 *
 * Freeing a table that still has an open order would lose track of who the food
 * belongs to, so that is rejected: close or cancel the order first.
 */
async function updateStatus(tableId, status) {
  const existing = await prisma.diningTable.findUnique({ where: { tableId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Table not found.');

  if (status !== 'OCCUPIED') {
    const openOrders = await prisma.order.count({
      where: { tableId, status: { in: OPEN_ORDER_STATUSES } },
    });

    if (openOrders > 0) {
      throw new AppError(
        409,
        'TABLE_HAS_OPEN_ORDERS',
        `This table has ${openOrders} open order(s). Close or cancel them before changing its status.`,
        { openOrders }
      );
    }
  }

  const updated = await prisma.diningTable.update({
    where: { tableId },
    data: { status },
  });

  return publicTable(updated);
}

/**
 * A table with order history cannot be deleted — the FK is Restrict and past
 * dine-in orders would lose the table they were served at (SRS §8 Auditability).
 */
async function remove(tableId) {
  const existing = await prisma.diningTable.findUnique({
    where: { tableId },
    include: { _count: { select: { orders: true } } },
  });

  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Table not found.');

  if (existing._count.orders > 0) {
    throw new AppError(
      409,
      'TABLE_IN_USE',
      `In use: this table has ${existing._count.orders} order(s) linked to it and cannot be deleted.`,
      { orderCount: existing._count.orders }
    );
  }

  await prisma.diningTable.delete({ where: { tableId } });
  return { deleted: true, id: tableId };
}

module.exports = {
  list,
  listAvailable,
  getById,
  create,
  update,
  updateStatus,
  remove,
  TABLE_STATUSES,
  TABLE_LOCATIONS,
  OPEN_ORDER_STATUSES,
};
