ALTER TABLE "users"
ADD COLUMN "experience_summary" TEXT,
ADD COLUMN "expertise_reason" TEXT;

ALTER TABLE "registration_requests"
ADD COLUMN "experience_summary" TEXT,
ADD COLUMN "expertise_reason" TEXT;
