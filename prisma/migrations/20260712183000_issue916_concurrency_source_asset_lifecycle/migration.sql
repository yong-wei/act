CREATE TYPE "SubmissionObjectTombstoneState" AS ENUM ('PENDING', 'RETRYABLE', 'DELETED');
CREATE TYPE "GradingTombstoneState" AS ENUM ('PENDING', 'RETRYABLE', 'DELETED');

ALTER TABLE "GradingTombstone"
  ADD COLUMN "status" "GradingTombstoneState" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "deletionIntentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "physicalDeletedAt" TIMESTAMP(3),
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastErrorCode" TEXT;

UPDATE "GradingTombstone"
SET "status" = 'DELETED', "physicalDeletedAt" = "contentDeletedAt"
WHERE "contentDeletedAt" IS NOT NULL;

CREATE INDEX "GradingTombstone_status_deletionIntentAt_idx" ON "GradingTombstone"("status", "deletionIntentAt");

ALTER TABLE "SubmissionAsset"
  ADD COLUMN "retentionPolicyVersion" TEXT,
  ADD COLUMN "retentionExpiresAt" TIMESTAMP(3),
  ADD COLUMN "governedRecordRule" TEXT,
  ADD COLUMN "deletionIntentAt" TIMESTAMP(3),
  ADD COLUMN "deletionAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastDeletionErrorCode" TEXT,
  ADD COLUMN "tombstonedAt" TIMESTAMP(3);

CREATE INDEX "SubmissionAsset_state_retentionExpiresAt_idx" ON "SubmissionAsset"("state", "retentionExpiresAt");

ALTER TABLE "SubmissionObjectTombstone"
  ADD COLUMN "status" "SubmissionObjectTombstoneState" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "deletionIntentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "physicalDeletedAt" TIMESTAMP(3),
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastErrorCode" TEXT;

ALTER TABLE "SubmissionObjectTombstone" ALTER COLUMN "deletedAt" DROP NOT NULL;
ALTER TABLE "SubmissionObjectTombstone" ALTER COLUMN "deletedAt" DROP DEFAULT;
UPDATE "SubmissionObjectTombstone"
SET "status" = 'DELETED', "physicalDeletedAt" = "deletedAt", "deletionIntentAt" = COALESCE("deletedAt", "createdAt")
WHERE "deletedAt" IS NOT NULL;

CREATE INDEX "SubmissionObjectTombstone_status_deletionIntentAt_idx" ON "SubmissionObjectTombstone"("status", "deletionIntentAt");

ALTER TABLE "GradingBatchItem"
  ADD COLUMN "workerClaimToken" TEXT,
  ADD COLUMN "workerClaimedAt" TIMESTAMP(3);

CREATE INDEX "GradingBatchItem_workerClaimToken_workerClaimedAt_idx" ON "GradingBatchItem"("workerClaimToken", "workerClaimedAt");

ALTER TABLE "GradingJob" ADD COLUMN "rerunIdentity" TEXT;
ALTER TABLE "GradingRerun" ADD COLUMN "rerunIdentity" TEXT;
CREATE INDEX IF NOT EXISTS "GradingRerun_kind_createdAt_idx" ON "GradingRerun"("kind", "createdAt");
CREATE INDEX "GradingRerun_rerunIdentity_idx" ON "GradingRerun"("rerunIdentity");
