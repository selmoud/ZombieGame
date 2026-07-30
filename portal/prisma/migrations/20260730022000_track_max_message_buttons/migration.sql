ALTER TABLE "max_notifications"
ADD COLUMN "max_message_id" TEXT,
ADD COLUMN "buttons_hidden_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "max_notifications_max_message_id_key"
ON "max_notifications"("max_message_id");

CREATE INDEX "max_notifications_binding_id_buttons_hidden_at_idx"
ON "max_notifications"("binding_id", "buttons_hidden_at");
