-- CreateTable
CREATE TABLE IF NOT EXISTS "DiagnosisReport" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportBody" JSONB NOT NULL,
    "riskSummary" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatorVersion" TEXT NOT NULL DEFAULT 'v1',

    CONSTRAINT "DiagnosisReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DiagnosisReport_scopeType_scopeId_generatedAt_idx" ON "DiagnosisReport"("scopeType", "scopeId", "generatedAt");
CREATE INDEX IF NOT EXISTS "DiagnosisReport_userId_idx" ON "DiagnosisReport"("userId");
