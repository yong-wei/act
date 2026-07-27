ALTER TABLE "SubmissionAttempt"
  ADD COLUMN "textSnapshotPolicyId" TEXT,
  ADD COLUMN "textSnapshotPolicyVersion" TEXT,
  ADD COLUMN "textSnapshotDeleteStrategy" TEXT,
  ADD COLUMN "textSnapshotRetentionSeconds" INTEGER,
  ADD COLUMN "textSnapshotExpiresAt" TIMESTAMP(3);

ALTER TABLE "SubmissionAsset"
  ADD COLUMN "retentionPolicyId" TEXT,
  ADD COLUMN "retentionDeleteStrategy" TEXT,
  ADD COLUMN "retentionSeconds" INTEGER,
  ADD COLUMN "deletionClaimToken" TEXT,
  ADD COLUMN "deletionClaimedAt" TIMESTAMP(3),
  ADD COLUMN "deletionLeaseExpiresAt" TIMESTAMP(3);

ALTER TABLE "SubmissionObjectTombstone"
  ADD COLUMN "lifecyclePolicyId" TEXT,
  ADD COLUMN "lifecyclePolicyVersion" TEXT,
  ADD COLUMN "lifecycleDeleteStrategy" TEXT,
  ADD COLUMN "lifecycleRetentionSeconds" INTEGER,
  ADD COLUMN "pseudonymizedAt" TIMESTAMP(3),
  ADD COLUMN "deletionClaimToken" TEXT,
  ADD COLUMN "deletionClaimedAt" TIMESTAMP(3),
  ADD COLUMN "deletionLeaseExpiresAt" TIMESTAMP(3);

ALTER TABLE "GradingAuditEvent"
  ADD COLUMN "eventKey" TEXT;

UPDATE "GradingAuditEvent"
SET "eventKey" = 'legacy-audit:' || md5(concat_ws(':', "id", "action", "purpose", "resourceType", "createdAt"))
WHERE "eventKey" IS NULL;

ALTER TABLE "GradingAuditEvent" ALTER COLUMN "eventKey" SET NOT NULL;

ALTER TABLE "GradingTombstone"
  ADD COLUMN "lifecyclePolicyId" TEXT,
  ADD COLUMN "lifecyclePolicyVersion" TEXT,
  ADD COLUMN "lifecycleDeleteStrategy" TEXT,
  ADD COLUMN "lifecycleRetentionSeconds" INTEGER,
  ADD COLUMN "deletionClaimToken" TEXT,
  ADD COLUMN "deletionClaimedAt" TIMESTAMP(3),
  ADD COLUMN "deletionLeaseExpiresAt" TIMESTAMP(3);

ALTER TABLE "AnswerEvidence"
  ADD COLUMN "lifecyclePolicyId" TEXT,
  ADD COLUMN "lifecyclePolicyVersion" TEXT,
  ADD COLUMN "lifecycleDeleteStrategy" TEXT,
  ADD COLUMN "lifecycleRetentionSeconds" INTEGER;

ALTER TABLE "DocumentConversion"
  ADD COLUMN "lifecyclePolicyId" TEXT,
  ADD COLUMN "lifecyclePolicyVersion" TEXT,
  ADD COLUMN "lifecycleDeleteStrategy" TEXT,
  ADD COLUMN "lifecycleRetentionSeconds" INTEGER;

ALTER TABLE "GradingBatch"
  ADD COLUMN "lifecyclePolicyId" TEXT,
  ADD COLUMN "lifecyclePolicyVersion" TEXT,
  ADD COLUMN "lifecycleDeleteStrategy" TEXT,
  ADD COLUMN "lifecycleRetentionSeconds" INTEGER;

ALTER TABLE "GradingRun"
  ADD COLUMN "lifecyclePolicyId" TEXT,
  ADD COLUMN "lifecyclePolicyVersion" TEXT,
  ADD COLUMN "lifecycleDeleteStrategy" TEXT,
  ADD COLUMN "lifecycleRetentionSeconds" INTEGER;

ALTER TABLE "GradingJob"
  ADD COLUMN "workerClaimToken" TEXT,
  ADD COLUMN "workerClaimedAt" TIMESTAMP(3),
  ADD COLUMN "workerLeaseExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "GradingAuditEvent_eventKey_key" ON "GradingAuditEvent"("eventKey");
CREATE INDEX "SubmissionAttempt_textSnapshotExpiresAt_idx" ON "SubmissionAttempt"("textSnapshotExpiresAt");
CREATE INDEX "SubmissionAsset_deletionLeaseExpiresAt_idx" ON "SubmissionAsset"("deletionLeaseExpiresAt");
CREATE INDEX "SubmissionObjectTombstone_deletionLeaseExpiresAt_idx" ON "SubmissionObjectTombstone"("deletionLeaseExpiresAt");
CREATE INDEX "SubmissionObjectTombstone_lifecyclePolicyId_idx" ON "SubmissionObjectTombstone"("lifecyclePolicyId");
CREATE INDEX "GradingTombstone_deletionLeaseExpiresAt_idx" ON "GradingTombstone"("deletionLeaseExpiresAt");
CREATE INDEX "AnswerEvidence_lifecyclePolicyId_idx" ON "AnswerEvidence"("lifecyclePolicyId");
CREATE INDEX "DocumentConversion_lifecyclePolicyId_idx" ON "DocumentConversion"("lifecyclePolicyId");
CREATE INDEX "GradingBatch_lifecyclePolicyId_idx" ON "GradingBatch"("lifecyclePolicyId");
CREATE INDEX "GradingRun_lifecyclePolicyId_idx" ON "GradingRun"("lifecyclePolicyId");
CREATE INDEX "GradingJob_workerLeaseExpiresAt_idx" ON "GradingJob"("workerLeaseExpiresAt");

ALTER TABLE "SubmissionAttempt" ADD CONSTRAINT "SubmissionAttempt_textSnapshotPolicyId_fkey" FOREIGN KEY ("textSnapshotPolicyId") REFERENCES "GradingLifecyclePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubmissionAsset" ADD CONSTRAINT "SubmissionAsset_retentionPolicyId_fkey" FOREIGN KEY ("retentionPolicyId") REFERENCES "GradingLifecyclePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnswerEvidence" ADD CONSTRAINT "AnswerEvidence_lifecyclePolicyId_fkey" FOREIGN KEY ("lifecyclePolicyId") REFERENCES "GradingLifecyclePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentConversion" ADD CONSTRAINT "DocumentConversion_lifecyclePolicyId_fkey" FOREIGN KEY ("lifecyclePolicyId") REFERENCES "GradingLifecyclePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatch" ADD CONSTRAINT "GradingBatch_lifecyclePolicyId_fkey" FOREIGN KEY ("lifecyclePolicyId") REFERENCES "GradingLifecyclePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingRun" ADD CONSTRAINT "GradingRun_lifecyclePolicyId_fkey" FOREIGN KEY ("lifecyclePolicyId") REFERENCES "GradingLifecyclePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingTombstone" ADD CONSTRAINT "GradingTombstone_lifecyclePolicyId_fkey" FOREIGN KEY ("lifecyclePolicyId") REFERENCES "GradingLifecyclePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubmissionObjectTombstone" ADD CONSTRAINT "SubmissionObjectTombstone_lifecyclePolicyId_fkey" FOREIGN KEY ("lifecyclePolicyId") REFERENCES "GradingLifecyclePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
