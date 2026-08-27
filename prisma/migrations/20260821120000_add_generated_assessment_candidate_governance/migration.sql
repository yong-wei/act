CREATE TABLE "AdaptiveAssessmentGeneratedCandidate" (
    "id" TEXT NOT NULL,
    "generationKind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentRevisionId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdaptiveAssessmentGeneratedCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdaptiveAssessmentGeneratedCandidateRevision" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "parentRevisionId" TEXT,
    "contentHash" TEXT NOT NULL,
    "envelopePublicJson" JSONB NOT NULL,
    "envelopePrivateJson" JSONB NOT NULL DEFAULT '{}',
    "contentJson" JSONB NOT NULL,
    "promptHash" TEXT,
    "modelResponseHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdaptiveAssessmentGeneratedCandidateRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdaptiveAssessmentGeneratedCandidateEvent" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdaptiveAssessmentGeneratedCandidateEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdaptiveAssessmentGeneratedCandidateReview" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "reviewerRole" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "itemDecisions" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "reviewSourceHash" TEXT NOT NULL,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdaptiveAssessmentGeneratedCandidateReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdaptiveAssessmentGeneratedPublicationReceipt" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "catalogReleaseId" TEXT NOT NULL,
    "receiptHash" TEXT NOT NULL,
    "generationKind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),
    CONSTRAINT "AdaptiveAssessmentGeneratedPublicationReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdaptiveAssessmentGeneratedCandidate_status_createdAt_idx" ON "AdaptiveAssessmentGeneratedCandidate"("status", "createdAt");
CREATE INDEX "AdaptiveAssessmentGeneratedCandidate_generationKind_status_idx" ON "AdaptiveAssessmentGeneratedCandidate"("generationKind", "status");
CREATE INDEX "AdaptiveAssessmentGeneratedCandidate_createdByUserId_createdAt_idx" ON "AdaptiveAssessmentGeneratedCandidate"("createdByUserId", "createdAt");
CREATE INDEX "AdaptiveAssessmentGeneratedCandidateRevision_candidateId_createdAt_idx" ON "AdaptiveAssessmentGeneratedCandidateRevision"("candidateId", "createdAt");
CREATE INDEX "AdaptiveAssessmentGeneratedCandidateRevision_contentHash_idx" ON "AdaptiveAssessmentGeneratedCandidateRevision"("contentHash");
CREATE INDEX "AdaptiveAssessmentGeneratedCandidateEvent_candidateId_createdAt_idx" ON "AdaptiveAssessmentGeneratedCandidateEvent"("candidateId", "createdAt");
CREATE INDEX "AdaptiveAssessmentGeneratedCandidateReview_candidateId_revisionId_createdAt_idx" ON "AdaptiveAssessmentGeneratedCandidateReview"("candidateId", "revisionId", "createdAt");
CREATE INDEX "AdaptiveAssessmentGeneratedCandidateReview_reviewSourceHash_idx" ON "AdaptiveAssessmentGeneratedCandidateReview"("reviewSourceHash");
CREATE UNIQUE INDEX "AdaptiveAssessmentGeneratedPublicationReceipt_receiptHash_key" ON "AdaptiveAssessmentGeneratedPublicationReceipt"("receiptHash");
CREATE INDEX "AdaptiveAssessmentGeneratedPublicationReceipt_candidateId_status_idx" ON "AdaptiveAssessmentGeneratedPublicationReceipt"("candidateId", "status");
CREATE INDEX "AdaptiveAssessmentGeneratedPublicationReceipt_catalogItemId_idx" ON "AdaptiveAssessmentGeneratedPublicationReceipt"("catalogItemId");

ALTER TABLE "AdaptiveAssessmentGeneratedCandidateRevision" ADD CONSTRAINT "AdaptiveAssessmentGeneratedCandidateRevision_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AdaptiveAssessmentGeneratedCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentGeneratedCandidateEvent" ADD CONSTRAINT "AdaptiveAssessmentGeneratedCandidateEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AdaptiveAssessmentGeneratedCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentGeneratedCandidateReview" ADD CONSTRAINT "AdaptiveAssessmentGeneratedCandidateReview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AdaptiveAssessmentGeneratedCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentGeneratedPublicationReceipt" ADD CONSTRAINT "AdaptiveAssessmentGeneratedPublicationReceipt_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AdaptiveAssessmentGeneratedCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
