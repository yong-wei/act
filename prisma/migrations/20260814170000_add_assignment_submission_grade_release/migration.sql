CREATE TABLE "AssignmentSubmissionGradeRelease" (
  "id" TEXT NOT NULL,
  "gradeId" TEXT NOT NULL,
  "confirmationId" TEXT NOT NULL,
  "ownerStudentId" TEXT NOT NULL,
  "releasedById" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "packageSnapshot" JSONB NOT NULL,
  "releasedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentSubmissionGradeRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssignmentSubmissionGradeRelease_gradeId_key" ON "AssignmentSubmissionGradeRelease"("gradeId");
CREATE UNIQUE INDEX "AssignmentSubmissionGradeRelease_confirmationId_key" ON "AssignmentSubmissionGradeRelease"("confirmationId");
CREATE UNIQUE INDEX "AssignmentSubmissionGradeRelease_gradeId_idempotencyKey_key" ON "AssignmentSubmissionGradeRelease"("gradeId", "idempotencyKey");
CREATE INDEX "AssignmentSubmissionGradeRelease_ownerStudentId_releasedAt_idx" ON "AssignmentSubmissionGradeRelease"("ownerStudentId", "releasedAt");
CREATE INDEX "AssignmentSubmissionGradeRelease_releasedById_releasedAt_idx" ON "AssignmentSubmissionGradeRelease"("releasedById", "releasedAt");

ALTER TABLE "AssignmentSubmissionGradeRelease" ADD CONSTRAINT "AssignmentSubmissionGradeRelease_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "AssignmentSubmissionGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionGradeRelease" ADD CONSTRAINT "AssignmentSubmissionGradeRelease_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "AssignmentSubmissionGradeConfirmation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionGradeRelease" ADD CONSTRAINT "AssignmentSubmissionGradeRelease_ownerStudentId_fkey" FOREIGN KEY ("ownerStudentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmissionGradeRelease" ADD CONSTRAINT "AssignmentSubmissionGradeRelease_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
