CREATE TYPE "DiagnosisGenerationJobState" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMED_OUT');
CREATE TYPE "DiagnosisGenerationAttemptState" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT');

CREATE TABLE "DiagnosisGenerationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "activeScopeKey" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "state" "DiagnosisGenerationJobState" NOT NULL DEFAULT 'QUEUED',
    "evidenceCutoff" TIMESTAMP(3) NOT NULL,
    "generatorVersion" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "deliveryGeneration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiagnosisGenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosisGenerationAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "state" "DiagnosisGenerationAttemptState" NOT NULL DEFAULT 'RUNNING',
    "agentSessionId" TEXT,
    "providerResponseId" TEXT,
    "toolAudit" JSONB NOT NULL DEFAULT '[]',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "DiagnosisGenerationAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DiagnosisReport" ADD COLUMN "generationJobId" TEXT;
CREATE UNIQUE INDEX "DiagnosisGenerationJob_activeScopeKey_key" ON "DiagnosisGenerationJob"("activeScopeKey");
CREATE UNIQUE INDEX "DiagnosisGenerationJob_userId_idempotencyKey_key" ON "DiagnosisGenerationJob"("userId", "idempotencyKey");
CREATE INDEX "DiagnosisGenerationJob_classId_targetUserId_createdAt_idx" ON "DiagnosisGenerationJob"("classId", "targetUserId", "createdAt");
CREATE INDEX "DiagnosisGenerationJob_state_createdAt_idx" ON "DiagnosisGenerationJob"("state", "createdAt");
CREATE UNIQUE INDEX "DiagnosisGenerationAttempt_jobId_attemptNumber_key" ON "DiagnosisGenerationAttempt"("jobId", "attemptNumber");
CREATE INDEX "DiagnosisGenerationAttempt_state_startedAt_idx" ON "DiagnosisGenerationAttempt"("state", "startedAt");
CREATE UNIQUE INDEX "DiagnosisReport_generationJobId_key" ON "DiagnosisReport"("generationJobId");
ALTER TABLE "DiagnosisGenerationAttempt" ADD CONSTRAINT "DiagnosisGenerationAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DiagnosisGenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosisReport" ADD CONSTRAINT "DiagnosisReport_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "DiagnosisGenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
