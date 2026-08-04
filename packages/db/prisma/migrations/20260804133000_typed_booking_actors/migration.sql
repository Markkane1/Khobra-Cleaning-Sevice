-- AlterTable
ALTER TABLE "BookingStatusHistory" ADD COLUMN     "changedByRole" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "changedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "BookingStatusHistory_changedByUserId_idx" ON "BookingStatusHistory"("changedByUserId");

-- AddForeignKey
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
