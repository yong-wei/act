ALTER TABLE "StudentPortraitV2Snapshot"
ADD COLUMN "sourceLegacySnapshotId" TEXT;

UPDATE "StudentPortraitV2Snapshot"
SET "sourceLegacySnapshotId" = "payload"->'derivation'->>'sourceLegacySnapshotId'
WHERE "derivationKind" = 'migrated'
  AND "sourceLegacySnapshotId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "StudentPortraitV2Snapshot"
    WHERE "sourceLegacySnapshotId" IS NOT NULL
    GROUP BY "userId", "sourceLegacySnapshotId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate migrated portrait lineage detected; review before applying unique constraint';
  END IF;
END $$;

CREATE UNIQUE INDEX "StudentPortraitV2Snapshot_userId_sourceLegacySnapshotId_key"
ON "StudentPortraitV2Snapshot"("userId", "sourceLegacySnapshotId");
