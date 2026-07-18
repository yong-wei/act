CREATE TABLE "StudentPortraitV2Snapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "payloadVersion" TEXT NOT NULL,
    "calculationVersion" TEXT NOT NULL,
    "migrationVersion" TEXT NOT NULL,
    "derivationKind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentPortraitV2Snapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentPortraitV2Snapshot_userId_snapshotAt_idx"
ON "StudentPortraitV2Snapshot"("userId", "snapshotAt");

CREATE INDEX "StudentPortraitV2Snapshot_snapshotAt_idx"
ON "StudentPortraitV2Snapshot"("snapshotAt");

CREATE INDEX "StudentPortraitV2Snapshot_payloadVersion_calculationVersion_idx"
ON "StudentPortraitV2Snapshot"("payloadVersion", "calculationVersion");

CREATE INDEX "StudentPortraitV2Snapshot_derivationKind_snapshotAt_idx"
ON "StudentPortraitV2Snapshot"("derivationKind", "snapshotAt");
