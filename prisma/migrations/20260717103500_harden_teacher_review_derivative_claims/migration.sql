ALTER TABLE "TeacherAssignmentReviewedDerivative"
  ADD COLUMN "claimToken" TEXT,
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX "TeacherAssignmentReviewedDerivative_state_leaseExpiresAt_idx"
  ON "TeacherAssignmentReviewedDerivative"("state", "leaseExpiresAt");
