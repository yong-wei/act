-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountSource" TEXT NOT NULL DEFAULT 'PLATFORM';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_accountSource_role_idx" ON "User"("accountSource", "role");

-- AlterTable
ALTER TABLE "IlabExperimentRun"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "reportId" TEXT,
  ADD COLUMN IF NOT EXISTS "stepDrafts" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IlabExperimentRun_userId_vesselId_status_updatedAt_idx"
  ON "IlabExperimentRun"("userId", "vesselId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IlabExperimentRun_reportId_idx"
  ON "IlabExperimentRun"("reportId");

-- AddForeignKey
ALTER TABLE "IlabExperimentRun"
  ADD CONSTRAINT "IlabExperimentRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IlabExperimentRun"
  ADD CONSTRAINT "IlabExperimentRun_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "VirtualSimulationReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing iLab bound users
UPDATE "User"
SET "accountSource" = 'ILAB'
WHERE EXISTS (
  SELECT 1 FROM "Account"
  WHERE "Account"."userId" = "User"."id" AND "Account"."provider" = 'ilab-x'
);
