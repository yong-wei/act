-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InteractionLog" ALTER COLUMN "resourceKey" DROP NOT NULL;

-- CreateTable
CREATE TABLE "KonlingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KonlingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEventBatch" (
    "id" TEXT NOT NULL,
    "batchDate" DATE NOT NULL,
    "events" JSONB NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEventBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDictionary" (
    "eventType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "description" TEXT,
    "schema" JSONB,
    "competencyMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDictionary_pkey" PRIMARY KEY ("eventType")
);

-- CreateTable
CREATE TABLE "LearningFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "moduleId" TEXT,
    "sessionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "outcome" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "timeSpent" INTEGER,
    "competencyContribution" JSONB NOT NULL,
    "sourceEventId" TEXT,
    "sourceLogId" TEXT,
    "courseId" TEXT,
    "lessonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCompetencySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "competencyVector" JSONB NOT NULL,
    "evidenceSummary" JSONB NOT NULL,
    "riskFlags" JSONB NOT NULL,
    "trajectoryVector" JSONB,
    "calculationVersion" TEXT NOT NULL DEFAULT 'v1',
    "factCount" INTEGER NOT NULL,

    CONSTRAINT "StudentCompetencySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfileSummary" (
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "overallLevel" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "strengthsJson" JSONB NOT NULL,
    "weaknessesJson" JSONB NOT NULL,
    "recentTrend" TEXT NOT NULL,
    "trendDirection" TEXT NOT NULL,
    "riskFlagsJson" JSONB NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "recommendedScaffolding" TEXT NOT NULL,
    "recentActivityJson" JSONB NOT NULL,
    "cacheExpiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfileSummary_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ClassCompetencySnapshot" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "aggregateJson" JSONB NOT NULL,
    "distributionJson" JSONB NOT NULL,
    "trendJson" JSONB NOT NULL,
    "riskSummaryJson" JSONB NOT NULL,
    "levelDistribution" JSONB NOT NULL,
    "activeStudentCount" INTEGER NOT NULL,
    "totalStudentCount" INTEGER NOT NULL,

    CONSTRAINT "ClassCompetencySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRiskFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flagType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRiskFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "mediaUrls" TEXT[],
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetModule" TEXT,
    "estimatedTime" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "wasHelpful" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KonlingSession_userId_courseId_pageId_idx" ON "KonlingSession"("userId", "courseId", "pageId");

-- CreateIndex
CREATE INDEX "KonlingSession_expiresAt_idx" ON "KonlingSession"("expiresAt");

-- CreateIndex
CREATE INDEX "KonlingSession_userId_updatedAt_idx" ON "KonlingSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "LearningEventBatch_batchDate_idx" ON "LearningEventBatch"("batchDate");

-- CreateIndex
CREATE INDEX "LearningEventBatch_processedAt_idx" ON "LearningEventBatch"("processedAt");

-- CreateIndex
CREATE INDEX "LearningFact_userId_factType_idx" ON "LearningFact"("userId", "factType");

-- CreateIndex
CREATE INDEX "LearningFact_userId_startedAt_idx" ON "LearningFact"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "LearningFact_sessionId_idx" ON "LearningFact"("sessionId");

-- CreateIndex
CREATE INDEX "LearningFact_factType_startedAt_idx" ON "LearningFact"("factType", "startedAt");

-- CreateIndex
CREATE INDEX "StudentCompetencySnapshot_userId_snapshotAt_idx" ON "StudentCompetencySnapshot"("userId", "snapshotAt");

-- CreateIndex
CREATE INDEX "StudentCompetencySnapshot_snapshotAt_idx" ON "StudentCompetencySnapshot"("snapshotAt");

-- CreateIndex
CREATE INDEX "StudentProfileSummary_updatedAt_idx" ON "StudentProfileSummary"("updatedAt");

-- CreateIndex
CREATE INDEX "StudentProfileSummary_riskLevel_idx" ON "StudentProfileSummary"("riskLevel");

-- CreateIndex
CREATE INDEX "ClassCompetencySnapshot_classId_snapshotAt_idx" ON "ClassCompetencySnapshot"("classId", "snapshotAt");

-- CreateIndex
CREATE INDEX "StudentRiskFlag_userId_flagType_idx" ON "StudentRiskFlag"("userId", "flagType");

-- CreateIndex
CREATE INDEX "StudentRiskFlag_userId_isResolved_idx" ON "StudentRiskFlag"("userId", "isResolved");

-- CreateIndex
CREATE INDEX "StudentRiskFlag_flagType_severity_idx" ON "StudentRiskFlag"("flagType", "severity");

-- CreateIndex
CREATE INDEX "GrowthRecord_userId_recordType_idx" ON "GrowthRecord"("userId", "recordType");

-- CreateIndex
CREATE INDEX "GrowthRecord_userId_occurredAt_idx" ON "GrowthRecord"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "LearningRecommendation_userId_recType_idx" ON "LearningRecommendation"("userId", "recType");

-- CreateIndex
CREATE INDEX "LearningRecommendation_userId_isCompleted_idx" ON "LearningRecommendation"("userId", "isCompleted");

-- AddForeignKey
ALTER TABLE "KonlingSession" ADD CONSTRAINT "KonlingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRiskFlag" ADD CONSTRAINT "StudentRiskFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
