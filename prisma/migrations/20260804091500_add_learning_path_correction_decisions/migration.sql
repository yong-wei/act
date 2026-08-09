CREATE TABLE "LearningPathCorrectionDecision" (
  "id" TEXT NOT NULL,
  "pathId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "candidateFingerprint" TEXT NOT NULL,
  "pathUpdatedAt" TIMESTAMP(3) NOT NULL,
  "decision" TEXT NOT NULL,
  "originalPathSnapshot" JSONB NOT NULL,
  "candidateSnapshot" JSONB NOT NULL,
  "supportingFacts" JSONB NOT NULL DEFAULT '[]',
  "applicationResult" JSONB NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningPathCorrectionDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningPathCorrectionDecision_pathId_idempotencyKey_key"
  ON "LearningPathCorrectionDecision"("pathId", "idempotencyKey");
CREATE INDEX "LearningPathCorrectionDecision_pathId_candidateFingerprint_createdAt_idx"
  ON "LearningPathCorrectionDecision"("pathId", "candidateFingerprint", "createdAt");
CREATE INDEX "LearningPathCorrectionDecision_userId_createdAt_idx"
  ON "LearningPathCorrectionDecision"("userId", "createdAt");

ALTER TABLE "LearningPathCorrectionDecision"
  ADD CONSTRAINT "LearningPathCorrectionDecision_pathId_fkey"
  FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
