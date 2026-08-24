CREATE TYPE "AssignmentSubmissionGradeState" AS ENUM ('PENDING_GRADING', 'PARTIAL_FAILURE', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'RELEASED');
CREATE TYPE "AssignmentQuestionConclusionKind" AS ENUM ('UNANSWERED', 'EXEMPT');

CREATE TABLE "AssignmentSubmissionGrade" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "state" "AssignmentSubmissionGradeState" NOT NULL DEFAULT 'PENDING_GRADING',
  "questionProjection" JSONB NOT NULL DEFAULT '[]',
  "totalScore" DECIMAL(10,4),
  "confirmedById" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssignmentSubmissionGrade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentQuestionConclusion" (
  "id" TEXT NOT NULL,
  "gradeId" TEXT NOT NULL,
  "snapshotItemId" TEXT NOT NULL,
  "kind" "AssignmentQuestionConclusionKind" NOT NULL,
  "scoreEffect" DECIMAL(10,4) NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "authorizationSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssignmentQuestionConclusion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentSubmissionGradeConfirmation" (
  "id" TEXT NOT NULL,
  "gradeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "attemptVectorHash" TEXT NOT NULL,
  "totalScore" DECIMAL(10,4) NOT NULL,
  "questionProjection" JSONB NOT NULL,
  "confirmedById" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentSubmissionGradeConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssignmentSubmissionGrade_snapshotId_key" ON "AssignmentSubmissionGrade"("snapshotId");
CREATE INDEX "AssignmentSubmissionGrade_state_updatedAt_idx" ON "AssignmentSubmissionGrade"("state", "updatedAt");
CREATE INDEX "AssignmentSubmissionGrade_confirmedById_confirmedAt_idx" ON "AssignmentSubmissionGrade"("confirmedById", "confirmedAt");
CREATE UNIQUE INDEX "AssignmentQuestionConclusion_gradeId_snapshotItemId_key" ON "AssignmentQuestionConclusion"("gradeId", "snapshotItemId");
CREATE INDEX "AssignmentQuestionConclusion_actorId_createdAt_idx" ON "AssignmentQuestionConclusion"("actorId", "createdAt");
CREATE UNIQUE INDEX "AssignmentSubmissionGradeConfirmation_gradeId_version_key" ON "AssignmentSubmissionGradeConfirmation"("gradeId", "version");
CREATE UNIQUE INDEX "AssignmentSubmissionGradeConfirmation_gradeId_idempotencyKey_key" ON "AssignmentSubmissionGradeConfirmation"("gradeId", "idempotencyKey");
CREATE INDEX "AssignmentSubmissionGradeConfirmation_confirmedById_confirmedAt_idx" ON "AssignmentSubmissionGradeConfirmation"("confirmedById", "confirmedAt");

ALTER TABLE "AssignmentSubmissionGrade" ADD CONSTRAINT "AssignmentSubmissionGrade_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AssignmentSubmissionSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionGrade" ADD CONSTRAINT "AssignmentSubmissionGrade_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentQuestionConclusion" ADD CONSTRAINT "AssignmentQuestionConclusion_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "AssignmentSubmissionGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentQuestionConclusion" ADD CONSTRAINT "AssignmentQuestionConclusion_snapshotItemId_fkey" FOREIGN KEY ("snapshotItemId") REFERENCES "AssignmentSubmissionSnapshotItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentQuestionConclusion" ADD CONSTRAINT "AssignmentQuestionConclusion_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionGradeConfirmation" ADD CONSTRAINT "AssignmentSubmissionGradeConfirmation_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "AssignmentSubmissionGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionGradeConfirmation" ADD CONSTRAINT "AssignmentSubmissionGradeConfirmation_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
