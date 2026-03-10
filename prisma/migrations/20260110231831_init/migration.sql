-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MissionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'EXPERT');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ViolationType" AS ENUM ('EXCESSIVE_RUDDER_RATE', 'EXCESSIVE_ROLL_ANGLE', 'COLLISION_RISK', 'ENVIRONMENTAL_HAZARD', 'SAFETY_VIOLATION');

-- CreateEnum
CREATE TYPE "LearningStyle" AS ENUM ('VISUAL', 'TEXTUAL', 'INTERACTIVE', 'AUDITORY', 'LOGICAL');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'CURRENT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "KnowledgeNodeType" AS ENUM ('THEORY', 'SCENARIO', 'ETHICS');

-- CreateEnum
CREATE TYPE "BloomLevel" AS ENUM ('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE');

-- CreateEnum
CREATE TYPE "KnowledgeDimension" AS ENUM ('FACTUAL', 'CONCEPTUAL', 'PROCEDURAL', 'METACOGNITIVE');

-- CreateEnum
CREATE TYPE "LearningStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('STATIC_TEXT', 'STATIC_MEDIA', 'INTERACTIVE_COMP', 'SIMULATION_APP', 'ETHICS_SCENARIO');

-- CreateEnum
CREATE TYPE "InteractiveCategory" AS ENUM ('SYSTEM_MODELING', 'TIME_DOMAIN', 'ROOT_LOCUS', 'FREQUENCY_DOMAIN', 'SYSTEM_CORRECTION', 'NONLINEAR', 'FUN_EXPLORATION', 'CLASSROOM');

-- CreateEnum
CREATE TYPE "BopppsStage" AS ENUM ('BRIDGE_IN', 'OBJECTIVE', 'PRE_ASSESSMENT', 'PARTICIPATORY', 'POST_ASSESSMENT', 'SUMMARY');

-- CreateEnum
CREATE TYPE "LessonItemType" AS ENUM ('RESOURCE', 'KNOWLEDGE_NODE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "passwordHash" TEXT,
    "employeeNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentNumber" TEXT,
    "classId" TEXT,
    "techScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ethicsScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "major" TEXT,
    "year" TEXT,
    "className" TEXT,
    "controlCredits" INTEGER NOT NULL DEFAULT 0,
    "controlUnlocks" JSONB NOT NULL DEFAULT '[]',
    "controlOdysseyProgress" JSONB NOT NULL DEFAULT '{}',
    "controlControllerLevels" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlOdysseyAiHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlOdysseyAiHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "description" TEXT,
    "year" TEXT,
    "semester" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT,
    "simType" TEXT NOT NULL,
    "inputParams" JSONB NOT NULL,
    "outputSummary" TEXT,
    "artifacts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT,
    "threadId" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" "MissionDifficulty" NOT NULL DEFAULT 'EASY',
    "order" INTEGER NOT NULL DEFAULT 0,
    "objectives" JSONB,
    "unlockCriteria" JSONB,
    "seaStateConfig" JSONB,
    "shipType" TEXT NOT NULL DEFAULT 'destroyer',
    "taskType" TEXT NOT NULL DEFAULT 'turn90',
    "duration" INTEGER NOT NULL DEFAULT 180,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'LOCKED',
    "bestScore" DOUBLE PRECISION,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT,
    "sessionId" TEXT,
    "controlMode" TEXT NOT NULL DEFAULT 'PID',
    "inputParams" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "trajectoryData" JSONB,
    "isEthicalViolation" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION,
    "duration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EthicalLog" (
    "id" TEXT NOT NULL,
    "simulationLogId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "violationType" "ViolationType" NOT NULL,
    "thresholdValue" DOUBLE PRECISION,
    "actualValue" DOUBLE PRECISION,
    "aiCritique" TEXT,
    "studentJustification" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EthicalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "learningStyle" "LearningStyle" NOT NULL DEFAULT 'VISUAL',
    "cognitiveLevel" INTEGER NOT NULL DEFAULT 1,
    "fleetGroup" TEXT,
    "dailyStudyMinutes" INTEGER NOT NULL DEFAULT 0,
    "experimentMinutes" INTEGER NOT NULL DEFAULT 0,
    "ethicsMinutes" INTEGER NOT NULL DEFAULT 0,
    "aiRecommendIndex" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "unlockedShips" INTEGER NOT NULL DEFAULT 0,
    "totalShips" INTEGER NOT NULL DEFAULT 36,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningMilestone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EthicsScenario" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scenarioType" TEXT NOT NULL,
    "defaultSafety" INTEGER NOT NULL DEFAULT 33,
    "defaultEcology" INTEGER NOT NULL DEFAULT 33,
    "defaultEconomy" INTEGER NOT NULL DEFAULT 34,
    "defaultTimeLimit" INTEGER NOT NULL DEFAULT 120,
    "defaultInfoFog" INTEGER NOT NULL DEFAULT 30,
    "regulations" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EthicsScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EthicsDecision" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "safetyWeight" INTEGER NOT NULL,
    "ecologyWeight" INTEGER NOT NULL,
    "economyWeight" INTEGER NOT NULL,
    "selectedRules" JSONB NOT NULL DEFAULT '[]',
    "chosenOption" TEXT NOT NULL,
    "optionDetails" TEXT NOT NULL,
    "humanCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ecologicalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "economicCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "culturalImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "decisionTime" INTEGER NOT NULL,
    "timeRemaining" INTEGER NOT NULL,
    "aiScore" DOUBLE PRECISION,
    "aiFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EthicsDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EthicsDecisionLog" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "EthicsDecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nodeType" "KnowledgeNodeType" NOT NULL,
    "description" TEXT NOT NULL,
    "bloomLevel" "BloomLevel" NOT NULL DEFAULT 'UNDERSTAND',
    "knowledgeDim" "KnowledgeDimension" NOT NULL DEFAULT 'CONCEPTUAL',
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "resources" JSONB NOT NULL DEFAULT '[]',
    "ethicsContent" JSONB,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeLink" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,

    CONSTRAINT "KnowledgeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingResource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ResourceType" NOT NULL,
    "content" TEXT,
    "registryId" TEXT,
    "category" "InteractiveCategory",
    "displayName" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "teacherOnly" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "aiHints" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "authorId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "presetKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "itemType" "LessonItemType" NOT NULL DEFAULT 'RESOURCE',
    "resourceId" TEXT,
    "knowledgeNodeId" TEXT,
    "stage" "BopppsStage" NOT NULL,
    "order" INTEGER NOT NULL,
    "duration" INTEGER,
    "overrideConfig" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStage" "BopppsStage",
    "currentItemId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentState" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT,
    "data" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" "LearningStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "lastVisited" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "KnowledgeProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedTime" INTEGER NOT NULL,
    "nodeIds" JSONB NOT NULL DEFAULT '[]',
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "isBookmarked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_KnowledgeNodeToTeachingResource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "ControlOdysseyAiHistory_levelId_idx" ON "ControlOdysseyAiHistory"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlOdysseyAiHistory_userId_levelId_key" ON "ControlOdysseyAiHistory"("userId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_code_key" ON "Class"("code");

-- CreateIndex
CREATE INDEX "Class_teacherId_idx" ON "Class"("teacherId");

-- CreateIndex
CREATE INDEX "SimulationSession_userId_idx" ON "SimulationSession"("userId");

-- CreateIndex
CREATE INDEX "LlmSession_userId_idx" ON "LlmSession"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "UserProgress_userId_idx" ON "UserProgress"("userId");

-- CreateIndex
CREATE INDEX "UserProgress_missionId_idx" ON "UserProgress"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_missionId_key" ON "UserProgress"("userId", "missionId");

-- CreateIndex
CREATE INDEX "SimulationLog_userId_idx" ON "SimulationLog"("userId");

-- CreateIndex
CREATE INDEX "SimulationLog_missionId_idx" ON "SimulationLog"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "EthicalLog_simulationLogId_key" ON "EthicalLog"("simulationLogId");

-- CreateIndex
CREATE INDEX "EthicalLog_userId_idx" ON "EthicalLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProfile_userId_key" ON "LearningProfile"("userId");

-- CreateIndex
CREATE INDEX "LearningMilestone_userId_idx" ON "LearningMilestone"("userId");

-- CreateIndex
CREATE INDEX "Achievement_userId_idx" ON "Achievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_userId_badgeType_key" ON "Achievement"("userId", "badgeType");

-- CreateIndex
CREATE INDEX "EthicsDecision_userId_idx" ON "EthicsDecision"("userId");

-- CreateIndex
CREATE INDEX "EthicsDecision_scenarioId_idx" ON "EthicsDecision"("scenarioId");

-- CreateIndex
CREATE INDEX "EthicsDecisionLog_userId_scenarioId_idx" ON "EthicsDecisionLog"("userId", "scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeLink_sourceId_targetId_key" ON "KnowledgeLink"("sourceId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlan_presetKey_key" ON "LessonPlan"("presetKey");

-- CreateIndex
CREATE INDEX "LessonItem_planId_idx" ON "LessonItem"("planId");

-- CreateIndex
CREATE INDEX "LessonItem_resourceId_idx" ON "LessonItem"("resourceId");

-- CreateIndex
CREATE INDEX "LessonItem_knowledgeNodeId_idx" ON "LessonItem"("knowledgeNodeId");

-- CreateIndex
CREATE INDEX "LessonItem_itemType_idx" ON "LessonItem"("itemType");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_joinCode_key" ON "ClassSession"("joinCode");

-- CreateIndex
CREATE INDEX "ClassSession_classId_idx" ON "ClassSession"("classId");

-- CreateIndex
CREATE INDEX "StudentState_sessionId_idx" ON "StudentState"("sessionId");

-- CreateIndex
CREATE INDEX "StudentState_userId_idx" ON "StudentState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentState_sessionId_userId_key" ON "StudentState"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "InteractionLog_userId_resourceId_idx" ON "InteractionLog"("userId", "resourceId");

-- CreateIndex
CREATE INDEX "InteractionLog_sessionId_idx" ON "InteractionLog"("sessionId");

-- CreateIndex
CREATE INDEX "InteractionLog_createdAt_idx" ON "InteractionLog"("createdAt");

-- CreateIndex
CREATE INDEX "InteractionLog_eventType_idx" ON "InteractionLog"("eventType");

-- CreateIndex
CREATE INDEX "KnowledgeProgress_userId_idx" ON "KnowledgeProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeProgress_userId_nodeId_key" ON "KnowledgeProgress"("userId", "nodeId");

-- CreateIndex
CREATE INDEX "LearningPath_userId_idx" ON "LearningPath"("userId");

-- CreateIndex
CREATE INDEX "LearningNote_userId_idx" ON "LearningNote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "_KnowledgeNodeToTeachingResource_AB_unique" ON "_KnowledgeNodeToTeachingResource"("A", "B");

-- CreateIndex
CREATE INDEX "_KnowledgeNodeToTeachingResource_B_index" ON "_KnowledgeNodeToTeachingResource"("B");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlOdysseyAiHistory" ADD CONSTRAINT "ControlOdysseyAiHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationSession" ADD CONSTRAINT "SimulationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmSession" ADD CONSTRAINT "LlmSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationLog" ADD CONSTRAINT "SimulationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationLog" ADD CONSTRAINT "SimulationLog_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalLog" ADD CONSTRAINT "EthicalLog_simulationLogId_fkey" FOREIGN KEY ("simulationLogId") REFERENCES "SimulationLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicalLog" ADD CONSTRAINT "EthicalLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProfile" ADD CONSTRAINT "LearningProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningMilestone" ADD CONSTRAINT "LearningMilestone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicsDecision" ADD CONSTRAINT "EthicsDecision_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "EthicsScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicsDecision" ADD CONSTRAINT "EthicsDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicsDecisionLog" ADD CONSTRAINT "EthicsDecisionLog_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "EthicsScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EthicsDecisionLog" ADD CONSTRAINT "EthicsDecisionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeLink" ADD CONSTRAINT "KnowledgeLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeLink" ADD CONSTRAINT "KnowledgeLink_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "KnowledgeNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingResource" ADD CONSTRAINT "TeachingResource_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LessonPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "TeachingResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LessonPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentState" ADD CONSTRAINT "StudentState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentState" ADD CONSTRAINT "StudentState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionLog" ADD CONSTRAINT "InteractionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionLog" ADD CONSTRAINT "InteractionLog_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "TeachingResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeProgress" ADD CONSTRAINT "KnowledgeProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeProgress" ADD CONSTRAINT "KnowledgeProgress_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "KnowledgeNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningNote" ADD CONSTRAINT "LearningNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KnowledgeNodeToTeachingResource" ADD CONSTRAINT "_KnowledgeNodeToTeachingResource_A_fkey" FOREIGN KEY ("A") REFERENCES "KnowledgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KnowledgeNodeToTeachingResource" ADD CONSTRAINT "_KnowledgeNodeToTeachingResource_B_fkey" FOREIGN KEY ("B") REFERENCES "TeachingResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

