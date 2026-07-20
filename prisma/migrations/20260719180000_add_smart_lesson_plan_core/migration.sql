CREATE TYPE "SmartLessonSourceSelectionState" AS ENUM ('SELECTED', 'REMOVED');
CREATE TYPE "SmartLessonItemState" AS ENUM ('DRAFT', 'CONFIRMED', 'REMOVED');
CREATE TYPE "SmartLessonSourceState" AS ENUM ('VERIFIED', 'AI_GENERATED_SOURCE_PENDING', 'TEACHER_CREATED_SOURCE_PENDING');
CREATE TYPE "SmartLessonDraftState" AS ENUM ('EDITABLE', 'GENERATING', 'READY', 'APPROVED');
CREATE TYPE "SmartLessonGenerationJobState" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "SmartLessonGenerationStageKind" AS ENUM ('OUTLINE', 'BRIDGE_IN', 'OBJECTIVES', 'PRE_ASSESSMENT', 'PARTICIPATORY_LEARNING', 'POST_ASSESSMENT', 'SUMMARY');
CREATE TYPE "SmartLessonGenerationStageState" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "SmartLessonProviderAttemptOutcome" AS ENUM ('RUNNING', 'SUCCEEDED', 'RETRYABLE_FAILURE', 'PERMANENT_FAILURE', 'CANCELLED');

CREATE TABLE "SmartLessonTask" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "courseBasisId" TEXT NOT NULL,
  "lineageId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "prerequisites" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "outlineConfirmationRequired" BOOLEAN NOT NULL DEFAULT false,
  "scopeConfirmedAt" TIMESTAMP(3),
  "goalsConfirmedAt" TIMESTAMP(3),
  "aggregateClassContext" JSONB,
  "aggregateClassContextRef" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartLessonTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartLessonTask_duration_check" CHECK ("durationMinutes" BETWEEN 30 AND 120 AND MOD("durationMinutes", 5) = 0)
);

CREATE TABLE "SmartLessonSourceSelection" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "sourceVersionId" TEXT NOT NULL,
  "state" "SmartLessonSourceSelectionState" NOT NULL DEFAULT 'SELECTED',
  "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "SmartLessonSourceSelection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartLessonKnowledgePoint" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "lineageId" TEXT NOT NULL,
  "state" "SmartLessonItemState" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "sourceState" "SmartLessonSourceState" NOT NULL,
  "sourceBindings" JSONB NOT NULL DEFAULT '[]',
  "sourceBindingSetHash" TEXT NOT NULL,
  "gapIdentity" TEXT,
  "origin" TEXT NOT NULL,
  "supersedesIds" TEXT[] NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartLessonKnowledgePoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartLessonKnowledgePoint_gap_check" CHECK (("sourceState" = 'VERIFIED' AND "gapIdentity" IS NULL) OR ("sourceState" <> 'VERIFIED' AND "gapIdentity" IS NOT NULL))
);

CREATE TABLE "SmartLessonGoal" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "lineageId" TEXT NOT NULL,
  "state" "SmartLessonItemState" NOT NULL DEFAULT 'DRAFT',
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "sourceState" "SmartLessonSourceState" NOT NULL,
  "sourceBindings" JSONB NOT NULL DEFAULT '[]',
  "sourceBindingSetHash" TEXT NOT NULL,
  "gapIdentity" TEXT,
  "standardsMappings" JSONB NOT NULL DEFAULT '[]',
  "confirmedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartLessonGoal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartLessonGoal_gap_check" CHECK (("sourceState" = 'VERIFIED' AND "gapIdentity" IS NULL) OR ("sourceState" <> 'VERIFIED' AND "gapIdentity" IS NOT NULL))
);

CREATE TABLE "SmartLessonDraft" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "state" "SmartLessonDraftState" NOT NULL DEFAULT 'EDITABLE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "content" JSONB,
  "contentHash" TEXT,
  "basedOnRevisionId" TEXT,
  "staleDownstreamAt" TIMESTAMP(3),
  "approvedRevisionNumber" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartLessonDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartLessonRevision" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "displayName" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "sourcesSnapshot" JSONB NOT NULL,
  "knowledgeSnapshot" JSONB NOT NULL,
  "goalsSnapshot" JSONB NOT NULL,
  "provenanceSnapshot" JSONB NOT NULL,
  "approvalIdempotencyKey" TEXT NOT NULL,
  "approvalRequestHash" TEXT NOT NULL,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartLessonRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartLessonRevision_number_check" CHECK ("revisionNumber" > 0)
);

CREATE TABLE "SmartLessonGenerationJob" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "taskRevision" INTEGER NOT NULL,
  "inputHash" TEXT NOT NULL,
  "deliveryGeneration" INTEGER NOT NULL DEFAULT 1,
  "state" "SmartLessonGenerationJobState" NOT NULL DEFAULT 'QUEUED',
  "outlineConfirmation" BOOLEAN NOT NULL DEFAULT false,
  "activeIdentity" TEXT,
  "firstIncompleteStage" "SmartLessonGenerationStageKind" NOT NULL DEFAULT 'OUTLINE',
  "failureCode" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "supersededByTaskRevision" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartLessonGenerationJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartLessonGenerationJob_task_revision_check" CHECK ("taskRevision" > 0),
  CONSTRAINT "SmartLessonGenerationJob_delivery_generation_check" CHECK ("deliveryGeneration" > 0),
  CONSTRAINT "SmartLessonGenerationJob_superseded_revision_check" CHECK ("supersededByTaskRevision" IS NULL OR "supersededByTaskRevision" > 0)
);

CREATE TABLE "SmartLessonGenerationStage" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "kind" "SmartLessonGenerationStageKind" NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "state" "SmartLessonGenerationStageState" NOT NULL DEFAULT 'PENDING',
  "attemptGeneration" INTEGER NOT NULL DEFAULT 0,
  "claimToken" TEXT,
  "claimExpiresAt" TIMESTAMP(3),
  "output" JSONB,
  "outputHash" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartLessonGenerationStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartLessonProviderAttempt" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "providerKind" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "requestSnapshot" JSONB NOT NULL,
  "normalizedResponseId" TEXT,
  "outcome" "SmartLessonProviderAttemptOutcome" NOT NULL DEFAULT 'RUNNING',
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "costMicros" BIGINT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "SmartLessonProviderAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartLessonGenerationCommand" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "resultSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartLessonGenerationCommand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartLessonAdvisoryReview" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'RUNNING',
  "failureCode" TEXT,
  "report" JSONB,
  "providerAudit" JSONB,
  "advisoryOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "SmartLessonAdvisoryReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartLessonAdvisoryReview_advisory_only_check" CHECK ("advisoryOnly" = true)
);

CREATE UNIQUE INDEX "SmartLessonTask_lineageId_key" ON "SmartLessonTask"("lineageId");
CREATE INDEX "SmartLessonTask_ownerId_updatedAt_idx" ON "SmartLessonTask"("ownerId", "updatedAt");
CREATE INDEX "SmartLessonTask_ownerId_courseBasisId_idx" ON "SmartLessonTask"("ownerId", "courseBasisId");
CREATE UNIQUE INDEX "SmartLessonSourceSelection_taskId_sourceVersionId_key" ON "SmartLessonSourceSelection"("taskId", "sourceVersionId");
CREATE INDEX "SmartLessonSourceSelection_ownerId_taskId_state_idx" ON "SmartLessonSourceSelection"("ownerId", "taskId", "state");
CREATE UNIQUE INDEX "SmartLessonKnowledgePoint_lineageId_key" ON "SmartLessonKnowledgePoint"("lineageId");
CREATE INDEX "SmartLessonKnowledgePoint_ownerId_taskId_state_idx" ON "SmartLessonKnowledgePoint"("ownerId", "taskId", "state");
CREATE INDEX "SmartLessonKnowledgePoint_taskId_gapIdentity_idx" ON "SmartLessonKnowledgePoint"("taskId", "gapIdentity");
CREATE UNIQUE INDEX "SmartLessonGoal_lineageId_key" ON "SmartLessonGoal"("lineageId");
CREATE INDEX "SmartLessonGoal_ownerId_taskId_state_idx" ON "SmartLessonGoal"("ownerId", "taskId", "state");
CREATE INDEX "SmartLessonGoal_taskId_gapIdentity_idx" ON "SmartLessonGoal"("taskId", "gapIdentity");
CREATE INDEX "SmartLessonDraft_ownerId_taskId_updatedAt_idx" ON "SmartLessonDraft"("ownerId", "taskId", "updatedAt");
CREATE UNIQUE INDEX "SmartLessonRevision_draftId_key" ON "SmartLessonRevision"("draftId");
CREATE UNIQUE INDEX "SmartLessonRevision_taskId_revisionNumber_key" ON "SmartLessonRevision"("taskId", "revisionNumber");
CREATE UNIQUE INDEX "SmartLessonRevision_ownerId_approvalIdempotencyKey_key" ON "SmartLessonRevision"("ownerId", "approvalIdempotencyKey");
CREATE INDEX "SmartLessonRevision_ownerId_taskId_revisionNumber_idx" ON "SmartLessonRevision"("ownerId", "taskId", "revisionNumber");
CREATE UNIQUE INDEX "SmartLessonGenerationJob_activeIdentity_key" ON "SmartLessonGenerationJob"("activeIdentity");
CREATE INDEX "SmartLessonGenerationJob_ownerId_draftId_createdAt_idx" ON "SmartLessonGenerationJob"("ownerId", "draftId", "createdAt");
CREATE UNIQUE INDEX "SmartLessonGenerationStage_jobId_kind_key" ON "SmartLessonGenerationStage"("jobId", "kind");
CREATE UNIQUE INDEX "SmartLessonGenerationStage_jobId_orderIndex_key" ON "SmartLessonGenerationStage"("jobId", "orderIndex");
CREATE INDEX "SmartLessonGenerationStage_ownerId_jobId_state_idx" ON "SmartLessonGenerationStage"("ownerId", "jobId", "state");
CREATE UNIQUE INDEX "SmartLessonProviderAttempt_ownerId_idempotencyKey_key" ON "SmartLessonProviderAttempt"("ownerId", "idempotencyKey");
CREATE UNIQUE INDEX "SmartLessonProviderAttempt_stageId_attemptNumber_key" ON "SmartLessonProviderAttempt"("stageId", "attemptNumber");
CREATE INDEX "SmartLessonProviderAttempt_ownerId_stageId_startedAt_idx" ON "SmartLessonProviderAttempt"("ownerId", "stageId", "startedAt");
CREATE UNIQUE INDEX "SmartLessonGenerationCommand_ownerId_action_idempotencyKey_key" ON "SmartLessonGenerationCommand"("ownerId", "action", "idempotencyKey");
CREATE INDEX "SmartLessonGenerationCommand_ownerId_jobId_createdAt_idx" ON "SmartLessonGenerationCommand"("ownerId", "jobId", "createdAt");
CREATE UNIQUE INDEX "SmartLessonAdvisoryReview_ownerId_idempotencyKey_key" ON "SmartLessonAdvisoryReview"("ownerId", "idempotencyKey");
CREATE INDEX "SmartLessonAdvisoryReview_ownerId_draftId_createdAt_idx" ON "SmartLessonAdvisoryReview"("ownerId", "draftId", "createdAt");

ALTER TABLE "SmartLessonTask" ADD CONSTRAINT "SmartLessonTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonTask" ADD CONSTRAINT "SmartLessonTask_courseBasisId_fkey" FOREIGN KEY ("courseBasisId") REFERENCES "CourseBasis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonSourceSelection" ADD CONSTRAINT "SmartLessonSourceSelection_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SmartLessonTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonSourceSelection" ADD CONSTRAINT "SmartLessonSourceSelection_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "CourseBasisDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonKnowledgePoint" ADD CONSTRAINT "SmartLessonKnowledgePoint_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SmartLessonTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonGoal" ADD CONSTRAINT "SmartLessonGoal_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SmartLessonTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonDraft" ADD CONSTRAINT "SmartLessonDraft_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SmartLessonTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonDraft" ADD CONSTRAINT "SmartLessonDraft_basedOnRevisionId_fkey" FOREIGN KEY ("basedOnRevisionId") REFERENCES "SmartLessonRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonRevision" ADD CONSTRAINT "SmartLessonRevision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SmartLessonTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonRevision" ADD CONSTRAINT "SmartLessonRevision_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "SmartLessonDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonRevision" ADD CONSTRAINT "SmartLessonRevision_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonGenerationJob" ADD CONSTRAINT "SmartLessonGenerationJob_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "SmartLessonDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonGenerationStage" ADD CONSTRAINT "SmartLessonGenerationStage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SmartLessonGenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonProviderAttempt" ADD CONSTRAINT "SmartLessonProviderAttempt_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "SmartLessonGenerationStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonGenerationCommand" ADD CONSTRAINT "SmartLessonGenerationCommand_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SmartLessonGenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartLessonAdvisoryReview" ADD CONSTRAINT "SmartLessonAdvisoryReview_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "SmartLessonDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_smart_lesson_revision_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SmartLessonRevision rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SmartLessonRevision_immutable"
BEFORE UPDATE OR DELETE ON "SmartLessonRevision"
FOR EACH ROW EXECUTE FUNCTION "reject_smart_lesson_revision_mutation"();
