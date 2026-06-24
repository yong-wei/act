-- CreateTable
CREATE TABLE "DiagnosisReportSnapshot" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "userId" TEXT,
    "classId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "materializerVersion" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosisReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagnosisReportSnapshot_goalId_subjectKind_generatedAt_idx" ON "DiagnosisReportSnapshot"("goalId", "subjectKind", "generatedAt");

-- CreateIndex
CREATE INDEX "DiagnosisReportSnapshot_goalId_userId_generatedAt_idx" ON "DiagnosisReportSnapshot"("goalId", "userId", "generatedAt");

-- CreateIndex
CREATE INDEX "DiagnosisReportSnapshot_goalId_classId_generatedAt_idx" ON "DiagnosisReportSnapshot"("goalId", "classId", "generatedAt");

-- CreateIndex
CREATE INDEX "DiagnosisReportSnapshot_materializerVersion_generatedAt_idx" ON "DiagnosisReportSnapshot"("materializerVersion", "generatedAt");
