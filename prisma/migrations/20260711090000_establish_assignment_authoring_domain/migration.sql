CREATE TYPE "AssignmentLifecycleState" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "AssignmentRevisionState" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "AssignmentQuestionSourceFamily" AS ENUM ('MANUAL', 'ADAPTIVE_ASSESSMENT_CATALOG', 'ASSIGNMENT_DERIVATIVE');
CREATE TYPE "AssignmentSolutionReleaseMode" AS ENUM ('PRIVATE', 'AT_TIME');

CREATE TABLE "Assignment" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "courseContext" TEXT,
  "state" "AssignmentLifecycleState" NOT NULL DEFAULT 'DRAFT',
  "archivedAt" TIMESTAMP(3),
  "anonymizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentRevision" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "state" "AssignmentRevisionState" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "instructions" TEXT NOT NULL,
  "totalPoints" DECIMAL(8,2) NOT NULL,
  "availabilityStartsAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "latePolicy" JSONB NOT NULL DEFAULT '{}',
  "responsePolicy" JSONB NOT NULL DEFAULT '{}',
  "resubmissionPolicy" JSONB NOT NULL DEFAULT '{}',
  "solutionReleasePolicy" JSONB NOT NULL DEFAULT '{}',
  "contentHash" TEXT,
  "publishedAt" TIMESTAMP(3),
  "frozenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssignmentRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentAudience" (
  "id" TEXT NOT NULL,
  "assignmentRevisionId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "availableAt" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "policySnapshot" JSONB NOT NULL DEFAULT '{}',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentAudience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentQuestion" (
  "id" TEXT NOT NULL,
  "assignmentRevisionId" TEXT NOT NULL,
  "stableQuestionId" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "responseType" TEXT NOT NULL,
  "points" DECIMAL(8,2) NOT NULL,
  "promptSnapshot" JSONB NOT NULL,
  "answerSnapshot" JSONB NOT NULL,
  "rubricSnapshot" JSONB NOT NULL,
  "sourceFamily" "AssignmentQuestionSourceFamily" NOT NULL,
  "sourceId" TEXT,
  "sourceVersion" TEXT,
  "sourceHash" TEXT NOT NULL,
  "sourceReviewState" TEXT NOT NULL,
  "sourceCatalogItemId" TEXT,
  "sourceOriginalFamily" TEXT,
  "sourceSelectionProof" TEXT,
  "sourceLineage" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentReviewGrant" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AssignmentReviewGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentPublicationOperation" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentPublicationOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentHistoricalOwnership" (
  "id" TEXT NOT NULL,
  "assignmentRevisionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "audienceClassId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL,
  "anonymizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentHistoricalOwnership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Assignment_authorId_state_updatedAt_idx" ON "Assignment"("authorId", "state", "updatedAt");
CREATE INDEX "Assignment_courseContext_idx" ON "Assignment"("courseContext");
CREATE UNIQUE INDEX "AssignmentRevision_assignmentId_revisionNumber_key" ON "AssignmentRevision"("assignmentId", "revisionNumber");
CREATE INDEX "AssignmentRevision_assignmentId_state_updatedAt_idx" ON "AssignmentRevision"("assignmentId", "state", "updatedAt");
CREATE INDEX "AssignmentRevision_publishedAt_idx" ON "AssignmentRevision"("publishedAt");
CREATE UNIQUE INDEX "AssignmentAudience_assignmentRevisionId_classId_key" ON "AssignmentAudience"("assignmentRevisionId", "classId");
CREATE INDEX "AssignmentAudience_classId_availableAt_dueAt_idx" ON "AssignmentAudience"("classId", "availableAt", "dueAt");
CREATE UNIQUE INDEX "AssignmentQuestion_assignmentRevisionId_stableQuestionId_key" ON "AssignmentQuestion"("assignmentRevisionId", "stableQuestionId");
CREATE UNIQUE INDEX "AssignmentQuestion_assignmentRevisionId_orderIndex_key" ON "AssignmentQuestion"("assignmentRevisionId", "orderIndex");
CREATE INDEX "AssignmentQuestion_sourceFamily_sourceId_idx" ON "AssignmentQuestion"("sourceFamily", "sourceId");
CREATE INDEX "AssignmentQuestion_contentHash_idx" ON "AssignmentQuestion"("contentHash");
CREATE INDEX "AssignmentReviewGrant_assignmentId_teacherId_revokedAt_expiresAt_idx" ON "AssignmentReviewGrant"("assignmentId", "teacherId", "revokedAt", "expiresAt");
CREATE UNIQUE INDEX "AssignmentPublicationOperation_assignmentId_idempotencyKey_key" ON "AssignmentPublicationOperation"("assignmentId", "idempotencyKey");
CREATE INDEX "AssignmentPublicationOperation_revisionId_idx" ON "AssignmentPublicationOperation"("revisionId");
CREATE UNIQUE INDEX "AssignmentHistoricalOwnership_assignmentRevisionId_studentId_key" ON "AssignmentHistoricalOwnership"("assignmentRevisionId", "studentId");
CREATE INDEX "AssignmentHistoricalOwnership_studentId_assignedAt_idx" ON "AssignmentHistoricalOwnership"("studentId", "assignedAt");
CREATE INDEX "AssignmentHistoricalOwnership_audienceClassId_idx" ON "AssignmentHistoricalOwnership"("audienceClassId");

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentRevision" ADD CONSTRAINT "AssignmentRevision_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentAudience" ADD CONSTRAINT "AssignmentAudience_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentAudience" ADD CONSTRAINT "AssignmentAudience_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentQuestion" ADD CONSTRAINT "AssignmentQuestion_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentReviewGrant" ADD CONSTRAINT "AssignmentReviewGrant_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentReviewGrant" ADD CONSTRAINT "AssignmentReviewGrant_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentReviewGrant" ADD CONSTRAINT "AssignmentReviewGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentPublicationOperation" ADD CONSTRAINT "AssignmentPublicationOperation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentPublicationOperation" ADD CONSTRAINT "AssignmentPublicationOperation_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentHistoricalOwnership" ADD CONSTRAINT "AssignmentHistoricalOwnership_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentHistoricalOwnership" ADD CONSTRAINT "AssignmentHistoricalOwnership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
