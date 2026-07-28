CREATE TABLE "user_subgroups" (
    "user_id" UUID NOT NULL,
    "subgroup_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_subgroups_pkey" PRIMARY KEY ("user_id", "subgroup_id")
);

CREATE TABLE "registration_request_subgroups" (
    "registration_request_id" UUID NOT NULL,
    "subgroup_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registration_request_subgroups_pkey"
        PRIMARY KEY ("registration_request_id", "subgroup_id")
);

INSERT INTO "user_subgroups" ("user_id", "subgroup_id")
SELECT "id", "subgroup_id"
FROM "users"
WHERE "subgroup_id" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "registration_request_subgroups" (
    "registration_request_id",
    "subgroup_id"
)
SELECT "id", "subgroup_id"
FROM "registration_requests"
WHERE "subgroup_id" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX "user_subgroups_subgroup_id_idx"
ON "user_subgroups"("subgroup_id");

CREATE INDEX "registration_request_subgroups_subgroup_id_idx"
ON "registration_request_subgroups"("subgroup_id");

ALTER TABLE "user_subgroups"
ADD CONSTRAINT "user_subgroups_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_subgroups"
ADD CONSTRAINT "user_subgroups_subgroup_id_fkey"
FOREIGN KEY ("subgroup_id") REFERENCES "subgroups"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registration_request_subgroups"
ADD CONSTRAINT "registration_request_subgroups_registration_request_id_fkey"
FOREIGN KEY ("registration_request_id") REFERENCES "registration_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registration_request_subgroups"
ADD CONSTRAINT "registration_request_subgroups_subgroup_id_fkey"
FOREIGN KEY ("subgroup_id") REFERENCES "subgroups"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" DROP CONSTRAINT "users_subgroup_id_fkey";
ALTER TABLE "registration_requests"
DROP CONSTRAINT "registration_requests_subgroup_id_fkey";

DROP INDEX "users_subgroup_id_idx";
DROP INDEX "registration_requests_subgroup_id_idx";

ALTER TABLE "users" DROP COLUMN "subgroup_id";
ALTER TABLE "registration_requests" DROP COLUMN "subgroup_id";
