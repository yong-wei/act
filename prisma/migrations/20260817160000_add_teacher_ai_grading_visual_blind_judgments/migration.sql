CREATE TABLE "TeacherAiGradingVisualEvidenceBlindJudgment" (
  "id" TEXT NOT NULL,
  "configId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "visualEvidenceId" TEXT NOT NULL,
  "evidenceContentHash" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "faithful" BOOLEAN NOT NULL,
  "sufficientForScoring" BOOLEAN NOT NULL,
  "misattributed" BOOLEAN NOT NULL,
  "operatorUserId" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TeacherAiGradingVisualEvidenceBlindJudgment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherAiGradingVisualEvidenceBlindJudgment_executionId_visualEvidenceId_version_key"
ON "TeacherAiGradingVisualEvidenceBlindJudgment"("executionId", "visualEvidenceId", "version");

CREATE INDEX "TeacherAiGradingVisualEvidenceBlindJudgment_configId_executionId_idx"
ON "TeacherAiGradingVisualEvidenceBlindJudgment"("configId", "executionId");

ALTER TABLE "TeacherAiGradingVisualEvidenceBlindJudgment"
ADD CONSTRAINT "TeacherAiGradingVisualEvidenceBlindJudgment_configId_fkey"
FOREIGN KEY ("configId") REFERENCES "TeacherAiGradingExperimentConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherAiGradingVisualEvidenceBlindJudgment"
ADD CONSTRAINT "TeacherAiGradingVisualEvidenceBlindJudgment_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "TeacherAiGradingExperimentExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
