CREATE TABLE "AdminOperationLedger" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "outcome" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "sourceFileHash" TEXT,
  "artifactRefs" JSONB NOT NULL DEFAULT '[]',
  "retentionPolicy" JSONB NOT NULL DEFAULT '{}',
  "rollback" JSONB NOT NULL DEFAULT '{}',
  "auditSummary" TEXT NOT NULL,
  "recoveryState" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminOperationLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminOperationArtifact" (
  "id" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "authorizedRoles" JSONB NOT NULL DEFAULT '[]',
  "piiMinimized" BOOLEAN NOT NULL DEFAULT true,
  "rowCount" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminOperationArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminOperationLedger_operationId_key" ON "AdminOperationLedger"("operationId");
CREATE UNIQUE INDEX "AdminOperationLedger_idempotencyKey_key" ON "AdminOperationLedger"("idempotencyKey");
CREATE INDEX "AdminOperationLedger_actorId_createdAt_idx" ON "AdminOperationLedger"("actorId", "createdAt");
CREATE INDEX "AdminOperationLedger_kind_createdAt_idx" ON "AdminOperationLedger"("kind", "createdAt");
CREATE INDEX "AdminOperationLedger_scope_createdAt_idx" ON "AdminOperationLedger"("scope", "createdAt");

CREATE UNIQUE INDEX "AdminOperationArtifact_artifactId_key" ON "AdminOperationArtifact"("artifactId");
CREATE INDEX "AdminOperationArtifact_operationId_idx" ON "AdminOperationArtifact"("operationId");
CREATE INDEX "AdminOperationArtifact_expiresAt_idx" ON "AdminOperationArtifact"("expiresAt");
