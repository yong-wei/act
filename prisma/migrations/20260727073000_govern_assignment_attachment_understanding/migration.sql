ALTER TABLE "AnswerEvidence"
ADD COLUMN "sourceManifest" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "GradingRun"
ADD COLUMN "evidenceState" TEXT NOT NULL DEFAULT 'COMPLETE';

ALTER TABLE "TeacherAssignmentApprovalSnapshot"
ADD COLUMN "incompleteEvidenceConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "omittedAssetIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
