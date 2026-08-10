ALTER TABLE "Service" ADD COLUMN "withMaterialsRate" DECIMAL(14,2);
UPDATE "Service" SET "withMaterialsRate" = "baseRate" WHERE "withMaterialsRate" IS NULL;
ALTER TABLE "Service" ALTER COLUMN "withMaterialsRate" SET NOT NULL;

ALTER TABLE "BookingItem" ADD COLUMN "includesMaterials" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "InventoryItem" DROP COLUMN "sellPrice";
