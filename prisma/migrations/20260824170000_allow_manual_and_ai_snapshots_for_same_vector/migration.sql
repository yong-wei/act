ALTER TABLE "AssignmentSubmissionSnapshot"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'AI';

UPDATE "AssignmentSubmissionSnapshot" AS snapshot
SET "source" = 'MANUAL'
FROM "AssignmentGradingOperation" AS operation
WHERE snapshot."operationId" = operation."id"
  AND operation."selectionSnapshot" ->> 'version' = 'assignment-manual-grading.v1';

DROP INDEX "AssignmentSubmissionSnapshot_submissionId_attemptVectorHash_key";

CREATE UNIQUE INDEX "AssignmentSubmissionSnapshot_ai_submissionId_attemptVectorHash_key"
ON "AssignmentSubmissionSnapshot"("submissionId", "attemptVectorHash")
WHERE "source" = 'AI';
