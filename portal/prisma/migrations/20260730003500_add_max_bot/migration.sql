ALTER TABLE "registration_requests"
ADD COLUMN "approved_user_id" UUID;

CREATE UNIQUE INDEX "registration_requests_approved_user_id_key"
ON "registration_requests"("approved_user_id");

ALTER TABLE "registration_requests"
ADD CONSTRAINT "registration_requests_approved_user_id_fkey"
FOREIGN KEY ("approved_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "max_link_tokens" (
    "id" UUID NOT NULL,
    "registration_request_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "max_link_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "max_link_tokens_registration_request_id_key"
ON "max_link_tokens"("registration_request_id");
CREATE UNIQUE INDEX "max_link_tokens_token_hash_key"
ON "max_link_tokens"("token_hash");
CREATE INDEX "max_link_tokens_expires_at_idx"
ON "max_link_tokens"("expires_at");
ALTER TABLE "max_link_tokens"
ADD CONSTRAINT "max_link_tokens_registration_request_id_fkey"
FOREIGN KEY ("registration_request_id") REFERENCES "registration_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "max_bot_bindings" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "registration_request_id" UUID,
    "max_user_id" BIGINT NOT NULL,
    "max_chat_id" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "max_bot_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "max_bot_bindings_user_id_key"
ON "max_bot_bindings"("user_id");
CREATE UNIQUE INDEX "max_bot_bindings_registration_request_id_key"
ON "max_bot_bindings"("registration_request_id");
CREATE UNIQUE INDEX "max_bot_bindings_max_user_id_key"
ON "max_bot_bindings"("max_user_id");
CREATE INDEX "max_bot_bindings_enabled_idx"
ON "max_bot_bindings"("enabled");
ALTER TABLE "max_bot_bindings"
ADD CONSTRAINT "max_bot_bindings_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "max_bot_bindings"
ADD CONSTRAINT "max_bot_bindings_registration_request_id_fkey"
FOREIGN KEY ("registration_request_id") REFERENCES "registration_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "max_notifications" (
    "id" UUID NOT NULL,
    "binding_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "link_url" TEXT,
    "link_label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "max_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "max_notifications_dedupe_key_key"
ON "max_notifications"("dedupe_key");
CREATE INDEX "max_notifications_status_next_attempt_at_idx"
ON "max_notifications"("status", "next_attempt_at");
ALTER TABLE "max_notifications"
ADD CONSTRAINT "max_notifications_binding_id_fkey"
FOREIGN KEY ("binding_id") REFERENCES "max_bot_bindings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
