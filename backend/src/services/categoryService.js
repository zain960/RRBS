/**
 * Menu category management (SRS §4.4).
 *
 * Categories group the menu for both the back office and the public menu.
 * The name is unique — two "Desserts" would split the same section in two.
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');

function publicCategory(category, foodCount) {
  return {
    id: category.categoryId,
    categoryName: category.categoryName,
    ...(foodCount === undefined ? {} : { foodCount }),
  };
}

async function list({ includeCounts = true } = {}) {
  const categories = await prisma.category.findMany({
    orderBy: { categoryName: 'asc' },
    ...(includeCounts ? { include: { _count: { select: { foods: true } } } } : {}),
  });

  return categories.map((category) =>
    publicCategory(category, includeCounts ? category._count.foods : undefined)
  );
}

async function getById(categoryId) {
  const category = await prisma.category.findUnique({
    where: { categoryId },
    include: { _count: { select: { foods: true } } },
  });

  if (!category) throw new AppError(404, 'NOT_FOUND', 'Category not found.');
  return publicCategory(category, category._count.foods);
}

async function assertNameFree(categoryName, exceptCategoryId) {
  const duplicate = await prisma.category.findUnique({ where: { categoryName } });
  if (duplicate && duplicate.categoryId !== exceptCategoryId) {
    throw new AppError(409, 'CATEGORY_NAME_TAKEN', 'A category with this name already exists.', {
      categoryName: 'This category name is already in use.',
    });
  }
}

async function create(payload) {
  await assertNameFree(payload.categoryName);

  const created = await prisma.category.create({ data: payload });
  return publicCategory(created, 0);
}

async function update(categoryId, payload) {
  const existing = await prisma.category.findUnique({ where: { categoryId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Category not found.');

  if (payload.categoryName !== undefined && payload.categoryName !== existing.categoryName) {
    await assertNameFree(payload.categoryName, categoryId);
  }

  const updated = await prisma.category.update({
    where: { categoryId },
    data: payload,
    include: { _count: { select: { foods: true } } },
  });

  return publicCategory(updated, updated._count.foods);
}

/**
 * A category that still holds menu items cannot be deleted — the FK is Restrict
 * and the items would be orphaned. Move them to another category first.
 */
async function remove(categoryId) {
  const existing = await prisma.category.findUnique({
    where: { categoryId },
    include: { _count: { select: { foods: true } } },
  });

  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Category not found.');

  if (existing._count.foods > 0) {
    throw new AppError(
      409,
      'CATEGORY_IN_USE',
      `In use: this category has ${existing._count.foods} menu item(s). Reassign or delete them first.`,
      { foodCount: existing._count.foods }
    );
  }

  await prisma.category.delete({ where: { categoryId } });
  return { deleted: true, id: categoryId };
}

module.exports = { list, getById, create, update, remove };
