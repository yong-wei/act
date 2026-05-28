-- Add canonical simulation task, run, and trace contracts.

ALTER TABLE "ArenaVirtualSimulationRun" ADD COLUMN "simulationRunId" TEXT;

CREATE TABLE "SimulationTaskSpec" (
    "id" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "specHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "launchContext" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationTaskSpec_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "classId" TEXT,
    "courseId" TEXT,
    "sessionId" TEXT,
    "resourceId" TEXT,
    "publicationId" TEXT,
    "runKind" TEXT NOT NULL,
    "sourceDomain" TEXT NOT NULL,
    "sourceRefId" TEXT NOT NULL,
    "taskSpecId" TEXT,
    "taskSpecSnapshot" JSONB,
    "controllerSnapshotRef" TEXT,
    "status" TEXT NOT NULL,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "replayToken" TEXT,
    "seed" BIGINT,
    "protocolVersion" TEXT NOT NULL,
    "runtimeVersion" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "sceneSpecVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SimulationTrace" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "runtimeVersion" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "seed" BIGINT,
    "checksum" TEXT NOT NULL,
    "summaryMetrics" JSONB NOT NULL DEFAULT '{}',
    "sampleCount" INTEGER NOT NULL,
    "sampleCadence" DOUBLE PRECISION NOT NULL,
    "sampleStorageUri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationTrace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SimulationTaskSpec_specHash_key" ON "SimulationTaskSpec"("specHash");
CREATE INDEX "SimulationTaskSpec_sceneId_scenarioId_idx" ON "SimulationTaskSpec"("sceneId", "scenarioId");
CREATE INDEX "SimulationTaskSpec_createdAt_idx" ON "SimulationTaskSpec"("createdAt");

CREATE INDEX "SimulationRun_ownerUserId_createdAt_idx" ON "SimulationRun"("ownerUserId", "createdAt");
CREATE INDEX "SimulationRun_classId_createdAt_idx" ON "SimulationRun"("classId", "createdAt");
CREATE INDEX "SimulationRun_runKind_status_createdAt_idx" ON "SimulationRun"("runKind", "status", "createdAt");
CREATE UNIQUE INDEX "SimulationRun_sourceDomain_sourceRefId_key" ON "SimulationRun"("sourceDomain", "sourceRefId");
CREATE INDEX "SimulationRun_taskSpecId_idx" ON "SimulationRun"("taskSpecId");

CREATE UNIQUE INDEX "ArenaVirtualSimulationRun_simulationRunId_key" ON "ArenaVirtualSimulationRun"("simulationRunId");

CREATE INDEX "SimulationTrace_runId_createdAt_idx" ON "SimulationTrace"("runId", "createdAt");
CREATE INDEX "SimulationTrace_checksum_idx" ON "SimulationTrace"("checksum");

ALTER TABLE "ArenaVirtualSimulationRun" ADD CONSTRAINT "ArenaVirtualSimulationRun_simulationRunId_fkey" FOREIGN KEY ("simulationRunId") REFERENCES "SimulationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_taskSpecId_fkey" FOREIGN KEY ("taskSpecId") REFERENCES "SimulationTaskSpec"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SimulationTrace" ADD CONSTRAINT "SimulationTrace_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
