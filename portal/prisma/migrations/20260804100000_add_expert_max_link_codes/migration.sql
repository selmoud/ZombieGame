ALTER TABLE "users" ADD COLUMN "max_link_code" TEXT;

DO $$
DECLARE
    expert_id UUID;
    candidate TEXT;
BEGIN
    FOR expert_id IN
        SELECT "id"
        FROM "users"
        WHERE "role" IN ('EXPERT', 'LEAD') AND "max_link_code" IS NULL
    LOOP
        LOOP
            candidate := 'id' || LPAD((FLOOR(RANDOM() * 900000) + 100000)::INTEGER::TEXT, 6, '0');
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM "users" WHERE "max_link_code" = candidate
            );
        END LOOP;
        UPDATE "users" SET "max_link_code" = candidate WHERE "id" = expert_id;
    END LOOP;
END $$;

CREATE UNIQUE INDEX "users_max_link_code_key" ON "users"("max_link_code");

ALTER TABLE "max_bot_bindings"
    ADD COLUMN "link_attempt_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "link_attempt_window_at" TIMESTAMP(3),
    ADD COLUMN "link_blocked_until" TIMESTAMP(3);
