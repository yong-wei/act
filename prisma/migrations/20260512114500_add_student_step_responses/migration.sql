CREATE TABLE "StudentStepResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "lessonKey" TEXT,
    "stepId" TEXT NOT NULL,
    "attemptKey" TEXT,
    "sourceLogId" TEXT,
    "clientEventId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "responseData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentStepResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentStepResponse_sourceLogId_key" ON "StudentStepResponse"("sourceLogId");
CREATE INDEX "StudentStepResponse_sessionId_stepId_idx" ON "StudentStepResponse"("sessionId", "stepId");
CREATE INDEX "StudentStepResponse_userId_submittedAt_idx" ON "StudentStepResponse"("userId", "submittedAt");
CREATE INDEX "StudentStepResponse_lessonKey_stepId_idx" ON "StudentStepResponse"("lessonKey", "stepId");
CREATE INDEX "StudentStepResponse_attemptKey_idx" ON "StudentStepResponse"("attemptKey");
CREATE INDEX "StudentStepResponse_clientEventId_idx" ON "StudentStepResponse"("clientEventId");

ALTER TABLE "StudentStepResponse"
ADD CONSTRAINT "StudentStepResponse_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentStepResponse"
ADD CONSTRAINT "StudentStepResponse_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentStepResponse"
ADD CONSTRAINT "StudentStepResponse_sourceLogId_fkey"
FOREIGN KEY ("sourceLogId") REFERENCES "InteractionLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
