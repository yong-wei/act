ALTER TABLE "GradingBatch"
  ADD COLUMN "visualPolicyId" TEXT,
  ADD COLUMN "visualPolicySnapshot" JSONB,
  ADD COLUMN "visualPolicySnapshotHash" TEXT;

ALTER TABLE "DocumentConversion"
  ADD COLUMN "visualPolicyId" TEXT,
  ADD COLUMN "visualPolicySnapshot" JSONB,
  ADD COLUMN "visualPolicySnapshotHash" TEXT;

ALTER TABLE "DocumentConversionVisualEvidence"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "policyVersion" TEXT,
  ADD COLUMN "providerRequestId" TEXT,
  ADD COLUMN "providerDeletionHandle" TEXT,
  ADD COLUMN "providerRequestedAt" TIMESTAMP(3),
  ADD COLUMN "providerProcessedAt" TIMESTAMP(3);

CREATE INDEX "GradingBatch_visualPolicyId_idx" ON "GradingBatch"("visualPolicyId");
CREATE INDEX "DocumentConversion_visualPolicyId_idx" ON "DocumentConversion"("visualPolicyId");

ALTER TABLE "GradingBatch"
  ADD CONSTRAINT "GradingBatch_visualPolicyId_fkey"
  FOREIGN KEY ("visualPolicyId") REFERENCES "GradingProviderPolicy"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentConversion"
  ADD CONSTRAINT "DocumentConversion_visualPolicyId_fkey"
  FOREIGN KEY ("visualPolicyId") REFERENCES "GradingProviderPolicy"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
