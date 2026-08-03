CREATE TYPE "RegistrationMessageDirection" AS ENUM ('ADMIN_TO_EXPERT', 'EXPERT_TO_ADMIN');

CREATE TABLE "registration_messages" (
    "id" UUID NOT NULL,
    "registration_request_id" UUID NOT NULL,
    "direction" "RegistrationMessageDirection" NOT NULL,
    "text" TEXT NOT NULL,
    "admin_author_id" UUID,
    "external_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registration_messages_external_message_id_key"
ON "registration_messages"("external_message_id");

CREATE INDEX "registration_messages_registration_request_id_created_at_idx"
ON "registration_messages"("registration_request_id", "created_at");

ALTER TABLE "registration_messages"
ADD CONSTRAINT "registration_messages_registration_request_id_fkey"
FOREIGN KEY ("registration_request_id") REFERENCES "registration_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registration_messages"
ADD CONSTRAINT "registration_messages_admin_author_id_fkey"
FOREIGN KEY ("admin_author_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
