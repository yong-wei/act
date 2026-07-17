-- Issue #916 phase six: preserve legacy content, freeze lifecycle contracts,
-- and stop every durable grading association before retention can consume it.

ALTER TABLE "SubmissionAttempt"
  ADD COLUMN "textSnapshotGovernedRecordRule" TEXT,
  ADD COLUMN "textSnapshotProviderRetentionSeconds" INTEGER;

ALTER TABLE "SubmissionObjectTombstone"
  ADD COLUMN "lifecycleGovernedRecordRule" TEXT;

ALTER TABLE "GradingTombstone"
  ADD COLUMN "lifecycleGovernedRecordRule" TEXT,
  ADD COLUMN "providerRetentionStartedAt" TIMESTAMP(3);

ALTER TABLE "AnswerEvidence"
  ADD COLUMN "lifecycleGovernedRecordRule" TEXT,
  ADD COLUMN "lifecycleProviderRetentionSeconds" INTEGER;

ALTER TABLE "DocumentConversion"
  ADD COLUMN "lifecycleGovernedRecordRule" TEXT,
  ADD COLUMN "lifecycleProviderRetentionSeconds" INTEGER,
  ADD COLUMN "providerRequestedAt" TIMESTAMP(3),
  ADD COLUMN "providerProcessedAt" TIMESTAMP(3);

ALTER TABLE "GradingBatch"
  ADD COLUMN "lifecycleGovernedRecordRule" TEXT,
  ADD COLUMN "lifecycleProviderRetentionSeconds" INTEGER;

ALTER TABLE "GradingRun"
  ADD COLUMN "lifecycleGovernedRecordRule" TEXT,
  ADD COLUMN "lifecycleProviderRetentionSeconds" INTEGER,
  ADD COLUMN "providerRequestedAt" TIMESTAMP(3),
  ADD COLUMN "providerProcessedAt" TIMESTAMP(3);

-- A finite local retention window and a governed record are different
-- contracts. Keep this NOT VALID for pre-existing policy rows, while making
-- every new or changed policy row obey the contract.
ALTER TABLE "GradingLifecyclePolicy"
  ADD CONSTRAINT "GradingLifecyclePolicy_retention_contract_ck"
  CHECK (
    (
      "retentionSeconds" IS NULL
      AND "deleteStrategy" = 'retain-governed-record'
      AND NULLIF(BTRIM("governedRecordRule"), '') IS NOT NULL
    )
    OR (
      "retentionSeconds" IS NOT NULL
      AND "retentionSeconds" >= 1
      AND "deleteStrategy" IN ('delete-content', 'pseudonymize-lineage')
      AND NULLIF(BTRIM("governedRecordRule"), '') IS NULL
    )
  ) NOT VALID;

-- Preserve every historical text snapshot. An incomplete or contradictory
-- snapshot policy is blocked and audited; it is never made eligible for GC.
UPDATE "SubmissionAttempt"
SET
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-text-snapshot-lifecycle-policy-incomplete')
WHERE "textSnapshot" IS NOT NULL
  AND (
    "textSnapshotProviderRetentionSeconds" IS NULL
    OR
    "textSnapshotPolicyId" IS NULL
    OR "textSnapshotPolicyVersion" IS NULL
    OR "textSnapshotDeleteStrategy" IS NULL
    OR NOT (
      (
        "textSnapshotDeleteStrategy" = 'retain-governed-record'
        AND "textSnapshotRetentionSeconds" IS NULL
        AND "textSnapshotExpiresAt" IS NULL
        AND NULLIF(BTRIM("textSnapshotGovernedRecordRule"), '') IS NOT NULL
      )
      OR (
        "textSnapshotDeleteStrategy" IN ('delete-content', 'pseudonymize-lineage')
        AND "textSnapshotRetentionSeconds" IS NOT NULL
        AND "textSnapshotRetentionSeconds" >= 1
        AND "textSnapshotExpiresAt" IS NOT NULL
        AND NULLIF(BTRIM("textSnapshotGovernedRecordRule"), '') IS NULL
      )
    )
  );

UPDATE "SubmissionAsset"
SET
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-source-asset-lifecycle-policy-incomplete'),
  "deletionClaimToken" = NULL,
  "deletionClaimedAt" = NULL,
  "deletionLeaseExpiresAt" = NULL,
  "lastDeletionErrorCode" = COALESCE("lastDeletionErrorCode", 'legacy-source-asset-lifecycle-policy-incomplete')
WHERE "state" IN ('QUARANTINED', 'REVOKED', 'DELETING', 'FINALIZED')
  AND (
    "retentionPolicyId" IS NULL
    OR "retentionPolicyVersion" IS NULL
    OR "retentionDeleteStrategy" IS NULL
    OR NOT (
      (
        "retentionDeleteStrategy" = 'retain-governed-record'
        AND "retentionSeconds" IS NULL
        AND "retentionExpiresAt" IS NULL
        AND NULLIF(BTRIM("governedRecordRule"), '') IS NOT NULL
      )
      OR (
        "retentionDeleteStrategy" IN ('delete-content', 'pseudonymize-lineage')
        AND "retentionSeconds" IS NOT NULL
        AND "retentionSeconds" >= 1
        AND "retentionExpiresAt" IS NOT NULL
        AND NULLIF(BTRIM("governedRecordRule"), '') IS NULL
      )
    )
  );

UPDATE "AnswerEvidence"
SET
  "readiness" = 'BLOCKED',
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-evidence-lifecycle-policy-incomplete')
WHERE "lifecyclePolicyId" IS NULL
   OR "lifecyclePolicyVersion" IS NULL
   OR "lifecycleDeleteStrategy" IS NULL
   OR "lifecycleProviderRetentionSeconds" IS NULL
   OR NOT (
     (
       "lifecycleDeleteStrategy" = 'retain-governed-record'
       AND "lifecycleRetentionSeconds" IS NULL
       AND "retentionExpiresAt" IS NULL
       AND NULLIF(BTRIM("lifecycleGovernedRecordRule"), '') IS NOT NULL
     )
     OR (
       "lifecycleDeleteStrategy" IN ('delete-content', 'pseudonymize-lineage')
       AND "lifecycleRetentionSeconds" IS NOT NULL
       AND "lifecycleRetentionSeconds" >= 1
       AND "retentionExpiresAt" IS NOT NULL
       AND NULLIF(BTRIM("lifecycleGovernedRecordRule"), '') IS NULL
     )
   );

UPDATE "DocumentConversion"
SET
  "state" = 'BLOCKED',
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-conversion-lifecycle-policy-incomplete')
WHERE "lifecyclePolicyId" IS NULL
   OR "lifecyclePolicyVersion" IS NULL
   OR "lifecycleDeleteStrategy" IS NULL
   OR "lifecycleProviderRetentionSeconds" IS NULL
   OR NOT (
     (
       "lifecycleDeleteStrategy" = 'retain-governed-record'
       AND "lifecycleRetentionSeconds" IS NULL
       AND "retentionExpiresAt" IS NULL
       AND NULLIF(BTRIM("lifecycleGovernedRecordRule"), '') IS NOT NULL
     )
     OR (
       "lifecycleDeleteStrategy" IN ('delete-content', 'pseudonymize-lineage')
       AND "lifecycleRetentionSeconds" IS NOT NULL
       AND "lifecycleRetentionSeconds" >= 1
       AND "retentionExpiresAt" IS NOT NULL
       AND NULLIF(BTRIM("lifecycleGovernedRecordRule"), '') IS NULL
     )
   );

UPDATE "GradingRun"
SET
  "state" = 'BLOCKED',
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-grading-run-lifecycle-policy-incomplete')
WHERE "lifecyclePolicyId" IS NULL
   OR "lifecyclePolicyVersion" IS NULL
   OR "lifecycleDeleteStrategy" IS NULL
   OR "lifecycleProviderRetentionSeconds" IS NULL
   OR NOT (
     (
       "lifecycleDeleteStrategy" = 'retain-governed-record'
       AND "lifecycleRetentionSeconds" IS NULL
       AND "retentionExpiresAt" IS NULL
       AND NULLIF(BTRIM("lifecycleGovernedRecordRule"), '') IS NOT NULL
     )
     OR (
       "lifecycleDeleteStrategy" IN ('delete-content', 'pseudonymize-lineage')
       AND "lifecycleRetentionSeconds" IS NOT NULL
       AND "lifecycleRetentionSeconds" >= 1
       AND "retentionExpiresAt" IS NOT NULL
       AND NULLIF(BTRIM("lifecycleGovernedRecordRule"), '') IS NULL
     )
   );

UPDATE "GradingBatch"
SET
  "state" = 'BLOCKED',
  "lifecycleBlockedAt" = COALESCE("lifecycleBlockedAt", now()),
  "lifecycleBlockReason" = COALESCE("lifecycleBlockReason", 'legacy-grading-batch-lifecycle-policy-incomplete')
WHERE "lifecyclePolicyId" IS NULL
   OR "lifecyclePolicyVersion" IS NULL
   OR "lifecycleDeleteStrategy" IS NULL
   OR "lifecycleProviderRetentionSeconds" IS NULL
   OR NOT (
     (
       "lifecycleDeleteStrategy" = 'retain-governed-record'
       AND "lifecycleRetentionSeconds" IS NULL
       AND "retentionExpiresAt" IS NULL
       AND NULLIF(BTRIM("lifecycleGovernedRecordRule"), '') IS NOT NULL
     )
     OR (
       "lifecycleDeleteStrategy" IN ('delete-content', 'pseudonymize-lineage')
       AND "lifecycleRetentionSeconds" IS NOT NULL
       AND "lifecycleRetentionSeconds" >= 1
       AND "retentionExpiresAt" IS NOT NULL
       AND NULLIF(BTRIM("lifecycleGovernedRecordRule"), '') IS NULL
     )
   );

-- The item is the durable fan-out boundary. Freeze it first, clear its
-- worker claim, and then freeze all associated queue jobs in the same
-- migration transaction. BLOCKED is the item state; CONTENT_UNAVAILABLE is
-- the queue-job state because the worker must not consume the content.
UPDATE "GradingBatchItem" AS item
SET
  "state" = 'BLOCKED',
  "failureCode" = COALESCE("failureCode", 'legacy-lifecycle-content-unavailable'),
  "workerClaimToken" = NULL,
  "workerClaimedAt" = NULL,
  "updatedAt" = now()
WHERE item."state" IN ('QUEUED', 'CONVERTING', 'GRADING', 'RETRYABLE')
  AND (
    item."attemptId" IN (SELECT "id" FROM "SubmissionAttempt" WHERE "lifecycleBlockedAt" IS NOT NULL)
    OR item."evidenceId" IN (SELECT "id" FROM "AnswerEvidence" WHERE "lifecycleBlockedAt" IS NOT NULL)
    OR item."conversionId" IN (SELECT "id" FROM "DocumentConversion" WHERE "lifecycleBlockedAt" IS NOT NULL)
    OR item."gradingRunId" IN (SELECT "id" FROM "GradingRun" WHERE "lifecycleBlockedAt" IS NOT NULL)
    OR item."batchId" IN (SELECT "id" FROM "GradingBatch" WHERE "lifecycleBlockedAt" IS NOT NULL)
  );

UPDATE "GradingJob" AS job
SET
  "state" = 'CONTENT_UNAVAILABLE',
  "lastErrorCode" = COALESCE("lastErrorCode", 'legacy-lifecycle-content-unavailable'),
  "workerClaimToken" = NULL,
  "workerClaimedAt" = NULL,
  "workerLeaseExpiresAt" = NULL,
  "completedAt" = COALESCE("completedAt", now()),
  "updatedAt" = now()
WHERE job."state" IN ('QUEUED', 'RUNNING', 'RETRYABLE')
  AND (
    job."attemptId" IN (SELECT "id" FROM "SubmissionAttempt" WHERE "lifecycleBlockedAt" IS NOT NULL)
    OR job."conversionId" IN (SELECT "id" FROM "DocumentConversion" WHERE "lifecycleBlockedAt" IS NOT NULL)
    OR job."gradingRunId" IN (SELECT "id" FROM "GradingRun" WHERE "lifecycleBlockedAt" IS NOT NULL)
    OR job."batchId" IN (SELECT "id" FROM "GradingBatch" WHERE "lifecycleBlockedAt" IS NOT NULL)
    OR job."batchItemId" IN (
      SELECT "id" FROM "GradingBatchItem" WHERE "state" = 'BLOCKED' AND "failureCode" = 'legacy-lifecycle-content-unavailable'
    )
  );

UPDATE "GradingBatch" AS batch
SET
  "state" = 'BLOCKED',
  "lastErrorCode" = COALESCE("lastErrorCode", 'legacy-lifecycle-content-unavailable'),
  "updatedAt" = now()
WHERE batch."state" IN ('QUEUED', 'RUNNING', 'RETRYABLE')
  AND batch."id" IN (
    SELECT "batchId" FROM "GradingBatchItem" WHERE "state" = 'BLOCKED' AND "failureCode" = 'legacy-lifecycle-content-unavailable'
  );

INSERT INTO "GradingAuditEvent" ("id", "eventKey", "actorPseudoId", "actorRole", "action", "purpose", "resourceType", "resourceId", "metadata")
SELECT
  'phase-six-lifecycle-audit:' || blocked."resourceType" || ':' || md5(blocked."id"),
  'phase-six-lifecycle-blocked:' || blocked."resourceType" || ':' || md5(blocked."id"),
  'actor:phase-six-lifecycle',
  'SERVICE',
  'grading-retention.legacy-blocked',
  'lifecycle',
  blocked."resourceType",
  'redacted:phase-six-lifecycle:' || md5(blocked."id"),
  jsonb_build_object('redacted', true, 'reason', 'legacy-lifecycle-content-unavailable')
FROM (
  SELECT 'SubmissionAttempt' AS "resourceType", "id" FROM "SubmissionAttempt" WHERE "lifecycleBlockedAt" IS NOT NULL
  UNION ALL
  SELECT 'SubmissionAsset', "id" FROM "SubmissionAsset" WHERE "lifecycleBlockedAt" IS NOT NULL
  UNION ALL
  SELECT 'AnswerEvidence', "id" FROM "AnswerEvidence" WHERE "lifecycleBlockedAt" IS NOT NULL
  UNION ALL
  SELECT 'DocumentConversion', "id" FROM "DocumentConversion" WHERE "lifecycleBlockedAt" IS NOT NULL
  UNION ALL
  SELECT 'GradingRun', "id" FROM "GradingRun" WHERE "lifecycleBlockedAt" IS NOT NULL
  UNION ALL
  SELECT 'GradingBatch', "id" FROM "GradingBatch" WHERE "lifecycleBlockedAt" IS NOT NULL
) AS blocked
ON CONFLICT ("eventKey") DO NOTHING;
