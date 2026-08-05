/**
 * JWT issuing and verification.
 *
 * Token claims (CLAUDE.md §1 — 8h expiry):
 *   user_id      staff users.user_id, or customers.customer_id for customers
 *   role_id      roles.role_id
 *   role_name    roles.role_name — what requireRole() matches on
 *   account_type 'staff' | 'customer'
 *
 * `account_type` is required because staff and customers live in separate
 * tables (SRS §7.2); without it, users.user_id 5 and customers.customer_id 5
 * would be indistinguishable.
 */
const jwt = require('jsonwebtoken');

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'CHANGE_ME') {
    throw new Error(
      'JWT_SECRET is not configured. Copy backend/.env.example to backend/.env and set a real secret.'
    );
  }
  return secret;
}

function signToken({ userId, roleId, roleName, accountType }) {
  return jwt.sign(
    {
      user_id: userId,
      role_id: roleId,
      role_name: roleName,
      account_type: accountType,
    },
    getSecret(),
    { expiresIn: EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signToken, verifyToken, EXPIRES_IN };
