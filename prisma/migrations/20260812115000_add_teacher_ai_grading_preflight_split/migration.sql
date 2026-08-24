ALTER TABLE "TeacherAiGradingLabSplit"
  ADD COLUMN "preflight" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TeacherAiGradingLabSplit"
  DROP CONSTRAINT "TeacherAiGradingLabSplit_count_check",
  ADD CONSTRAINT "TeacherAiGradingLabSplit_count_check" CHECK (
    (
      "preflight" = false
      AND "sampleCount" > 1
      AND "tuningCount" > 0
      AND "hiddenCount" > 0
      AND "sampleCount" = "tuningCount" + "hiddenCount"
    )
    OR
    (
      "preflight" = true
      AND "sampleCount" = 2
      AND "tuningCount" = 2
      AND "hiddenCount" = 0
    )
  );
