CREATE TABLE "DiagnosisReportExportArtifact" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "projectionVersion" TEXT NOT NULL,
    "roleVersion" TEXT NOT NULL,
    "audienceUserId" TEXT NOT NULL DEFAULT '',
    "contentHash" TEXT NOT NULL,
    "artifactHash" TEXT NOT NULL,
    "artifactBytes" BYTEA NOT NULL,
    "artifactSizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagnosisReportExportArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosisReportExportEvent" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagnosisReportExportEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosisReportDispositionEvent" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actionRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'recorded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagnosisReportDispositionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagnosisReportExportArtifact_identity_key" ON "DiagnosisReportExportArtifact"("reportId", "projectionVersion", "roleVersion", "audienceUserId");
CREATE INDEX "DiagnosisReportExportArtifact_reportId_createdAt_idx" ON "DiagnosisReportExportArtifact"("reportId", "createdAt");
CREATE INDEX "DiagnosisReportExportArtifact_createdById_createdAt_idx" ON "DiagnosisReportExportArtifact"("createdById", "createdAt");
CREATE INDEX "DiagnosisReportExportEvent_artifactId_exportedAt_idx" ON "DiagnosisReportExportEvent"("artifactId", "exportedAt");
CREATE INDEX "DiagnosisReportExportEvent_actorId_exportedAt_idx" ON "DiagnosisReportExportEvent"("actorId", "exportedAt");
CREATE UNIQUE INDEX "DiagnosisReportDisposition_idempotency_key" ON "DiagnosisReportDispositionEvent"("reportId", "actorId", "idempotencyKey");
CREATE INDEX "DiagnosisReportDispositionEvent_reportId_targetKind_targetKey_createdAt_idx" ON "DiagnosisReportDispositionEvent"("reportId", "targetKind", "targetKey", "createdAt");
CREATE INDEX "DiagnosisReportDispositionEvent_actorId_createdAt_idx" ON "DiagnosisReportDispositionEvent"("actorId", "createdAt");

ALTER TABLE "DiagnosisReportExportArtifact" ADD CONSTRAINT "DiagnosisReportExportArtifact_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DiagnosisReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosisReportExportArtifact" ADD CONSTRAINT "DiagnosisReportExportArtifact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosisReportExportEvent" ADD CONSTRAINT "DiagnosisReportExportEvent_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "DiagnosisReportExportArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosisReportExportEvent" ADD CONSTRAINT "DiagnosisReportExportEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosisReportDispositionEvent" ADD CONSTRAINT "DiagnosisReportDispositionEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DiagnosisReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosisReportDispositionEvent" ADD CONSTRAINT "DiagnosisReportDispositionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
