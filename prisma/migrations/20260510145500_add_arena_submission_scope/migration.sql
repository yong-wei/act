-- Add optional scope fields used by class and season Arena leaderboards.
ALTER TABLE "ArenaSubmission"
ADD COLUMN "classId" TEXT,
ADD COLUMN "seasonId" TEXT;

CREATE INDEX "ArenaSubmission_taskId_classId_idx" ON "ArenaSubmission"("taskId", "classId");
CREATE INDEX "ArenaSubmission_taskId_seasonId_idx" ON "ArenaSubmission"("taskId", "seasonId");
