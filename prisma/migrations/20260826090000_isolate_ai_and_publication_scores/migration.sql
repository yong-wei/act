ALTER TABLE "TeacherAiGradingStructuredReviewVersion"
  ADD COLUMN "baselineVersion" TEXT,
  ADD COLUMN "baselineScore" DOUBLE PRECISION;

ALTER TABLE "GradingRun"
  ADD COLUMN "aiTotalScore" DOUBLE PRECISION,
  ADD COLUMN "approvedTotalScore" DOUBLE PRECISION;

UPDATE "GradingRun" AS gr
SET "approvedTotalScore" = tar."derivedTotal",
    "aiTotalScore" = NULL
FROM "TeacherAssignmentReview" AS tar
WHERE tar."gradingRunId" = gr."id"
  AND tar."state" = 'APPROVED'
  AND gr."source" = 'AI';

UPDATE "GradingRun" AS gr
SET "aiTotalScore" = gr."draftTotalScore"
WHERE gr."aiTotalScore" IS NULL
  AND gr."source" = 'AI'
  AND NOT EXISTS (
    SELECT 1
    FROM "TeacherAssignmentReview" AS tar
    WHERE tar."gradingRunId" = gr."id"
      AND tar."state" = 'APPROVED'
  );

CREATE OR REPLACE FUNCTION "teacher_ai_grading_immutable_ai_fields"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'GradingRun' THEN
    IF OLD."source" = 'AI' AND OLD."state" IN ('AWAITING_REVIEW', 'APPROVED', 'BLOCKED') AND (
      NEW."aiTotalScore" IS DISTINCT FROM OLD."aiTotalScore"
      OR NEW."draftTotalScore" IS DISTINCT FROM OLD."draftTotalScore"
    ) THEN
      RAISE EXCEPTION 'teacher-ai-grading-ai-result-immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'TeacherAiGradingExperimentExecution' THEN
    IF OLD."rawOutputObjectKey" IS NOT NULL AND (
      NEW."rawOutputObjectKey" IS DISTINCT FROM OLD."rawOutputObjectKey"
      OR NEW."rawOutputChecksum" IS DISTINCT FROM OLD."rawOutputChecksum"
    ) THEN
      RAISE EXCEPTION 'teacher-ai-grading-raw-output-immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'GradingCriterionAssessment' AND OLD."gradingRunId" IS NOT NULL THEN
    IF NEW."score" IS DISTINCT FROM OLD."score"
      OR NEW."rationale" IS DISTINCT FROM OLD."rationale"
      OR NEW."criterionId" IS DISTINCT FROM OLD."criterionId" THEN
      RAISE EXCEPTION 'teacher-ai-grading-assessment-immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'GradingAnnotation' AND OLD."gradingRunId" IS NOT NULL THEN
    IF NEW."criterionId" IS DISTINCT FROM OLD."criterionId"
      OR NEW."comment" IS DISTINCT FROM OLD."comment"
      OR NEW."reason" IS DISTINCT FROM OLD."reason"
      OR NEW."pageNumber" IS DISTINCT FROM OLD."pageNumber"
      OR NEW."blockId" IS DISTINCT FROM OLD."blockId"
      OR NEW."bbox" IS DISTINCT FROM OLD."bbox" THEN
      RAISE EXCEPTION 'teacher-ai-grading-annotation-immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "GradingRun_teacher_ai_grading_immutable_ai_fields"
BEFORE UPDATE ON "GradingRun"
FOR EACH ROW EXECUTE FUNCTION "teacher_ai_grading_immutable_ai_fields"();

CREATE TRIGGER "TeacherAiGradingExperimentExecution_teacher_ai_grading_immutable_ai_fields"
BEFORE UPDATE ON "TeacherAiGradingExperimentExecution"
FOR EACH ROW EXECUTE FUNCTION "teacher_ai_grading_immutable_ai_fields"();

CREATE TRIGGER "GradingCriterionAssessment_teacher_ai_grading_immutable_ai_fields"
BEFORE UPDATE ON "GradingCriterionAssessment"
FOR EACH ROW EXECUTE FUNCTION "teacher_ai_grading_immutable_ai_fields"();

CREATE TRIGGER "GradingAnnotation_teacher_ai_grading_immutable_ai_fields"
BEFORE UPDATE ON "GradingAnnotation"
FOR EACH ROW EXECUTE FUNCTION "teacher_ai_grading_immutable_ai_fields"();
