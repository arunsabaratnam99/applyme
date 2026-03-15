ALTER TABLE "job_sources" ADD COLUMN IF NOT EXISTS "last_fetched_at" timestamptz;
ALTER TABLE "job_sources" ADD COLUMN IF NOT EXISTS "last_external_ids" jsonb DEFAULT '[]'::jsonb;
