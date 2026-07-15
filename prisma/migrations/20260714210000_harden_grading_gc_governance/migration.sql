-- Preserve the resource identity of pre-hardening reservations while removing
-- plaintext keys. Runtime retains a bounded legacy-hash read during rollout.
UPDATE "GradingRequestIdempotency"
SET "idempotencyKey" = 'legacy-md5:' || md5("operation" || ':' || "idempotencyKey")
WHERE "idempotencyKey" NOT LIKE 'legacy-md5:%';

ALTER TABLE "GradingRun" ADD COLUMN "authorizationSnapshot" JSONB;

ALTER TABLE "GradingRequestIdempotency"
ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours');

CREATE INDEX "GradingRequestIdempotency_expiresAt_idx"
ON "GradingRequestIdempotency"("expiresAt");

ALTER TABLE "GrowthRecord"
  ADD COLUMN "businessKey" TEXT,
  ADD COLUMN "sourceSnapshotAt" TIMESTAMP(3),
  ADD COLUMN "sourceInputDigest" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3);
UPDATE "GrowthRecord"
SET "sourceSnapshotAt" = "occurredAt",
    "sourceInputDigest" = "evidenceJson"->>'inputDigest',
    "expiresAt" = "occurredAt" + INTERVAL '365 days'
WHERE "recordType" = 'competency_evaluation';
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "userId" ORDER BY "occurredAt" DESC, "createdAt" DESC, "id" DESC) AS rank
  FROM "GrowthRecord"
  WHERE "recordType" = 'competency_evaluation' AND ("courseId" = 'profile:growth-evaluation' OR "courseId" IS NULL)
)
UPDATE "GrowthRecord" AS growth
SET "businessKey" = CASE WHEN ranked.rank = 1 THEN 'competency-evaluation:' || growth."userId" ELSE NULL END,
    "courseId" = 'profile:growth-evaluation',
    "sourceSnapshotAt" = growth."occurredAt"
FROM ranked WHERE ranked."id" = growth."id";
CREATE UNIQUE INDEX "GrowthRecord_businessKey_key" ON "GrowthRecord"("businessKey");
CREATE INDEX "GrowthRecord_recordType_expiresAt_idx"
ON "GrowthRecord"("recordType", "expiresAt");

ALTER TABLE "ClassCompetencySnapshot" ADD COLUMN "materializationVersion" TEXT;
UPDATE "ClassCompetencySnapshot"
SET "trendJson" = jsonb_set(COALESCE("trendJson", '{}'::jsonb), '{_derivation}', '{"state":"stale","reason":"legacy-unscoped-materialization"}'::jsonb, true)
WHERE "materializationVersion" IS NULL;
CREATE INDEX "ClassCompetency_class_version_snapshot_idx"
ON "ClassCompetencySnapshot"("classId", "materializationVersion", "snapshotAt");

CREATE TABLE "LearningMaterializationRebuildRequest" (
  "userId" TEXT NOT NULL,
  "classIds" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "generation" INTEGER NOT NULL DEFAULT 1,
  "claimedGeneration" INTEGER,
  "claimToken" TEXT,
  "claimExpiresAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningMaterializationRebuildRequest_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "LMRebuild_status_claim_exp_updated_idx"
ON "LearningMaterializationRebuildRequest"("status", "claimExpiresAt", "updatedAt");

CREATE TABLE "LearningMaterializationGeneration" (
  "userId" TEXT NOT NULL,
  "generation" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningMaterializationGeneration_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "LearningMaterializationRebuildRequest"
ADD CONSTRAINT "LearningMaterializationRebuildRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningMaterializationGeneration"
ADD CONSTRAINT "LearningMaterializationGeneration_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LearningMaterializationOutbox" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'CLASS_SNAPSHOT',
  "classId" TEXT,
  "generation" INTEGER NOT NULL,
  "snapshotId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "claimToken" TEXT,
  "claimExpiresAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningMaterializationOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LearningMaterializationOutbox_dedupeKey_key" ON "LearningMaterializationOutbox"("dedupeKey");
CREATE INDEX "LMOutbox_status_available_claim_idx" ON "LearningMaterializationOutbox"("status", "availableAt", "claimExpiresAt");
CREATE INDEX "LMOutbox_expiresAt_idx" ON "LearningMaterializationOutbox"("expiresAt");
ALTER TABLE "LearningMaterializationOutbox" ADD CONSTRAINT "LearningMaterializationOutbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
