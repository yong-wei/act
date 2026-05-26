-- CreateTable
CREATE TABLE "AdaptiveAssessmentAlgorithmVersion" (
    "version" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveAssessmentAlgorithmVersion_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "selectedQuestionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "algorithmVersion" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAnsweredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveAssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentItemRef" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "domains" TEXT[],
    "knowledgeTags" TEXT[],
    "difficulty" DOUBLE PRECISION NOT NULL,
    "optionCount" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveAssessmentItemRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionRefId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionKey" TEXT NOT NULL,
    "correctOptionKey" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "responseTimeSeconds" INTEGER NOT NULL,
    "abilityEstimate" DOUBLE PRECISION NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveAssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentAbilityEstimate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "theta" DOUBLE PRECISION NOT NULL,
    "confidenceLow" DOUBLE PRECISION NOT NULL,
    "confidenceHigh" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "estimatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveAssessmentAbilityEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveMasteryUpdate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "knowledgeTag" TEXT NOT NULL,
    "priorMastery" DOUBLE PRECISION NOT NULL,
    "posteriorMastery" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidenceKind" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "updateReason" TEXT NOT NULL,
    "prerequisiteState" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveMasteryUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveAssessmentSession_userId_sessionKey_key" ON "AdaptiveAssessmentSession"("userId", "sessionKey");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentSession_userId_startedAt_idx" ON "AdaptiveAssessmentSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentSession_sessionKey_idx" ON "AdaptiveAssessmentSession"("sessionKey");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentSession_algorithmVersion_idx" ON "AdaptiveAssessmentSession"("algorithmVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveAssessmentItemRef_questionId_algorithmVersion_key" ON "AdaptiveAssessmentItemRef"("questionId", "algorithmVersion");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentItemRef_questionId_idx" ON "AdaptiveAssessmentItemRef"("questionId");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentItemRef_algorithmVersion_idx" ON "AdaptiveAssessmentItemRef"("algorithmVersion");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentAnswer_userId_answeredAt_idx" ON "AdaptiveAssessmentAnswer"("userId", "answeredAt");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentAnswer_sessionId_answeredAt_idx" ON "AdaptiveAssessmentAnswer"("sessionId", "answeredAt");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentAnswer_questionId_idx" ON "AdaptiveAssessmentAnswer"("questionId");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentAnswer_questionRefId_idx" ON "AdaptiveAssessmentAnswer"("questionRefId");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentAnswer_algorithmVersion_idx" ON "AdaptiveAssessmentAnswer"("algorithmVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveAssessmentAbilityEstimate_answerId_key" ON "AdaptiveAssessmentAbilityEstimate"("answerId");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentAbilityEstimate_userId_estimatedAt_idx" ON "AdaptiveAssessmentAbilityEstimate"("userId", "estimatedAt");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentAbilityEstimate_sessionId_idx" ON "AdaptiveAssessmentAbilityEstimate"("sessionId");

-- CreateIndex
CREATE INDEX "AdaptiveAssessmentAbilityEstimate_algorithmVersion_idx" ON "AdaptiveAssessmentAbilityEstimate"("algorithmVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveMasteryUpdate_answerId_knowledgeTag_algorithmVersion_key" ON "AdaptiveMasteryUpdate"("answerId", "knowledgeTag", "algorithmVersion");

-- CreateIndex
CREATE INDEX "AdaptiveMasteryUpdate_userId_knowledgeTag_createdAt_idx" ON "AdaptiveMasteryUpdate"("userId", "knowledgeTag", "createdAt");

-- CreateIndex
CREATE INDEX "AdaptiveMasteryUpdate_sessionId_idx" ON "AdaptiveMasteryUpdate"("sessionId");

-- CreateIndex
CREATE INDEX "AdaptiveMasteryUpdate_questionId_idx" ON "AdaptiveMasteryUpdate"("questionId");

-- CreateIndex
CREATE INDEX "AdaptiveMasteryUpdate_algorithmVersion_idx" ON "AdaptiveMasteryUpdate"("algorithmVersion");

-- AddForeignKey
ALTER TABLE "AdaptiveAssessmentSession" ADD CONSTRAINT "AdaptiveAssessmentSession_algorithmVersion_fkey" FOREIGN KEY ("algorithmVersion") REFERENCES "AdaptiveAssessmentAlgorithmVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveAssessmentItemRef" ADD CONSTRAINT "AdaptiveAssessmentItemRef_algorithmVersion_fkey" FOREIGN KEY ("algorithmVersion") REFERENCES "AdaptiveAssessmentAlgorithmVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveAssessmentAnswer" ADD CONSTRAINT "AdaptiveAssessmentAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdaptiveAssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveAssessmentAnswer" ADD CONSTRAINT "AdaptiveAssessmentAnswer_questionRefId_fkey" FOREIGN KEY ("questionRefId") REFERENCES "AdaptiveAssessmentItemRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveAssessmentAnswer" ADD CONSTRAINT "AdaptiveAssessmentAnswer_algorithmVersion_fkey" FOREIGN KEY ("algorithmVersion") REFERENCES "AdaptiveAssessmentAlgorithmVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveAssessmentAbilityEstimate" ADD CONSTRAINT "AdaptiveAssessmentAbilityEstimate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdaptiveAssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveAssessmentAbilityEstimate" ADD CONSTRAINT "AdaptiveAssessmentAbilityEstimate_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "AdaptiveAssessmentAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveAssessmentAbilityEstimate" ADD CONSTRAINT "AdaptiveAssessmentAbilityEstimate_algorithmVersion_fkey" FOREIGN KEY ("algorithmVersion") REFERENCES "AdaptiveAssessmentAlgorithmVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveMasteryUpdate" ADD CONSTRAINT "AdaptiveMasteryUpdate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdaptiveAssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveMasteryUpdate" ADD CONSTRAINT "AdaptiveMasteryUpdate_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "AdaptiveAssessmentAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveMasteryUpdate" ADD CONSTRAINT "AdaptiveMasteryUpdate_algorithmVersion_fkey" FOREIGN KEY ("algorithmVersion") REFERENCES "AdaptiveAssessmentAlgorithmVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
