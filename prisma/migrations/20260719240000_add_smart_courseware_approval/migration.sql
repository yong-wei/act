CREATE TABLE "SmartCoursewareRevision" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL DEFAULT 1,
  "planRevisionId" TEXT NOT NULL,
  "planRevisionNumber" INTEGER NOT NULL,
  "planContentHash" TEXT NOT NULL,
  "manifestSnapshot" JSONB NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "moduleMetadataSnapshot" JSONB NOT NULL,
  "moduleMetadataHash" TEXT NOT NULL,
  "gapsSnapshot" JSONB NOT NULL,
  "provenanceSnapshot" JSONB NOT NULL,
  "validationSnapshot" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "approvalIdempotencyKey" TEXT NOT NULL,
  "approvalRequestHash" TEXT NOT NULL,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCoursewareRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartCoursewareRevision_draftId_key" ON "SmartCoursewareRevision"("draftId");
CREATE UNIQUE INDEX "SmartCoursewareRevision_draftId_revisionNumber_key" ON "SmartCoursewareRevision"("draftId", "revisionNumber");
CREATE UNIQUE INDEX "SmartCoursewareRevision_ownerId_approvalIdempotencyKey_key" ON "SmartCoursewareRevision"("ownerId", "approvalIdempotencyKey");
CREATE INDEX "SmartCoursewareRevision_ownerId_approvedAt_idx" ON "SmartCoursewareRevision"("ownerId", "approvedAt");
CREATE INDEX "SmartCoursewareRevision_planRevisionId_idx" ON "SmartCoursewareRevision"("planRevisionId");

ALTER TABLE "SmartCoursewareRevision" ADD CONSTRAINT "SmartCoursewareRevision_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "SmartCoursewareDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewareRevision" ADD CONSTRAINT "SmartCoursewareRevision_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_smart_courseware_revision_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SmartCoursewareRevision rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SmartCoursewareRevision_immutable"
BEFORE UPDATE OR DELETE ON "SmartCoursewareRevision"
FOR EACH ROW EXECUTE FUNCTION reject_smart_courseware_revision_mutation();
