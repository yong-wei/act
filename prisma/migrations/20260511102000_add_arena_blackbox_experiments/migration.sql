-- CreateTable
CREATE TABLE "ArenaBlackBoxExperiment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "datasetHash" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "budgetCost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaBlackBoxExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaBlackBoxExperiment_userId_taskId_createdAt_idx" ON "ArenaBlackBoxExperiment"("userId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaBlackBoxExperiment_taskId_datasetHash_idx" ON "ArenaBlackBoxExperiment"("taskId", "datasetHash");

-- AddForeignKey
ALTER TABLE "ArenaBlackBoxExperiment" ADD CONSTRAINT "ArenaBlackBoxExperiment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
