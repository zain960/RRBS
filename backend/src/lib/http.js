/**
 * Response envelope helpers — every response is { data, error, meta }.
 * See CLAUDE.md §3.
 */

function ok(res, data, meta = {}, status = 200) {
  return res.status(status).json({ data, error: null, meta });
}

function fail(res, status, code, message, details) {
  return res.status(status).json({
    data: null,
    error: details ? { code, message, details } : { code, message },
    meta: {},
  });
}

/**
 * An error carrying an HTTP status and a machine-readable code, so services can
 * signal failures without knowing about Express.
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Wraps an async handler so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { ok, fail, AppError, asyncHandler };
