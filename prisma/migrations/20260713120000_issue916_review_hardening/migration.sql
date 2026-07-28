ALTER TYPE "SubmissionObjectTombstoneState" ADD VALUE IF NOT EXISTS 'RETAINED';
ALTER TYPE "GradingTombstoneState" ADD VALUE IF NOT EXISTS 'BLOCKED';
ALTER TYPE "GradingTombstoneState" ADD VALUE IF NOT EXISTS 'RETAINED';

ALTER TABLE "GradingTombstone"
  ADD COLUMN "providerRetentionDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "providerDeletionState" TEXT,
  ADD COLUMN "providerDeletionReason" TEXT,
  ADD COLUMN "providerDeletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "lineageReference" TEXT;

ALTER TABLE "AnswerEvidence" ALTER COLUMN "attemptId" DROP NOT NULL;

ALTER TABLE "DocumentConversion"
  ALTER COLUMN "assetId" DROP NOT NULL,
  ALTER COLUMN "attemptId" DROP NOT NULL;

ALTER TABLE "GradingBatch"
  ALTER COLUMN "questionId" DROP NOT NULL,
  ALTER COLUMN "requesterUserId" DROP NOT NULL,
  ALTER COLUMN "questionSnapshot" DROP NOT NULL,
  ALTER COLUMN "rubricSnapshot" DROP NOT NULL,
  ALTER COLUMN "referenceAnswer" DROP NOT NULL;

ALTER TABLE "GradingBatchItem"
  ALTER COLUMN "answerId" DROP NOT NULL,
  ALTER COLUMN "attemptId" DROP NOT NULL;

ALTER TABLE "GradingRun"
  ALTER COLUMN "answerAttemptId" DROP NOT NULL,
  ALTER COLUMN "answerEvidenceId" DROP NOT NULL,
  ALTER COLUMN "questionId" DROP NOT NULL,
  ALTER COLUMN "rubricId" DROP NOT NULL,
  ALTER COLUMN "questionSnapshot" DROP NOT NULL,
  ALTER COLUMN "rubricSnapshot" DROP NOT NULL,
  ALTER COLUMN "referenceAnswer" DROP NOT NULL;

CREATE INDEX "GradingTombstone_status_lease_idx" ON "GradingTombstone"("status", "deletionLeaseExpiresAt");
CREATE INDEX "GradingTombstone_provider_state_idx" ON "GradingTombstone"("providerDeletionState", "providerRetentionDeadlineAt");
