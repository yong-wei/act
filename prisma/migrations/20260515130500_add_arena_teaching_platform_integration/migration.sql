-- Persist teacher-published Arena challenge assignments and carry their context
-- through official submissions and learning-evidence materialization.

ALTER TABLE "LearningFact"
ADD COLUMN "contextJson" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "ArenaChallengePublication" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "leaderboardPolicyId" TEXT NOT NULL,
    "homeworkBinding" BOOLEAN NOT NULL DEFAULT false,
    "gradingPolicy" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaChallengePublication_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ArenaSubmission"
ADD COLUMN "publicationId" TEXT,
ADD COLUMN "isLate" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ArenaChallengePublication_teacherId_status_idx" ON "ArenaChallengePublication"("teacherId", "status");
CREATE INDEX "ArenaChallengePublication_classId_status_deadline_idx" ON "ArenaChallengePublication"("classId", "status", "deadline");
CREATE INDEX "ArenaChallengePublication_taskId_status_idx" ON "ArenaChallengePublication"("taskId", "status");
CREATE INDEX "ArenaChallengePublication_visibility_status_idx" ON "ArenaChallengePublication"("visibility", "status");

CREATE INDEX "ArenaSubmission_taskId_publicationId_idx" ON "ArenaSubmission"("taskId", "publicationId");
CREATE INDEX "ArenaSubmission_publicationId_submittedAt_idx" ON "ArenaSubmission"("publicationId", "submittedAt");

ALTER TABLE "ArenaChallengePublication"
ADD CONSTRAINT "ArenaChallengePublication_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ArenaChallengePublication"
ADD CONSTRAINT "ArenaChallengePublication_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ArenaSubmission"
ADD CONSTRAINT "ArenaSubmission_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "ArenaChallengePublication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
