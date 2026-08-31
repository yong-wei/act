ALTER TABLE "TeacherAiGradingHiddenAcceptance"
DROP CONSTRAINT IF EXISTS "TeacherAiGradingHiddenAcceptance_state_shape_check";

ALTER TABLE "TeacherAiGradingHiddenAcceptance"
ADD CONSTRAINT "TeacherAiGradingHiddenAcceptance_state_shape_check" CHECK (
  (
    "state" = 'SEALED'
    AND "configId" IS NULL AND "batchId" IS NULL
    AND "startKey" IS NULL AND "startRequestHash" IS NULL
    AND "startedAt" IS NULL AND "consumedAt" IS NULL
  ) OR (
    "state" = 'RUNNING'
    AND "configId" IS NOT NULL
    AND "startKey" IS NOT NULL AND "startRequestHash" IS NOT NULL
    AND "startedAt" IS NOT NULL AND "consumedAt" IS NULL
  ) OR (
    "state" = 'CONSUMED'
    AND "configId" IS NOT NULL AND "batchId" IS NOT NULL
    AND "startKey" IS NOT NULL AND "startRequestHash" IS NOT NULL
    AND "startedAt" IS NOT NULL AND "consumedAt" IS NOT NULL
  )
);
