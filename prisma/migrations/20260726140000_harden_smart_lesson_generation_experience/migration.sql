CREATE TYPE "SmartLessonGenerationActionState" AS ENUM (
  'WAITING',
  'PREPARING_EVIDENCE',
  'GENERATING',
  'VALIDATING',
  'AUTO_FIXING',
  'WAITING_CONFIRMATION',
  'RETRYABLE',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "SmartLessonProviderAttemptKind" AS ENUM ('ORIGINAL', 'CORRECTION');

ALTER TABLE "SmartLessonGenerationStage"
  ADD COLUMN "actionState" "SmartLessonGenerationActionState" NOT NULL DEFAULT 'WAITING',
  ADD COLUMN "providerAttemptGeneration" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "SmartLessonProviderAttempt"
  ADD COLUMN "kind" "SmartLessonProviderAttemptKind" NOT NULL DEFAULT 'ORIGINAL',
  ADD COLUMN "providerAttemptGeneration" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "deliveryGeneration" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "validationReceipt" JSONB,
  ADD COLUMN "correctsAttemptId" TEXT;

UPDATE "SmartLessonProviderAttempt"
SET "providerAttemptGeneration" = "attemptNumber";

UPDATE "SmartLessonGenerationStage" AS stage
SET "providerAttemptGeneration" = GREATEST(
  1,
  COALESCE((
    SELECT MAX(attempt."providerAttemptGeneration")
    FROM "SmartLessonProviderAttempt" AS attempt
    WHERE attempt."stageId" = stage."id"
  ), 1)
);

UPDATE "SmartLessonGenerationStage"
SET "actionState" = CASE
  WHEN "state" = 'RUNNING' THEN 'GENERATING'::"SmartLessonGenerationActionState"
  WHEN "state" = 'PAUSED' THEN 'WAITING_CONFIRMATION'::"SmartLessonGenerationActionState"
  WHEN "state" IN ('RETRYABLE', 'FAILED') THEN 'RETRYABLE'::"SmartLessonGenerationActionState"
  WHEN "state" = 'COMPLETED' THEN 'COMPLETED'::"SmartLessonGenerationActionState"
  WHEN "state" = 'CANCELLED' THEN 'CANCELLED'::"SmartLessonGenerationActionState"
  ELSE 'WAITING'::"SmartLessonGenerationActionState"
END;

ALTER TABLE "SmartLessonProviderAttempt"
  ADD CONSTRAINT "SmartLessonProviderAttempt_correctsAttemptId_fkey"
  FOREIGN KEY ("correctsAttemptId") REFERENCES "SmartLessonProviderAttempt"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SmartLessonProviderAttempt_stageId_providerAttemptGeneration_kind_key"
  ON "SmartLessonProviderAttempt"("stageId", "providerAttemptGeneration", "kind");

ALTER TABLE "SmartLessonGenerationStage"
  ADD CONSTRAINT "SmartLessonGenerationStage_provider_attempt_generation_check"
  CHECK ("providerAttemptGeneration" >= 1);

ALTER TABLE "SmartLessonProviderAttempt"
  ADD CONSTRAINT "SmartLessonProviderAttempt_generation_identity_check"
  CHECK ("providerAttemptGeneration" >= 1 AND "deliveryGeneration" >= 1);

ALTER TABLE "SmartLessonProviderAttempt"
  ADD CONSTRAINT "SmartLessonProviderAttempt_correction_link_check"
  CHECK (
    ("kind" = 'ORIGINAL' AND "correctsAttemptId" IS NULL)
    OR ("kind" = 'CORRECTION' AND "correctsAttemptId" IS NOT NULL)
  );
