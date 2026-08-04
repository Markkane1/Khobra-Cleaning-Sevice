-- Booking schedule is a calendar date; arrival clock time is stored separately in startTime/endTime.
-- Legacy 19:00 UTC values came from server-local midnight (UTC+5) and represent the following date.
ALTER TABLE "Booking" ALTER COLUMN "scheduledDate" TYPE DATE USING (
  CASE
    WHEN ("scheduledDate" AT TIME ZONE 'UTC')::time = TIME '19:00:00' THEN ("scheduledDate" AT TIME ZONE 'UTC')::date + 1
    ELSE ("scheduledDate" AT TIME ZONE 'UTC')::date
  END
);
