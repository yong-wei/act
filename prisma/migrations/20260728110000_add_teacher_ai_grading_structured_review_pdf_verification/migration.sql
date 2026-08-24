CREATE TABLE "TeacherAiGradingStructuredReviewVersion" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "parentVersionId" TEXT,
    "decision" TEXT NOT NULL,
    "scoreCorrections" JSONB NOT NULL,
    "annotationCorrections" JSONB NOT NULL,
    "operatorUserId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAiGradingStructuredReviewVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingStructuredReviewVersion_shape_check" CHECK (
        "version" > 0 AND "decision" IN ('ACCEPTED', 'CORRECTED')
        AND length("operatorUserId") > 0 AND length("contentHash") > 0
        AND jsonb_typeof("scoreCorrections") = 'array'
        AND jsonb_typeof("annotationCorrections") = 'array'
        AND (
            ("decision" = 'ACCEPTED' AND jsonb_array_length("scoreCorrections") = 0 AND jsonb_array_length("annotationCorrections") = 0)
            OR ("decision" = 'CORRECTED' AND (jsonb_array_length("scoreCorrections") > 0 OR jsonb_array_length("annotationCorrections") > 0))
        )
    )
);

CREATE TABLE "TeacherAiGradingEvaluationDerivative" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "sourceConversionId" TEXT NOT NULL,
    "sourcePdfChecksum" TEXT NOT NULL,
    "sourcePdfObjectKey" TEXT NOT NULL,
    "sourcePdfSizeBytes" INTEGER NOT NULL,
    "conversionVersion" INTEGER NOT NULL,
    "conversionAdapterVersion" TEXT NOT NULL,
    "generatorVersion" TEXT NOT NULL,
    "anchorVersion" TEXT NOT NULL,
    "structuredResultHash" TEXT NOT NULL,
    "semanticIdentity" TEXT NOT NULL,
    "contentChecksum" TEXT NOT NULL,
    "contentSizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAiGradingEvaluationDerivative_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingEvaluationDerivative_shape_check" CHECK (
        length("sampleId") > 0 AND length("sourceConversionId") > 0
        AND length("sourcePdfChecksum") > 0 AND length("sourcePdfObjectKey") > 0
        AND "sourcePdfSizeBytes" > 0 AND "conversionVersion" > 0
        AND length("conversionAdapterVersion") > 0 AND length("generatorVersion") > 0
        AND length("anchorVersion") > 0 AND length("structuredResultHash") > 0
        AND length("semanticIdentity") > 0 AND length("contentChecksum") > 0
        AND "contentSizeBytes" > 0
    )
);

CREATE TABLE "TeacherAiGradingDerivativeReviewVersion" (
    "derivativeId" TEXT NOT NULL,
    "reviewVersionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    CONSTRAINT "TeacherAiGradingDerivativeReviewVersion_pkey" PRIMARY KEY ("derivativeId", "reviewVersionId"),
    CONSTRAINT "TeacherAiGradingDerivativeReviewVersion_ordinal_check" CHECK ("ordinal" >= 0)
);

CREATE TABLE "TeacherAiGradingPdfVerification" (
    "id" TEXT NOT NULL,
    "acceptanceId" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "derivativeId" TEXT NOT NULL,
    "originalLayoutComplete" BOOLEAN,
    "pageMarksComplete" BOOLEAN,
    "nativeAnnotationsComplete" BOOLEAN,
    "positioningCorrect" BOOLEAN,
    "summaryPageCorrect" BOOLEAN,
    "blockingDefect" BOOLEAN,
    "defectCode" TEXT,
    "operatorUserId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherAiGradingPdfVerification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherAiGradingPdfVerification_shape_check" CHECK (
        "revision" >= 0 AND length("sampleId") > 0
        AND (("blockingDefect" = true AND "defectCode" IS NOT NULL) OR "blockingDefect" IS DISTINCT FROM true)
        AND (("reviewedAt" IS NULL AND "operatorUserId" IS NULL) OR ("reviewedAt" IS NOT NULL AND length("operatorUserId") > 0))
    )
);

CREATE UNIQUE INDEX "TeacherAiGradingStructuredReviewVersion_execution_version_key"
ON "TeacherAiGradingStructuredReviewVersion"("executionId", "version");
CREATE INDEX "TeacherAiGradingStructuredReviewVersion_parent_idx"
ON "TeacherAiGradingStructuredReviewVersion"("parentVersionId");
CREATE INDEX "TeacherAiGradingStructuredReviewVersion_operator_created_idx"
ON "TeacherAiGradingStructuredReviewVersion"("operatorUserId", "createdAt");
CREATE INDEX "TeacherAiGradingEvaluationDerivative_split_sample_idx"
ON "TeacherAiGradingEvaluationDerivative"("splitId", "sampleId");
CREATE INDEX "TeacherAiGradingEvaluationDerivative_source_conversion_idx"
ON "TeacherAiGradingEvaluationDerivative"("sourceConversionId");
CREATE UNIQUE INDEX "TeacherAiGradingEvaluationDerivative_split_sample_identity_key"
ON "TeacherAiGradingEvaluationDerivative"("splitId", "sampleId", "semanticIdentity");
CREATE UNIQUE INDEX "TeacherAiGradingDerivativeReviewVersion_derivative_ordinal_key"
ON "TeacherAiGradingDerivativeReviewVersion"("derivativeId", "ordinal");
CREATE INDEX "TeacherAiGradingDerivativeReviewVersion_review_version_idx"
ON "TeacherAiGradingDerivativeReviewVersion"("reviewVersionId");
CREATE UNIQUE INDEX "TeacherAiGradingPdfVerification_derivativeId_key"
ON "TeacherAiGradingPdfVerification"("derivativeId");
CREATE UNIQUE INDEX "TeacherAiGradingPdfVerification_acceptance_sample_key"
ON "TeacherAiGradingPdfVerification"("acceptanceId", "sampleId");
CREATE INDEX "TeacherAiGradingPdfVerification_split_reviewed_idx"
ON "TeacherAiGradingPdfVerification"("splitId", "reviewedAt");

ALTER TABLE "TeacherAiGradingStructuredReviewVersion"
ADD CONSTRAINT "TeacherAiGradingStructuredReviewVersion_execution_fkey"
FOREIGN KEY ("executionId") REFERENCES "TeacherAiGradingExperimentExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingStructuredReviewVersion"
ADD CONSTRAINT "TeacherAiGradingStructuredReviewVersion_parent_fkey"
FOREIGN KEY ("parentVersionId") REFERENCES "TeacherAiGradingStructuredReviewVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingEvaluationDerivative"
ADD CONSTRAINT "TeacherAiGradingEvaluationDerivative_split_fkey"
FOREIGN KEY ("splitId") REFERENCES "TeacherAiGradingLabSplit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingEvaluationDerivative"
ADD CONSTRAINT "TeacherAiGradingEvaluationDerivative_source_conversion_fkey"
FOREIGN KEY ("sourceConversionId") REFERENCES "DocumentConversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingDerivativeReviewVersion"
ADD CONSTRAINT "TeacherAiGradingDerivativeReviewVersion_derivative_fkey"
FOREIGN KEY ("derivativeId") REFERENCES "TeacherAiGradingEvaluationDerivative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingDerivativeReviewVersion"
ADD CONSTRAINT "TeacherAiGradingDerivativeReviewVersion_review_version_fkey"
FOREIGN KEY ("reviewVersionId") REFERENCES "TeacherAiGradingStructuredReviewVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingPdfVerification"
ADD CONSTRAINT "TeacherAiGradingPdfVerification_acceptance_fkey"
FOREIGN KEY ("acceptanceId") REFERENCES "TeacherAiGradingHiddenAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingPdfVerification"
ADD CONSTRAINT "TeacherAiGradingPdfVerification_split_fkey"
FOREIGN KEY ("splitId") REFERENCES "TeacherAiGradingLabSplit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAiGradingPdfVerification"
ADD CONSTRAINT "TeacherAiGradingPdfVerification_derivative_fkey"
FOREIGN KEY ("derivativeId") REFERENCES "TeacherAiGradingEvaluationDerivative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_teacher_ai_grading_structured_review_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Teacher AI grading structured review versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherAiGradingStructuredReviewVersion_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingStructuredReviewVersion"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_structured_review_mutation();
CREATE TRIGGER "TeacherAiGradingEvaluationDerivative_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingEvaluationDerivative"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_structured_review_mutation();
CREATE TRIGGER "TeacherAiGradingDerivativeReviewVersion_immutable"
BEFORE UPDATE OR DELETE ON "TeacherAiGradingDerivativeReviewVersion"
FOR EACH ROW EXECUTE FUNCTION prevent_teacher_ai_grading_structured_review_mutation();

CREATE FUNCTION prevent_completed_teacher_ai_grading_run_mutation() RETURNS trigger AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "TeacherAiGradingExperimentExecution"
        WHERE "gradingRunId" = OLD."id" AND "state" = 'SUCCEEDED'
    ) THEN
        RAISE EXCEPTION 'Completed teacher AI grading source runs are immutable';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION prevent_completed_teacher_ai_grading_child_mutation() RETURNS trigger AS $$
DECLARE
    old_grading_run_id TEXT;
    new_grading_run_id TEXT;
BEGIN
    IF TG_OP <> 'INSERT' THEN old_grading_run_id := OLD."gradingRunId"; END IF;
    IF TG_OP <> 'DELETE' THEN new_grading_run_id := NEW."gradingRunId"; END IF;
    IF EXISTS (
        SELECT 1 FROM "TeacherAiGradingExperimentExecution"
        WHERE "gradingRunId" IN (old_grading_run_id, new_grading_run_id) AND "state" = 'SUCCEEDED'
    ) THEN
        RAISE EXCEPTION 'Completed teacher AI grading source results are immutable';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CompletedTeacherAiGradingRun_immutable"
BEFORE UPDATE OR DELETE ON "GradingRun"
FOR EACH ROW EXECUTE FUNCTION prevent_completed_teacher_ai_grading_run_mutation();
CREATE TRIGGER "CompletedTeacherAiGradingAssessment_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "GradingCriterionAssessment"
FOR EACH ROW EXECUTE FUNCTION prevent_completed_teacher_ai_grading_child_mutation();
CREATE TRIGGER "CompletedTeacherAiGradingAnnotation_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "GradingAnnotation"
FOR EACH ROW EXECUTE FUNCTION prevent_completed_teacher_ai_grading_child_mutation();
