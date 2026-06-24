ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "source_repo" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_source_repo_idx" ON "jobs" ("source_repo");
