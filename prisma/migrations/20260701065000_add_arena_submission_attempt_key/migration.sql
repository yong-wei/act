ALTER TABLE "ArenaSubmission"
ADD COLUMN "submissionAttemptKey" TEXT;

CREATE UNIQUE INDEX "ArenaSubmission_submissionAttemptKey_key"
ON "ArenaSubmission"("submissionAttemptKey");
