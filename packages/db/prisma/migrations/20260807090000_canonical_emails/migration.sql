DO $$
BEGIN
  IF EXISTS (
    SELECT lower(btrim("email"))
    FROM "User"
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize User.email: case-insensitive duplicates exist';
  END IF;
END $$;

UPDATE "User"
SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));

UPDATE "Vendor"
SET "email" = lower(btrim("email"))
WHERE "email" IS NOT NULL AND "email" <> lower(btrim("email"));

CREATE OR REPLACE FUNCTION khobra_canonicalize_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."email" IS NOT NULL THEN
    NEW."email" := lower(btrim(NEW."email"));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "User_canonicalize_email"
BEFORE INSERT OR UPDATE OF "email" ON "User"
FOR EACH ROW EXECUTE FUNCTION khobra_canonicalize_email();

CREATE TRIGGER "Vendor_canonicalize_email"
BEFORE INSERT OR UPDATE OF "email" ON "Vendor"
FOR EACH ROW EXECUTE FUNCTION khobra_canonicalize_email();
