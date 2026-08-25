ALTER TABLE "TeacherAssignmentReview"
ALTER COLUMN "answerEvidenceId" DROP NOT NULL;

ALTER TABLE "TeacherAssignmentApprovalSnapshot"
ALTER COLUMN "answerEvidenceId" DROP NOT NULL;
