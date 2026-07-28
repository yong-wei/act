-- Issue #916 phase four: freeze provider identity and remove direct lineage
-- material from terminal pseudonymized records.  This migration is additive
-- for live rows; the cleanup is limited to rows that already declare the
-- pseudonymized terminal state so historical non-pseudonymized audit data is
-- not silently destroyed.

ALTER TYPE "SubmissionObjectTombstoneState" ADD VALUE IF NOT EXISTS 'BLOCKED';

ALTER TABLE "SubmissionAsset"
  ALTER COLUMN "checksum" DROP NOT NULL;

ALTER TABLE "SubmissionObjectTombstone"
  ADD COLUMN "lineageReference" TEXT;

ALTER TABLE "GradingTombstone"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerRequestId" TEXT,
  ADD COLUMN "providerDeletionHandle" TEXT;

CREATE INDEX "SubmissionObjectTombstone_lineageReference_idx"
  ON "SubmissionObjectTombstone"("lineageReference");

CREATE INDEX "GradingTombstone_providerRequestId_idx"
  ON "GradingTombstone"("providerRequestId");

-- Existing terminal pseudonymized object tombstones must not retain the raw
-- object key or checksum.  md5 is only used as a deterministic migration
-- marker; it is not a replacement for purpose-scoped HMACs written by the
-- runtime.
UPDATE "SubmissionObjectTombstone"
SET
  "lineageReference" = 'redacted:submission-object-lineage:' || md5("objectKey"),
  "objectKey" = 'redacted:submission-object:' || md5("objectKey"),
  "checksum" = NULL,
  "redactionCount" = GREATEST("redactionCount", 1)
WHERE "pseudonymizedAt" IS NOT NULL
  AND "status" IN ('DELETED', 'RETAINED');

-- Grading tombstones receive the same historical cleanup.  The provider name
-- remains available for accountable retention reporting, while request IDs
-- and deletion handles are cleared because they are direct external
-- correlation material after pseudonymization.
UPDATE "GradingTombstone"
SET
  "lineageReference" = 'redacted:grading-lineage:' || md5("resourceKey"),
  "resourceKey" = 'redacted:grading-resource:' || md5("resourceKey"),
  "resourceId" = 'redacted:grading-resource-id:' || md5("resourceId"),
  "checksum" = NULL,
  "providerRequestId" = NULL,
  "providerDeletionHandle" = NULL,
  "redactionCount" = GREATEST("redactionCount", 1)
WHERE "pseudonymizedAt" IS NOT NULL
  AND "status" IN ('DELETED', 'RETAINED');
