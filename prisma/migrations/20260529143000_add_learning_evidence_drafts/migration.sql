CREATE TABLE "LearningEvidenceDraft" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceRefs" JSONB NOT NULL,
  "factType" TEXT NOT NULL,
  "summary" JSONB NOT NULL DEFAULT '{}',
  "evidenceRefs" JSONB NOT NULL DEFAULT '{}',
  "provenance" JSONB NOT NULL DEFAULT '{}',
  "confidence" DOUBLE PRECISION NOT NULL,
  "privacyScope" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "reviewerState" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "courseId" TEXT,
  "sessionId" TEXT,
  "classId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LearningEvidenceDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceOutbox" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "causationId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "dedupeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EvidenceOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningEvidenceDraft_dedupeKey_key" ON "LearningEvidenceDraft"("dedupeKey");
CREATE INDEX "LearningEvidenceDraft_ownerUserId_occurredAt_idx" ON "LearningEvidenceDraft"("ownerUserId", "occurredAt");
CREATE INDEX "LearningEvidenceDraft_sourceType_occurredAt_idx" ON "LearningEvidenceDraft"("sourceType", "occurredAt");
CREATE INDEX "LearningEvidenceDraft_reviewerState_occurredAt_idx" ON "LearningEvidenceDraft"("reviewerState", "occurredAt");
CREATE INDEX "LearningEvidenceDraft_classId_occurredAt_idx" ON "LearningEvidenceDraft"("classId", "occurredAt");

CREATE UNIQUE INDEX "EvidenceOutbox_dedupeKey_key" ON "EvidenceOutbox"("dedupeKey");
CREATE INDEX "EvidenceOutbox_eventType_status_availableAt_idx" ON "EvidenceOutbox"("eventType", "status", "availableAt");
CREATE INDEX "EvidenceOutbox_ownerUserId_createdAt_idx" ON "EvidenceOutbox"("ownerUserId", "createdAt");
CREATE INDEX "EvidenceOutbox_correlationId_idx" ON "EvidenceOutbox"("correlationId");
CREATE INDEX "EvidenceOutbox_causationId_idx" ON "EvidenceOutbox"("causationId");
