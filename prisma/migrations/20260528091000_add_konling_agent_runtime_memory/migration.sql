-- Add governed Konling memory and intervention outcome fields.

ALTER TABLE "AIIntervention"
  ADD COLUMN "classId" TEXT,
  ADD COLUMN "resourceId" TEXT,
  ADD COLUMN "pathNodeId" TEXT,
  ADD COLUMN "whyNow" TEXT,
  ADD COLUMN "evidence" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "alternatives" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "privacyScope" TEXT NOT NULL DEFAULT 'student-visible',
  ADD COLUMN "teacherPolicy" TEXT NOT NULL DEFAULT 'allowed',
  ADD COLUMN "cooldownUntil" TIMESTAMP(3),
  ADD COLUMN "outcome" JSONB;

CREATE TABLE "KonlingMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "classId" TEXT,
  "courseId" TEXT,
  "pageId" TEXT,
  "resourceId" TEXT,
  "pathNodeId" TEXT,
  "memoryType" TEXT NOT NULL,
  "privacyScope" TEXT NOT NULL DEFAULT 'student-visible',
  "summary" TEXT NOT NULL,
  "evidenceRefs" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),

  CONSTRAINT "KonlingMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIIntervention_userId_interventionType_createdAt_idx" ON "AIIntervention"("userId", "interventionType", "createdAt");
CREATE INDEX "AIIntervention_classId_idx" ON "AIIntervention"("classId");
CREATE INDEX "AIIntervention_resourceId_idx" ON "AIIntervention"("resourceId");
CREATE INDEX "KonlingMemory_userId_memoryType_createdAt_idx" ON "KonlingMemory"("userId", "memoryType", "createdAt");
CREATE INDEX "KonlingMemory_sessionId_idx" ON "KonlingMemory"("sessionId");
CREATE INDEX "KonlingMemory_classId_idx" ON "KonlingMemory"("classId");
CREATE INDEX "KonlingMemory_courseId_pageId_idx" ON "KonlingMemory"("courseId", "pageId");
CREATE INDEX "KonlingMemory_resourceId_idx" ON "KonlingMemory"("resourceId");
CREATE INDEX "KonlingMemory_pathNodeId_idx" ON "KonlingMemory"("pathNodeId");
CREATE INDEX "KonlingMemory_privacyScope_idx" ON "KonlingMemory"("privacyScope");

ALTER TABLE "KonlingMemory"
  ADD CONSTRAINT "KonlingMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
