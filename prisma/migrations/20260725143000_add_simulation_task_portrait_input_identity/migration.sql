ALTER TABLE "LearnerPortraitStateVersion"
ADD COLUMN "taskInputDigest" TEXT NOT NULL DEFAULT '';

ALTER TABLE "LearnerPortraitCurrentState"
ADD COLUMN "taskInputDigest" TEXT NOT NULL DEFAULT '';

DROP INDEX "LearnerPortraitState_user_calc_generation_watermark_key";

CREATE UNIQUE INDEX "LearnerPortraitState_user_calc_generation_watermark_task_key"
ON "LearnerPortraitStateVersion" (
  "userId",
  "calculationVersion",
  "generation",
  "stateWatermark",
  "taskInputDigest"
);
