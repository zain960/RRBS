-- Phase 10: one review per booking or order (SRS §4.9).
--
-- The plain indexes on reviews.booking_id / reviews.order_id become unique, so
-- two concurrent submissions for the same stay or order cannot both land. NULL
-- is not constrained in a Postgres unique index, so the column that does not
-- apply to a given review stays free. A lookup index on customer_id is added in
-- their place, for "my reviews".
--
-- Written by hand because the development database was offline when this phase
-- was built. Run `npx prisma migrate dev` once the DB is up to confirm Prisma
-- agrees this migration and schema.prisma describe the same thing.

-- DropIndex
DROP INDEX "reviews_booking_id_idx";

-- DropIndex
DROP INDEX "reviews_order_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_id_key" ON "reviews"("order_id");

-- CreateIndex
CREATE INDEX "reviews_customer_id_idx" ON "reviews"("customer_id");
