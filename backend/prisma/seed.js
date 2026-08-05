/**
 * Seed data for the Restaurant & Room Booking System.
 *
 * Idempotent: every record is upserted on a unique key, so this can be re-run
 * safely against an existing database.
 *
 *   node prisma/seed.js      (or: npx prisma db seed)
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BCRYPT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Roles (SRS §3) — permissions are "<module>:<action>" strings.
// Stored in the DB so the client can adjust them without a code change.
// ---------------------------------------------------------------------------
const ROLES = [
  {
    roleName: 'Super Admin',
    permissions: ['*'],
  },
  {
    roleName: 'Manager',
    permissions: [
      'dashboard:view',
      'customers:read', 'customers:write',
      'room_types:read', 'room_types:write',
      'rooms:read', 'rooms:write',
      'bookings:read', 'bookings:write',
      'tables:read', 'tables:write',
      'categories:read', 'categories:write',
      'foods:read', 'foods:write',
      'orders:read', 'orders:write',
      'payments:read',
      'coupons:read', 'coupons:write',
      'reviews:read',
      'reports:read', 'reports:financial', 'reports:export',
    ],
  },
  {
    roleName: 'Receptionist',
    permissions: [
      'dashboard:view',
      'customers:read', 'customers:write',
      'rooms:read',
      'room_types:read',
      'bookings:read', 'bookings:write', 'bookings:check_in', 'bookings:check_out',
      'payments:read', 'payments:write',
    ],
  },
  {
    roleName: 'Waiter',
    permissions: [
      'dashboard:view',
      'tables:read', 'tables:write',
      'foods:read',
      'categories:read',
      'orders:read', 'orders:write', 'orders:status',
      'payments:read', 'payments:write',
      'customers:read', 'customers:write',
    ],
  },
  {
    roleName: 'Kitchen Staff',
    permissions: [
      'orders:read',
      'orders:status',
      'foods:read',
    ],
  },
  {
    roleName: 'Accountant',
    permissions: [
      'dashboard:view',
      'payments:read',
      'bookings:read',
      'orders:read',
      'reports:read', 'reports:financial', 'reports:export',
    ],
  },
  {
    roleName: 'Customer',
    permissions: [
      'self:bookings',
      'self:orders',
      'self:reviews',
      'self:profile',
    ],
  },
];

// Fixed duration options (SRS §5.1) — no arbitrary durations allowed.
//
// ASSUMPTION: the SRS names these durations but never defines their hour counts.
// "Full Day" is modelled as daytime-only (12h) and "Full Night" as overnight
// (12h), so that "Day & Night" (24h) remains a distinct option rather than a
// duplicate of Full Day. Confirm with the client before the pricing engine
// depends on these numbers (SRS §10).
const DURATIONS = [
  { durationName: '2 Hours', hours: 2 },
  { durationName: '4 Hours', hours: 4 },
  { durationName: '6 Hours', hours: 6 },
  { durationName: '8 Hours', hours: 8 },
  { durationName: 'Full Day', hours: 12 },
  { durationName: 'Full Night', hours: 12 },
  { durationName: 'Day & Night', hours: 24 },
];

/**
 * Placeholder photography.
 *
 * Unsplash's CDN is queried with explicit width/quality parameters so a room
 * card downloads roughly what it displays rather than a 4000px original. These
 * stand in until the property supplies its own shots; every one is nullable in
 * the schema and the UI falls back to a placeholder tile.
 */
const UNSPLASH = (id, width) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=70`;

const ROOM_TYPES = [
  {
    typeName: 'Standard',
    capacity: 2,
    amenities: 'Air conditioning, WiFi, LED TV, Attached bathroom',
    imageUrl: UNSPLASH('1631049307264-da0ec9d70304', 1200),
    rate2hr: 1500, rate4hr: 2500, rate6hr: 3500, rate8hr: 4500,
    rateFullDay: 6000, rateFullNight: 5000, rateDayNight: 9000,
  },
  {
    typeName: 'Deluxe',
    capacity: 3,
    amenities: 'Air conditioning, WiFi, LED TV, Mini fridge, Balcony, Room service',
    imageUrl: UNSPLASH('1590490360182-c33d57733427', 1200),
    rate2hr: 2500, rate4hr: 4000, rate6hr: 5500, rate8hr: 7000,
    rateFullDay: 9000, rateFullNight: 7500, rateDayNight: 14000,
  },
  {
    typeName: 'Suite',
    capacity: 4,
    amenities: 'Air conditioning, WiFi, Smart TV, Living area, Mini bar, Bathtub, Room service',
    imageUrl: UNSPLASH('1582719478250-c89cae4dc85b', 1200),
    rate2hr: 4000, rate4hr: 6500, rate6hr: 9000, rate8hr: 11000,
    rateFullDay: 15000, rateFullNight: 12500, rateDayNight: 22000,
  },
  {
    typeName: 'Family',
    capacity: 6,
    amenities: 'Air conditioning, WiFi, LED TV, Two bedrooms, Kitchenette, Extra beds',
    imageUrl: UNSPLASH('1566665797739-1674de7a421a', 1200),
    rate2hr: 3500, rate4hr: 5500, rate6hr: 7500, rate8hr: 9500,
    rateFullDay: 12000, rateFullNight: 10000, rateDayNight: 18000,
  },
];

// 10 physical rooms spread across the four types.
const ROOMS = [
  { roomNumber: '101', floor: '1', type: 'Standard' },
  { roomNumber: '102', floor: '1', type: 'Standard' },
  { roomNumber: '103', floor: '1', type: 'Standard' },
  { roomNumber: '104', floor: '1', type: 'Standard' },
  { roomNumber: '201', floor: '2', type: 'Deluxe' },
  { roomNumber: '202', floor: '2', type: 'Deluxe' },
  { roomNumber: '203', floor: '2', type: 'Deluxe' },
  { roomNumber: '301', floor: '3', type: 'Suite' },
  { roomNumber: '302', floor: '3', type: 'Suite' },
  { roomNumber: '401', floor: '4', type: 'Family' },
];

const CATEGORIES = [
  'Starters',
  'Main Course',
  'BBQ & Grill',
  'Beverages',
  'Desserts',
  'Sides',
];

// 20 menu items across the six categories.
const FOODS = [
  { name: 'Chicken Samosa', category: 'Starters', price: 150, description: 'Crisp pastry parcels filled with spiced chicken.', imageUrl: UNSPLASH('1601050690597-df0568f70950', 800) },
  { name: 'Vegetable Spring Rolls', category: 'Starters', price: 180, description: 'Served with sweet chilli dip.', imageUrl: UNSPLASH('1544025162-d76694265947', 800) },
  { name: 'Chicken Wings', category: 'Starters', price: 450, description: 'Six pieces, choice of buffalo or honey glaze.', imageUrl: UNSPLASH('1608039755401-742074f0548d', 800) },
  { name: 'Soup of the Day', category: 'Starters', price: 300, description: 'Ask your server for today’s preparation.', imageUrl: UNSPLASH('1547592166-23ac45744acd', 800) },

  { name: 'Chicken Biryani', category: 'Main Course', price: 650, description: 'Aromatic basmati rice layered with spiced chicken.', imageUrl: UNSPLASH('1563379091339-03b21ab4a4f8', 800) },
  { name: 'Mutton Karahi', category: 'Main Course', price: 1400, description: 'Slow-cooked mutton with tomato and green chilli.', imageUrl: UNSPLASH('1631292784640-2b24be784d5d', 800) },
  { name: 'Butter Chicken', category: 'Main Course', price: 900, description: 'Creamy tomato gravy, served with naan.', imageUrl: UNSPLASH('1588166524941-3bf61a9c41db', 800) },
  { name: 'Daal Makhani', category: 'Main Course', price: 480, description: 'Black lentils simmered overnight.', imageUrl: UNSPLASH('1585937421612-70a008356fbe', 800) },
  { name: 'Grilled Fish Fillet', category: 'Main Course', price: 1100, description: 'Served with lemon butter sauce and vegetables.', imageUrl: UNSPLASH('1519708227418-c8fd9a32b7a2', 800) },

  { name: 'Chicken Tikka', category: 'BBQ & Grill', price: 550, description: 'Charcoal-grilled marinated chicken.', imageUrl: UNSPLASH('1599487488170-d11ec9c172f0', 800) },
  { name: 'Seekh Kebab', category: 'BBQ & Grill', price: 600, description: 'Minced beef skewers with fresh herbs.', imageUrl: UNSPLASH('1529193591184-b1d58069ecdd', 800) },
  { name: 'Malai Boti', category: 'BBQ & Grill', price: 700, description: 'Creamy marinated chicken cubes.', imageUrl: UNSPLASH('1610057099443-fde8c4d50f91', 800) },

  { name: 'Fresh Lime Soda', category: 'Beverages', price: 200, description: 'Sweet or salted.', imageUrl: UNSPLASH('1621263764928-df1444c5e859', 800) },
  { name: 'Mango Lassi', category: 'Beverages', price: 250, description: 'Chilled yoghurt drink.', imageUrl: UNSPLASH('1553530666-ba11a7da3888', 800) },
  { name: 'Masala Chai', category: 'Beverages', price: 120, description: 'Spiced milk tea.', imageUrl: UNSPLASH('1561336313-0bd5e0b27ec8', 800) },
  { name: 'Soft Drink', category: 'Beverages', price: 100, description: 'Assorted 330ml cans.', imageUrl: UNSPLASH('1622483767028-3f66f32aef97', 800) },

  { name: 'Gulab Jamun', category: 'Desserts', price: 220, description: 'Two pieces in warm syrup.', imageUrl: UNSPLASH('1666190092159-3171cf0fbb12', 800) },
  { name: 'Chocolate Lava Cake', category: 'Desserts', price: 400, description: 'Served with vanilla ice cream.', imageUrl: UNSPLASH('1624353365286-3f8d62daad51', 800) },

  { name: 'Garlic Naan', category: 'Sides', price: 90, description: 'Fresh from the tandoor.', imageUrl: UNSPLASH('1601050690117-94f5f6fa8bd7', 800) },
  { name: 'Seasoned Fries', category: 'Sides', price: 250, description: 'Hand-cut, lightly spiced.', imageUrl: UNSPLASH('1573080496219-bb080dd4f877', 800) },
];

const TABLES = [
  { tableNumber: 'T1', capacity: 2, location: 'INDOOR' },
  { tableNumber: 'T2', capacity: 2, location: 'INDOOR' },
  { tableNumber: 'T3', capacity: 4, location: 'INDOOR' },
  { tableNumber: 'T4', capacity: 4, location: 'INDOOR' },
  { tableNumber: 'T5', capacity: 6, location: 'INDOOR' },
  { tableNumber: 'T6', capacity: 4, location: 'OUTDOOR' },
  { tableNumber: 'T7', capacity: 6, location: 'OUTDOOR' },
  { tableNumber: 'T8', capacity: 8, location: 'OUTDOOR' },
];

// The first back-office account. Overridable from the environment so a
// deployment never has to ship with a password that is published in this repo —
// the development defaults are only reached when the variables are unset.
//
// Note the password applies on creation only: the upsert below updates the
// profile but never the hash, so re-seeding cannot reset a password the client
// has since changed.
const SUPER_ADMIN = {
  fullName: process.env.SUPER_ADMIN_NAME || 'System Administrator',
  email: process.env.SUPER_ADMIN_EMAIL || 'admin@rrbs.local',
  phone: process.env.SUPER_ADMIN_PHONE || '+920000000000',
  password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@123',
};

// Tax rates the client has yet to confirm (SRS §10). Seeded once, then owned by
// the Tax Settings screen — re-seeding never overwrites them.
const TAX_DEFAULTS = { roomTaxRate: 0, foodTaxRate: 0 };

// Sample coupons so the discount rules are exercisable straight after seeding.
// `valid_to` is a DATE, so a coupon is good for the whole of that day.
const COUPONS = [
  {
    code: 'WELCOME10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    applicableTo: 'BOTH',
    minAmount: null,
    usageLimit: null,
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2026-12-31'),
  },
  {
    code: 'ROOMS500',
    discountType: 'FIXED_AMOUNT',
    discountValue: 500,
    applicableTo: 'ROOMS',
    minAmount: 3000,
    usageLimit: 100,
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2026-12-31'),
  },
  {
    code: 'FOOD15',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    applicableTo: 'FOOD',
    minAmount: 1000,
    usageLimit: 50,
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2026-12-31'),
  },
];

async function main() {
  console.log('Seeding RRBS database…\n');

  // --- Roles ---------------------------------------------------------------
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { roleName: role.roleName },
      update: { permissions: role.permissions },
      create: { roleName: role.roleName, permissions: role.permissions },
    });
  }
  console.log(`  roles................ ${ROLES.length}`);

  // --- Booking durations ---------------------------------------------------
  for (const duration of DURATIONS) {
    await prisma.bookingDuration.upsert({
      where: { durationName: duration.durationName },
      update: { hours: duration.hours },
      create: duration,
    });
  }
  console.log(`  booking_durations.... ${DURATIONS.length}`);

  // --- Room types ----------------------------------------------------------
  const roomTypeIds = {};
  for (const roomType of ROOM_TYPES) {
    // typeName is not unique in the schema, so match on it explicitly.
    const existing = await prisma.roomType.findFirst({ where: { typeName: roomType.typeName } });
    const saved = existing
      ? await prisma.roomType.update({ where: { roomTypeId: existing.roomTypeId }, data: roomType })
      : await prisma.roomType.create({ data: roomType });
    roomTypeIds[roomType.typeName] = saved.roomTypeId;
  }
  console.log(`  room_types........... ${ROOM_TYPES.length}`);

  // --- Rooms ---------------------------------------------------------------
  for (const room of ROOMS) {
    const data = {
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomTypeId: roomTypeIds[room.type],
    };
    await prisma.room.upsert({
      where: { roomNumber: room.roomNumber },
      update: data,
      create: data,
    });
  }
  console.log(`  rooms................ ${ROOMS.length}`);

  // --- Menu categories -----------------------------------------------------
  const categoryIds = {};
  for (const categoryName of CATEGORIES) {
    const saved = await prisma.category.upsert({
      where: { categoryName },
      update: {},
      create: { categoryName },
    });
    categoryIds[categoryName] = saved.categoryId;
  }
  console.log(`  categories........... ${CATEGORIES.length}`);

  // --- Foods ---------------------------------------------------------------
  for (const food of FOODS) {
    const data = {
      name: food.name,
      description: food.description,
      price: food.price,
      imageUrl: food.imageUrl,
      categoryId: categoryIds[food.category],
    };
    const existing = await prisma.food.findFirst({ where: { name: food.name } });
    if (existing) {
      await prisma.food.update({ where: { foodId: existing.foodId }, data });
    } else {
      await prisma.food.create({ data });
    }
  }
  console.log(`  foods................ ${FOODS.length}`);

  // --- Dining tables -------------------------------------------------------
  for (const table of TABLES) {
    await prisma.diningTable.upsert({
      where: { tableNumber: table.tableNumber },
      update: { capacity: table.capacity, location: table.location },
      create: table,
    });
  }
  console.log(`  dining_tables........ ${TABLES.length}`);

  // --- Super Admin ---------------------------------------------------------
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { roleName: 'Super Admin' } });

  // The development default is documented in the README, so on a public
  // deployment it is a known credential. Only reachable if the deploy skipped
  // SUPER_ADMIN_PASSWORD (render.yaml marks it `sync: false` to prevent that).
  if (process.env.NODE_ENV === 'production' && !process.env.SUPER_ADMIN_PASSWORD) {
    console.warn(
      '  WARNING: SUPER_ADMIN_PASSWORD is unset — seeding the default password ' +
        'published in the README. Set it, or change the password from the app immediately.'
    );
  }

  const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, BCRYPT_ROUNDS);

  await prisma.user.upsert({
    where: { email: SUPER_ADMIN.email },
    update: {
      fullName: SUPER_ADMIN.fullName,
      phone: SUPER_ADMIN.phone,
      roleId: superAdminRole.roleId,
    },
    create: {
      fullName: SUPER_ADMIN.fullName,
      email: SUPER_ADMIN.email,
      phone: SUPER_ADMIN.phone,
      passwordHash,
      roleId: superAdminRole.roleId,
    },
  });
  console.log(`  users................ 1 (${SUPER_ADMIN.email})`);

  // --- System settings -----------------------------------------------------
  // Single row, id 1 (SRS §9). Created only if absent — re-seeding must not
  // reset tax rates the client has already configured.
  const existingSettings = await prisma.setting.findUnique({ where: { settingId: 1 } });
  if (!existingSettings) {
    await prisma.setting.create({
      data: { settingId: 1, roomTaxRate: TAX_DEFAULTS.roomTaxRate, foodTaxRate: TAX_DEFAULTS.foodTaxRate },
    });
    console.log(`  settings............. 1 (rooms ${TAX_DEFAULTS.roomTaxRate}%, food ${TAX_DEFAULTS.foodTaxRate}%)`);
  } else {
    console.log('  settings............. kept (already configured)');
  }

  // --- Coupons -------------------------------------------------------------
  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: coupon,
    });
  }
  console.log(`  coupons.............. ${COUPONS.length}`);

  console.log('\nSeed complete.');
  console.log(`Sign in with ${SUPER_ADMIN.email} / ${SUPER_ADMIN.password} — change this password before deploying.`);
}

main()
  .catch((err) => {
    console.error('\nSeed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
