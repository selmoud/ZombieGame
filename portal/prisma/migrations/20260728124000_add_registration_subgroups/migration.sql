-- Add selected subgroup to registration requests without breaking existing rows.
ALTER TABLE "registration_requests" ADD COLUMN "subgroup_id" UUID;

CREATE INDEX "registration_requests_subgroup_id_idx"
ON "registration_requests"("subgroup_id");

ALTER TABLE "registration_requests"
ADD CONSTRAINT "registration_requests_subgroup_id_fkey"
FOREIGN KEY ("subgroup_id") REFERENCES "subgroups"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Initial editable subgroup directory.
INSERT INTO "subgroups" ("id", "name", "created_at", "updated_at")
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Коммуникации', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000002', 'Развлечения', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000003', 'Авторский контент', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000004', 'ТВ, радио, СМИ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Move legacy demo accounts to the new default subgroup.
UPDATE "users"
SET "subgroup_id" = (
  SELECT "id" FROM "subgroups" WHERE "name" = 'Коммуникации'
)
WHERE "subgroup_id" IN (
  SELECT "id" FROM "subgroups" WHERE "name" = 'Медиа и контент'
);

DELETE FROM "subgroups" WHERE "name" = 'Медиа и контент';
