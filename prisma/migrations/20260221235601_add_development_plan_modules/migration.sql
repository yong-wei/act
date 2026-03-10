-- CreateTable
CREATE TABLE "LinkageSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interactions" JSONB[],

    CONSTRAINT "LinkageSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "domains" TEXT[],
    "difficulty" DOUBLE PRECISION NOT NULL,
    "discrimination" DOUBLE PRECISION NOT NULL,
    "guessing" DOUBLE PRECISION NOT NULL,
    "knowledgeTags" TEXT[],
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "crossDomainHint" TEXT,
    "source" TEXT NOT NULL,
    "aiMetadata" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'pending',
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "correctRate" DOUBLE PRECISION,
    "avgTimeSpent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpent" INTEGER NOT NULL,
    "answerGiven" TEXT NOT NULL,
    "thetaEstimate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbilityAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "computationalTheta" DOUBLE PRECISION NOT NULL,
    "crossDomainTheta" DOUBLE PRECISION NOT NULL,
    "designTheta" DOUBLE PRECISION NOT NULL,
    "knowledgePointAbilities" JSONB NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbilityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIIntervention" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "interventionType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "studentResponse" TEXT,
    "wasHelpful" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "promptContent" TEXT NOT NULL,
    "structuredData" JSONB,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "completenessScore" DOUBLE PRECISION NOT NULL,
    "precisionScore" DOUBLE PRECISION NOT NULL,
    "structurizationScore" DOUBLE PRECISION NOT NULL,
    "executabilityScore" DOUBLE PRECISION NOT NULL,
    "suggestions" JSONB[],
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "promptVersions" JSONB[],
    "designActions" JSONB[],
    "finalResult" JSONB,
    "consistencyScore" DOUBLE PRECISION,
    "goalBehaviorAlignment" DOUBLE PRECISION,
    "behaviorResultCoherence" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DesignSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkageSession_userId_createdAt_idx" ON "LinkageSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserAnswer_userId_createdAt_idx" ON "UserAnswer"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserAnswer_questionId_idx" ON "UserAnswer"("questionId");

-- CreateIndex
CREATE INDEX "AbilityAssessment_userId_assessedAt_idx" ON "AbilityAssessment"("userId", "assessedAt");

-- CreateIndex
CREATE INDEX "AIIntervention_userId_createdAt_idx" ON "AIIntervention"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIIntervention_sessionId_idx" ON "AIIntervention"("sessionId");

-- CreateIndex
CREATE INDEX "PromptAssessment_userId_createdAt_idx" ON "PromptAssessment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PromptAssessment_sessionId_version_idx" ON "PromptAssessment"("sessionId", "version");

-- CreateIndex
CREATE INDEX "DesignSession_userId_startedAt_idx" ON "DesignSession"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "LinkageSession" ADD CONSTRAINT "LinkageSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbilityAssessment" ADD CONSTRAINT "AbilityAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIIntervention" ADD CONSTRAINT "AIIntervention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptAssessment" ADD CONSTRAINT "PromptAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignSession" ADD CONSTRAINT "DesignSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
