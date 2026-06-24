ALTER TABLE "LearningPath"
  ADD COLUMN "goalId" TEXT,
  ADD COLUMN "plannerVersion" TEXT,
  ADD COLUMN "pathStatus" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "currentNodeId" TEXT,
  ADD COLUMN "learnerStateRef" TEXT,
  ADD COLUMN "classId" TEXT,
  ADD COLUMN "inputSnapshot" JSONB,
  ADD COLUMN "pathPayload" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "explanationPayload" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "alternativePayload" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "entryNodeId" TEXT,
  ADD COLUMN "terminalValidation" JSONB,
  ADD COLUMN "lastExecutionMetadata" JSONB,
  ADD COLUMN "legacySummaryPayload" JSONB;

CREATE TABLE "LearningPathExecution" (
  "id" TEXT NOT NULL,
  "pathId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "evidenceRefs" JSONB NOT NULL DEFAULT '[]',
  "liftMetadata" JSONB NOT NULL DEFAULT '{}',
  "simulationRef" JSONB,
  "arenaRef" JSONB,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningPathExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningPathDeviation" (
  "id" TEXT NOT NULL,
  "pathId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviationType" TEXT NOT NULL,
  "priorNodeId" TEXT,
  "targetNodeId" TEXT,
  "context" JSONB NOT NULL DEFAULT '{}',
  "evidenceConfidence" TEXT NOT NULL DEFAULT 'unknown',
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningPathDeviation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningPathIntervention" (
  "id" TEXT NOT NULL,
  "pathId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "interventionKind" TEXT NOT NULL,
  "citedEvidence" JSONB NOT NULL DEFAULT '[]',
  "suggestedAction" TEXT NOT NULL,
  "studentOutcome" TEXT NOT NULL DEFAULT 'pending',
  "privacySafeSummary" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningPathIntervention_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearningPath_userId_goalId_pathStatus_idx" ON "LearningPath"("userId", "goalId", "pathStatus");
CREATE INDEX "LearningPath_classId_goalId_pathStatus_idx" ON "LearningPath"("classId", "goalId", "pathStatus");

CREATE UNIQUE INDEX "LearningPathExecution_pathId_idempotencyKey_key" ON "LearningPathExecution"("pathId", "idempotencyKey");
CREATE INDEX "LearningPathExecution_pathId_createdAt_idx" ON "LearningPathExecution"("pathId", "createdAt");
CREATE INDEX "LearningPathExecution_userId_nodeId_status_idx" ON "LearningPathExecution"("userId", "nodeId", "status");

CREATE UNIQUE INDEX "LearningPathDeviation_pathId_idempotencyKey_key" ON "LearningPathDeviation"("pathId", "idempotencyKey");
CREATE INDEX "LearningPathDeviation_pathId_createdAt_idx" ON "LearningPathDeviation"("pathId", "createdAt");
CREATE INDEX "LearningPathDeviation_userId_deviationType_createdAt_idx" ON "LearningPathDeviation"("userId", "deviationType", "createdAt");

CREATE UNIQUE INDEX "LearningPathIntervention_pathId_idempotencyKey_key" ON "LearningPathIntervention"("pathId", "idempotencyKey");
CREATE INDEX "LearningPathIntervention_pathId_createdAt_idx" ON "LearningPathIntervention"("pathId", "createdAt");
CREATE INDEX "LearningPathIntervention_userId_interventionKind_createdAt_idx" ON "LearningPathIntervention"("userId", "interventionKind", "createdAt");

ALTER TABLE "LearningPathExecution"
  ADD CONSTRAINT "LearningPathExecution_pathId_fkey"
  FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningPathDeviation"
  ADD CONSTRAINT "LearningPathDeviation_pathId_fkey"
  FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningPathIntervention"
  ADD CONSTRAINT "LearningPathIntervention_pathId_fkey"
  FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
