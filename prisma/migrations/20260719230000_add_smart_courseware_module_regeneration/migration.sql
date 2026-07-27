CREATE TYPE "SmartCoursewareGenerationJobMode" AS ENUM ('INITIAL', 'MODULE');

ALTER TABLE "SmartCoursewareGenerationJob"
  ADD COLUMN "mode" "SmartCoursewareGenerationJobMode" NOT NULL DEFAULT 'INITIAL',
  ADD COLUMN "targetModuleId" TEXT,
  ADD COLUMN "targetModuleHash" TEXT,
  ADD COLUMN "sourceBindingsSnapshot" JSONB,
  ADD COLUMN "candidateRuntimeModule" JSONB,
  ADD COLUMN "candidateModuleMetadata" JSONB,
  ADD COLUMN "candidateHash" TEXT,
  ADD COLUMN "providerAudit" JSONB,
  ADD COLUMN "acceptedAt" TIMESTAMP(3);

ALTER TABLE "SmartCoursewareGenerationJob"
  ALTER COLUMN "firstIncompleteUnitKey" DROP NOT NULL;

ALTER TABLE "SmartCoursewareGenerationJob"
  DROP CONSTRAINT "SmartCoursewareGenerationJob_first_unit_check";

ALTER TABLE "SmartCoursewareGenerationJob"
  ADD CONSTRAINT "SmartCoursewareGenerationJob_first_unit_check" CHECK (
    ("mode" = 'MODULE' AND "firstIncompleteUnitKey" IS NULL)
    OR
    ("mode" = 'INITIAL' AND "firstIncompleteUnitKey" IN ('bridge-in', 'objective', 'pre-assessment', 'participatory-learning', 'post-assessment', 'summary'))
  );

ALTER TABLE "SmartCoursewareGenerationJob"
  ADD CONSTRAINT "SmartCoursewareGenerationJob_module_target_check" CHECK (
    ("mode" = 'INITIAL' AND "targetModuleId" IS NULL AND "targetModuleHash" IS NULL)
    OR
    ("mode" = 'MODULE' AND "targetModuleId" IS NOT NULL AND "targetModuleHash" IS NOT NULL)
  );

CREATE INDEX "SmartCoursewareGenerationJob_ownerId_mode_createdAt_idx"
  ON "SmartCoursewareGenerationJob"("ownerId", "mode", "createdAt");
