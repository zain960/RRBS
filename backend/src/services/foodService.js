/**
 * Menu item management and the public menu (SRS §4.4, §5.2).
 *
 * A food item belongs to exactly one category and carries an availability flag.
 * Marking an item unavailable takes it off the public menu and blocks it from
 * new orders, but it stays in the back office and in historical orders — the
 * price on a past order line was locked at order time (CLAUDE.md §4).
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');

const FOOD_AVAILABILITIES = ['AVAILABLE', 'UNAVAILABLE'];

/** Serialises a food item; the Decimal price becomes a string, never a float. */
function publicFood(food, orderItemCount) {
  return {
    id: food.foodId,
    categoryId: food.categoryId,
    name: food.name,
    description: food.description,
    price: String(food.price),
    imageUrl: food.imageUrl,
    availabilityStatus: food.availabilityStatus,
    category: food.category
      ? { id: food.category.categoryId, categoryName: food.category.categoryName }
      : undefined,
    ...(orderItemCount === undefined ? {} : { orderItemCount }),
  };
}

async function assertCategoryExists(categoryId) {
  const category = await prisma.category.findUnique({ where: { categoryId } });
  if (!category) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      categoryId: 'Selected category does not exist.',
    });
  }
  return category;
}

/** Back-office listing — includes unavailable items (SRS §4.4). */
async function list({ categoryId, availabilityStatus } = {}) {
  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (availabilityStatus) where.availabilityStatus = availabilityStatus;

  const foods = await prisma.food.findMany({
    where,
    include: { category: true },
    orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
  });

  return foods.map((food) => publicFood(food));
}

/**
 * Public menu — grouped by category, available items only (SRS §5.2).
 *
 * Categories with no available items are omitted rather than rendered empty.
 */
async function menu() {
  const categories = await prisma.category.findMany({
    orderBy: { categoryName: 'asc' },
    include: {
      foods: {
        where: { availabilityStatus: 'AVAILABLE' },
        orderBy: { name: 'asc' },
      },
    },
  });

  return categories
    .filter((category) => category.foods.length > 0)
    .map((category) => ({
      id: category.categoryId,
      categoryName: category.categoryName,
      items: category.foods.map((food) => publicFood(food)),
    }));
}

async function getById(foodId) {
  const food = await prisma.food.findUnique({
    where: { foodId },
    include: { category: true, _count: { select: { orderItems: true } } },
  });

  if (!food) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');
  return publicFood(food, food._count.orderItems);
}

async function create(payload) {
  await assertCategoryExists(payload.categoryId);

  const created = await prisma.food.create({
    data: payload,
    include: { category: true },
  });

  return publicFood(created, 0);
}

async function update(foodId, payload) {
  const existing = await prisma.food.findUnique({ where: { foodId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');

  if (payload.categoryId !== undefined) {
    await assertCategoryExists(payload.categoryId);
  }

  const updated = await prisma.food.update({
    where: { foodId },
    data: payload,
    include: { category: true, _count: { select: { orderItems: true } } },
  });

  return publicFood(updated, updated._count.orderItems);
}

/**
 * Availability toggle (SRS §4.4). Kept separate from update() so the one-click
 * control on the menu screen cannot accidentally rewrite price or category.
 */
async function setAvailability(foodId, availabilityStatus) {
  const existing = await prisma.food.findUnique({ where: { foodId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');

  const updated = await prisma.food.update({
    where: { foodId },
    data: { availabilityStatus },
    include: { category: true },
  });

  return publicFood(updated);
}

/**
 * A menu item that has been ordered cannot be deleted — the FK is Restrict and
 * removing it would sever historical order lines from what was actually served
 * (SRS §8 Auditability). Marking it Unavailable is how an item is retired.
 */
async function remove(foodId) {
  const existing = await prisma.food.findUnique({
    where: { foodId },
    include: { _count: { select: { orderItems: true } } },
  });

  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');

  if (existing._count.orderItems > 0) {
    throw new AppError(
      409,
      'FOOD_IN_USE',
      `In use: "${existing.name}" appears on ${existing._count.orderItems} order line(s) and cannot be deleted. Mark it Unavailable to take it off the menu.`,
      { orderItemCount: existing._count.orderItems }
    );
  }

  await prisma.food.delete({ where: { foodId } });
  return { deleted: true, id: foodId };
}

module.exports = {
  list,
  menu,
  getById,
  create,
  update,
  setAvailability,
  remove,
  FOOD_AVAILABILITIES,
};
