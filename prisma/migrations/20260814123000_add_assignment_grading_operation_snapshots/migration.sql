CREATE TYPE "AssignmentGradingOperationState" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'BLOCKED');

CREATE TABLE "AssignmentGradingOperation" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "assignmentRevisionId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "selectionSnapshot" JSONB NOT NULL,
  "state" "AssignmentGradingOperationState" NOT NULL DEFAULT 'QUEUED',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssignmentGradingOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentSubmissionSnapshot" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "assignmentRevisionId" TEXT NOT NULL,
  "frozenAudienceId" TEXT NOT NULL,
  "frozenAudienceClassId" TEXT NOT NULL,
  "originalDueAt" TIMESTAMP(3) NOT NULL,
  "submissionState" TEXT NOT NULL,
  "attemptVectorHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentSubmissionSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentSubmissionSnapshotItem" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "answerId" TEXT,
  "attemptId" TEXT,
  "attemptNumber" INTEGER,
  "answerVersion" INTEGER,
  "questionSnapshotHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentSubmissionSnapshotItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GradingBatch" ADD COLUMN "assignmentGradingOperationId" TEXT;

CREATE UNIQUE INDEX "AssignmentGradingOperation_dedupeKey_key" ON "AssignmentGradingOperation"("dedupeKey");
CREATE UNIQUE INDEX "AssignmentGradingOperation_requesterUserId_idempotencyKey_key" ON "AssignmentGradingOperation"("requesterUserId", "idempotencyKey");
CREATE INDEX "AssignmentGradingOperation_assignmentRevisionId_state_updatedAt_idx" ON "AssignmentGradingOperation"("assignmentRevisionId", "state", "updatedAt");
CREATE INDEX "AssignmentGradingOperation_assignmentId_createdAt_idx" ON "AssignmentGradingOperation"("assignmentId", "createdAt");
CREATE UNIQUE INDEX "AssignmentSubmissionSnapshot_operationId_submissionId_key" ON "AssignmentSubmissionSnapshot"("operationId", "submissionId");
CREATE INDEX "AssignmentSubmissionSnapshot_submissionId_createdAt_idx" ON "AssignmentSubmissionSnapshot"("submissionId", "createdAt");
CREATE INDEX "AssignmentSubmissionSnapshot_assignmentRevisionId_frozenAudienceClassId_originalDueAt_idx" ON "AssignmentSubmissionSnapshot"("assignmentRevisionId", "frozenAudienceClassId", "originalDueAt");
CREATE UNIQUE INDEX "AssignmentSubmissionSnapshotItem_snapshotId_questionId_key" ON "AssignmentSubmissionSnapshotItem"("snapshotId", "questionId");
CREATE INDEX "AssignmentSubmissionSnapshotItem_attemptId_idx" ON "AssignmentSubmissionSnapshotItem"("attemptId");
CREATE INDEX "AssignmentSubmissionSnapshotItem_questionId_snapshotId_idx" ON "AssignmentSubmissionSnapshotItem"("questionId", "snapshotId");
CREATE INDEX "GradingBatch_assignmentGradingOperationId_state_idx" ON "GradingBatch"("assignmentGradingOperationId", "state");

ALTER TABLE "AssignmentGradingOperation" ADD CONSTRAINT "AssignmentGradingOperation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentGradingOperation" ADD CONSTRAINT "AssignmentGradingOperation_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentGradingOperation" ADD CONSTRAINT "AssignmentGradingOperation_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionSnapshot" ADD CONSTRAINT "AssignmentSubmissionSnapshot_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "AssignmentGradingOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionSnapshot" ADD CONSTRAINT "AssignmentSubmissionSnapshot_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionSnapshot" ADD CONSTRAINT "AssignmentSubmissionSnapshot_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionSnapshotItem" ADD CONSTRAINT "AssignmentSubmissionSnapshotItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AssignmentSubmissionSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionSnapshotItem" ADD CONSTRAINT "AssignmentSubmissionSnapshotItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssignmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionSnapshotItem" ADD CONSTRAINT "AssignmentSubmissionSnapshotItem_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "SubmissionAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionSnapshotItem" ADD CONSTRAINT "AssignmentSubmissionSnapshotItem_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingBatch" ADD CONSTRAINT "GradingBatch_assignmentGradingOperationId_fkey" FOREIGN KEY ("assignmentGradingOperationId") REFERENCES "AssignmentGradingOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
