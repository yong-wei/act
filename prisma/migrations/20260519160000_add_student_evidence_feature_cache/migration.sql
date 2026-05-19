-- CreateTable
CREATE TABLE "StudentEvidenceFeatureCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payloadVersion" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "evidenceWindow" JSONB NOT NULL,
    "sourceCounts" JSONB NOT NULL,
    "sourceCoverage" JSONB NOT NULL,
    "freshness" JSONB NOT NULL,
    "confidenceMarkers" JSONB NOT NULL,
    "statusMarkers" JSONB NOT NULL,
    "sourceFactCount" INTEGER NOT NULL DEFAULT 0,
    "lastSourceFactAt" TIMESTAMP(3),
    "refreshedAt" TIMESTAMP(3) NOT NULL,
    "rebuiltAt" TIMESTAMP(3) NOT NULL,
    "rebuildCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEvidenceFeatureCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentEvidenceFeatureCache_userId_key" ON "StudentEvidenceFeatureCache"("userId");

-- CreateIndex
CREATE INDEX "StudentEvidenceFeatureCache_refreshedAt_idx" ON "StudentEvidenceFeatureCache"("refreshedAt");

-- CreateIndex
CREATE INDEX "StudentEvidenceFeatureCache_lastSourceFactAt_idx" ON "StudentEvidenceFeatureCache"("lastSourceFactAt");

-- CreateIndex
CREATE INDEX "StudentEvidenceFeatureCache_payloadVersion_idx" ON "StudentEvidenceFeatureCache"("payloadVersion");
