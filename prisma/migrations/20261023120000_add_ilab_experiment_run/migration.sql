-- CreateTable
CREATE TABLE "IlabExperimentRun" (
    "id" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "ilabUsername" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" INTEGER NOT NULL DEFAULT 2,
    "score" INTEGER NOT NULL DEFAULT 0,
    "startTimeMs" BIGINT NOT NULL,
    "endTimeMs" BIGINT,
    "timeUsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "vesselId" TEXT NOT NULL DEFAULT '',
    "steps" JSONB NOT NULL,
    "aiLedger" JSONB NOT NULL,
    "reportHtml" TEXT,
    "uploadStatus" TEXT NOT NULL DEFAULT 'pending',
    "uploadResult" JSONB,
    "attachmentResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IlabExperimentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IlabExperimentRun_originId_key" ON "IlabExperimentRun"("originId");

-- CreateIndex
CREATE INDEX "IlabExperimentRun_ilabUsername_createdAt_idx" ON "IlabExperimentRun"("ilabUsername", "createdAt");
