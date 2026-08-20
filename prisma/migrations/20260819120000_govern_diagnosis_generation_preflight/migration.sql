ALTER TABLE "DiagnosisGenerationJob"
  ADD COLUMN "ruleVersion" TEXT,
  ADD COLUMN "generationReason" TEXT,
  ADD COLUMN "forceReason" TEXT,
  ADD COLUMN "previousReportId" TEXT,
  ADD COLUMN "inputSummary" JSONB,
  ADD COLUMN "governedInput" JSONB,
  ADD COLUMN "inputDigest" TEXT,
  ADD COLUMN "ordinaryGenerationIdentity" TEXT;

ALTER TABLE "DiagnosisReport"
  ADD COLUMN "ruleVersion" TEXT,
  ADD COLUMN "generationReason" TEXT,
  ADD COLUMN "forceReason" TEXT,
  ADD COLUMN "previousReportId" TEXT,
  ADD COLUMN "inputSummary" JSONB,
  ADD COLUMN "inputDigest" TEXT;

CREATE UNIQUE INDEX "DiagnosisGenerationJob_ordinaryGenerationIdentity_key"
  ON "DiagnosisGenerationJob"("ordinaryGenerationIdentity");
CREATE INDEX "DiagnosisGenerationJob_previousReportId_idx"
  ON "DiagnosisGenerationJob"("previousReportId");
CREATE INDEX "DiagnosisReport_previousReportId_idx"
  ON "DiagnosisReport"("previousReportId");

ALTER TABLE "DiagnosisGenerationJob"
  ADD CONSTRAINT "DiagnosisGenerationJob_previousReportId_fkey"
  FOREIGN KEY ("previousReportId") REFERENCES "DiagnosisReport"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiagnosisReport"
  ADD CONSTRAINT "DiagnosisReport_previousReportId_fkey"
  FOREIGN KEY ("previousReportId") REFERENCES "DiagnosisReport"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
