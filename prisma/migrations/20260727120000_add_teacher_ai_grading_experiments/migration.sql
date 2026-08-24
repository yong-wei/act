CREATE TYPE "TeacherAiGradingExperimentBatchState" AS ENUM ('QUEUED', 'RUNNING', 'RETRYABLE', 'SUCCEEDED', 'PARTIAL', 'FAILED');
CREATE TYPE "TeacherAiGradingExperimentExecutionState" AS ENUM ('QUEUED', 'RUNNING', 'RETRYABLE', 'SUCCEEDED', 'FAILED');

CREATE TABLE "TeacherAiGradingExperimentConfig" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "datasetId" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "datasetContentHash" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "splitVersion" TEXT NOT NULL,
    "splitContentHash" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptContentHash" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "modelParameters" JSONB NOT NULL,
    "rubricId" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "rubricContentHash" TEXT NOT NULL,
    "processorId" TEXT NOT NULL,
    "processorVersion" TEXT NOT NULL,
    "processorContentHash" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "metricVersion" TEXT NOT NULL,
    "metricContentHash" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAiGradingExperimentConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAiGradingExperimentBatch" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "sampleSetSnapshot" JSONB NOT NULL,
    "sampleSetHash" TEXT NOT NULL,
    "state" "TeacherAiGradingExperimentBatchState" NOT NULL DEFAULT 'QUEUED',
    "totalExecutions" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "retryableCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherAiGradingExperimentBatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingExperimentBatch_attempts_check" CHECK ("maxAttempts" > 0),
    CONSTRAINT "TeacherAiGradingExperimentBatch_total_check" CHECK ("totalExecutions" > 0)
);

CREATE TABLE "TeacherAiGradingExperimentExecution" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "repetitionOrdinal" INTEGER NOT NULL,
    "gradingRunId" TEXT NOT NULL,
    "state" "TeacherAiGradingExperimentExecutionState" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failureStage" TEXT,
    "errorCode" TEXT,
    "claimToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "rawOutputObjectKey" TEXT,
    "rawOutputChecksum" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherAiGradingExperimentExecution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingExperimentExecution_ordinal_check" CHECK ("repetitionOrdinal" BETWEEN 1 AND 3),
    CONSTRAINT "TeacherAiGradingExperimentExecution_attempt_count_check" CHECK ("attemptCount" >= 0),
    CONSTRAINT "TeacherAiGradingExperimentExecution_raw_output_check" CHECK (("rawOutputObjectKey" IS NULL) = ("rawOutputChecksum" IS NULL))
);

CREATE UNIQUE INDEX "TeacherAiGradingExperimentConfig_idempotencyKey_key" ON "TeacherAiGradingExperimentConfig"("idempotencyKey");
CREATE UNIQUE INDEX "TeacherAiGradingExperimentConfig_datasetId_version_key" ON "TeacherAiGradingExperimentConfig"("datasetId", "version");
CREATE INDEX "TeacherAiGradingExperimentConfig_contentHash_idx" ON "TeacherAiGradingExperimentConfig"("contentHash");
CREATE INDEX "TeacherAiGradingExperimentConfig_datasetId_datasetVersion_idx" ON "TeacherAiGradingExperimentConfig"("datasetId", "datasetVersion");
CREATE UNIQUE INDEX "TeacherAiGradingExperimentBatch_idempotencyKey_key" ON "TeacherAiGradingExperimentBatch"("idempotencyKey");
CREATE INDEX "TeacherAiGradingExperimentBatch_configId_state_idx" ON "TeacherAiGradingExperimentBatch"("configId", "state");
CREATE INDEX "TeacherAiGradingExperimentBatch_state_updatedAt_idx" ON "TeacherAiGradingExperimentBatch"("state", "updatedAt");
CREATE UNIQUE INDEX "TeacherAiGradingExperimentExecution_gradingRunId_key" ON "TeacherAiGradingExperimentExecution"("gradingRunId");
CREATE UNIQUE INDEX "TeacherAiGradingExperimentExecution_config_split_sample_question_ordinal_key" ON "TeacherAiGradingExperimentExecution"("configId", "splitId", "sampleId", "questionId", "repetitionOrdinal");
CREATE INDEX "TeacherAiGradingExperimentExecution_batchId_state_idx" ON "TeacherAiGradingExperimentExecution"("batchId", "state");
CREATE INDEX "TeacherAiGradingExperimentExecution_state_leaseExpiresAt_idx" ON "TeacherAiGradingExperimentExecution"("state", "leaseExpiresAt");

ALTER TABLE "TeacherAiGradingExperimentBatch" ADD CONSTRAINT "TeacherAiGradingExperimentBatch_configId_fkey" FOREIGN KEY ("configId") REFERENCES "TeacherAiGradingExperimentConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingExperimentExecution" ADD CONSTRAINT "TeacherAiGradingExperimentExecution_configId_fkey" FOREIGN KEY ("configId") REFERENCES "TeacherAiGradingExperimentConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingExperimentExecution" ADD CONSTRAINT "TeacherAiGradingExperimentExecution_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TeacherAiGradingExperimentBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingExperimentExecution" ADD CONSTRAINT "TeacherAiGradingExperimentExecution_gradingRunId_fkey" FOREIGN KEY ("gradingRunId") REFERENCES "GradingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_teacher_ai_grading_experiment_config_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'TeacherAiGradingExperimentConfig rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherAiGradingExperimentConfig_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingExperimentConfig"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_experiment_config_mutation();
