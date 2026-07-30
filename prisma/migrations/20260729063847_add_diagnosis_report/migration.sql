-- CreateTable
CREATE TABLE IF NOT EXISTS "DiagnosisReport" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "reportBody" JSONB NOT NULL,
    "riskSummary" JSONB,
    "evidenceCutoff" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatorVersion" TEXT NOT NULL DEFAULT 'v1',

    CONSTRAINT "DiagnosisReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DiagnosisReport_scopeType_scopeId_generatedAt_idx" ON "DiagnosisReport"("scopeType", "scopeId", "generatedAt");
CREATE INDEX IF NOT EXISTS "DiagnosisReport_classId_generatedAt_idx" ON "DiagnosisReport"("classId", "generatedAt");
CREATE INDEX IF NOT EXISTS "DiagnosisReport_userId_generatedAt_idx" ON "DiagnosisReport"("userId", "generatedAt");
CREATE INDEX IF NOT EXISTS "DiagnosisReport_targetUserId_generatedAt_idx" ON "DiagnosisReport"("targetUserId", "generatedAt");

ALTER TABLE "DiagnosisReport"
  ADD CONSTRAINT "DiagnosisReport_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiagnosisReport"
  ADD CONSTRAINT "DiagnosisReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiagnosisReport"
  ADD CONSTRAINT "DiagnosisReport_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the newest active risk state and close pre-existing duplicates before
-- enforcing the one-active-flag invariant used by concurrent scanners.
WITH "rankedActiveRiskFlags" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "flagType"
      ORDER BY "triggeredAt" DESC, "createdAt" DESC, "id" DESC
    ) AS "activeRank"
  FROM "StudentRiskFlag"
  WHERE "isResolved" = false
)
UPDATE "StudentRiskFlag" AS "flag"
SET
  "isResolved" = true,
  "resolvedAt" = COALESCE("flag"."resolvedAt", CURRENT_TIMESTAMP),
  "resolutionNote" = COALESCE(
    "flag"."resolutionNote",
    'deduplicated-before-active-risk-unique-index'
  )
FROM "rankedActiveRiskFlags" AS "ranked"
WHERE "flag"."id" = "ranked"."id"
  AND "ranked"."activeRank" > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "StudentRiskFlag_active_user_type_key"
  ON "StudentRiskFlag"("userId", "flagType")
  WHERE "isResolved" = false;
