/**
 * Auth endpoints. Validation and response shaping only — the rules live in
 * services/authService.js (CLAUDE.md §2).
 */
const authService = require('../services/authService');
const { ok, AppError, asyncHandler } = require('../lib/http');
const { EXPIRES_IN } = require('../lib/tokens');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function validateRegister(body) {
  const errors = {};
  const fullName = String(body.fullName ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? '').trim();
  const password = String(body.password ?? '');

  if (fullName.length < 2) errors.fullName = 'Full name is required.';
  if (fullName.length > 100) errors.fullName = 'Full name must be 100 characters or fewer.';
  if (!EMAIL_RE.test(email)) errors.email = 'A valid email address is required.';
  if (email.length > 100) errors.email = 'Email must be 100 characters or fewer.';
  if (phone.length < 5) errors.phone = 'A contact phone number is required.';
  if (phone.length > 20) errors.phone = 'Phone must be 20 characters or fewer.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', errors);
  }

  return {
    fullName,
    email,
    phone,
    password,
    address: body.address ? String(body.address).trim() : null,
    cnicPassport: body.cnicPassport ? String(body.cnicPassport).trim() : null,
  };
}

function validateLogin(body) {
  const errors = {};
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!email) errors.email = 'Email is required.';
  if (!password) errors.password = 'Password is required.';

  if (Object.keys(errors).length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Email and password are required.', errors);
  }

  return { email, password };
}

function validateChangePassword(body) {
  const errors = {};
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');

  if (!currentPassword) errors.currentPassword = 'Your current password is required.';
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.newPassword = 'Choose a password different from your current one.';
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', errors);
  }

  return { currentPassword, newPassword };
}

/** POST /api/auth/register — public self-registration, Customer role only. */
const register = asyncHandler(async (req, res) => {
  const payload = validateRegister(req.body ?? {});
  const { user, token } = await authService.register(payload);
  return ok(res, { user, token }, { expiresIn: EXPIRES_IN }, 201);
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const payload = validateLogin(req.body ?? {});
  const { user, token } = await authService.login(payload);
  return ok(res, { user, token }, { expiresIn: EXPIRES_IN });
});

/**
 * POST /api/auth/logout
 *
 * JWTs are stateless, so the server cannot revoke an already-issued token.
 * Logout is acknowledged here and the client discards the token; the token
 * itself stays technically valid until it expires (8h). Add a server-side
 * denylist if immediate revocation is ever required.
 */
const logout = asyncHandler(async (req, res) => {
  return ok(res, { loggedOut: true });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.auth);
  return ok(res, { user });
});

/**
 * PATCH /api/auth/password — changes the caller's own password.
 *
 * Which account is changed comes from the verified token, never the body. The
 * whole /api/auth prefix is rate limited in server.js, so this is throttled
 * alongside login rather than offering an unmetered way to test passwords.
 *
 * Like logout, this cannot revoke tokens already issued: they remain valid
 * until they expire.
 */
const changePassword = asyncHandler(async (req, res) => {
  const payload = validateChangePassword(req.body ?? {});
  const result = await authService.changePassword(req.auth, payload);
  return ok(res, result);
});

module.exports = { register, login, logout, me, changePassword };
