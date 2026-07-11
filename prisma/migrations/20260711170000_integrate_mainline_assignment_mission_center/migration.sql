-- CreateEnum
CREATE TYPE "AssignmentSubmissionState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "SubmissionAnswerState" AS ENUM ('DRAFT', 'READY', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "SubmissionAssetState" AS ENUM ('QUARANTINED', 'DELETING', 'FINALIZED', 'REVOKED', 'DELETED');

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentRevisionId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "state" "AssignmentSubmissionState" NOT NULL DEFAULT 'NOT_STARTED',
    "submittedRequiredCount" INTEGER NOT NULL DEFAULT 0,
    "requiredQuestionCount" INTEGER NOT NULL,
    "frozenStudentId" TEXT NOT NULL,
    "frozenAudienceClassId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "assignmentQuestionId" TEXT NOT NULL,
    "state" "SubmissionAnswerState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "responseType" TEXT NOT NULL,
    "textDraft" TEXT,
    "currentAttemptNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAttempt" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "answerVersion" INTEGER NOT NULL,
    "textSnapshot" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAsset" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "attemptId" TEXT,
    "version" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "state" "SubmissionAssetState" NOT NULL DEFAULT 'QUARANTINED',
    "scanState" TEXT NOT NULL DEFAULT 'PENDING',
    "scanRetryCount" INTEGER NOT NULL DEFAULT 0,
    "lastScanErrorCode" TEXT,
    "nextScanAt" TIMESTAMP(3),
    "quarantineExpiresAt" TIMESTAMP(3),
    "finalizationKey" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionIdempotency" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "attemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionObjectTombstone" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "checksum" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionObjectTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionMutationQuota" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionMutationQuota_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "SubmissionAssetAccessToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubmissionAssetAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentSubmission_studentId_state_updatedAt_idx" ON "AssignmentSubmission"("studentId", "state", "updatedAt");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_audienceId_idx" ON "AssignmentSubmission"("audienceId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentRevisionId_studentId_key" ON "AssignmentSubmission"("assignmentRevisionId", "studentId");

-- CreateIndex
CREATE INDEX "SubmissionAnswer_assignmentQuestionId_state_idx" ON "SubmissionAnswer"("assignmentQuestionId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionAnswer_submissionId_assignmentQuestionId_key" ON "SubmissionAnswer"("submissionId", "assignmentQuestionId");

-- CreateIndex
CREATE INDEX "SubmissionAttempt_submittedAt_idx" ON "SubmissionAttempt"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionAttempt_answerId_attemptNumber_key" ON "SubmissionAttempt"("answerId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionAsset_objectKey_key" ON "SubmissionAsset"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionAsset_finalizationKey_key" ON "SubmissionAsset"("finalizationKey");

-- CreateIndex
CREATE INDEX "SubmissionAsset_state_createdAt_idx" ON "SubmissionAsset"("state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionAsset_answerId_version_key" ON "SubmissionAsset"("answerId", "version");

-- CreateIndex
CREATE INDEX "SubmissionIdempotency_attemptId_idx" ON "SubmissionIdempotency"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionIdempotency_studentId_scope_idempotencyKey_key" ON "SubmissionIdempotency"("studentId", "scope", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionObjectTombstone_objectKey_key" ON "SubmissionObjectTombstone"("objectKey");

-- CreateIndex
CREATE INDEX "SubmissionObjectTombstone_deletedAt_idx" ON "SubmissionObjectTombstone"("deletedAt");

-- CreateIndex
CREATE INDEX "SubmissionMutationQuota_blockedUntil_idx" ON "SubmissionMutationQuota"("blockedUntil");

CREATE UNIQUE INDEX "SubmissionAssetAccessToken_tokenHash_key" ON "SubmissionAssetAccessToken"("tokenHash");
CREATE INDEX "SubmissionAssetAccessToken_assetId_studentId_expiresAt_idx" ON "SubmissionAssetAccessToken"("assetId", "studentId", "expiresAt");
CREATE INDEX "SubmissionAssetAccessToken_expiresAt_usedAt_idx" ON "SubmissionAssetAccessToken"("expiresAt", "usedAt");

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentRevisionId_fkey" FOREIGN KEY ("assignmentRevisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AssignmentAudience"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAnswer" ADD CONSTRAINT "SubmissionAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAnswer" ADD CONSTRAINT "SubmissionAnswer_assignmentQuestionId_fkey" FOREIGN KEY ("assignmentQuestionId") REFERENCES "AssignmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttempt" ADD CONSTRAINT "SubmissionAttempt_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "SubmissionAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAsset" ADD CONSTRAINT "SubmissionAsset_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "SubmissionAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAsset" ADD CONSTRAINT "SubmissionAsset_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionIdempotency" ADD CONSTRAINT "SubmissionIdempotency_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubmissionAssetAccessToken" ADD CONSTRAINT "SubmissionAssetAccessToken_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "SubmissionAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
