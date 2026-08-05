/**
 * Notifications (SRS §4.8).
 *
 * Domain events raise a message for the customer they concern: a confirmed
 * booking, a check-in, a checkout, an order moving along the kitchen pipeline,
 * a payment landing.
 *
 * Two steps, deliberately separated:
 *
 *   1. `notify(tx, event, context, outbox)` writes the `notifications` row
 *      inside the caller's transaction, so a confirmation and its notification
 *      commit together or not at all (SRS §8 Auditability). The new row starts
 *      as `Pending` — recorded, not yet delivered.
 *   2. `deliverSoon(outbox)` runs after the transaction has committed and
 *      pushes each row through the configured channels, then marks it `Sent`
 *      or `Failed`.
 *
 * Delivery never throws back into the request: a mail server being down must
 * not roll back a check-in that already happened. Failures are logged and left
 * on the row as `Failed`.
 *
 * `channel` records the channel a message is *addressed* to. Only email is
 * implemented; `SMS` and `Push` are in the schema (SRS §7.2) but out of scope
 * for this phase (§1.2). The `log` transport is a development sink, not a
 * channel a guest can be reached on, so it does not get its own enum value.
 */
const prisma = require('../lib/prisma');
const config = require('../lib/config');
const mailer = require('../lib/mailer');
const { AppError } = require('../lib/http');
const { toMoneyString } = require('../lib/money');

const RECIPIENT_TYPES = ['CUSTOMER', 'STAFF'];
const CHANNELS = ['SMS', 'EMAIL', 'PUSH'];
const STATUSES = ['PENDING', 'SENT', 'FAILED'];

/**
 * Datetimes are stored UTC and only localised at the presentation layer
 * (CLAUDE.md §3). A notification body is stored text, so it carries the UTC
 * stamp and says so rather than freezing a server-side locale into the record.
 */
function stamp(value) {
  if (!value) return 'an unscheduled time';
  return `${new Date(value).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function roomLabel(booking) {
  return booking.room?.roomNumber ? `room ${booking.room.roomNumber}` : 'your room';
}

/** Enum member -> the wording the guest sees (SRS §7.2 payment_method). */
const METHOD_LABELS = { CASH: 'cash', CARD: 'card', ONLINE: 'online' };

function methodLabel(method) {
  return METHOD_LABELS[method] ?? String(method).toLowerCase();
}

/**
 * One template per event. Each returns the row to write, or null when there is
 * nobody to tell — a walk-in order with no customer record, for instance.
 */
const TEMPLATES = {
  'booking.confirmed': ({ booking }) =>
    booking.customerId && {
      recipientType: 'CUSTOMER',
      recipientId: booking.customerId,
      channel: 'EMAIL',
      title: `Booking #${booking.bookingId} confirmed`,
      message:
        `Your booking for ${roomLabel(booking)} is confirmed for ${stamp(
          booking.checkInDatetime
        )} to ${stamp(booking.checkOutDatetime)}. ` +
        `Total ${toMoneyString(booking.totalAmount)}.`,
    },

  'booking.checked_in': ({ booking }) =>
    booking.customerId && {
      recipientType: 'CUSTOMER',
      recipientId: booking.customerId,
      channel: 'EMAIL',
      title: `Checked in to ${roomLabel(booking)}`,
      message:
        `You are checked in to ${roomLabel(booking)} as of ${stamp(booking.actualCheckIn)}. ` +
        'Room service is available for the rest of your stay.',
    },

  'booking.checked_out': ({ booking }) =>
    booking.customerId && {
      recipientType: 'CUSTOMER',
      recipientId: booking.customerId,
      channel: 'EMAIL',
      title: `Checked out of ${roomLabel(booking)}`,
      message:
        `You checked out of ${roomLabel(booking)} at ${stamp(booking.actualCheckOut)}. ` +
        `Booking #${booking.bookingId} billed ${toMoneyString(booking.totalAmount)}. ` +
        'Thank you for staying with us.',
    },

  'order.status_changed': ({ order, statusLabel, previousLabel }) =>
    order.customerId && {
      recipientType: 'CUSTOMER',
      recipientId: order.customerId,
      channel: 'EMAIL',
      title: `Order #${order.orderId} is ${statusLabel}`,
      message: `Your order #${order.orderId} moved from ${previousLabel} to ${statusLabel}.`,
    },

  'payment.received': ({ payment, booking, order }) => {
    const recipientId = booking?.customerId ?? order?.customerId;
    if (!recipientId) return null;

    const against = booking ? `booking #${booking.bookingId}` : `order #${order.orderId}`;
    const isRefund = payment.paymentType === 'REFUND';

    return {
      recipientType: 'CUSTOMER',
      recipientId,
      channel: 'EMAIL',
      title: isRefund
        ? `Refund of ${toMoneyString(payment.amount)} issued`
        : `Payment of ${toMoneyString(payment.amount)} received`,
      message: isRefund
        ? `A refund of ${toMoneyString(payment.amount)} for ${against} has been issued against your ${methodLabel(
            payment.method
          )} payment.`
        : `We received ${toMoneyString(payment.amount)} by ${methodLabel(
            payment.method
          )} against ${against}.`,
    };
  },
};

const EVENTS = Object.keys(TEMPLATES);

/**
 * Records a notification for an event.
 *
 * `client` is normally the caller's transaction. Ids are pushed onto `outbox`
 * so the caller can hand them to `deliverSoon()` once the transaction has
 * committed. Returns the new id, or null when the event has no recipient.
 */
async function notify(client, event, context, outbox) {
  const template = TEMPLATES[event];
  if (!template) throw new Error(`Unknown notification event: ${event}`);

  const payload = template(context);
  if (!payload) return null;

  const created = await client.notification.create({
    data: { ...payload, status: 'PENDING' },
    select: { notificationId: true },
  });

  if (Array.isArray(outbox)) outbox.push(created.notificationId);
  return created.notificationId;
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/** Email address for a recipient, or null when there is none on file. */
async function recipientEmail(notification) {
  if (notification.recipientType === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({
      where: { customerId: notification.recipientId },
      select: { email: true },
    });
    return customer?.email ?? null;
  }

  const user = await prisma.user.findUnique({
    where: { userId: notification.recipientId },
    select: { email: true },
  });
  return user?.email ?? null;
}

/**
 * Pushes one notification through every configured channel.
 * Returns true when at least one channel accepted it.
 */
async function dispatch(notification) {
  const results = [];

  for (const channel of config.notificationChannels) {
    if (channel === 'log') {
      // eslint-disable-next-line no-console
      console.info(
        `[notification] #${notification.notificationId} -> ${notification.recipientType.toLowerCase()} ${
          notification.recipientId
        }: ${notification.title} — ${notification.message}`
      );
      results.push(true);
      continue;
    }

    if (channel === 'email') {
      const to = await recipientEmail(notification);
      const outcome = await mailer.send({
        to,
        subject: notification.title,
        text: notification.message,
      });

      if (outcome.skipped) {
        // eslint-disable-next-line no-console
        console.warn(
          `[notification] #${notification.notificationId} email skipped: ${outcome.reason}`
        );
        continue;
      }

      results.push(true);
      continue;
    }

    // eslint-disable-next-line no-console
    console.warn(`[notification] unknown channel "${channel}" — ignored.`);
  }

  return results.some(Boolean);
}

/**
 * Delivers the given notifications and records the outcome.
 *
 * Ids that no longer exist are ignored, which is what makes it safe to collect
 * them inside a transaction: a rollback simply leaves nothing to deliver.
 */
async function deliver(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return { delivered: 0, failed: 0 };

  const notifications = await prisma.notification.findMany({
    where: { notificationId: { in: ids.filter(Boolean) } },
  });

  let delivered = 0;
  let failed = 0;

  for (const notification of notifications) {
    let status = 'PENDING';

    try {
      status = (await dispatch(notification)) ? 'SENT' : 'PENDING';
    } catch (err) {
      status = 'FAILED';
      // eslint-disable-next-line no-console
      console.error(
        `[notification] #${notification.notificationId} delivery failed: ${err.message}`
      );
    }

    if (status !== notification.status) {
      await prisma.notification.update({
        where: { notificationId: notification.notificationId },
        data: { status },
      });
    }

    if (status === 'SENT') delivered += 1;
    if (status === 'FAILED') failed += 1;
  }

  return { delivered, failed };
}

/**
 * Fire-and-forget delivery, for use straight after a transaction commits.
 * Never rejects: the work it wraps has already been persisted, and a transport
 * problem is not the caller's to handle.
 */
function deliverSoon(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return;

  setImmediate(() => {
    deliver(ids).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[notification] delivery sweep failed: ${err.message}`);
    });
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function publicNotification(notification) {
  return {
    id: notification.notificationId,
    recipientType: notification.recipientType,
    recipientId: notification.recipientId,
    title: notification.title,
    message: notification.message,
    channel: notification.channel,
    status: notification.status,
    createdAt: notification.createdAt,
  };
}

/**
 * Notifications for one recipient, newest first.
 *
 * `recipientType` + `recipientId` are required together: the two id spaces
 * overlap (staff live in `users`, customers in `customers`), so an id alone
 * would be ambiguous. The caller decides who may ask for whom.
 */
async function list({ recipientType, recipientId, status, page = 1, pageSize } = {}) {
  if (!RECIPIENT_TYPES.includes(recipientType)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      recipientType: `Recipient type must be one of: ${RECIPIENT_TYPES.join(', ')}.`,
    });
  }

  const take = Math.min(pageSize || config.defaultPageSize, config.maxPageSize);
  const skip = (page - 1) * take;

  const where = {
    recipientType,
    recipientId,
    ...(status ? { status } : {}),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { notificationId: 'desc' },
      skip,
      take,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications: notifications.map(publicNotification),
    meta: {
      page,
      pageSize: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  };
}

module.exports = {
  notify,
  deliver,
  deliverSoon,
  list,
  publicNotification,
  EVENTS,
  RECIPIENT_TYPES,
  CHANNELS,
  STATUSES,
};
