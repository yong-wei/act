ALTER TYPE "GradingRunState" ADD VALUE IF NOT EXISTS 'APPROVED';

ALTER TABLE "GradingCriterionAssessment"
  ADD COLUMN "teacherLevelId" TEXT,
  ADD COLUMN "teacherScore" DOUBLE PRECISION,
  ADD COLUMN "teacherComment" TEXT,
  ADD COLUMN "teacherReviewedAt" TIMESTAMP(3);

-- Legacy review drafts cannot safely acquire frozen rubric/lifecycle provenance after evaluation.
-- Make them explicitly rerunnable instead of exposing a generic drift failure in the workbench.
UPDATE "GradingRun"
SET "state" = 'CONTENT_UNAVAILABLE',
    "limitations" = ARRAY(SELECT DISTINCT unnest("limitations" || ARRAY['review-contract-rerun-required']::TEXT[])),
    "blockedReasons" = ARRAY(SELECT DISTINCT unnest("blockedReasons" || ARRAY['review-contract-rerun-required']::TEXT[])),
    "updatedAt" = NOW()
WHERE "state" = 'AWAITING_REVIEW';
