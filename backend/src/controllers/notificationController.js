const notificationService = require('../services/notificationService');
const { ok, AppError, asyncHandler } = require('../lib/http');
const { Validator } = require('../lib/validate');
const config = require('../lib/config');

const { RECIPIENT_TYPES, STATUSES } = notificationService;

/** Staff who may read another recipient's notifications (SRS §5.4). */
const SUPERVISOR_ROLES = ['Super Admin', 'Manager'];

/**
 * GET /api/notifications?recipient_id=&recipient_type=&status=
 *
 * Defaults to the caller's own notifications. Reading someone else's is a
 * supervisory action, so it is restricted server-side — a customer passing
 * another customer's `recipient_id` gets their own list, never a stranger's
 * (SRS §5.4, §8 Security).
 */
const list = asyncHandler(async (req, res) => {
  const q = req.query;

  const { page, pageSize, status, recipientId, recipientType } = new Validator({
    page: q.page ?? 1,
    pageSize: q.pageSize ?? q.page_size ?? config.defaultPageSize,
    status: q.status,
    recipientId: q.recipient_id ?? q.recipientId,
    recipientType: q.recipient_type ?? q.recipientType,
  })
    .integer('page', { min: 1, label: 'Page' })
    .integer('pageSize', { min: 1, max: config.maxPageSize, label: 'Page size' })
    .enum('status', STATUSES, { required: false, label: 'Status' })
    .integer('recipientId', { required: false, min: 1, label: 'Recipient' })
    .enum('recipientType', RECIPIENT_TYPES, { required: false, label: 'Recipient type' })
    .result();

  const own = {
    recipientType: req.auth.accountType === 'staff' ? 'STAFF' : 'CUSTOMER',
    recipientId: req.auth.userId,
  };

  const asked = {
    recipientType: recipientType ?? own.recipientType,
    recipientId: recipientId ?? own.recipientId,
  };

  const isOwn =
    asked.recipientType === own.recipientType && asked.recipientId === own.recipientId;

  if (!isOwn && !SUPERVISOR_ROLES.includes(req.auth.roleName)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only read your own notifications.', {
      requiredRoles: SUPERVISOR_ROLES,
      yourRole: req.auth.roleName,
    });
  }

  const result = await notificationService.list({
    ...asked,
    status: status ?? undefined,
    page,
    pageSize,
  });

  return ok(res, result.notifications, { ...result.meta, ...asked });
});

module.exports = { list };
