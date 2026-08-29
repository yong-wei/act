-- 课堂提交证据边界（separate-classroom-live-state-from-submission-evidence）：
-- ClassSession 增加单调提交序列分配器、闭课接受水位与闭包修订；
-- 分类提交在 InteractionLog / StudentStepResponse 上获得数据库级幂等锚点。
-- 唯一索引列为可空列：PostgreSQL 唯一索引对 NULL 不去重，历史未分类行不受影响。
ALTER TABLE "ClassSession" ADD COLUMN "submissionSequence" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "ClassSession" ADD COLUMN "acceptedSubmissionWatermark" BIGINT;
ALTER TABLE "ClassSession" ADD COLUMN "closureRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "InteractionLog" ADD COLUMN "submissionIdentity" TEXT;

ALTER TABLE "StudentStepResponse" ADD COLUMN "submissionIdentity" TEXT;
ALTER TABLE "StudentStepResponse" ADD COLUMN "identityVersion" TEXT;
ALTER TABLE "StudentStepResponse" ADD COLUMN "submissionSequence" BIGINT;
ALTER TABLE "StudentStepResponse" ADD COLUMN "evidenceStatus" TEXT NOT NULL DEFAULT 'ACCEPTED';

ALTER TABLE "ClassSessionReport" ADD COLUMN "closureRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClassSessionReport" ADD COLUMN "acceptedSubmissionWatermark" BIGINT;
ALTER TABLE "ClassSessionReport" ADD COLUMN "recomputeRevision" INTEGER;
ALTER TABLE "ClassSessionReport" ADD COLUMN "recomputeInputWatermark" BIGINT;

CREATE UNIQUE INDEX "InteractionLog_userId_sessionId_submissionIdentity_key" ON "InteractionLog"("userId", "sessionId", "submissionIdentity");

CREATE UNIQUE INDEX "StudentStepResponse_sessionId_userId_submissionIdentity_key" ON "StudentStepResponse"("sessionId", "userId", "submissionIdentity");
CREATE INDEX "StudentStepResponse_sessionId_evidenceStatus_idx" ON "StudentStepResponse"("sessionId", "evidenceStatus");

CREATE TABLE "SessionClosureOutbox" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "closureRevision" INTEGER NOT NULL,
    "acceptedSubmissionWatermark" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "SessionClosureOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionClosureOutbox_sessionId_closureRevision_key" ON "SessionClosureOutbox"("sessionId", "closureRevision");
CREATE INDEX "SessionClosureOutbox_status_availableAt_idx" ON "SessionClosureOutbox"("status", "availableAt");

ALTER TABLE "SessionClosureOutbox" ADD CONSTRAINT "SessionClosureOutbox_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
