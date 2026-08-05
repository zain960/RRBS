/**
 * Authentication and role-based access control.
 *
 * Role checks are enforced here, server-side, on every protected endpoint —
 * never trust a role rendered by the frontend (CLAUDE.md §1, SRS §8 Security).
 */
const { fail } = require('../lib/http');
const { verifyToken } = require('../lib/tokens');

/**
 * Verifies the Bearer token and attaches req.auth.
 * Responds 401 when the token is missing, malformed or expired.
 */
function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme.toLowerCase() !== 'bearer') {
    return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  let claims;
  try {
    claims = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return fail(res, 401, 'TOKEN_EXPIRED', 'Session expired. Please sign in again.');
    }
    if (err.name === 'JsonWebTokenError') {
      return fail(res, 401, 'INVALID_TOKEN', 'Invalid authentication token.');
    }
    return next(err); // misconfiguration (e.g. missing JWT_SECRET) -> 500
  }

  req.auth = {
    userId: claims.user_id,
    roleId: claims.role_id,
    roleName: claims.role_name,
    accountType: claims.account_type,
  };

  return next();
}

/**
 * Attaches req.auth when a valid token is present, and carries on when it is
 * not. For endpoints that are public but show more to a signed-in caller — an
 * invalid token is treated the same as no token, never as an error.
 */
function optionalAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme.toLowerCase() !== 'bearer') return next();

  try {
    const claims = verifyToken(token);
    req.auth = {
      userId: claims.user_id,
      roleId: claims.role_id,
      roleName: claims.role_name,
      accountType: claims.account_type,
    };
  } catch {
    // Expired or malformed — treat the caller as anonymous.
  }

  return next();
}

/**
 * Restricts a route to the given role names.
 * Must be mounted after requireAuth. Responds 403 for an authenticated user
 * whose role is not permitted.
 *
 *   router.get('/', requireAuth, requireRole(['Super Admin']), handler)
 */
function requireRole(roleNames) {
  const allowed = Array.isArray(roleNames) ? roleNames : [roleNames];

  return function roleGuard(req, res, next) {
    if (!req.auth) {
      return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
    }

    if (!allowed.includes(req.auth.roleName)) {
      return fail(
        res,
        403,
        'FORBIDDEN',
        'Your role does not have access to this resource.',
        { requiredRoles: allowed, yourRole: req.auth.roleName }
      );
    }

    return next();
  };
}

/**
 * Back-office access: any staff role. Customers authenticate successfully but
 * must not reach staff endpoints (SRS §3).
 */
function requireStaff(req, res, next) {
  if (!req.auth) {
    return fail(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
  }
  if (req.auth.accountType !== 'staff') {
    return fail(res, 403, 'FORBIDDEN', 'Back-office access is restricted to staff accounts.');
  }
  return next();
}

module.exports = { requireAuth, optionalAuth, requireRole, requireStaff };
