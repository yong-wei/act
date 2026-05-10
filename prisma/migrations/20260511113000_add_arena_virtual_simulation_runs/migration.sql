-- CreateTable
CREATE TABLE "ArenaVirtualSimulationRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "datasetHash" TEXT NOT NULL,
    "controllerHash" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaVirtualSimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaVirtualSimulationRun_userId_taskId_createdAt_idx" ON "ArenaVirtualSimulationRun"("userId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaVirtualSimulationRun_taskId_controllerHash_idx" ON "ArenaVirtualSimulationRun"("taskId", "controllerHash");

-- CreateIndex
CREATE INDEX "ArenaVirtualSimulationRun_taskId_datasetHash_idx" ON "ArenaVirtualSimulationRun"("taskId", "datasetHash");

-- AddForeignKey
ALTER TABLE "ArenaVirtualSimulationRun" ADD CONSTRAINT "ArenaVirtualSimulationRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
