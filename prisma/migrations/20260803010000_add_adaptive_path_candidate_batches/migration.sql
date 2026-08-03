CREATE TABLE "AdaptivePathCandidateBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "classId" TEXT,
    "generationRequestId" TEXT NOT NULL,
    "sourcePathId" TEXT NOT NULL,
    "plannerVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "candidateCount" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptivePathCandidateBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdaptivePathCandidate" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "styleId" TEXT NOT NULL,
    "policyFamily" TEXT,
    "label" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptivePathCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdaptivePathCandidateBatch_generationRequestId_key"
ON "AdaptivePathCandidateBatch"("generationRequestId");

CREATE INDEX "AdaptivePathCandidateBatch_userId_goalId_status_createdAt_idx"
ON "AdaptivePathCandidateBatch"("userId", "goalId", "status", "createdAt");

CREATE INDEX "AdaptivePathCandidateBatch_classId_goalId_status_createdAt_idx"
ON "AdaptivePathCandidateBatch"("classId", "goalId", "status", "createdAt");

CREATE UNIQUE INDEX "AdaptivePathCandidate_batchId_ordinal_key"
ON "AdaptivePathCandidate"("batchId", "ordinal");

CREATE UNIQUE INDEX "AdaptivePathCandidate_batchId_styleId_key"
ON "AdaptivePathCandidate"("batchId", "styleId");

CREATE INDEX "AdaptivePathCandidate_batchId_createdAt_idx"
ON "AdaptivePathCandidate"("batchId", "createdAt");

ALTER TABLE "AdaptivePathCandidateBatch"
ADD CONSTRAINT "AdaptivePathCandidateBatch_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdaptivePathCandidate"
ADD CONSTRAINT "AdaptivePathCandidate_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "AdaptivePathCandidateBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
