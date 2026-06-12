-- CreateTable
CREATE TABLE "CourseEnhancementPack" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "sourcePrepPackId" TEXT NOT NULL,
    "diagnosisSnapshotId" TEXT,
    "status" TEXT NOT NULL,
    "source" JSONB NOT NULL DEFAULT '{}',
    "items" JSONB NOT NULL DEFAULT '[]',
    "auditLog" JSONB NOT NULL DEFAULT '[]',
    "teacherFeedback" JSONB NOT NULL DEFAULT '[]',
    "activatedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEnhancementPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseEnhancementPack_teacherId_status_updatedAt_idx" ON "CourseEnhancementPack"("teacherId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CourseEnhancementPack_classId_lessonId_status_idx" ON "CourseEnhancementPack"("classId", "lessonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnhancementPack_sourcePrepPackId_key" ON "CourseEnhancementPack"("sourcePrepPackId");

-- CreateIndex
CREATE INDEX "CourseEnhancementPack_diagnosisSnapshotId_idx" ON "CourseEnhancementPack"("diagnosisSnapshotId");
