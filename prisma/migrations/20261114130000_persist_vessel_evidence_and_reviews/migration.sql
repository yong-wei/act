ALTER TABLE "VirtualSimulationReport"
  ADD COLUMN "clientRef" TEXT,
  ADD COLUMN "experimentVersion" TEXT NOT NULL DEFAULT 'legacy-v1',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'finalized',
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "classId" TEXT,
  ADD COLUMN "reviewerId" TEXT,
  ADD COLUMN "sections" JSONB,
  ADD COLUMN "evidenceRefs" JSONB,
  ADD COLUMN "rubric" JSONB,
  ADD COLUMN "teacherFeedback" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "VirtualSimulationReport_clientRef_key" ON "VirtualSimulationReport"("clientRef");
CREATE INDEX "VirtualSimulationReport_classId_experimentKey_status_idx" ON "VirtualSimulationReport"("classId", "experimentKey", "status");
ALTER TABLE "StudentModelArtifact" ADD COLUMN "clientRef" TEXT;
CREATE UNIQUE INDEX "StudentModelArtifact_clientRef_key" ON "StudentModelArtifact"("clientRef");
ALTER TABLE "ComparisonArtifact" ADD COLUMN "clientRef" TEXT;
CREATE UNIQUE INDEX "ComparisonArtifact_clientRef_key" ON "ComparisonArtifact"("clientRef");
ALTER TABLE "StepSubmissionAttempt" ADD COLUMN "clientRef" TEXT;
CREATE UNIQUE INDEX "StepSubmissionAttempt_clientRef_key" ON "StepSubmissionAttempt"("clientRef");
ALTER TABLE "SimulationTrace" ADD COLUMN "chunkIndex" INTEGER;
CREATE UNIQUE INDEX "SimulationTrace_runId_chunkIndex_key" ON "SimulationTrace"("runId", "chunkIndex");
