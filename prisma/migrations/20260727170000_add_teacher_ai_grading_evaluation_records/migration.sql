ALTER TABLE "GradingRun"
ADD COLUMN "providerInputTokens" INTEGER,
ADD COLUMN "providerOutputTokens" INTEGER,
ADD COLUMN "providerTelemetryComplete" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TeacherAiGradingAnnotationJudgment" (
    "id" TEXT NOT NULL,
    "gradingAnnotationId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "locationCorrect" BOOLEAN NOT NULL,
    "reasonCorrect" BOOLEAN NOT NULL,
    "suggestionCorrect" BOOLEAN NOT NULL,
    "seriouslyMisleading" BOOLEAN NOT NULL,
    "issueIdentity" TEXT NOT NULL,
    "evidenceIdentity" TEXT NOT NULL,
    "operatorUserId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAiGradingAnnotationJudgment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingAnnotationJudgment_version_check" CHECK ("version" > 0),
    CONSTRAINT "TeacherAiGradingAnnotationJudgment_identity_check" CHECK (
        length("issueIdentity") > 0 AND length("evidenceIdentity") > 0 AND length("operatorUserId") > 0
    )
);

CREATE TABLE "TeacherAiGradingConversionAttempt" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "attemptOrdinal" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "errorCode" TEXT,
    "durationMs" INTEGER NOT NULL,
    "conversionVersion" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "telemetryComplete" BOOLEAN NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAiGradingConversionAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingConversionAttempt_shape_check" CHECK (
        "attemptOrdinal" > 0 AND "durationMs" >= 0
        AND "status" IN ('SUCCEEDED', 'FAILED')
        AND (("status" = 'SUCCEEDED' AND "errorCode" IS NULL) OR ("status" = 'FAILED' AND "errorCode" IS NOT NULL))
        AND length("sampleId") > 0 AND length("stage") > 0
        AND length("conversionVersion") > 0 AND length("sourceHash") > 0
    )
);

CREATE TABLE "TeacherAiGradingProviderCallAttempt" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "attemptOrdinal" INTEGER NOT NULL,
    "callOrdinal" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "estimatedCostMicros" BIGINT,
    "pricingVersion" TEXT,
    "providerRequestId" TEXT,
    "errorCode" TEXT,
    "telemetryComplete" BOOLEAN NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAiGradingProviderCallAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingProviderCallAttempt_shape_check" CHECK (
        "attemptOrdinal" > 0 AND "callOrdinal" > 0 AND "durationMs" >= 0
        AND ("inputTokens" IS NULL OR "inputTokens" >= 0)
        AND ("outputTokens" IS NULL OR "outputTokens" >= 0)
        AND ("estimatedCostMicros" IS NULL OR "estimatedCostMicros" >= 0)
        AND "status" IN ('SUCCEEDED', 'FAILED')
        AND (("status" = 'SUCCEEDED' AND "errorCode" IS NULL) OR ("status" = 'FAILED' AND "errorCode" IS NOT NULL))
    )
);

CREATE TABLE "TeacherAiGradingReportSnapshot" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "partition" "TeacherAiGradingLabPartition" NOT NULL,
    "metricVersion" TEXT NOT NULL,
    "pricingVersion" TEXT NOT NULL,
    "configurationContentHash" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAiGradingReportSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingReportSnapshot_context_check" CHECK (
        length("metricVersion") > 0 AND length("pricingVersion") > 0
        AND length("configurationContentHash") > 0 AND length("contentHash") > 0
    )
);

CREATE UNIQUE INDEX "TeacherAiGradingAnnotationJudgment_annotation_version_key"
ON "TeacherAiGradingAnnotationJudgment"("gradingAnnotationId", "version");
CREATE INDEX "TeacherAiGradingAnnotationJudgment_execution_created_idx"
ON "TeacherAiGradingAnnotationJudgment"("executionId", "createdAt");
CREATE INDEX "TeacherAiGradingAnnotationJudgment_operator_created_idx"
ON "TeacherAiGradingAnnotationJudgment"("operatorUserId", "createdAt");
CREATE UNIQUE INDEX "TeacherAiGradingConversionAttempt_batch_sample_attempt_key"
ON "TeacherAiGradingConversionAttempt"("batchId", "sampleId", "attemptOrdinal");
CREATE INDEX "TeacherAiGradingConversionAttempt_batch_status_idx"
ON "TeacherAiGradingConversionAttempt"("batchId", "status");
CREATE UNIQUE INDEX "TeacherAiGradingProviderCallAttempt_execution_attempt_call_key"
ON "TeacherAiGradingProviderCallAttempt"("executionId", "attemptOrdinal", "callOrdinal");
CREATE INDEX "TeacherAiGradingProviderCallAttempt_execution_created_idx"
ON "TeacherAiGradingProviderCallAttempt"("executionId", "createdAt");
CREATE INDEX "TeacherAiGradingProviderCallAttempt_status_created_idx"
ON "TeacherAiGradingProviderCallAttempt"("status", "createdAt");
CREATE UNIQUE INDEX "TeacherAiGradingReportSnapshot_context_content_key"
ON "TeacherAiGradingReportSnapshot"("configId", "splitId", "partition", "contentHash");
CREATE INDEX "TeacherAiGradingReportSnapshot_context_created_idx"
ON "TeacherAiGradingReportSnapshot"("configId", "splitId", "partition", "createdAt");

ALTER TABLE "TeacherAiGradingAnnotationJudgment"
ADD CONSTRAINT "TeacherAiGradingAnnotationJudgment_annotation_fkey"
FOREIGN KEY ("gradingAnnotationId") REFERENCES "GradingAnnotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingAnnotationJudgment"
ADD CONSTRAINT "TeacherAiGradingAnnotationJudgment_execution_fkey"
FOREIGN KEY ("executionId") REFERENCES "TeacherAiGradingExperimentExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingConversionAttempt"
ADD CONSTRAINT "TeacherAiGradingConversionAttempt_batch_fkey"
FOREIGN KEY ("batchId") REFERENCES "TeacherAiGradingExperimentBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingProviderCallAttempt"
ADD CONSTRAINT "TeacherAiGradingProviderCallAttempt_execution_fkey"
FOREIGN KEY ("executionId") REFERENCES "TeacherAiGradingExperimentExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingReportSnapshot"
ADD CONSTRAINT "TeacherAiGradingReportSnapshot_config_fkey"
FOREIGN KEY ("configId") REFERENCES "TeacherAiGradingExperimentConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingReportSnapshot"
ADD CONSTRAINT "TeacherAiGradingReportSnapshot_split_fkey"
FOREIGN KEY ("splitId") REFERENCES "TeacherAiGradingLabSplit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_teacher_ai_grading_evaluation_record_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Teacher AI grading evaluation records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherAiGradingAnnotationJudgment_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingAnnotationJudgment"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_evaluation_record_mutation();
CREATE TRIGGER "TeacherAiGradingConversionAttempt_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingConversionAttempt"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_evaluation_record_mutation();
CREATE TRIGGER "TeacherAiGradingProviderCallAttempt_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingProviderCallAttempt"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_evaluation_record_mutation();
CREATE TRIGGER "TeacherAiGradingReportSnapshot_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingReportSnapshot"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_evaluation_record_mutation();
