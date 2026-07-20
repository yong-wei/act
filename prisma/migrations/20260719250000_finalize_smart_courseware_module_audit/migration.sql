ALTER TABLE "SmartCoursewareGenerationJob"
  ADD COLUMN "moduleAttemptGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "moduleClaimToken" TEXT,
  ADD COLUMN "moduleClaimExpiresAt" TIMESTAMP(3);

ALTER TABLE "SmartCoursewareGenerationJob"
  ADD CONSTRAINT "SmartCoursewareGenerationJob_module_attempt_generation_check"
  CHECK ("moduleAttemptGeneration" >= 0);

ALTER TABLE "SmartCoursewareModuleRevision"
  ADD COLUMN "generationJobId" TEXT,
  ADD COLUMN "providerAttemptId" TEXT,
  ADD COLUMN "candidateHash" TEXT,
  ADD COLUMN "candidateDiffId" TEXT,
  ADD COLUMN "acceptedCommandId" TEXT,
  ADD COLUMN "originalAttemptIdSnapshot" TEXT;

CREATE INDEX "SmartCoursewareModuleRevision_generationJobId_idx"
  ON "SmartCoursewareModuleRevision"("generationJobId");
CREATE INDEX "SmartCoursewareModuleRevision_providerAttemptId_idx"
  ON "SmartCoursewareModuleRevision"("providerAttemptId");
CREATE INDEX "SmartCoursewareModuleRevision_acceptedCommandId_idx"
  ON "SmartCoursewareModuleRevision"("acceptedCommandId");
CREATE UNIQUE INDEX "SmartCoursewareModuleRevision_candidateDiffId_key"
  ON "SmartCoursewareModuleRevision"("candidateDiffId");

ALTER TABLE "SmartCoursewareModuleRevision" ADD CONSTRAINT "SmartCoursewareModuleRevision_generationJobId_fkey"
  FOREIGN KEY ("generationJobId") REFERENCES "SmartCoursewareGenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareModuleRevision" ADD CONSTRAINT "SmartCoursewareModuleRevision_providerAttemptId_fkey"
  FOREIGN KEY ("providerAttemptId") REFERENCES "SmartCoursewareProviderAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareModuleRevision" ADD CONSTRAINT "SmartCoursewareModuleRevision_acceptedCommandId_fkey"
  FOREIGN KEY ("acceptedCommandId") REFERENCES "SmartCoursewareGenerationCommand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
