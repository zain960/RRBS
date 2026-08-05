const prisma = require('../lib/prisma');
const { ok, asyncHandler } = require('../lib/http');

/**
 * GET /api/roles — lists roles and their permissions.
 * Super Admin only: only they may change role permissions (SRS §5.4).
 */
const list = asyncHandler(async (req, res) => {
  const roles = await prisma.role.findMany({ orderBy: { roleId: 'asc' } });

  return ok(
    res,
    roles.map((role) => ({
      id: role.roleId,
      name: role.roleName,
      permissions: role.permissions,
    })),
    { total: roles.length }
  );
});

module.exports = { list };
