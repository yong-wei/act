CREATE TYPE "AnswerEvidenceSourceKind" AS ENUM ('TEXT_NATIVE', 'DOCUMENT');
CREATE TYPE "AnswerEvidenceReadiness" AS ENUM ('PENDING', 'READY', 'BLOCKED', 'DELETED');
CREATE TYPE "GradingPrecision" AS ENUM ('SPAN', 'BLOCK', 'PAGE');
CREATE TYPE "DocumentConversionState" AS ENUM ('QUEUED', 'RUNNING', 'RETRYABLE', 'SUCCEEDED', 'FALLBACK', 'BLOCKED', 'FAILED', 'CANCELLED', 'CONTENT_UNAVAILABLE', 'DELETED');
CREATE TYPE "GradingJobKind" AS ENUM ('CONVERSION', 'GRADING', 'BATCH', 'RETRY', 'RERUN');
CREATE TYPE "GradingJobState" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRYABLE', 'CANCELLED', 'BLOCKED', 'CONTENT_UNAVAILABLE');
CREATE TYPE "GradingBatchState" AS ENUM ('QUEUED', 'RUNNING', 'RETRYABLE', 'SUCCEEDED', 'PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED', 'CONTENT_UNAVAILABLE');
CREATE TYPE "GradingBatchItemState" AS ENUM ('QUEUED', 'CONVERTING', 'GRADING', 'SUCCEEDED', 'FAILED', 'RETRYABLE', 'CANCELLED', 'BLOCKED');
CREATE TYPE "GradingRunState" AS ENUM ('QUEUED', 'RUNNING', 'FAILED', 'AWAITING_REVIEW', 'BLOCKED', 'RETRYABLE', 'CANCELLED', 'CONTENT_UNAVAILABLE');
CREATE TYPE "GradingAnnotationAuthorRole" AS ENUM ('AI_DRAFT', 'TEACHER');

CREATE TABLE "GradingProviderPolicy" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "model" TEXT,
    "endpoint" TEXT,
    "purpose" TEXT NOT NULL,
    "dataCategories" TEXT[] NOT NULL,
    "minimizedScope" TEXT[] NOT NULL,
    "institutionScope" TEXT,
    "classScope" TEXT[] NOT NULL,
    "processingRegion" TEXT NOT NULL,
    "agreementVersion" TEXT NOT NULL,
    "noTraining" BOOLEAN NOT NULL,
    "providerRetentionSeconds" INTEGER NOT NULL,
    "deletionCapability" BOOLEAN NOT NULL,
    "rateLimitPerMinute" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMP(3),
    "credentialRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingProviderPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingRequestIdempotency" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "actorPseudoId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingRequestIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingLifecyclePolicy" (
    "id" TEXT NOT NULL,
    "dataClass" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "retentionSeconds" INTEGER,
    "governedRecordRule" TEXT,
    "deleteStrategy" TEXT NOT NULL,
    "providerRetentionSeconds" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingLifecyclePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingAuditEvent" (
    "id" TEXT NOT NULL,
    "actorPseudoId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "classId" TEXT,
    "assignmentId" TEXT,
    "answerId" TEXT,
    "provider" TEXT,
    "providerRequestId" TEXT,
    "policyVersion" TEXT,
    "requestHash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradingAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingTombstone" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "checksum" TEXT,
    "contentDeletedAt" TIMESTAMP(3),
    "lineageRetained" BOOLEAN NOT NULL DEFAULT true,
    "pseudonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradingTombstone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingLegalHold" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "placedByPseudoId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releasedByPseudoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingLegalHold_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingQuota" (
    "key" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingQuota_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "DocumentConversion" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "policyId" TEXT,
    "policySnapshot" JSONB,
    "policySnapshotHash" TEXT,
    "version" INTEGER NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "adapterVersion" TEXT NOT NULL,
    "state" "DocumentConversionState" NOT NULL DEFAULT 'QUEUED',
    "sourceChecksum" TEXT NOT NULL,
    "outputChecksum" TEXT,
    "canonicalMarkdown" TEXT,
    "renderedObjectKey" TEXT,
    "renderedChecksum" TEXT,
    "precision" "GradingPrecision",
    "confidence" DOUBLE PRECISION,
    "warningCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "limitationState" TEXT NOT NULL DEFAULT 'none',
    "providerRequestId" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "cancellationRequestedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "failureCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "retentionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentConversion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnswerEvidence" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "sourceAssetId" TEXT,
    "conversionId" TEXT,
    "version" INTEGER NOT NULL,
    "sourceKind" "AnswerEvidenceSourceKind" NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "canonicalMarkdown" TEXT NOT NULL,
    "anchorVersion" TEXT NOT NULL,
    "precision" "GradingPrecision" NOT NULL,
    "readiness" "AnswerEvidenceReadiness" NOT NULL DEFAULT 'PENDING',
    "limitationState" TEXT NOT NULL DEFAULT 'none',
    "limitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "retentionExpiresAt" TIMESTAMP(3),
    "tombstonedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnswerEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnswerEvidenceBlock" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "text" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "spanStart" INTEGER,
    "spanEnd" INTEGER,
    "bbox" JSONB,
    "precision" "GradingPrecision" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnswerEvidenceBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingConversionWarning" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "detail" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradingConversionWarning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingBatch" (
    "id" TEXT NOT NULL,
    "assignmentRevisionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "policyId" TEXT,
    "policySnapshot" JSONB,
    "policySnapshotHash" TEXT,
    "conversionPolicyId" TEXT,
    "conversionPolicySnapshot" JSONB,
    "conversionPolicySnapshotHash" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "questionSnapshotHash" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "questionSnapshot" JSONB NOT NULL,
    "rubricSnapshot" JSONB NOT NULL,
    "referenceAnswer" TEXT NOT NULL,
    "state" "GradingBatchState" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "blockedItems" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "nextRunAt" TIMESTAMP(3),
    "cancellationRequestedAt" TIMESTAMP(3),
    "rerunReason" TEXT,
    "retentionExpiresAt" TIMESTAMP(3),
    "tombstonedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingRerun" (
    "id" TEXT NOT NULL,
    "kind" "GradingJobKind" NOT NULL,
    "batchId" TEXT,
    "gradingRunId" TEXT,
    "gradingJobId" TEXT,
    "reason" TEXT NOT NULL,
    "createdByPseudoId" TEXT NOT NULL,
    "versionBoundary" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradingRerun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingRun" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "answerAttemptId" TEXT NOT NULL,
    "answerEvidenceId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "policyId" TEXT,
    "policySnapshot" JSONB,
    "policySnapshotHash" TEXT,
    "rerunIdentity" TEXT,
    "rerunReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "questionSnapshotHash" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "questionSnapshot" JSONB NOT NULL,
    "rubricSnapshot" JSONB NOT NULL,
    "referenceAnswer" TEXT NOT NULL,
    "limitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "blockedReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "state" "GradingRunState" NOT NULL DEFAULT 'QUEUED',
    "draftTotalScore" DOUBLE PRECISION,
    "overallComment" TEXT,
    "modelInputObjectKey" TEXT,
    "modelOutputObjectKey" TEXT,
    "teacherReviewedAt" TIMESTAMP(3),
    "retentionExpiresAt" TIMESTAMP(3),
    "tombstonedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "answerVersion" INTEGER NOT NULL,
    "questionSnapshotHash" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "evidenceId" TEXT,
    "conversionId" TEXT,
    "evidenceHash" TEXT,
    "evidenceVersion" INTEGER,
    "inputHash" TEXT,
    "gradingRunId" TEXT,
    "state" "GradingBatchItemState" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "failureCode" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingCriterionAssessment" (
    "id" TEXT NOT NULL,
    "gradingRunId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "limitationState" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingCriterionAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingAnnotation" (
    "id" TEXT NOT NULL,
    "gradingRunId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "blockId" TEXT,
    "criterionId" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "spanStart" INTEGER,
    "spanEnd" INTEGER,
    "bbox" JSONB,
    "precision" "GradingPrecision" NOT NULL,
    "excerpt" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "authorRole" "GradingAnnotationAuthorRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradingAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradingJob" (
    "id" TEXT NOT NULL,
    "kind" "GradingJobKind" NOT NULL,
    "state" "GradingJobState" NOT NULL DEFAULT 'QUEUED',
    "dedupeKey" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "reason" TEXT,
    "attemptId" TEXT,
    "conversionId" TEXT,
    "batchId" TEXT,
    "batchItemId" TEXT,
    "gradingRunId" TEXT,
    "policyId" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "correlationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradingProviderPolicy_provider_version_key" ON "GradingProviderPolicy"("provider", "version");
CREATE INDEX "GradingProviderPolicy_provider_enabled_createdAt_idx" ON "GradingProviderPolicy"("provider", "enabled", "createdAt");
CREATE UNIQUE INDEX "GradingRequestIdempotency_operation_scope_actor_key" ON "GradingRequestIdempotency"("operation", "scope", "actorPseudoId", "idempotencyKey");
CREATE INDEX "GradingRequestIdempotency_resourceType_resourceId_idx" ON "GradingRequestIdempotency"("resourceType", "resourceId");
CREATE UNIQUE INDEX "GradingLifecyclePolicy_dataClass_version_key" ON "GradingLifecyclePolicy"("dataClass", "version");
CREATE INDEX "GradingLifecyclePolicy_dataClass_enabled_idx" ON "GradingLifecyclePolicy"("dataClass", "enabled");
CREATE INDEX "GradingAuditEvent_resourceType_resourceId_createdAt_idx" ON "GradingAuditEvent"("resourceType", "resourceId", "createdAt");
CREATE INDEX "GradingAuditEvent_actorPseudoId_createdAt_idx" ON "GradingAuditEvent"("actorPseudoId", "createdAt");
CREATE INDEX "GradingAuditEvent_purpose_createdAt_idx" ON "GradingAuditEvent"("purpose", "createdAt");
CREATE INDEX "GradingAuditEvent_classId_createdAt_idx" ON "GradingAuditEvent"("classId", "createdAt");
CREATE UNIQUE INDEX "GradingTombstone_resourceKey_key" ON "GradingTombstone"("resourceKey");
CREATE INDEX "GradingTombstone_resourceType_resourceId_idx" ON "GradingTombstone"("resourceType", "resourceId");
CREATE INDEX "GradingTombstone_contentDeletedAt_idx" ON "GradingTombstone"("contentDeletedAt");
CREATE INDEX "GradingLegalHold_scopeType_scopeId_releasedAt_idx" ON "GradingLegalHold"("scopeType", "scopeId", "releasedAt");
CREATE INDEX "GradingLegalHold_expiresAt_idx" ON "GradingLegalHold"("expiresAt");
CREATE INDEX "GradingQuota_subjectType_subjectId_scope_idx" ON "GradingQuota"("subjectType", "subjectId", "scope");
CREATE INDEX "GradingQuota_blockedUntil_idx" ON "GradingQuota"("blockedUntil");
CREATE UNIQUE INDEX "DocumentConversion_dedupeKey_key" ON "DocumentConversion"("dedupeKey");
CREATE UNIQUE INDEX "DocumentConversion_assetId_version_key" ON "DocumentConversion"("assetId", "version");
CREATE INDEX "DocumentConversion_state_progress_createdAt_idx" ON "DocumentConversion"("state", "progress", "createdAt");
CREATE INDEX "DocumentConversion_attemptId_state_idx" ON "DocumentConversion"("attemptId", "state");
CREATE INDEX "DocumentConversion_sourceChecksum_idx" ON "DocumentConversion"("sourceChecksum");
CREATE UNIQUE INDEX "AnswerEvidence_conversionId_key" ON "AnswerEvidence"("conversionId");
CREATE UNIQUE INDEX "AnswerEvidence_attemptId_version_key" ON "AnswerEvidence"("attemptId", "version");
CREATE INDEX "AnswerEvidence_sourceHash_idx" ON "AnswerEvidence"("sourceHash");
CREATE INDEX "AnswerEvidence_readiness_retentionExpiresAt_idx" ON "AnswerEvidence"("readiness", "retentionExpiresAt");
CREATE INDEX "AnswerEvidence_sourceAssetId_idx" ON "AnswerEvidence"("sourceAssetId");
CREATE UNIQUE INDEX "AnswerEvidenceBlock_evidenceId_blockIndex_key" ON "AnswerEvidenceBlock"("evidenceId", "blockIndex");
CREATE INDEX "AnswerEvidenceBlock_evidenceId_pageNumber_idx" ON "AnswerEvidenceBlock"("evidenceId", "pageNumber");
CREATE INDEX "AnswerEvidenceBlock_sourceHash_idx" ON "AnswerEvidenceBlock"("sourceHash");
CREATE INDEX "GradingConversionWarning_conversionId_severity_idx" ON "GradingConversionWarning"("conversionId", "severity");
CREATE UNIQUE INDEX "GradingConversionWarning_conversionId_code_key" ON "GradingConversionWarning"("conversionId", "code");
CREATE UNIQUE INDEX "GradingBatch_dedupeKey_key" ON "GradingBatch"("dedupeKey");
CREATE UNIQUE INDEX "GradingBatch_requesterUserId_idempotencyKey_key" ON "GradingBatch"("requesterUserId", "idempotencyKey");
CREATE INDEX "GradingBatch_questionId_classId_state_idx" ON "GradingBatch"("questionId", "classId", "state");
CREATE INDEX "GradingBatch_assignment_question_hash_idx" ON "GradingBatch"("assignmentRevisionId", "questionId", "questionSnapshotHash");
CREATE INDEX "GradingBatch_conversionPolicyId_idx" ON "GradingBatch"("conversionPolicyId");
CREATE INDEX "GradingBatch_state_updatedAt_idx" ON "GradingBatch"("state", "updatedAt");
CREATE UNIQUE INDEX "GradingRerun_idempotencyKey_key" ON "GradingRerun"("idempotencyKey");
CREATE INDEX "GradingRerun_kind_createdAt_idx" ON "GradingRerun"("kind", "createdAt");
CREATE INDEX "GradingRerun_batchId_idx" ON "GradingRerun"("batchId");
CREATE INDEX "GradingRerun_gradingRunId_idx" ON "GradingRerun"("gradingRunId");
CREATE INDEX "GradingRerun_gradingJobId_idx" ON "GradingRerun"("gradingJobId");
CREATE UNIQUE INDEX "GradingRun_dedupeKey_key" ON "GradingRun"("dedupeKey");
CREATE UNIQUE INDEX "GradingRun_attempt_rubric_input_rerun_key" ON "GradingRun"("answerAttemptId", "rubricId", "rubricVersion", "evaluatorVersion", "inputHash", "rerunIdentity");
CREATE INDEX "GradingRun_questionId_state_createdAt_idx" ON "GradingRun"("questionId", "state", "createdAt");
CREATE INDEX "GradingRun_answerAttemptId_createdAt_idx" ON "GradingRun"("answerAttemptId", "createdAt");
CREATE INDEX "GradingRun_batchId_state_idx" ON "GradingRun"("batchId", "state");
CREATE INDEX "GradingRun_state_retentionExpiresAt_idx" ON "GradingRun"("state", "retentionExpiresAt");
CREATE UNIQUE INDEX "GradingBatchItem_gradingRunId_key" ON "GradingBatchItem"("gradingRunId");
CREATE UNIQUE INDEX "GradingBatchItem_batchId_answerId_key" ON "GradingBatchItem"("batchId", "answerId");
CREATE INDEX "GradingBatchItem_batchId_state_idx" ON "GradingBatchItem"("batchId", "state");
CREATE INDEX "GradingBatchItem_attemptId_idx" ON "GradingBatchItem"("attemptId");
CREATE UNIQUE INDEX "GradingCriterionAssessment_gradingRunId_criterionId_key" ON "GradingCriterionAssessment"("gradingRunId", "criterionId");
CREATE INDEX "GradingCriterionAssessment_criterionId_createdAt_idx" ON "GradingCriterionAssessment"("criterionId", "createdAt");
CREATE INDEX "GradingAnnotation_gradingRunId_criterionId_idx" ON "GradingAnnotation"("gradingRunId", "criterionId");
CREATE INDEX "GradingAnnotation_blockId_idx" ON "GradingAnnotation"("blockId");
CREATE UNIQUE INDEX "GradingJob_dedupeKey_key" ON "GradingJob"("dedupeKey");
CREATE INDEX "GradingJob_state_nextRunAt_idx" ON "GradingJob"("state", "nextRunAt");
CREATE INDEX "GradingJob_kind_state_createdAt_idx" ON "GradingJob"("kind", "state", "createdAt");
CREATE INDEX "GradingJob_attemptId_kind_idx" ON "GradingJob"("attemptId", "kind");
CREATE INDEX "GradingJob_batchId_state_idx" ON "GradingJob"("batchId", "state");

ALTER TABLE "DocumentConversion" ADD CONSTRAINT "DocumentConversion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "SubmissionAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentConversion" ADD CONSTRAINT "DocumentConversion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentConversion" ADD CONSTRAINT "DocumentConversion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "GradingProviderPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnswerEvidence" ADD CONSTRAINT "AnswerEvidence_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnswerEvidence" ADD CONSTRAINT "AnswerEvidence_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "SubmissionAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnswerEvidence" ADD CONSTRAINT "AnswerEvidence_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "DocumentConversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnswerEvidenceBlock" ADD CONSTRAINT "AnswerEvidenceBlock_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "AnswerEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingConversionWarning" ADD CONSTRAINT "GradingConversionWarning_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "DocumentConversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatch" ADD CONSTRAINT "GradingBatch_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatch" ADD CONSTRAINT "GradingBatch_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssignmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatch" ADD CONSTRAINT "GradingBatch_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatch" ADD CONSTRAINT "GradingBatch_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatch" ADD CONSTRAINT "GradingBatch_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "GradingProviderPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatch" ADD CONSTRAINT "GradingBatch_conversionPolicyId_fkey" FOREIGN KEY ("conversionPolicyId") REFERENCES "GradingProviderPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingRerun" ADD CONSTRAINT "GradingRerun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "GradingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingRerun" ADD CONSTRAINT "GradingRerun_gradingRunId_fkey" FOREIGN KEY ("gradingRunId") REFERENCES "GradingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingRerun" ADD CONSTRAINT "GradingRerun_gradingJobId_fkey" FOREIGN KEY ("gradingJobId") REFERENCES "GradingJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingRun" ADD CONSTRAINT "GradingRun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "GradingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingRun" ADD CONSTRAINT "GradingRun_answerAttemptId_fkey" FOREIGN KEY ("answerAttemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingRun" ADD CONSTRAINT "GradingRun_answerEvidenceId_fkey" FOREIGN KEY ("answerEvidenceId") REFERENCES "AnswerEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingRun" ADD CONSTRAINT "GradingRun_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssignmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingRun" ADD CONSTRAINT "GradingRun_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "GradingProviderPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatchItem" ADD CONSTRAINT "GradingBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "GradingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatchItem" ADD CONSTRAINT "GradingBatchItem_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatchItem" ADD CONSTRAINT "GradingBatchItem_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "AnswerEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatchItem" ADD CONSTRAINT "GradingBatchItem_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "DocumentConversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatchItem" ADD CONSTRAINT "GradingBatchItem_gradingRunId_fkey" FOREIGN KEY ("gradingRunId") REFERENCES "GradingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingCriterionAssessment" ADD CONSTRAINT "GradingCriterionAssessment_gradingRunId_fkey" FOREIGN KEY ("gradingRunId") REFERENCES "GradingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingAnnotation" ADD CONSTRAINT "GradingAnnotation_gradingRunId_fkey" FOREIGN KEY ("gradingRunId") REFERENCES "GradingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingAnnotation" ADD CONSTRAINT "GradingAnnotation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "GradingCriterionAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingAnnotation" ADD CONSTRAINT "GradingAnnotation_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "AnswerEvidenceBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "DocumentConversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "GradingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_batchItemId_fkey" FOREIGN KEY ("batchItemId") REFERENCES "GradingBatchItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_gradingRunId_fkey" FOREIGN KEY ("gradingRunId") REFERENCES "GradingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "GradingProviderPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
