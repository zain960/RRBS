-- Phase 8: configurable tax settings (SRS §9) and a coupon on/off switch (SRS §4.7).
--
-- Written by hand because the development database was offline when this phase
-- was built. Run `npx prisma migrate dev` once the DB is up to confirm Prisma
-- agrees this migration and schema.prisma describe the same thing.

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "settings" (
    "setting_id" SERIAL NOT NULL,
    "room_tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "food_tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("setting_id")
);

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
