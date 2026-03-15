ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "display_name" text;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "custom_avatar_url" text;
