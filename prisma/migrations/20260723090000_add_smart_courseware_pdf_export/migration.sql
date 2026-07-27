CREATE TABLE "SmartCoursewarePdfExport" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "publicationRevisionId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "rendererVersion" TEXT NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "projectionHash" TEXT NOT NULL,
  "pageCount" INTEGER NOT NULL,
  "artifactHash" TEXT NOT NULL,
  "artifactBytes" BYTEA NOT NULL,
  "artifactSizeBytes" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCoursewarePdfExport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartCoursewarePdfExport_page_count_check" CHECK ("pageCount" > 0),
  CONSTRAINT "SmartCoursewarePdfExport_size_check" CHECK ("artifactSizeBytes" > 0)
);

CREATE UNIQUE INDEX "SmartCoursewarePdfExport_owner_idempotency_key" ON "SmartCoursewarePdfExport"("ownerId", "idempotencyKey");
CREATE UNIQUE INDEX "SmartCoursewarePdfExport_publication_renderer_key" ON "SmartCoursewarePdfExport"("publicationRevisionId", "rendererVersion");
CREATE INDEX "SmartCoursewarePdfExport_owner_publication_created_idx" ON "SmartCoursewarePdfExport"("ownerId", "publicationRevisionId", "createdAt");

ALTER TABLE "SmartCoursewarePdfExport" ADD CONSTRAINT "SmartCoursewarePdfExport_publication_fkey" FOREIGN KEY ("publicationRevisionId") REFERENCES "SmartCoursewarePublicationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCoursewarePdfExport" ADD CONSTRAINT "SmartCoursewarePdfExport_created_by_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "SmartCoursewarePdfExport_immutable" BEFORE UPDATE OR DELETE ON "SmartCoursewarePdfExport" FOR EACH ROW EXECUTE FUNCTION "reject_smart_courseware_publication_mutation"();
