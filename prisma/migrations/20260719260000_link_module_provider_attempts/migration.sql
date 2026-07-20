ALTER TABLE "SmartCoursewareProviderAttempt"
  ADD COLUMN "generationJobId" TEXT;

UPDATE "SmartCoursewareProviderAttempt" AS attempt
SET "generationJobId" = unit."jobId"
FROM "SmartCoursewareGenerationUnit" AS unit
WHERE attempt."unitId" = unit."id";

ALTER TABLE "SmartCoursewareProviderAttempt"
  ALTER COLUMN "generationJobId" SET NOT NULL,
  ALTER COLUMN "unitId" DROP NOT NULL;

CREATE INDEX "SmartCoursewareProviderAttempt_generationJobId_attemptNumber_idx"
  ON "SmartCoursewareProviderAttempt"("generationJobId", "attemptNumber");

ALTER TABLE "SmartCoursewareProviderAttempt"
  ADD CONSTRAINT "SmartCoursewareProviderAttempt_generationJobId_fkey"
  FOREIGN KEY ("generationJobId") REFERENCES "SmartCoursewareGenerationJob"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SmartCoursewareProviderAttempt"
  ADD CONSTRAINT "SmartCoursewareProviderAttempt_unit_scope_check"
  CHECK ("unitId" IS NOT NULL OR "idempotencyKey" LIKE 'smart-courseware-module:%');
