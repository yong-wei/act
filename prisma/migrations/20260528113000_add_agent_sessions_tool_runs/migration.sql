-- Add durable Konling agent task sessions and audited tool-run records.

CREATE TABLE "AgentSession" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "classId" TEXT,
  "courseId" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "resourceId" TEXT,
  "pathNodeId" TEXT,
  "phase" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "stateJson" JSONB NOT NULL DEFAULT '{}',
  "permittedTools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "pendingApproval" JSONB,
  "expiresAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentToolRun" (
  "id" TEXT NOT NULL,
  "agentSessionId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "classId" TEXT,
  "courseId" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "resourceId" TEXT,
  "pathNodeId" TEXT,
  "toolName" TEXT NOT NULL,
  "permissionTier" TEXT NOT NULL,
  "approvalState" TEXT NOT NULL DEFAULT 'not_required',
  "status" TEXT NOT NULL DEFAULT 'running',
  "inputSummary" JSONB NOT NULL DEFAULT '{}',
  "outputSummary" JSONB,
  "errorSummary" JSONB,
  "idempotencyKey" TEXT,
  "correlationId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "latencyMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgentToolRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentToolRun_ownerUserId_toolName_idempotencyKey_key"
  ON "AgentToolRun"("ownerUserId", "toolName", "idempotencyKey");

CREATE INDEX "AgentSession_ownerUserId_status_updatedAt_idx" ON "AgentSession"("ownerUserId", "status", "updatedAt");
CREATE INDEX "AgentSession_ownerUserId_courseId_pageId_idx" ON "AgentSession"("ownerUserId", "courseId", "pageId");
CREATE INDEX "AgentSession_classId_idx" ON "AgentSession"("classId");
CREATE INDEX "AgentSession_resourceId_idx" ON "AgentSession"("resourceId");
CREATE INDEX "AgentSession_pathNodeId_idx" ON "AgentSession"("pathNodeId");
CREATE INDEX "AgentSession_expiresAt_idx" ON "AgentSession"("expiresAt");

CREATE INDEX "AgentToolRun_agentSessionId_startedAt_idx" ON "AgentToolRun"("agentSessionId", "startedAt");
CREATE INDEX "AgentToolRun_ownerUserId_toolName_startedAt_idx" ON "AgentToolRun"("ownerUserId", "toolName", "startedAt");
CREATE INDEX "AgentToolRun_ownerUserId_status_startedAt_idx" ON "AgentToolRun"("ownerUserId", "status", "startedAt");
CREATE INDEX "AgentToolRun_ownerUserId_courseId_pageId_idx" ON "AgentToolRun"("ownerUserId", "courseId", "pageId");
CREATE INDEX "AgentToolRun_classId_idx" ON "AgentToolRun"("classId");
CREATE INDEX "AgentToolRun_resourceId_idx" ON "AgentToolRun"("resourceId");
CREATE INDEX "AgentToolRun_pathNodeId_idx" ON "AgentToolRun"("pathNodeId");

ALTER TABLE "AgentSession"
  ADD CONSTRAINT "AgentSession_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentSession"
  ADD CONSTRAINT "AgentSession_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentToolRun"
  ADD CONSTRAINT "AgentToolRun_agentSessionId_fkey" FOREIGN KEY ("agentSessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentToolRun"
  ADD CONSTRAINT "AgentToolRun_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentToolRun"
  ADD CONSTRAINT "AgentToolRun_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentToolRun"
  ADD CONSTRAINT "AgentToolRun_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
