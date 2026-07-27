-- Issue #916 P1 lifecycle repair: keep an opaque identity for submission
-- object tombstones after terminal redaction.  The original object key and
-- checksum can then be removed without allowing a later GC pass to create a
-- duplicate tombstone.

ALTER TABLE "SubmissionObjectTombstone"
  ADD COLUMN "lookupKey" TEXT;

UPDATE "SubmissionObjectTombstone"
SET "lookupKey" = CASE
  -- Phase four already replaced the raw key with its deterministic md5
  -- marker, so use that suffix directly instead of hashing the marker again.
  WHEN "objectKey" LIKE 'redacted:submission-object:%'
    THEN 'redacted:submission-lookup:' || substring("objectKey" FROM char_length('redacted:submission-object:') + 1)
  ELSE 'redacted:submission-lookup:' || md5("objectKey")
END
WHERE "lookupKey" IS NULL;

ALTER TABLE "SubmissionObjectTombstone"
  ALTER COLUMN "lookupKey" SET NOT NULL;

CREATE UNIQUE INDEX "SubmissionObjectTombstone_lookupKey_key"
  ON "SubmissionObjectTombstone"("lookupKey");

-- Delete-content rows must not retain raw storage identifiers or checksums.
-- Keep the migration deterministic so it can be audited without recovering
-- the original object identity.
UPDATE "SubmissionObjectTombstone"
SET
  "objectKey" = 'redacted:submission-object:' || md5("objectKey"),
  "checksum" = NULL,
  "lineageReference" = COALESCE("lineageReference", 'redacted:submission-lineage:' || md5("objectKey")),
  "pseudonymizedAt" = COALESCE("pseudonymizedAt", NOW()),
  "redactionCount" = GREATEST("redactionCount", 1)
WHERE "status" IN ('DELETED', 'DELETED_WITH_HOLD')
  AND "physicalDeletedAt" IS NOT NULL
  AND "objectKey" NOT LIKE 'redacted:submission-object:%';
