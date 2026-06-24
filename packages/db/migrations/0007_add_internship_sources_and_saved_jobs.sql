CREATE TABLE IF NOT EXISTS "internship_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "owner" text NOT NULL,
  "repo" text NOT NULL,
  "label" text,
  "is_internship" boolean DEFAULT true NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "internship_sources_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "internship_sources_user_id_idx" ON "internship_sources" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "internship_sources_user_repo_uq" ON "internship_sources" ("user_id", "owner", "repo");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "saved_jobs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "saved_jobs_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_jobs_user_id_idx" ON "saved_jobs" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saved_jobs_user_job_uq" ON "saved_jobs" ("user_id", "job_id");
