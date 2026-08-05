/**
 * Room type management (SRS §4.2).
 *
 * A room type carries capacity, amenities and one rate per fixed duration
 * option. Rates are the source the booking engine reads when pricing a stay,
 * so they are validated as non-negative Decimal(10,2) values.
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');

const RATE_FIELDS = [
  'rate2hr',
  'rate4hr',
  'rate6hr',
  'rate8hr',
  'rateFullDay',
  'rateFullNight',
  'rateDayNight',
];

/** Serialises a room type; Decimal rates become strings, never floats. */
function publicRoomType(roomType, roomCount) {
  const rates = {};
  for (const field of RATE_FIELDS) {
    rates[field] = roomType[field] === null ? null : String(roomType[field]);
  }

  return {
    id: roomType.roomTypeId,
    typeName: roomType.typeName,
    capacity: roomType.capacity,
    amenities: roomType.amenities,
    imageUrl: roomType.imageUrl ?? null,
    rates,
    ...(roomCount === undefined ? {} : { roomCount }),
  };
}

async function list({ includeCounts = true } = {}) {
  const roomTypes = await prisma.roomType.findMany({
    orderBy: { roomTypeId: 'asc' },
    ...(includeCounts ? { include: { _count: { select: { rooms: true } } } } : {}),
  });

  return roomTypes.map((rt) =>
    publicRoomType(rt, includeCounts ? rt._count.rooms : undefined)
  );
}

async function getById(roomTypeId) {
  const roomType = await prisma.roomType.findUnique({
    where: { roomTypeId },
    include: { _count: { select: { rooms: true } } },
  });

  if (!roomType) {
    throw new AppError(404, 'NOT_FOUND', 'Room type not found.');
  }

  return publicRoomType(roomType, roomType._count.rooms);
}

async function create(payload) {
  const created = await prisma.roomType.create({ data: payload });
  return publicRoomType(created, 0);
}

async function update(roomTypeId, payload) {
  const existing = await prisma.roomType.findUnique({ where: { roomTypeId } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Room type not found.');
  }

  const updated = await prisma.roomType.update({
    where: { roomTypeId },
    data: payload,
    include: { _count: { select: { rooms: true } } },
  });

  return publicRoomType(updated, updated._count.rooms);
}

/**
 * A room type that still has rooms cannot be deleted — the rooms would be
 * orphaned and their historical bookings would lose their rate context.
 */
async function remove(roomTypeId) {
  const existing = await prisma.roomType.findUnique({
    where: { roomTypeId },
    include: { _count: { select: { rooms: true } } },
  });

  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Room type not found.');
  }

  if (existing._count.rooms > 0) {
    throw new AppError(
      409,
      'ROOM_TYPE_IN_USE',
      `In use: this room type has ${existing._count.rooms} room(s) assigned. Reassign or delete them first.`,
      { roomCount: existing._count.rooms }
    );
  }

  await prisma.roomType.delete({ where: { roomTypeId } });
  return { deleted: true, id: roomTypeId };
}

module.exports = { list, getById, create, update, remove, RATE_FIELDS };
