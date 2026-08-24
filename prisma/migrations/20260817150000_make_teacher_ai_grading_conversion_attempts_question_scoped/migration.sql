ALTER TABLE "TeacherAiGradingConversionAttempt"
ADD COLUMN IF NOT EXISTS "questionId" TEXT;

-- Historical evaluation records are immutable and predate question-level attribution.
-- Their NULL attribution remains an explicit legacy state rather than fabricated data.

DROP INDEX IF EXISTS "TeacherAiGradingConversionAttempt_batch_sample_attempt_key";

CREATE UNIQUE INDEX "TeacherAiGradingConversionAttempt_batch_sample_question_attempt_key"
ON "TeacherAiGradingConversionAttempt"("batchId", "sampleId", "questionId", "attemptOrdinal");

CREATE INDEX "TeacherAiGradingConversionAttempt_batch_sample_question_idx"
ON "TeacherAiGradingConversionAttempt"("batchId", "sampleId", "questionId");
