ALTER TABLE "Notification" ADD COLUMN "deliveryKey" TEXT;

CREATE UNIQUE INDEX "Notification_deliveryKey_userId_channel_key"
ON "Notification"("deliveryKey", "userId", "channel");
