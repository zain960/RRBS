-- Room type photography for the public room cards (spec §7 Imagery).
--
-- Nullable and unbackfilled: a room type is sellable before anyone has
-- photographed it, and the UI falls back to a placeholder. The seed supplies
-- URLs for the four seeded types.
ALTER TABLE "room_types" ADD COLUMN "image_url" VARCHAR(500);
