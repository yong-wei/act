-- Issue #916 P0/P1 lifecycle repair: retain a stable opaque lookup identity
-- after terminal grading tombstone redaction.  The runtime uses a keyed
-- pseudonym for new rows; this migration only supplies a non-null index for
-- rows that predate the runtime lookup field.

ALTER TABLE "GradingTombstone"
  ADD COLUMN "lookupKey" TEXT;

UPDATE "GradingTombstone"
SET "lookupKey" = 'redacted:grading-lookup:' || md5("resourceKey")
WHERE "lookupKey" IS NULL;

ALTER TABLE "GradingTombstone"
  ALTER COLUMN "lookupKey" SET NOT NULL;

CREATE UNIQUE INDEX "GradingTombstone_lookupKey_key"
  ON "GradingTombstone"("lookupKey");

-- Older delete-content terminal rows were allowed to retain their raw key.
-- Redact those rows during the same additive migration.  The deterministic
-- marker is only a legacy migration bridge; all new terminal rows use the
-- runtime purpose-scoped HMAC operation identity and lookup key.
UPDATE "GradingTombstone"
SET
  "lineageReference" = COALESCE("lineageReference", 'redacted:grading-lineage:' || md5("resourceKey")),
  "resourceKey" = 'redacted:grading-operation:' || md5("resourceKey"),
  "resourceId" = 'redacted:grading-operation-id:' || md5("resourceId"),
  "checksum" = NULL,
  "providerRequestId" = NULL,
  "providerDeletionHandle" = NULL,
  "pseudonymizedAt" = COALESCE("pseudonymizedAt", NOW()),
  "redactionCount" = GREATEST("redactionCount", 1)
WHERE "status" IN ('DELETED', 'DELETED_WITH_HOLD')
  AND "contentDeletedAt" IS NOT NULL
  AND "lineageRetained" = FALSE
  AND "resourceKey" NOT LIKE 'redacted:grading-operation:%';
