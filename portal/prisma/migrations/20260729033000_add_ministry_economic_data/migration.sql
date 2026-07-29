CREATE TABLE "ministry_economic_data" (
    "id" UUID NOT NULL,
    "industry" TEXT NOT NULL,
    "reporting_period" TEXT,
    "gdp_share" DOUBLE PRECISION,
    "gva_share" DOUBLE PRECISION,
    "employment_share" DOUBLE PRECISION,
    "investment_activity" TEXT,
    "productivity_comparison" TEXT,
    "source" TEXT,
    "comment" TEXT,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ministry_economic_data_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ministry_economic_data_industry_key"
ON "ministry_economic_data"("industry");

ALTER TABLE "ministry_economic_data"
ADD CONSTRAINT "ministry_economic_data_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
