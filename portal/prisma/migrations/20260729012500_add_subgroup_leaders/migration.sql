ALTER TABLE "subgroups"
ADD COLUMN "leader_id" UUID;

CREATE INDEX "subgroups_leader_id_idx" ON "subgroups"("leader_id");

ALTER TABLE "subgroups"
ADD CONSTRAINT "subgroups_leader_id_fkey"
FOREIGN KEY ("leader_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
