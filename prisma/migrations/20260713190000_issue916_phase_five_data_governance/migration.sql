-- Issue #916 phase five: make post-delete hold outcomes explicit, freeze
-- provider deletion locators, and persist lifecycle blocks for legacy rows.

ALTER TYPE "SubmissionAssetState" ADD VALUE IF NOT EXISTS 'CONTENT_UNAVAILABLE';
ALTER TYPE "SubmissionObjectTombstoneState" ADD VALUE IF NOT EXISTS 'DELETED_WITH_HOLD';

ALTER TABLE "SubmissionAttempt"
  ADD COLUMN "lifecycleBlockedAt" TIMESTAMP(3),
  ADD COLUMN "lifecycleBlockReason" TEXT;

ALTER TABLE "SubmissionAsset"
  ADD COLUMN "lifecycleBlockedAt" TIMESTAMP(3),
  ADD COLUMN "lifecycleBlockReason" TEXT;

ALTER TABLE "AnswerEvidence"
  ADD COLUMN "lifecycleBlockedAt" TIMESTAMP(3),
  ADD COLUMN "lifecycleBlockReason" TEXT;

ALTER TABLE "DocumentConversion"
  ADD COLUMN "lifecycleBlockedAt" TIMESTAMP(3),
  ADD COLUMN "lifecycleBlockReason" TEXT;

ALTER TABLE "GradingRun"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerRequestId" TEXT,
  ADD COLUMN "providerDeletionHandle" TEXT,
  ADD COLUMN "lifecycleBlockedAt" TIMESTAMP(3),
  ADD COLUMN "lifecycleBlockReason" TEXT;

ALTER TABLE "GradingBatch"
  ADD COLUMN "lifecycleBlockedAt" TIMESTAMP(3),
  ADD COLUMN "lifecycleBlockReason" TEXT;

-- Preserve the physical-deletion fact if an earlier runtime already recorded
-- it under the retryable state, without restoring the object or its access.
UPDATE "SubmissionObjectTombstone"
SET "status" = 'DELETED_WITH_HOLD'
WHERE "status" = 'RETRYABLE'
  AND "lastErrorCode" = 'deleted-with-hold'
  AND "physicalDeletedAt" IS NOT NULL;

UPDATE "SubmissionAttempt"
SET
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-text-snapshot-lifecycle-metadata-missing')
WHERE "textSnapshot" IS NOT NULL
  AND ("textSnapshotPolicyId" IS NULL
    OR "textSnapshotPolicyVersion" IS NULL
    OR "textSnapshotDeleteStrategy" IS NULL
   OR "textSnapshotExpiresAt" IS NULL);

UPDATE "SubmissionAsset"
SET
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-source-asset-lifecycle-metadata-missing'),
  "deletionClaimToken" = NULL,
  "deletionClaimedAt" = NULL,
  "deletionLeaseExpiresAt" = NULL,
  "lastDeletionErrorCode" = COALESCE("lastDeletionErrorCode", 'legacy-source-asset-lifecycle-metadata-missing')
WHERE "state" IN ('QUARANTINED', 'REVOKED', 'DELETING', 'FINALIZED')
  AND (
    "retentionPolicyId" IS NULL
    OR "retentionPolicyVersion" IS NULL
    OR "retentionDeleteStrategy" IS NULL
    OR NOT (
      ("retentionDeleteStrategy" = 'retain-governed-record'
        AND "retentionExpiresAt" IS NULL
        AND "retentionSeconds" IS NULL
        AND NULLIF(BTRIM("governedRecordRule"), '') IS NOT NULL)
      OR ("retentionDeleteStrategy" IN ('delete-content', 'pseudonymize-lineage', 'retain-governed-record')
        AND "retentionExpiresAt" IS NOT NULL
        AND "retentionSeconds" IS NOT NULL)
    )
  );

UPDATE "AnswerEvidence"
SET
  "readiness" = 'BLOCKED',
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-evidence-lifecycle-metadata-missing')
WHERE "lifecyclePolicyId" IS NULL
   OR "lifecyclePolicyVersion" IS NULL
   OR "lifecycleDeleteStrategy" IS NULL
   OR ("retentionExpiresAt" IS NULL AND "lifecycleDeleteStrategy" <> 'retain-governed-record');

UPDATE "DocumentConversion"
SET
  "state" = 'BLOCKED',
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-conversion-lifecycle-metadata-missing')
WHERE "lifecyclePolicyId" IS NULL
   OR "lifecyclePolicyVersion" IS NULL
   OR "lifecycleDeleteStrategy" IS NULL
   OR ("retentionExpiresAt" IS NULL AND "lifecycleDeleteStrategy" <> 'retain-governed-record');

UPDATE "GradingRun"
SET
  "state" = 'BLOCKED',
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-grading-run-lifecycle-metadata-missing')
WHERE "lifecyclePolicyId" IS NULL
   OR "lifecyclePolicyVersion" IS NULL
   OR "lifecycleDeleteStrategy" IS NULL
   OR ("retentionExpiresAt" IS NULL AND "lifecycleDeleteStrategy" <> 'retain-governed-record');

UPDATE "GradingBatch"
SET
  "state" = 'BLOCKED',
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-grading-batch-lifecycle-metadata-missing')
WHERE "lifecyclePolicyId" IS NULL
   OR "lifecyclePolicyVersion" IS NULL
   OR "lifecycleDeleteStrategy" IS NULL
   OR ("retentionExpiresAt" IS NULL AND "lifecycleDeleteStrategy" <> 'retain-governed-record');

INSERT INTO "GradingAuditEvent" ("id", "eventKey", "actorPseudoId", "actorRole", "action", "purpose", "resourceType", "resourceId", "metadata")
SELECT
  'legacy-lifecycle-audit:' || "resourceType" || ':' || md5("id"),
  'legacy-lifecycle-blocked:' || "resourceType" || ':' || md5("id"),
  'actor:legacy-lifecycle',
  'SERVICE',
  'grading-retention.legacy-blocked',
  'lifecycle',
  "resourceType",
  'redacted:legacy-lifecycle:' || md5("id"),
  jsonb_build_object('redacted', true, 'reason', 'legacy-lifecycle-metadata-missing')
FROM (
  SELECT 'AnswerEvidence' AS "resourceType", "id" FROM "AnswerEvidence" WHERE "lifecycleBlockedAt" IS NOT NULL
  UNION ALL
  SELECT 'DocumentConversion', "id" FROM "DocumentConversion" WHERE "lifecycleBlockedAt" IS NOT NULL
  UNION ALL
  SELECT 'GradingRun', "id" FROM "GradingRun" WHERE "lifecycleBlockedAt" IS NOT NULL
  UNION ALL
  SELECT 'GradingBatch', "id" FROM "GradingBatch" WHERE "lifecycleBlockedAt" IS NOT NULL
  UNION ALL
  SELECT 'SubmissionAttempt', "id" FROM "SubmissionAttempt" WHERE "lifecycleBlockedAt" IS NOT NULL
  UNION ALL
  SELECT 'SubmissionAsset', "id" FROM "SubmissionAsset" WHERE "lifecycleBlockedAt" IS NOT NULL
) AS blocked
ON CONFLICT ("eventKey") DO NOTHING;
