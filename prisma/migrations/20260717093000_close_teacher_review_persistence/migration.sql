CREATE TYPE "TeacherAssignmentReviewState" AS ENUM ('WORKING', 'APPROVED', 'RETURNED', 'SUPERSEDED');
CREATE TYPE "AssignmentSubmissionReviewState" AS ENUM ('PENDING', 'REVIEWING', 'APPROVED_PENDING_RELEASE', 'RELEASE_BLOCKED', 'RETURNED', 'REVIEWED');
CREATE TYPE "TeacherAssignmentReviewOutboxCommand" AS ENUM ('GENERATE_DERIVATIVE', 'RELEASE_STUDENT_FEEDBACK', 'PROCESS_GOVERNED_EVIDENCE');
CREATE TYPE "TeacherAssignmentReviewOutboxState" AS ENUM ('PENDING', 'PROCESSING', 'RETRYABLE', 'SUCCEEDED', 'BLOCKED', 'FAILED');
CREATE TYPE "TeacherAssignmentResubmissionGrantState" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');
CREATE TYPE "TeacherAssignmentReviewedDerivativeState" AS ENUM ('GENERATING', 'READY', 'RETRYABLE', 'BLOCKED', 'FAILED');
CREATE TYPE "TeacherAssignmentReviewedDerivativeKind" AS ENUM ('REVIEWED_DOCX', 'REVIEWED_PDF', 'ANNOTATED_MARKDOWN');
CREATE TYPE "TeacherAssignmentFeedbackReleaseMode" AS ENUM ('DERIVATIVE', 'STRUCTURED_ONLY');
CREATE TYPE "TeacherAssignmentResubmissionIntakeState" AS ENUM ('PENDING', 'PROCESSING', 'WAITING_EVIDENCE', 'QUEUED', 'RETRYABLE', 'BLOCKED');

ALTER TABLE "AssignmentSubmission"
  ADD COLUMN "reviewState" "AssignmentSubmissionReviewState" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "approvedTotal" DECIMAL(10,4),
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "AssignmentSubmission_reviewState_updatedAt_idx" ON "AssignmentSubmission"("reviewState", "updatedAt");

CREATE TABLE "TeacherAssignmentReview" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "assignmentRevisionId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "answerId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "gradingRunId" TEXT NOT NULL,
  "answerEvidenceId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "state" "TeacherAssignmentReviewState" NOT NULL DEFAULT 'WORKING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "machineSnapshotHash" TEXT NOT NULL,
  "criterionValues" JSONB NOT NULL DEFAULT '[]',
  "annotationValues" JSONB NOT NULL DEFAULT '[]',
  "derivedTotal" DECIMAL(10,4) NOT NULL,
  "overallComment" TEXT,
  "authorizationSnapshot" JSONB NOT NULL,
  "lifecyclePolicyVersion" TEXT,
  "approvedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAssignmentReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAssignmentApprovalSnapshot" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "assignmentRevisionId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "answerId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "gradingRunId" TEXT NOT NULL,
  "answerEvidenceId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "reviewVersion" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "machineSnapshotHash" TEXT NOT NULL,
  "criterionSnapshot" JSONB NOT NULL,
  "annotationSnapshot" JSONB NOT NULL,
  "questionTotal" DECIMAL(10,4) NOT NULL,
  "overallComment" TEXT,
  "authorizationSnapshot" JSONB NOT NULL,
  "rubricVersion" TEXT NOT NULL,
  "evaluatorVersion" TEXT NOT NULL,
  "lifecyclePolicyVersion" TEXT,
  "approvedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherAssignmentApprovalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAssignmentReviewOutbox" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "command" "TeacherAssignmentReviewOutboxCommand" NOT NULL,
  "state" "TeacherAssignmentReviewOutboxState" NOT NULL DEFAULT 'PENDING',
  "dedupeKey" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "causationId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "claimToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "limitationCode" TEXT,
  "resultJson" JSONB,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAssignmentReviewOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAssignmentReviewedDerivative" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "sourceAssetId" TEXT,
  "sourceObjectKey" TEXT,
  "sourceChecksum" TEXT NOT NULL,
  "reviewSnapshotChecksum" TEXT NOT NULL,
  "generatorId" TEXT NOT NULL,
  "generatorVersion" TEXT NOT NULL,
  "anchorMapVersion" TEXT NOT NULL,
  "lifecyclePolicyVersion" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "state" "TeacherAssignmentReviewedDerivativeState" NOT NULL DEFAULT 'GENERATING',
  "outputKind" "TeacherAssignmentReviewedDerivativeKind" NOT NULL,
  "outputMimeType" TEXT NOT NULL,
  "outputObjectKey" TEXT,
  "outputChecksum" TEXT,
  "outputSizeBytes" INTEGER,
  "nativeCapable" BOOLEAN NOT NULL DEFAULT false,
  "anchorPrecision" TEXT NOT NULL,
  "limitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "readyAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAssignmentReviewedDerivative_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAssignmentFeedbackRelease" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "derivativeId" TEXT,
  "mode" "TeacherAssignmentFeedbackReleaseMode" NOT NULL,
  "ownerStudentId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "authorizationSnapshot" JSONB NOT NULL,
  "releasedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherAssignmentFeedbackRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAssignmentResubmissionGrant" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "assignmentRevisionId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "answerId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "sourceReviewId" TEXT NOT NULL,
  "sourceGradingRunId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "state" "TeacherAssignmentResubmissionGrantState" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT NOT NULL,
  "allowedResponseType" TEXT NOT NULL,
  "newDeadlineAt" TIMESTAMP(3) NOT NULL,
  "authorizationSnapshot" JSONB NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "consumedAttemptId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAssignmentResubmissionGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAssignmentQuestionExemption" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "assignmentRevisionId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "scoreEffect" DECIMAL(10,4) NOT NULL,
  "authorizationSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherAssignmentQuestionExemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAssignmentResubmissionIntake" (
  "id" TEXT NOT NULL,
  "grantId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "sourceGradingRunId" TEXT NOT NULL,
  "state" "TeacherAssignmentResubmissionIntakeState" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "claimToken" TEXT,
  "claimedAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastErrorCode" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAssignmentResubmissionIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherAssignmentReview_gradingRunId_key" ON "TeacherAssignmentReview"("gradingRunId");
CREATE INDEX "TeacherAssignmentReview_assignmentId_state_updatedAt_idx" ON "TeacherAssignmentReview"("assignmentId", "state", "updatedAt");
CREATE INDEX "TeacherAssignmentReview_submissionId_state_updatedAt_idx" ON "TeacherAssignmentReview"("submissionId", "state", "updatedAt");
CREATE INDEX "TeacherAssignmentReview_questionId_state_updatedAt_idx" ON "TeacherAssignmentReview"("questionId", "state", "updatedAt");
CREATE INDEX "TeacherAssignmentReview_reviewerId_state_updatedAt_idx" ON "TeacherAssignmentReview"("reviewerId", "state", "updatedAt");
CREATE INDEX "TeacherAssignmentReview_answerEvidenceId_idx" ON "TeacherAssignmentReview"("answerEvidenceId");

CREATE UNIQUE INDEX "TeacherAssignmentApprovalSnapshot_reviewId_key" ON "TeacherAssignmentApprovalSnapshot"("reviewId");
CREATE UNIQUE INDEX "TeacherAssignmentApprovalSnapshot_gradingRunId_key" ON "TeacherAssignmentApprovalSnapshot"("gradingRunId");
CREATE UNIQUE INDEX "TeacherAssignmentApprovalSnapshot_reviewId_idempotencyKey_key" ON "TeacherAssignmentApprovalSnapshot"("reviewId", "idempotencyKey");
CREATE INDEX "TeacherAssignmentApprovalSnapshot_submissionId_approvedAt_idx" ON "TeacherAssignmentApprovalSnapshot"("submissionId", "approvedAt");
CREATE INDEX "TeacherAssignmentApprovalSnapshot_questionId_approvedAt_idx" ON "TeacherAssignmentApprovalSnapshot"("questionId", "approvedAt");
CREATE INDEX "TeacherAssignmentApprovalSnapshot_attemptId_idx" ON "TeacherAssignmentApprovalSnapshot"("attemptId");
CREATE INDEX "TeacherAssignmentApprovalSnapshot_answerEvidenceId_idx" ON "TeacherAssignmentApprovalSnapshot"("answerEvidenceId");

CREATE UNIQUE INDEX "TeacherAssignmentReviewOutbox_dedupeKey_key" ON "TeacherAssignmentReviewOutbox"("dedupeKey");
CREATE UNIQUE INDEX "TeacherAssignmentReviewOutbox_snapshotId_command_key" ON "TeacherAssignmentReviewOutbox"("snapshotId", "command");
CREATE INDEX "TeacherAssignmentReviewOutbox_command_state_availableAt_idx" ON "TeacherAssignmentReviewOutbox"("command", "state", "availableAt");
CREATE INDEX "TeacherAssignmentReviewOutbox_state_leaseExpiresAt_idx" ON "TeacherAssignmentReviewOutbox"("state", "leaseExpiresAt");
CREATE INDEX "TeacherAssignmentReviewOutbox_correlationId_idx" ON "TeacherAssignmentReviewOutbox"("correlationId");
CREATE INDEX "TeacherAssignmentReviewOutbox_causationId_idx" ON "TeacherAssignmentReviewOutbox"("causationId");

CREATE UNIQUE INDEX "TeacherAssignmentReviewedDerivative_idempotencyKey_key" ON "TeacherAssignmentReviewedDerivative"("idempotencyKey");
CREATE UNIQUE INDEX "TchrReviewDerivative_snapshot_source_generator_key" ON "TeacherAssignmentReviewedDerivative"("snapshotId", "sourceChecksum", "generatorId", "generatorVersion", "anchorMapVersion");
CREATE INDEX "TeacherAssignmentReviewedDerivative_snapshotId_state_updatedAt_idx" ON "TeacherAssignmentReviewedDerivative"("snapshotId", "state", "updatedAt");
CREATE INDEX "TeacherAssignmentReviewedDerivative_state_updatedAt_idx" ON "TeacherAssignmentReviewedDerivative"("state", "updatedAt");
CREATE INDEX "TeacherAssignmentReviewedDerivative_sourceChecksum_idx" ON "TeacherAssignmentReviewedDerivative"("sourceChecksum");
CREATE UNIQUE INDEX "TeacherAssignmentFeedbackRelease_snapshotId_key" ON "TeacherAssignmentFeedbackRelease"("snapshotId");
CREATE UNIQUE INDEX "TeacherAssignmentFeedbackRelease_idempotencyKey_key" ON "TeacherAssignmentFeedbackRelease"("idempotencyKey");
CREATE INDEX "TeacherAssignmentFeedbackRelease_ownerStudentId_releasedAt_idx" ON "TeacherAssignmentFeedbackRelease"("ownerStudentId", "releasedAt");
CREATE INDEX "TeacherAssignmentFeedbackRelease_derivativeId_idx" ON "TeacherAssignmentFeedbackRelease"("derivativeId");

CREATE UNIQUE INDEX "TeacherAssignmentResubmissionGrant_idempotencyKey_key" ON "TeacherAssignmentResubmissionGrant"("idempotencyKey");
CREATE INDEX "TeacherAssignmentResubmissionGrant_submissionId_state_expiresAt_idx" ON "TeacherAssignmentResubmissionGrant"("submissionId", "state", "expiresAt");
CREATE INDEX "TeacherAssignmentResubmissionGrant_answerId_state_expiresAt_idx" ON "TeacherAssignmentResubmissionGrant"("answerId", "state", "expiresAt");
CREATE INDEX "TeacherAssignmentResubmissionGrant_questionId_state_expiresAt_idx" ON "TeacherAssignmentResubmissionGrant"("questionId", "state", "expiresAt");
CREATE INDEX "TeacherAssignmentResubmissionGrant_sourceGradingRunId_idx" ON "TeacherAssignmentResubmissionGrant"("sourceGradingRunId");

CREATE UNIQUE INDEX "TeacherAssignmentQuestionExemption_submissionId_questionId_key" ON "TeacherAssignmentQuestionExemption"("submissionId", "questionId");
CREATE INDEX "TeacherAssignmentQuestionExemption_assignmentId_createdAt_idx" ON "TeacherAssignmentQuestionExemption"("assignmentId", "createdAt");
CREATE INDEX "TeacherAssignmentQuestionExemption_actorId_createdAt_idx" ON "TeacherAssignmentQuestionExemption"("actorId", "createdAt");
CREATE UNIQUE INDEX "TeacherAssignmentResubmissionIntake_grantId_key" ON "TeacherAssignmentResubmissionIntake"("grantId");
CREATE UNIQUE INDEX "TeacherAssignmentResubmissionIntake_attemptId_key" ON "TeacherAssignmentResubmissionIntake"("attemptId");
CREATE INDEX "TeacherAssignmentResubmissionIntake_state_availableAt_leaseExpiresAt_idx" ON "TeacherAssignmentResubmissionIntake"("state", "availableAt", "leaseExpiresAt");
CREATE INDEX "TeacherAssignmentResubmissionIntake_sourceGradingRunId_idx" ON "TeacherAssignmentResubmissionIntake"("sourceGradingRunId");

ALTER TABLE "TeacherAssignmentReview" ADD CONSTRAINT "TeacherAssignmentReview_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentReview" ADD CONSTRAINT "TeacherAssignmentReview_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentReview" ADD CONSTRAINT "TeacherAssignmentReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentReview" ADD CONSTRAINT "TeacherAssignmentReview_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "SubmissionAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentReview" ADD CONSTRAINT "TeacherAssignmentReview_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentReview" ADD CONSTRAINT "TeacherAssignmentReview_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssignmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentReview" ADD CONSTRAINT "TeacherAssignmentReview_gradingRunId_fkey" FOREIGN KEY ("gradingRunId") REFERENCES "GradingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentReview" ADD CONSTRAINT "TeacherAssignmentReview_answerEvidenceId_fkey" FOREIGN KEY ("answerEvidenceId") REFERENCES "AnswerEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentReview" ADD CONSTRAINT "TeacherAssignmentReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherAssignmentApprovalSnapshot" ADD CONSTRAINT "TeacherAssignmentApprovalSnapshot_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "TeacherAssignmentReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentApprovalSnapshot" ADD CONSTRAINT "TeacherAssignmentApprovalSnapshot_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentApprovalSnapshot" ADD CONSTRAINT "TeacherAssignmentApprovalSnapshot_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentApprovalSnapshot" ADD CONSTRAINT "TeacherAssignmentApprovalSnapshot_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentApprovalSnapshot" ADD CONSTRAINT "TeacherAssignmentApprovalSnapshot_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "SubmissionAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentApprovalSnapshot" ADD CONSTRAINT "TeacherAssignmentApprovalSnapshot_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentApprovalSnapshot" ADD CONSTRAINT "TeacherAssignmentApprovalSnapshot_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssignmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentApprovalSnapshot" ADD CONSTRAINT "TeacherAssignmentApprovalSnapshot_gradingRunId_fkey" FOREIGN KEY ("gradingRunId") REFERENCES "GradingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentApprovalSnapshot" ADD CONSTRAINT "TeacherAssignmentApprovalSnapshot_answerEvidenceId_fkey" FOREIGN KEY ("answerEvidenceId") REFERENCES "AnswerEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentApprovalSnapshot" ADD CONSTRAINT "TeacherAssignmentApprovalSnapshot_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherAssignmentReviewOutbox" ADD CONSTRAINT "TeacherAssignmentReviewOutbox_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeacherAssignmentApprovalSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentReviewedDerivative" ADD CONSTRAINT "TeacherAssignmentReviewedDerivative_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeacherAssignmentApprovalSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentReviewedDerivative" ADD CONSTRAINT "TeacherAssignmentReviewedDerivative_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "SubmissionAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentFeedbackRelease" ADD CONSTRAINT "TeacherAssignmentFeedbackRelease_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeacherAssignmentApprovalSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentFeedbackRelease" ADD CONSTRAINT "TeacherAssignmentFeedbackRelease_derivativeId_fkey" FOREIGN KEY ("derivativeId") REFERENCES "TeacherAssignmentReviewedDerivative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_teacher_approval_snapshot_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'teacher-assignment-approval-snapshot-immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherAssignmentApprovalSnapshot_immutable_update"
BEFORE UPDATE ON "TeacherAssignmentApprovalSnapshot"
FOR EACH ROW EXECUTE FUNCTION "prevent_teacher_approval_snapshot_mutation"();

CREATE TRIGGER "TeacherAssignmentApprovalSnapshot_immutable_delete"
BEFORE DELETE ON "TeacherAssignmentApprovalSnapshot"
FOR EACH ROW EXECUTE FUNCTION "prevent_teacher_approval_snapshot_mutation"();

CREATE FUNCTION "prevent_teacher_review_derivative_lineage_update"() RETURNS trigger AS $$
BEGIN
  IF OLD."snapshotId" IS DISTINCT FROM NEW."snapshotId"
    OR OLD."sourceAssetId" IS DISTINCT FROM NEW."sourceAssetId"
    OR OLD."sourceObjectKey" IS DISTINCT FROM NEW."sourceObjectKey"
    OR OLD."sourceChecksum" IS DISTINCT FROM NEW."sourceChecksum"
    OR OLD."reviewSnapshotChecksum" IS DISTINCT FROM NEW."reviewSnapshotChecksum"
    OR OLD."generatorId" IS DISTINCT FROM NEW."generatorId"
    OR OLD."generatorVersion" IS DISTINCT FROM NEW."generatorVersion"
    OR OLD."anchorMapVersion" IS DISTINCT FROM NEW."anchorMapVersion"
    OR OLD."lifecyclePolicyVersion" IS DISTINCT FROM NEW."lifecyclePolicyVersion"
    OR OLD."idempotencyKey" IS DISTINCT FROM NEW."idempotencyKey"
    OR OLD."outputKind" IS DISTINCT FROM NEW."outputKind"
    OR OLD."outputMimeType" IS DISTINCT FROM NEW."outputMimeType"
    OR OLD."nativeCapable" IS DISTINCT FROM NEW."nativeCapable"
    OR OLD."anchorPrecision" IS DISTINCT FROM NEW."anchorPrecision"
    OR OLD."limitations" IS DISTINCT FROM NEW."limitations"
  THEN
    RAISE EXCEPTION 'teacher-review-derivative-lineage-immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeacherAssignmentReviewedDerivative_immutable_lineage"
BEFORE UPDATE ON "TeacherAssignmentReviewedDerivative"
FOR EACH ROW EXECUTE FUNCTION "prevent_teacher_review_derivative_lineage_update"();

ALTER TABLE "TeacherAssignmentResubmissionGrant" ADD CONSTRAINT "TeacherAssignmentResubmissionGrant_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionGrant" ADD CONSTRAINT "TeacherAssignmentResubmissionGrant_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionGrant" ADD CONSTRAINT "TeacherAssignmentResubmissionGrant_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionGrant" ADD CONSTRAINT "TeacherAssignmentResubmissionGrant_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "SubmissionAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionGrant" ADD CONSTRAINT "TeacherAssignmentResubmissionGrant_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionGrant" ADD CONSTRAINT "TeacherAssignmentResubmissionGrant_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssignmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionGrant" ADD CONSTRAINT "TeacherAssignmentResubmissionGrant_sourceReviewId_fkey" FOREIGN KEY ("sourceReviewId") REFERENCES "TeacherAssignmentReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionGrant" ADD CONSTRAINT "TeacherAssignmentResubmissionGrant_sourceGradingRunId_fkey" FOREIGN KEY ("sourceGradingRunId") REFERENCES "GradingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionGrant" ADD CONSTRAINT "TeacherAssignmentResubmissionGrant_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherAssignmentQuestionExemption" ADD CONSTRAINT "TeacherAssignmentQuestionExemption_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentQuestionExemption" ADD CONSTRAINT "TeacherAssignmentQuestionExemption_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentQuestionExemption" ADD CONSTRAINT "TeacherAssignmentQuestionExemption_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentQuestionExemption" ADD CONSTRAINT "TeacherAssignmentQuestionExemption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssignmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentQuestionExemption" ADD CONSTRAINT "TeacherAssignmentQuestionExemption_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionIntake" ADD CONSTRAINT "TeacherAssignmentResubmissionIntake_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "TeacherAssignmentResubmissionGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionIntake" ADD CONSTRAINT "TeacherAssignmentResubmissionIntake_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAssignmentResubmissionIntake" ADD CONSTRAINT "TeacherAssignmentResubmissionIntake_sourceGradingRunId_fkey" FOREIGN KEY ("sourceGradingRunId") REFERENCES "GradingRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnswerEvidenceBlock" ADD COLUMN IF NOT EXISTS "coordinateProvenance" JSONB;
