-- CreateTable
CREATE TABLE "ArenaControllerArtifact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "artifactHash" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaControllerArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaEvaluationRun" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "artifactHash" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "artifactPayload" JSONB NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "metrics" JSONB NOT NULL,
    "satisfaction" JSONB NOT NULL,
    "hardConstraintResults" JSONB NOT NULL,
    "penalties" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaSubmission" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentLabel" TEXT NOT NULL,
    "artifactHash" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "controllerArtifactId" TEXT NOT NULL,
    "evaluationRunId" TEXT NOT NULL,

    CONSTRAINT "ArenaSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArenaControllerArtifact_ownerId_taskId_artifactHash_key" ON "ArenaControllerArtifact"("ownerId", "taskId", "artifactHash");

-- CreateIndex
CREATE INDEX "ArenaControllerArtifact_taskId_idx" ON "ArenaControllerArtifact"("taskId");

-- CreateIndex
CREATE INDEX "ArenaControllerArtifact_artifactHash_idx" ON "ArenaControllerArtifact"("artifactHash");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaEvaluationRun_taskId_artifactHash_protocolVersion_key" ON "ArenaEvaluationRun"("taskId", "artifactHash", "protocolVersion");

-- CreateIndex
CREATE INDEX "ArenaEvaluationRun_taskId_score_idx" ON "ArenaEvaluationRun"("taskId", "score");

-- CreateIndex
CREATE INDEX "ArenaEvaluationRun_completedAt_idx" ON "ArenaEvaluationRun"("completedAt");

-- CreateIndex
CREATE INDEX "ArenaSubmission_taskId_score_idx" ON "ArenaSubmission"("taskId", "score");

-- CreateIndex
CREATE INDEX "ArenaSubmission_taskId_method_idx" ON "ArenaSubmission"("taskId", "method");

-- CreateIndex
CREATE INDEX "ArenaSubmission_taskId_submittedAt_idx" ON "ArenaSubmission"("taskId", "submittedAt");

-- CreateIndex
CREATE INDEX "ArenaSubmission_userId_submittedAt_idx" ON "ArenaSubmission"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "ArenaSubmission_artifactHash_idx" ON "ArenaSubmission"("artifactHash");

-- AddForeignKey
ALTER TABLE "ArenaControllerArtifact" ADD CONSTRAINT "ArenaControllerArtifact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaSubmission" ADD CONSTRAINT "ArenaSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaSubmission" ADD CONSTRAINT "ArenaSubmission_controllerArtifactId_fkey" FOREIGN KEY ("controllerArtifactId") REFERENCES "ArenaControllerArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaSubmission" ADD CONSTRAINT "ArenaSubmission_evaluationRunId_fkey" FOREIGN KEY ("evaluationRunId") REFERENCES "ArenaEvaluationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
