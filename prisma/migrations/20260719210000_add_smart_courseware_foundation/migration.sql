CREATE TYPE "SmartCoursewareDraftState" AS ENUM ('EDITABLE', 'READY', 'GENERATING', 'ACCEPTED');
CREATE TYPE "SmartCoursewareSourceState" AS ENUM ('VERIFIED', 'AI_GENERATED_SOURCE_PENDING', 'TEACHER_CREATED_SOURCE_PENDING');
CREATE TYPE "SmartCoursewareProvenance" AS ENUM ('AI_GENERATED', 'AI_GENERATED_TEACHER_EDITED', 'TEACHER_CREATED');

CREATE TABLE "SmartCoursewareDraft" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "planRevisionId" TEXT NOT NULL,
  "planRevisionNumber" INTEGER NOT NULL,
  "planContentHash" TEXT NOT NULL,
  "authoringLineageRoot" TEXT NOT NULL,
  "state" "SmartCoursewareDraftState" NOT NULL DEFAULT 'EDITABLE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "runtimeManifest" JSONB,
  "contentHash" TEXT,
  "validationSnapshot" JSONB,
  "creationIdempotencyKey" TEXT NOT NULL,
  "creationRequestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartCoursewareDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewareDraft_plan_revision_number_check" CHECK ("planRevisionNumber" > 0),
  CONSTRAINT "SmartCoursewareDraft_version_check" CHECK ("version" > 0),
  CONSTRAINT "SmartCoursewareDraft_manifest_check" CHECK (
    ("runtimeManifest" IS NULL AND "contentHash" IS NULL)
    OR ("runtimeManifest" IS NOT NULL AND "contentHash" IS NOT NULL)
  )
);

CREATE TABLE "SmartCoursewareModule" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "runtimeModuleId" TEXT NOT NULL,
  "moduleInstanceLineage" TEXT NOT NULL,
  "activeIdentity" TEXT,
  "contentHash" TEXT NOT NULL,
  "sourceState" "SmartCoursewareSourceState" NOT NULL,
  "sourceBindings" JSONB NOT NULL DEFAULT '[]',
  "sourceBindingSetHash" TEXT NOT NULL,
  "gapIdentity" TEXT,
  "provenance" "SmartCoursewareProvenance" NOT NULL,
  "originalAttemptId" TEXT,
  "teacherMetadata" JSONB NOT NULL DEFAULT '{}',
  "currentRevisionNumber" INTEGER NOT NULL DEFAULT 1,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartCoursewareModule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewareModule_revision_number_check" CHECK ("currentRevisionNumber" > 0),
  CONSTRAINT "SmartCoursewareModule_gap_check" CHECK (
    ("sourceState" = 'VERIFIED' AND "gapIdentity" IS NULL)
    OR ("sourceState" <> 'VERIFIED' AND "gapIdentity" IS NOT NULL)
  ),
  CONSTRAINT "SmartCoursewareModule_active_identity_check" CHECK (
    ("deletedAt" IS NULL AND "activeIdentity" IS NOT NULL)
    OR ("deletedAt" IS NOT NULL AND "activeIdentity" IS NULL)
  )
);

CREATE TABLE "SmartCoursewareModuleRevision" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "moduleRecordId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "changeKind" TEXT NOT NULL,
  "runtimeModuleSnapshot" JSONB NOT NULL,
  "teacherMetadataSnapshot" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "sourceState" "SmartCoursewareSourceState" NOT NULL,
  "sourceBindings" JSONB NOT NULL DEFAULT '[]',
  "sourceBindingSetHash" TEXT NOT NULL,
  "gapIdentity" TEXT,
  "provenance" "SmartCoursewareProvenance" NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCoursewareModuleRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewareModuleRevision_number_check" CHECK ("revisionNumber" > 0),
  CONSTRAINT "SmartCoursewareModuleRevision_gap_check" CHECK (
    ("sourceState" = 'VERIFIED' AND "gapIdentity" IS NULL)
    OR ("sourceState" <> 'VERIFIED' AND "gapIdentity" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "SmartCoursewareDraft_authoringLineageRoot_key" ON "SmartCoursewareDraft"("authoringLineageRoot");
CREATE UNIQUE INDEX "SmartCoursewareDraft_ownerId_creationIdempotencyKey_key" ON "SmartCoursewareDraft"("ownerId", "creationIdempotencyKey");
CREATE INDEX "SmartCoursewareDraft_ownerId_updatedAt_idx" ON "SmartCoursewareDraft"("ownerId", "updatedAt");
CREATE INDEX "SmartCoursewareDraft_ownerId_planRevisionId_idx" ON "SmartCoursewareDraft"("ownerId", "planRevisionId");
CREATE UNIQUE INDEX "SmartCoursewareModule_moduleInstanceLineage_key" ON "SmartCoursewareModule"("moduleInstanceLineage");
CREATE UNIQUE INDEX "SmartCoursewareModule_activeIdentity_key" ON "SmartCoursewareModule"("activeIdentity");
CREATE INDEX "SmartCoursewareModule_ownerId_draftId_runtimeModuleId_idx" ON "SmartCoursewareModule"("ownerId", "draftId", "runtimeModuleId");
CREATE INDEX "SmartCoursewareModule_draftId_gapIdentity_idx" ON "SmartCoursewareModule"("draftId", "gapIdentity");
CREATE UNIQUE INDEX "SmartCoursewareModuleRevision_moduleRecordId_revisionNumber_key" ON "SmartCoursewareModuleRevision"("moduleRecordId", "revisionNumber");
CREATE INDEX "SmartCoursewareModuleRevision_ownerId_moduleRecordId_createdAt_idx" ON "SmartCoursewareModuleRevision"("ownerId", "moduleRecordId", "createdAt");

ALTER TABLE "SmartCoursewareDraft" ADD CONSTRAINT "SmartCoursewareDraft_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareDraft" ADD CONSTRAINT "SmartCoursewareDraft_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "SmartLessonRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareModule" ADD CONSTRAINT "SmartCoursewareModule_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "SmartCoursewareDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareModuleRevision" ADD CONSTRAINT "SmartCoursewareModuleRevision_moduleRecordId_fkey" FOREIGN KEY ("moduleRecordId") REFERENCES "SmartCoursewareModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareModuleRevision" ADD CONSTRAINT "SmartCoursewareModuleRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_smart_courseware_module_revision_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SmartCoursewareModuleRevision rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SmartCoursewareModuleRevision_immutable"
BEFORE UPDATE OR DELETE ON "SmartCoursewareModuleRevision"
FOR EACH ROW EXECUTE FUNCTION "reject_smart_courseware_module_revision_mutation"();
