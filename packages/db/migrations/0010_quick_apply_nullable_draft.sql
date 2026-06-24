-- Allow quick-apply queue items to be created without a draft (one-click apply flow)
ALTER TABLE "autofill_queue" ALTER COLUMN "draft_id" DROP NOT NULL;
