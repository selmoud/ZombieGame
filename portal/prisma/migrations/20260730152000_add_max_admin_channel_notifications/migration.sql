CREATE TABLE "max_admin_channels" (
    "id" UUID NOT NULL,
    "max_chat_id" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "max_admin_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "max_admin_notifications" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "link_url" TEXT,
    "link_label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "last_error" TEXT,
    "max_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "max_admin_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "max_admin_channels_max_chat_id_key"
ON "max_admin_channels"("max_chat_id");

CREATE INDEX "max_admin_channels_enabled_idx"
ON "max_admin_channels"("enabled");

CREATE UNIQUE INDEX "max_admin_notifications_dedupe_key_key"
ON "max_admin_notifications"("dedupe_key");

CREATE UNIQUE INDEX "max_admin_notifications_max_message_id_key"
ON "max_admin_notifications"("max_message_id");

CREATE INDEX "max_admin_notifications_status_next_attempt_at_idx"
ON "max_admin_notifications"("status", "next_attempt_at");

CREATE INDEX "max_admin_notifications_entity_type_entity_id_idx"
ON "max_admin_notifications"("entity_type", "entity_id");

ALTER TABLE "max_admin_notifications"
ADD CONSTRAINT "max_admin_notifications_channel_id_fkey"
FOREIGN KEY ("channel_id") REFERENCES "max_admin_channels"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
