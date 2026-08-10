ALTER TABLE "TripStop" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "TripStop_tripId_sortOrder_idx" ON "TripStop"("tripId", "sortOrder");
