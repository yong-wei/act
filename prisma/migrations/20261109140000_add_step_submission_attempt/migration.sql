-- 步骤提交尝试（issue-2152 记录类型 D）。
CREATE TABLE "StepSubmissionAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "attemptSeq" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "runRefs" JSONB NOT NULL,
    "studentModelIds" JSONB,
    "comparisonIds" JSONB,
    "sketchRefs" JSONB,
    "explanation" TEXT,
    "scoringVersion" TEXT NOT NULL,
    "scoreResult" JSONB,
    "selectedFinalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StepSubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StepSubmissionAttempt_userId_experimentKey_stepKey_attemptSeq_key" ON "StepSubmissionAttempt"("userId", "experimentKey", "stepKey", "attemptSeq");

-- CreateIndex
CREATE INDEX "StepSubmissionAttempt_userId_experimentKey_stepKey_createdAt_idx" ON "StepSubmissionAttempt"("userId", "experimentKey", "stepKey", "createdAt");

-- AddForeignKey
ALTER TABLE "StepSubmissionAttempt" ADD CONSTRAINT "StepSubmissionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
