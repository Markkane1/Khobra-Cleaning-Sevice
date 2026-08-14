UPDATE "User" AS users
SET "phone" = employees."phone"
FROM "Employee" AS employees
WHERE employees."userId" = users."id"
  AND COALESCE(BTRIM(users."phone"), '') = ''
  AND employees."phone" IS NOT NULL;

ALTER TABLE "Employee"
DROP COLUMN "phone",
DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "area";
