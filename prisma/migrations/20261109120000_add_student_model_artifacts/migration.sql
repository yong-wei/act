-- 学生的有版本辨识模型工件（issue-2152 记录类型 B）。
-- 只增不改：重新辨识生成同 lineage 的新 version 行。
CREATE TABLE "StudentModelArtifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "lineageKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "structure" JSONB NOT NULL,
    "ioContract" JSONB NOT NULL,
    "operatingPoint" JSONB NOT NULL,
    "identification" JSONB NOT NULL,
    "trainingRuns" JSONB NOT NULL,
    "validationRuns" JSONB NOT NULL,
    "sampleDt" DOUBLE PRECISION NOT NULL,
    "contentHash" TEXT NOT NULL,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentModelArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonArtifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "studentModelId" TEXT NOT NULL,
    "physicalRunRef" TEXT NOT NULL,
    "controllerArtifactHash" TEXT,
    "inputSource" TEXT NOT NULL,
    "alignmentWindow" JSONB NOT NULL,
    "factorFlags" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "curveRefs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentModelArtifact_userId_experimentKey_lineageKey_version_key" ON "StudentModelArtifact"("userId", "experimentKey", "lineageKey", "version");

-- CreateIndex
CREATE INDEX "StudentModelArtifact_userId_experimentKey_frozenAt_idx" ON "StudentModelArtifact"("userId", "experimentKey", "frozenAt");

-- CreateIndex
CREATE INDEX "ComparisonArtifact_userId_experimentKey_createdAt_idx" ON "ComparisonArtifact"("userId", "experimentKey", "createdAt");

-- CreateIndex
CREATE INDEX "ComparisonArtifact_studentModelId_idx" ON "ComparisonArtifact"("studentModelId");

-- AddForeignKey
ALTER TABLE "StudentModelArtifact" ADD CONSTRAINT "StudentModelArtifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonArtifact" ADD CONSTRAINT "ComparisonArtifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonArtifact" ADD CONSTRAINT "ComparisonArtifact_studentModelId_fkey" FOREIGN KEY ("studentModelId") REFERENCES "StudentModelArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
