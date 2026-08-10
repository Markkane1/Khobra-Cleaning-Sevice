ALTER TABLE "TripStop" ADD COLUMN "bookingId" TEXT;

CREATE UNIQUE INDEX "TripStop_bookingId_key" ON "TripStop"("bookingId");
CREATE INDEX "TripStop_tripId_status_idx" ON "TripStop"("tripId", "status");

ALTER TABLE "TripStop"
ADD CONSTRAINT "TripStop_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TripStop" DROP CONSTRAINT "TripStop_tripId_fkey";
ALTER TABLE "TripStop"
ADD CONSTRAINT "TripStop_tripId_fkey"
FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
