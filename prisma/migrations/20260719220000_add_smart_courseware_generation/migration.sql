CREATE TYPE "SmartCoursewareGenerationJobState" AS ENUM ('QUEUED', 'RUNNING', 'RETRYABLE', 'FAILED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "SmartCoursewareGenerationUnitState" AS ENUM ('PENDING', 'RUNNING', 'RETRYABLE', 'FAILED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "SmartCoursewareProviderAttemptOutcome" AS ENUM ('RUNNING', 'SUCCEEDED', 'RETRYABLE_FAILURE', 'PERMANENT_FAILURE', 'CANCELLED');

CREATE TABLE "SmartCoursewareGenerationJob" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "planRevisionId" TEXT NOT NULL,
  "planContentHash" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "deliveryGeneration" INTEGER NOT NULL DEFAULT 1,
  "state" "SmartCoursewareGenerationJobState" NOT NULL DEFAULT 'QUEUED',
  "activeIdentity" TEXT,
  "firstIncompleteUnitKey" TEXT NOT NULL DEFAULT 'bridge-in',
  "failureCode" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartCoursewareGenerationJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewareGenerationJob_delivery_generation_check" CHECK ("deliveryGeneration" > 0),
  CONSTRAINT "SmartCoursewareGenerationJob_first_unit_check" CHECK ("firstIncompleteUnitKey" IN ('bridge-in', 'objective', 'pre-assessment', 'participatory-learning', 'post-assessment', 'summary'))
);

CREATE TABLE "SmartCoursewareGenerationUnit" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "unitKey" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "state" "SmartCoursewareGenerationUnitState" NOT NULL DEFAULT 'PENDING',
  "attemptGeneration" INTEGER NOT NULL DEFAULT 0,
  "claimToken" TEXT,
  "claimExpiresAt" TIMESTAMP(3),
  "output" JSONB,
  "outputHash" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartCoursewareGenerationUnit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewareGenerationUnit_key_check" CHECK ("unitKey" IN ('bridge-in', 'objective', 'pre-assessment', 'participatory-learning', 'post-assessment', 'summary')),
  CONSTRAINT "SmartCoursewareGenerationUnit_order_check" CHECK ("orderIndex" BETWEEN 0 AND 5),
  CONSTRAINT "SmartCoursewareGenerationUnit_attempt_generation_check" CHECK ("attemptGeneration" >= 0)
);

CREATE TABLE "SmartCoursewareProviderAttempt" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
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
  "outcome" "SmartCoursewareProviderAttemptOutcome" NOT NULL DEFAULT 'RUNNING',
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "costMicros" BIGINT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "SmartCoursewareProviderAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartCoursewareGenerationCommand" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "resultSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCoursewareGenerationCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartCoursewareGenerationJob_activeIdentity_key" ON "SmartCoursewareGenerationJob"("activeIdentity");
CREATE INDEX "SmartCoursewareGenerationJob_ownerId_draftId_createdAt_idx" ON "SmartCoursewareGenerationJob"("ownerId", "draftId", "createdAt");
CREATE UNIQUE INDEX "SmartCoursewareGenerationUnit_jobId_unitKey_key" ON "SmartCoursewareGenerationUnit"("jobId", "unitKey");
CREATE UNIQUE INDEX "SmartCoursewareGenerationUnit_jobId_orderIndex_key" ON "SmartCoursewareGenerationUnit"("jobId", "orderIndex");
CREATE INDEX "SmartCoursewareGenerationUnit_ownerId_jobId_state_idx" ON "SmartCoursewareGenerationUnit"("ownerId", "jobId", "state");
CREATE UNIQUE INDEX "SmartCoursewareProviderAttempt_ownerId_idempotencyKey_key" ON "SmartCoursewareProviderAttempt"("ownerId", "idempotencyKey");
CREATE UNIQUE INDEX "SmartCoursewareProviderAttempt_unitId_attemptNumber_key" ON "SmartCoursewareProviderAttempt"("unitId", "attemptNumber");
CREATE INDEX "SmartCoursewareProviderAttempt_ownerId_unitId_startedAt_idx" ON "SmartCoursewareProviderAttempt"("ownerId", "unitId", "startedAt");
CREATE UNIQUE INDEX "SmartCoursewareGenerationCommand_ownerId_action_idempotencyKey_key" ON "SmartCoursewareGenerationCommand"("ownerId", "action", "idempotencyKey");
CREATE INDEX "SmartCoursewareGenerationCommand_ownerId_jobId_createdAt_idx" ON "SmartCoursewareGenerationCommand"("ownerId", "jobId", "createdAt");

ALTER TABLE "SmartCoursewareGenerationJob" ADD CONSTRAINT "SmartCoursewareGenerationJob_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "SmartCoursewareDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareGenerationUnit" ADD CONSTRAINT "SmartCoursewareGenerationUnit_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SmartCoursewareGenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareProviderAttempt" ADD CONSTRAINT "SmartCoursewareProviderAttempt_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "SmartCoursewareGenerationUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareGenerationCommand" ADD CONSTRAINT "SmartCoursewareGenerationCommand_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SmartCoursewareGenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
