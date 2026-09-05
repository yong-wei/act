-- Issue #1963: class diagnosis report metric snapshots.
-- New table only; legacy reports intentionally have no snapshot row and are
-- degraded explicitly by the evolution read path (no backfill, no recompute).
CREATE TABLE "DiagnosisMetricSnapshot" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "computationVersion" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "memberSetFingerprint" TEXT NOT NULL,
    "evidenceCutoff" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagnosisMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagnosisMetricSnapshot_reportId_key" ON "DiagnosisMetricSnapshot"("reportId");
CREATE INDEX "DiagnosisMetricSnapshot_scopeType_scopeId_generatedAt_idx" ON "DiagnosisMetricSnapshot"("scopeType", "scopeId", "generatedAt");

ALTER TABLE "DiagnosisMetricSnapshot" ADD CONSTRAINT "DiagnosisMetricSnapshot_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DiagnosisReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
