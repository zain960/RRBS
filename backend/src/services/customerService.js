/**
 * The guest register (SRS §4.1).
 *
 * Customers reach the system three ways: self-registration, a receptionist
 * creating one at the desk, and guest checkout — which writes a lightweight
 * row with a null `passwordHash` (CLAUDE.md §5). All three appear here, and the
 * `hasAccount` flag is what tells them apart in the UI.
 *
 * This is a read-and-search surface for the back office. Customers edit their
 * own details through /api/auth; nothing here lets staff change a password.
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');
const config = require('../lib/config');

/** Never leaks `passwordHash` — only whether one exists. */
function publicCustomer(customer, counts) {
  return {
    id: customer.customerId,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    cnicPassport: customer.cnicPassport,
    loyaltyPoints: customer.loyaltyPoints,
    hasAccount: Boolean(customer.passwordHash),
    createdAt: customer.createdAt,
    ...(counts === undefined
      ? {}
      : { bookingCount: counts.bookings, orderCount: counts.orders }),
  };
}

/**
 * Paginated list with an optional search across name, email and phone.
 *
 * `mode: 'insensitive'` matters here: staff type a name as they hear it, not as
 * it was registered.
 */
async function list({ page = 1, pageSize = config.defaultPageSize, search = '' } = {}) {
  const take = Math.min(Math.max(1, pageSize), config.maxPageSize);
  const skip = (Math.max(1, page) - 1) * take;

  const where = search
    ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { _count: { select: { bookings: true, orders: true } } },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers: customers.map((customer) =>
      publicCustomer(customer, {
        bookings: customer._count.bookings,
        orders: customer._count.orders,
      })
    ),
    meta: { page: Math.max(1, page), pageSize: take, total },
  };
}

/** One customer with their recent bookings and orders, for the detail drawer. */
async function getById(customerId) {
  const customer = await prisma.customer.findUnique({
    where: { customerId },
    include: {
      _count: { select: { bookings: true, orders: true } },
      bookings: {
        orderBy: { checkInDatetime: 'desc' },
        take: 5,
        include: { room: { include: { roomType: true } } },
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!customer) {
    throw new AppError(404, 'NOT_FOUND', 'Customer not found.');
  }

  return {
    ...publicCustomer(customer, {
      bookings: customer._count.bookings,
      orders: customer._count.orders,
    }),
    recentBookings: customer.bookings.map((booking) => ({
      id: booking.bookingId,
      status: booking.status,
      checkInDatetime: booking.checkInDatetime,
      checkOutDatetime: booking.checkOutDatetime,
      totalAmount: String(booking.totalAmount),
      room: booking.room
        ? { roomNumber: booking.room.roomNumber, typeName: booking.room.roomType?.typeName }
        : null,
    })),
    recentOrders: customer.orders.map((order) => ({
      id: order.orderId,
      status: order.status,
      orderType: order.orderType,
      totalAmount: String(order.totalAmount),
      createdAt: order.createdAt,
    })),
  };
}

module.exports = { list, getById };
