-- StudentState: support multiple state buckets per user/session
ALTER TABLE "StudentState"
ADD COLUMN     "stateKey" TEXT NOT NULL DEFAULT 'course',
ADD COLUMN     "lessonKey" TEXT,
ADD COLUMN     "lastClientEventAt" TIMESTAMP(3);

DROP INDEX "StudentState_sessionId_userId_key";
CREATE UNIQUE INDEX "StudentState_sessionId_userId_stateKey_key" ON "StudentState"("sessionId", "userId", "stateKey");
CREATE INDEX "StudentState_lessonKey_idx" ON "StudentState"("lessonKey");

-- InteractionLog: allow logical resource keys and richer classroom semantics
ALTER TABLE "InteractionLog"
ADD COLUMN     "resourceKey" TEXT NOT NULL DEFAULT '__legacy__',
ADD COLUMN     "lessonKey" TEXT,
ADD COLUMN     "stepId" TEXT,
ADD COLUMN     "actorRole" TEXT,
ADD COLUMN     "attemptKey" TEXT,
ADD COLUMN     "clientEventAt" TIMESTAMP(3);

UPDATE "InteractionLog"
SET "resourceKey" = COALESCE("resourceId", '__legacy__')
WHERE "resourceKey" = '__legacy__';

ALTER TABLE "InteractionLog"
ALTER COLUMN "resourceKey" DROP DEFAULT,
ALTER COLUMN "resourceId" DROP NOT NULL;

ALTER TABLE "InteractionLog" DROP CONSTRAINT "InteractionLog_resourceId_fkey";
ALTER TABLE "InteractionLog"
ADD CONSTRAINT "InteractionLog_resourceId_fkey"
FOREIGN KEY ("resourceId") REFERENCES "TeachingResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "InteractionLog_userId_resourceKey_idx" ON "InteractionLog"("userId", "resourceKey");
CREATE INDEX "InteractionLog_sessionId_lessonKey_idx" ON "InteractionLog"("sessionId", "lessonKey");

-- Frozen classroom reports
CREATE TABLE "ClassSessionReport" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "lessonKey" TEXT,
    "reportType" TEXT NOT NULL DEFAULT 'class-summary',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "summary" TEXT,
    "reportData" JSONB NOT NULL DEFAULT '{}',
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSessionReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentSessionReport" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonKey" TEXT,
    "reportType" TEXT NOT NULL DEFAULT 'student-summary',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "summary" TEXT,
    "reportData" JSONB NOT NULL DEFAULT '{}',
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSessionReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassSessionReport_sessionId_reportType_key" ON "ClassSessionReport"("sessionId", "reportType");
CREATE INDEX "ClassSessionReport_lessonKey_idx" ON "ClassSessionReport"("lessonKey");

CREATE UNIQUE INDEX "StudentSessionReport_sessionId_userId_reportType_key" ON "StudentSessionReport"("sessionId", "userId", "reportType");
CREATE INDEX "StudentSessionReport_lessonKey_idx" ON "StudentSessionReport"("lessonKey");
CREATE INDEX "StudentSessionReport_userId_idx" ON "StudentSessionReport"("userId");

ALTER TABLE "ClassSessionReport"
ADD CONSTRAINT "ClassSessionReport_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentSessionReport"
ADD CONSTRAINT "StudentSessionReport_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentSessionReport"
ADD CONSTRAINT "StudentSessionReport_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
