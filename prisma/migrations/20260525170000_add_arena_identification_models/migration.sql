-- CreateTable
CREATE TABLE "ArenaIdentificationModel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "datasetHash" TEXT NOT NULL,
    "sourceExperimentId" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "validationSummary" JSONB NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaIdentificationModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArenaIdentificationModel_userId_taskId_sourceExperimentId_key" ON "ArenaIdentificationModel"("userId", "taskId", "sourceExperimentId");

-- CreateIndex
CREATE INDEX "ArenaIdentificationModel_userId_taskId_createdAt_idx" ON "ArenaIdentificationModel"("userId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaIdentificationModel_taskId_datasetHash_idx" ON "ArenaIdentificationModel"("taskId", "datasetHash");

-- CreateIndex
CREATE INDEX "ArenaIdentificationModel_sourceExperimentId_idx" ON "ArenaIdentificationModel"("sourceExperimentId");

-- AddForeignKey
ALTER TABLE "ArenaIdentificationModel" ADD CONSTRAINT "ArenaIdentificationModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaIdentificationModel" ADD CONSTRAINT "ArenaIdentificationModel_sourceExperimentId_fkey" FOREIGN KEY ("sourceExperimentId") REFERENCES "ArenaBlackBoxExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
