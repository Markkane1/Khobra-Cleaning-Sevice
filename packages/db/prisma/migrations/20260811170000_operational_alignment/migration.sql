ALTER TABLE "Service" DROP COLUMN "requiresMaterials";
ALTER TABLE "Booking" ADD COLUMN "pricingMode" TEXT NOT NULL DEFAULT 'service_variants';
UPDATE "Booking" SET "pricingMode" = 'legacy_addon' WHERE "materialsCost" > 0 OR EXISTS (SELECT 1 FROM "BookingMaterial" bm WHERE bm."bookingId" = "Booking"."id");

CREATE TABLE "ServiceMaterial" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "quantityPerCleanerHour" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'pcs',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceMaterial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceMaterial_serviceId_inventoryItemId_key" ON "ServiceMaterial"("serviceId", "inventoryItemId");
ALTER TABLE "ServiceMaterial" ADD CONSTRAINT "ServiceMaterial_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceMaterial" ADD CONSTRAINT "ServiceMaterial_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BookingMaterialReservation" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "requiredQuantity" DOUBLE PRECISION NOT NULL,
  "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'reserved',
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingMaterialReservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingMaterialReservation_bookingId_inventoryItemId_key" ON "BookingMaterialReservation"("bookingId", "inventoryItemId");
CREATE INDEX "BookingMaterialReservation_inventoryItemId_status_idx" ON "BookingMaterialReservation"("inventoryItemId", "status");
ALTER TABLE "BookingMaterialReservation" ADD CONSTRAINT "BookingMaterialReservation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingMaterialReservation" ADD CONSTRAINT "BookingMaterialReservation_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NotificationReceipt" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationReceipt_notificationId_userId_key" ON "NotificationReceipt"("notificationId", "userId");
ALTER TABLE "NotificationReceipt" ADD CONSTRAINT "NotificationReceipt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationReceipt" ADD CONSTRAINT "NotificationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "privacyPolicyVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "privacyAcknowledgedAt" TIMESTAMP(3);
CREATE TABLE "AccountDeletionRequest" (
  "id" TEXT NOT NULL, "tenantId" TEXT, "userId" TEXT, "email" TEXT NOT NULL,
  "reason" TEXT, "status" TEXT NOT NULL DEFAULT 'requested', "retainedDataReason" TEXT,
  "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountDeletionRequest_email_status_idx" ON "AccountDeletionRequest"("email", "status");
CREATE INDEX "AccountDeletionRequest_tenantId_status_idx" ON "AccountDeletionRequest"("tenantId", "status");
