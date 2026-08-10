ALTER TABLE "SubmissionAnswer"
  ADD COLUMN "answerContractVersion" TEXT,
  ADD COLUMN "attachmentOrderProvenance" TEXT;

UPDATE "SubmissionAnswer"
SET "answerContractVersion" = 'assignment-response.legacy.v1';

ALTER TABLE "SubmissionAnswer"
  ALTER COLUMN "answerContractVersion" SET DEFAULT 'assignment-response.v2',
  ALTER COLUMN "answerContractVersion" SET NOT NULL;

ALTER TABLE "SubmissionAttempt"
  ADD COLUMN "answerSnapshot" JSONB;

ALTER TABLE "SubmissionAsset"
  ADD COLUMN "assetRole" TEXT NOT NULL DEFAULT 'ATTACHMENT',
  ADD COLUMN "orderIndex" INTEGER,
  ADD COLUMN "embeddedPosition" TEXT;

CREATE INDEX "SubmissionAsset_answerId_state_orderIndex_idx"
  ON "SubmissionAsset"("answerId", "state", "orderIndex");

CREATE INDEX "SubmissionAsset_attemptId_orderIndex_idx"
  ON "SubmissionAsset"("attemptId", "orderIndex");
