INSERT INTO "AppSettings" ("id", "key", "value", "description", "updatedAt")
SELECT
  tenant."id" || ':service_categories',
  tenant."id" || ':service_categories',
  categories."value",
  COALESCE(categories."description", 'Dynamic Service Categories List'),
  CURRENT_TIMESTAMP
FROM "Tenant" AS tenant
CROSS JOIN "AppSettings" AS categories
WHERE categories."key" = 'service_categories'
ON CONFLICT ("key") DO NOTHING;
