-- 生效运行信封（issue-2152 记录类型 A 的生效配置部分）。
CREATE TABLE "AppliedRunEnvelope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "runRef" TEXT NOT NULL,
    "stepKey" TEXT,
    "courseVersion" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "parameterBundleHash" TEXT,
    "environmentVersion" TEXT,
    "sensorVersion" TEXT,
    "seed" BIGINT,
    "substreamIds" JSONB,
    "initialState" JSONB NOT NULL,
    "appliedFactorMask" JSONB NOT NULL,
    "controllerArtifactHash" TEXT,
    "simulationStartMs" BIGINT NOT NULL,
    "simulationEndMs" BIGINT,
    "terminationReason" TEXT,
    "quality" JSONB NOT NULL,
    "firstSampleReceipt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppliedRunEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppliedRunEnvelope_runRef_key" ON "AppliedRunEnvelope"("runRef");

-- CreateIndex
CREATE INDEX "AppliedRunEnvelope_userId_experimentKey_createdAt_idx" ON "AppliedRunEnvelope"("userId", "experimentKey", "createdAt");

-- AddForeignKey
ALTER TABLE "AppliedRunEnvelope" ADD CONSTRAINT "AppliedRunEnvelope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
