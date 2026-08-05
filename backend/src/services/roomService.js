/**
 * Room management (SRS §4.2, §5.1).
 *
 * Each physical room belongs to one room type and carries its own status.
 * Rooms under maintenance are excluded from availability results.
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');

const ROOM_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'];

/**
 * Booking states that still hold a claim on the room. Matches the overlap rule
 * in SRS §5.1 plus Pending, which may still be confirmed.
 */
const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];

function publicRoom(room) {
  return {
    id: room.roomId,
    roomNumber: room.roomNumber,
    floor: room.floor,
    status: room.status,
    roomTypeId: room.roomTypeId,
    roomType: room.roomType
      ? {
          id: room.roomType.roomTypeId,
          typeName: room.roomType.typeName,
          capacity: room.roomType.capacity,
        }
      : undefined,
  };
}

async function assertRoomTypeExists(roomTypeId) {
  const roomType = await prisma.roomType.findUnique({ where: { roomTypeId } });
  if (!roomType) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      roomTypeId: 'Selected room type does not exist.',
    });
  }
  return roomType;
}

async function list({ roomTypeId, status } = {}) {
  const where = {};
  if (roomTypeId) where.roomTypeId = roomTypeId;
  if (status) where.status = status;

  const rooms = await prisma.room.findMany({
    where,
    include: { roomType: true },
    orderBy: { roomNumber: 'asc' },
  });

  return rooms.map(publicRoom);
}

/**
 * Rooms offered to guests. Excludes maintenance rooms outright (SRS §4.2).
 *
 * NOTE: this does not yet apply the date-window overlap check from SRS §5.1 —
 * that lands with the booking module. Until then a room is "available" if it is
 * not under maintenance and not currently occupied.
 */
async function listAvailable({ roomTypeId } = {}) {
  const where = {
    status: { notIn: ['MAINTENANCE', 'OCCUPIED'] },
  };
  if (roomTypeId) where.roomTypeId = roomTypeId;

  const rooms = await prisma.room.findMany({
    where,
    include: { roomType: true },
    orderBy: { roomNumber: 'asc' },
  });

  return rooms.map(publicRoom);
}

async function getById(roomId) {
  const room = await prisma.room.findUnique({
    where: { roomId },
    include: { roomType: true },
  });

  if (!room) throw new AppError(404, 'NOT_FOUND', 'Room not found.');
  return publicRoom(room);
}

async function create(payload) {
  await assertRoomTypeExists(payload.roomTypeId);

  const duplicate = await prisma.room.findUnique({
    where: { roomNumber: payload.roomNumber },
  });
  if (duplicate) {
    throw new AppError(409, 'ROOM_NUMBER_TAKEN', 'A room with this number already exists.', {
      roomNumber: 'This room number is already in use.',
    });
  }

  const created = await prisma.room.create({
    data: payload,
    include: { roomType: true },
  });

  return publicRoom(created);
}

async function update(roomId, payload) {
  const existing = await prisma.room.findUnique({ where: { roomId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Room not found.');

  if (payload.roomTypeId !== undefined) {
    await assertRoomTypeExists(payload.roomTypeId);
  }

  if (payload.roomNumber !== undefined && payload.roomNumber !== existing.roomNumber) {
    const duplicate = await prisma.room.findUnique({
      where: { roomNumber: payload.roomNumber },
    });
    if (duplicate) {
      throw new AppError(409, 'ROOM_NUMBER_TAKEN', 'A room with this number already exists.', {
        roomNumber: 'This room number is already in use.',
      });
    }
  }

  const updated = await prisma.room.update({
    where: { roomId },
    data: payload,
    include: { roomType: true },
  });

  return publicRoom(updated);
}

/**
 * Manual status change (SRS §4.2 — staff may flag a room for maintenance).
 * Check-in/checkout also move this automatically once bookings exist.
 */
async function updateStatus(roomId, status) {
  const existing = await prisma.room.findUnique({ where: { roomId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Room not found.');

  // Taking an occupied room out of service would strand a checked-in guest.
  if (status === 'MAINTENANCE') {
    const activeBookings = await prisma.booking.count({
      where: { roomId, status: 'CHECKED_IN' },
    });
    if (activeBookings > 0) {
      throw new AppError(
        409,
        'ROOM_OCCUPIED',
        'This room has a checked-in guest and cannot be moved to maintenance.'
      );
    }
  }

  const updated = await prisma.room.update({
    where: { roomId },
    data: { status },
    include: { roomType: true },
  });

  return publicRoom(updated);
}

/**
 * A room with live bookings cannot be deleted. Rooms with only historical
 * bookings are also protected — the FK is Restrict, and deleting would sever
 * completed stays from their room. Maintenance status is the way to retire a
 * room without losing history.
 */
async function remove(roomId) {
  const existing = await prisma.room.findUnique({ where: { roomId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Room not found.');

  const activeCount = await prisma.booking.count({
    where: { roomId, status: { in: ACTIVE_BOOKING_STATUSES } },
  });

  if (activeCount > 0) {
    throw new AppError(
      409,
      'ROOM_HAS_ACTIVE_BOOKINGS',
      `In use: this room has ${activeCount} active booking(s). Cancel or complete them first.`,
      { activeBookings: activeCount }
    );
  }

  const totalCount = await prisma.booking.count({ where: { roomId } });
  if (totalCount > 0) {
    throw new AppError(
      409,
      'ROOM_HAS_BOOKING_HISTORY',
      `In use: this room has ${totalCount} past booking(s) and cannot be deleted. Set it to Maintenance to take it out of service.`,
      { totalBookings: totalCount }
    );
  }

  await prisma.room.delete({ where: { roomId } });
  return { deleted: true, id: roomId };
}

module.exports = {
  list,
  listAvailable,
  getById,
  create,
  update,
  updateStatus,
  remove,
  ROOM_STATUSES,
  ACTIVE_BOOKING_STATUSES,
};
