CREATE TYPE "SmartCoursewarePublicationReceiptKind" AS ENUM ('STATIC', 'BROWSER');
CREATE TYPE "SmartCoursewarePublicationGapScope" AS ENUM ('GOAL', 'MODULE');

CREATE TABLE "SmartCoursewarePublicationSeries" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "nextRevisionNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCoursewarePublicationSeries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewarePublicationSeries_next_revision_check" CHECK ("nextRevisionNumber" >= 1)
);

CREATE TABLE "SmartCoursewarePublicationReceipt" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sourceRevisionId" TEXT NOT NULL,
  "kind" "SmartCoursewarePublicationReceiptKind" NOT NULL,
  "contentHash" TEXT NOT NULL,
  "validatorVersion" TEXT NOT NULL,
  "profileHash" TEXT NOT NULL,
  "browserVersion" TEXT,
  "fontVersion" TEXT,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "completedById" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCoursewarePublicationReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewarePublicationReceipt_browser_metadata_check" CHECK (
    "kind" <> 'BROWSER' OR ("browserVersion" IS NOT NULL AND "fontVersion" IS NOT NULL)
  )
);

CREATE TABLE "SmartCoursewareGapAcknowledgement" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sourceRevisionId" TEXT NOT NULL,
  "scope" "SmartCoursewarePublicationGapScope" NOT NULL,
  "targetId" TEXT NOT NULL,
  "gapIdentity" TEXT NOT NULL,
  "targetContentHash" TEXT NOT NULL,
  "sourceState" TEXT NOT NULL,
  "sourceBindingSetHash" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "acknowledgedById" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCoursewareGapAcknowledgement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewareGapAcknowledgement_source_state_check" CHECK (
    "sourceState" IN ('AI_GENERATED_SOURCE_PENDING', 'TEACHER_CREATED_SOURCE_PENDING')
  )
);

CREATE TABLE "SmartCoursewareStalePlanAcknowledgement" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sourceRevisionId" TEXT NOT NULL,
  "baselinePlanRevisionId" TEXT NOT NULL,
  "baselineRevisionNumber" INTEGER NOT NULL,
  "baselinePlanContentHash" TEXT NOT NULL,
  "newestPlanRevisionId" TEXT NOT NULL,
  "newestRevisionNumber" INTEGER NOT NULL,
  "newestPlanContentHash" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "acknowledgedById" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCoursewareStalePlanAcknowledgement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewareStalePlanAcknowledgement_revision_check" CHECK (
    "baselineRevisionNumber" >= 1 AND "newestRevisionNumber" > "baselineRevisionNumber"
  )
);

CREATE TABLE "SmartCoursewarePublicationRevision" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "displayName" TEXT NOT NULL,
  "sourceRevisionId" TEXT NOT NULL,
  "sourceContentHash" TEXT NOT NULL,
  "planRevisionId" TEXT NOT NULL,
  "planRevisionNumber" INTEGER NOT NULL,
  "manifestSnapshot" JSONB NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "moduleMetadataSnapshot" JSONB NOT NULL,
  "gapsSnapshot" JSONB NOT NULL,
  "provenanceSnapshot" JSONB NOT NULL,
  "validationSnapshot" JSONB NOT NULL,
  "receiptSnapshot" JSONB NOT NULL,
  "acknowledgementSnapshot" JSONB NOT NULL,
  "stalePlanAcknowledgementSnapshot" JSONB,
  "contentHash" TEXT NOT NULL,
  "publishedById" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCoursewarePublicationRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewarePublicationRevision_number_check" CHECK ("revisionNumber" >= 1)
);

CREATE TABLE "SmartCoursewarePublicationOperation" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "sourceRevisionId" TEXT NOT NULL,
  "publicationRevisionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCoursewarePublicationOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartCoursewarePublicationSeries_taskId_key" ON "SmartCoursewarePublicationSeries"("taskId");
CREATE INDEX "SmartCoursewarePublicationSeries_ownerId_createdAt_idx" ON "SmartCoursewarePublicationSeries"("ownerId", "createdAt");
CREATE UNIQUE INDEX "SmartCoursewarePublicationReceipt_source_kind_hash_validator_profile_key" ON "SmartCoursewarePublicationReceipt"("sourceRevisionId", "kind", "contentHash", "validatorVersion", "profileHash");
CREATE INDEX "SmartCoursewarePublicationReceipt_owner_source_kind_completed_idx" ON "SmartCoursewarePublicationReceipt"("ownerId", "sourceRevisionId", "kind", "completedAt");
CREATE UNIQUE INDEX "SmartCoursewareGapAcknowledgement_owner_scope_gap_key" ON "SmartCoursewareGapAcknowledgement"("ownerId", "scope", "gapIdentity");
CREATE INDEX "SmartCoursewareGapAcknowledgement_source_scope_target_idx" ON "SmartCoursewareGapAcknowledgement"("sourceRevisionId", "scope", "targetId");
CREATE UNIQUE INDEX "SmartCoursewareStalePlanAcknowledgement_owner_source_newest_key" ON "SmartCoursewareStalePlanAcknowledgement"("ownerId", "sourceRevisionId", "newestPlanRevisionId");
CREATE INDEX "SmartCoursewareStalePlanAcknowledgement_source_newest_number_idx" ON "SmartCoursewareStalePlanAcknowledgement"("sourceRevisionId", "newestRevisionNumber");
CREATE UNIQUE INDEX "SmartCoursewarePublicationRevision_sourceRevisionId_key" ON "SmartCoursewarePublicationRevision"("sourceRevisionId");
CREATE UNIQUE INDEX "SmartCoursewarePublicationRevision_series_revision_key" ON "SmartCoursewarePublicationRevision"("seriesId", "revisionNumber");
CREATE INDEX "SmartCoursewarePublicationRevision_owner_published_idx" ON "SmartCoursewarePublicationRevision"("ownerId", "publishedAt");
CREATE INDEX "SmartCoursewarePublicationRevision_planRevisionId_idx" ON "SmartCoursewarePublicationRevision"("planRevisionId");
CREATE UNIQUE INDEX "SmartCoursewarePublicationOperation_owner_idempotency_key" ON "SmartCoursewarePublicationOperation"("ownerId", "idempotencyKey");
CREATE INDEX "SmartCoursewarePublicationOperation_source_created_idx" ON "SmartCoursewarePublicationOperation"("sourceRevisionId", "createdAt");

ALTER TABLE "SmartCoursewarePublicationSeries" ADD CONSTRAINT "SmartCoursewarePublicationSeries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SmartLessonTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareRevision" ADD CONSTRAINT "SmartCoursewareRevision_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "SmartLessonRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewarePublicationReceipt" ADD CONSTRAINT "SmartCoursewarePublicationReceipt_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "SmartCoursewareRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewarePublicationReceipt" ADD CONSTRAINT "SmartCoursewarePublicationReceipt_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareGapAcknowledgement" ADD CONSTRAINT "SmartCoursewareGapAcknowledgement_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "SmartCoursewareRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareGapAcknowledgement" ADD CONSTRAINT "SmartCoursewareGapAcknowledgement_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareStalePlanAcknowledgement" ADD CONSTRAINT "SmartCoursewareStalePlanAcknowledgement_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "SmartCoursewareRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareStalePlanAcknowledgement" ADD CONSTRAINT "SmartCoursewareStalePlanAcknowledgement_newestPlanRevisionId_fkey" FOREIGN KEY ("newestPlanRevisionId") REFERENCES "SmartLessonRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareStalePlanAcknowledgement" ADD CONSTRAINT "SmartCoursewareStalePlanAcknowledgement_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewarePublicationRevision" ADD CONSTRAINT "SmartCoursewarePublicationRevision_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "SmartCoursewarePublicationSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewarePublicationRevision" ADD CONSTRAINT "SmartCoursewarePublicationRevision_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "SmartCoursewareRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewarePublicationRevision" ADD CONSTRAINT "SmartCoursewarePublicationRevision_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "SmartLessonRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewarePublicationRevision" ADD CONSTRAINT "SmartCoursewarePublicationRevision_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewarePublicationOperation" ADD CONSTRAINT "SmartCoursewarePublicationOperation_publicationRevisionId_fkey" FOREIGN KEY ("publicationRevisionId") REFERENCES "SmartCoursewarePublicationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewarePublicationOperation" ADD CONSTRAINT "SmartCoursewarePublicationOperation_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "SmartCoursewareRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_smart_courseware_publication_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SmartCoursewarePublicationReceipt_immutable" BEFORE UPDATE OR DELETE ON "SmartCoursewarePublicationReceipt" FOR EACH ROW EXECUTE FUNCTION "reject_smart_courseware_publication_mutation"();
CREATE TRIGGER "SmartCoursewareGapAcknowledgement_immutable" BEFORE UPDATE OR DELETE ON "SmartCoursewareGapAcknowledgement" FOR EACH ROW EXECUTE FUNCTION "reject_smart_courseware_publication_mutation"();
CREATE TRIGGER "SmartCoursewareStalePlanAcknowledgement_immutable" BEFORE UPDATE OR DELETE ON "SmartCoursewareStalePlanAcknowledgement" FOR EACH ROW EXECUTE FUNCTION "reject_smart_courseware_publication_mutation"();
CREATE TRIGGER "SmartCoursewarePublicationRevision_immutable" BEFORE UPDATE OR DELETE ON "SmartCoursewarePublicationRevision" FOR EACH ROW EXECUTE FUNCTION "reject_smart_courseware_publication_mutation"();
CREATE TRIGGER "SmartCoursewarePublicationOperation_immutable" BEFORE UPDATE OR DELETE ON "SmartCoursewarePublicationOperation" FOR EACH ROW EXECUTE FUNCTION "reject_smart_courseware_publication_mutation"();
