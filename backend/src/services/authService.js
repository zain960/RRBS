/**
 * Authentication business rules (SRS §3, §4.1).
 *
 * Staff (users) and customers (customers) are separate tables. Both can sign
 * in through the same endpoint; only staff receive back-office access.
 */
const bcrypt = require('bcryptjs');

const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');
const { signToken } = require('../lib/tokens');

const BCRYPT_ROUNDS = 10;
const CUSTOMER_ROLE_NAME = 'Customer';

/** Shapes a staff record for API output — never leaks password_hash. */
function publicStaff(user) {
  return {
    id: user.userId,
    accountType: 'staff',
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    role: { id: user.role.roleId, name: user.role.roleName, permissions: user.role.permissions },
  };
}

/** Shapes a customer record for API output — never leaks password_hash. */
function publicCustomer(customer, role) {
  return {
    id: customer.customerId,
    accountType: 'customer',
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    loyaltyPoints: customer.loyaltyPoints,
    role: role
      ? { id: role.roleId, name: role.roleName, permissions: role.permissions }
      : { id: null, name: CUSTOMER_ROLE_NAME, permissions: [] },
  };
}

async function getCustomerRole() {
  const role = await prisma.role.findUnique({ where: { roleName: CUSTOMER_ROLE_NAME } });
  if (!role) {
    throw new AppError(
      500,
      'ROLE_NOT_SEEDED',
      `The "${CUSTOMER_ROLE_NAME}" role is missing. Run the database seed.`
    );
  }
  return role;
}

/**
 * Public self-registration. Always creates a Customer — the Customer role is
 * implicit for public registrants and grants no back-office access (SRS §3).
 */
async function register({ fullName, email, phone, password, address, cnicPassport }) {
  const role = await getCustomerRole();

  // Staff and customer emails share one login namespace, so both must be free.
  const [existingCustomer, existingStaff] = await Promise.all([
    prisma.customer.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { email } }),
  ]);

  if (existingCustomer || existingStaff) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const customer = await prisma.customer.create({
    data: {
      fullName,
      email,
      phone,
      address: address ?? null,
      cnicPassport: cnicPassport ?? null,
      passwordHash,
    },
  });

  const token = signToken({
    userId: customer.customerId,
    roleId: role.roleId,
    roleName: role.roleName,
    accountType: 'customer',
  });

  return { user: publicCustomer(customer, role), token };
}

/**
 * Signs in a staff user or a registered customer.
 *
 * Failures return one generic message so the response cannot be used to probe
 * which emails exist.
 */
async function login({ email, password }) {
  const invalid = () =>
    new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

  const staff = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (staff) {
    const matches = await bcrypt.compare(password, staff.passwordHash);
    if (!matches) throw invalid();

    if (staff.status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated.');
    }

    const token = signToken({
      userId: staff.userId,
      roleId: staff.role.roleId,
      roleName: staff.role.roleName,
      accountType: 'staff',
    });

    return { user: publicStaff(staff), token };
  }

  const customer = await prisma.customer.findUnique({ where: { email } });

  // Guest-checkout records have no password and cannot sign in (SRS §4.1).
  if (!customer || !customer.passwordHash) throw invalid();

  const matches = await bcrypt.compare(password, customer.passwordHash);
  if (!matches) throw invalid();

  const role = await getCustomerRole();

  const token = signToken({
    userId: customer.customerId,
    roleId: role.roleId,
    roleName: role.roleName,
    accountType: 'customer',
  });

  return { user: publicCustomer(customer, role), token };
}

/** Resolves the current principal from verified token claims. */
async function getCurrentUser(auth) {
  if (auth.accountType === 'staff') {
    const staff = await prisma.user.findUnique({
      where: { userId: auth.userId },
      include: { role: true },
    });
    if (!staff) throw new AppError(401, 'UNAUTHENTICATED', 'Account no longer exists.');
    if (staff.status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated.');
    }
    return publicStaff(staff);
  }

  const customer = await prisma.customer.findUnique({ where: { customerId: auth.userId } });
  if (!customer) throw new AppError(401, 'UNAUTHENTICATED', 'Account no longer exists.');

  const role = await getCustomerRole();
  return publicCustomer(customer, role);
}

/**
 * Changes the signed-in principal's own password (SRS §8 Security).
 *
 * Deliberately scoped to the caller: the account is read from verified token
 * claims, never from the request body, so this endpoint cannot be pointed at
 * somebody else's account. Resetting *another* user's password belongs to staff
 * management, which this phase does not implement.
 *
 * The issued token stays valid until it expires — JWTs are stateless, the same
 * caveat `logout` carries. A password change therefore does not sign out other
 * sessions; that needs a denylist.
 */
async function changePassword(auth, { currentPassword, newPassword }) {
  /**
   * A wrong current password is a 422, not a 401. The caller is already
   * authenticated, and the frontend signs the user out on any 401 — so
   * answering 401 here would end the session over a typo in a form field.
   */
  const wrongCurrentPassword = () =>
    new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      currentPassword: 'Current password is incorrect.',
    });

  if (auth.accountType === 'staff') {
    const staff = await prisma.user.findUnique({ where: { userId: auth.userId } });
    if (!staff) throw new AppError(401, 'UNAUTHENTICATED', 'Account no longer exists.');
    if (staff.status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated.');
    }

    const matches = await bcrypt.compare(currentPassword, staff.passwordHash);
    if (!matches) throw wrongCurrentPassword();

    await prisma.user.update({
      where: { userId: staff.userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    });

    return { changed: true };
  }

  const customer = await prisma.customer.findUnique({ where: { customerId: auth.userId } });
  if (!customer) throw new AppError(401, 'UNAUTHENTICATED', 'Account no longer exists.');

  // Guest-checkout records exist without a password (customers.password_hash is
  // nullable — CLAUDE.md §5), so there is nothing to verify or replace.
  if (!customer.passwordHash) {
    throw new AppError(
      409,
      'NO_PASSWORD_SET',
      'This guest record has no password to change. Register an account to set one.'
    );
  }

  const matches = await bcrypt.compare(currentPassword, customer.passwordHash);
  if (!matches) throw wrongCurrentPassword();

  await prisma.customer.update({
    where: { customerId: customer.customerId },
    data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
  });

  return { changed: true };
}

module.exports = { register, login, getCurrentUser, changePassword };
