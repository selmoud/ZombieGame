ALTER TABLE "registration_requests"
ALTER COLUMN "password_hash" DROP NOT NULL;

UPDATE "registration_requests"
SET "password_hash" = NULL
WHERE "status" <> 'PENDING';

UPDATE "invitation_tokens"
SET "revoked_at" = CURRENT_TIMESTAMP
WHERE "used_at" IS NULL
  AND "revoked_at" IS NULL
  AND "user_id" IN (
    SELECT "id"
    FROM "users"
    WHERE "role" = 'ADMIN'
  );

CREATE UNIQUE INDEX "users_full_name_ci_key"
ON "users" (LOWER("full_name"));

CREATE UNIQUE INDEX "registration_requests_pending_full_name_ci_key"
ON "registration_requests" (LOWER("full_name"))
WHERE "status" = 'PENDING';
