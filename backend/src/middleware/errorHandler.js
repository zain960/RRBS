const { fail } = require('../lib/http');

/** 404 for unmatched routes. */
function notFound(req, res) {
  return fail(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`);
}

/**
 * Terminal error handler. AppError carries its own status/code; anything else
 * is treated as a 500 and its message withheld from the client.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies this by arity
function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (status >= 500) {
    console.error(err);
    return fail(res, status, err.code || 'INTERNAL_ERROR', 'Internal server error.');
  }

  return fail(res, status, err.code || 'REQUEST_ERROR', err.message, err.details);
}

module.exports = { notFound, errorHandler };
