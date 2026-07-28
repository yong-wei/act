CREATE TABLE "CourseCoverageOverlayVersion" (
    "id" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "overlayId" TEXT NOT NULL,
    "overlayVersion" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "releaseSetId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "authoringRevision" TEXT NOT NULL,
    "captureRevision" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "releaseHash" TEXT NOT NULL,
    "lockRawHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseCoverageOverlayVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CourseCoverageOverlayVersion_schema_check"
      CHECK ("schemaVersion" = 'act-course-coverage-overlay/v1'),
    CONSTRAINT "CourseCoverageOverlayVersion_revision_check"
      CHECK (
        "authoringRevision" ~ '^[a-f0-9]{40}$'
        AND "captureRevision" ~ '^[a-f0-9]{40}$'
      ),
    CONSTRAINT "CourseCoverageOverlayVersion_hashes_check"
      CHECK (
        "sourceHash" ~ '^[a-f0-9]{64}$'
        AND "releaseHash" ~ '^[a-f0-9]{64}$'
        AND "lockRawHash" ~ '^[a-f0-9]{64}$'
      )
);

CREATE TABLE "CourseCoverageOverlayEntry" (
    "overlayVersionId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    CONSTRAINT "CourseCoverageOverlayEntry_pkey"
      PRIMARY KEY ("overlayVersionId", "canonicalId", "role"),
    CONSTRAINT "CourseCoverageOverlayEntry_role_check"
      CHECK ("role" IN ('formal_objective', 'necessary_prerequisite', 'explicit_extension')),
    CONSTRAINT "CourseCoverageOverlayEntry_ordinal_check" CHECK ("ordinal" >= 0)
);

CREATE TABLE "CourseCoverageImportReceipt" (
    "id" TEXT NOT NULL,
    "overlayVersionId" TEXT NOT NULL,
    "authoringRevision" TEXT NOT NULL,
    "captureRevision" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "releaseHash" TEXT NOT NULL,
    "lockRawHash" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseCoverageImportReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CourseCoverageImportReceipt_revision_check"
      CHECK (
        "authoringRevision" ~ '^[a-f0-9]{40}$'
        AND "captureRevision" ~ '^[a-f0-9]{40}$'
      ),
    CONSTRAINT "CourseCoverageImportReceipt_hashes_check"
      CHECK (
        "sourceHash" ~ '^[a-f0-9]{64}$'
        AND "releaseHash" ~ '^[a-f0-9]{64}$'
        AND "lockRawHash" ~ '^[a-f0-9]{64}$'
      ),
    CONSTRAINT "CourseCoverageImportReceipt_entry_count_check" CHECK ("entryCount" >= 0)
);

CREATE UNIQUE INDEX "CourseCoverageOverlayVersion_overlayId_overlayVersion_key"
  ON "CourseCoverageOverlayVersion"("overlayId", "overlayVersion");
CREATE UNIQUE INDEX "CourseCoverageOverlayVersion_courseId_releaseId_overlayVersion_key"
  ON "CourseCoverageOverlayVersion"("courseId", "releaseId", "overlayVersion");
CREATE UNIQUE INDEX "CourseCoverageOverlayVersion_id_releaseId_key"
  ON "CourseCoverageOverlayVersion"("id", "releaseId");
CREATE INDEX "CourseCoverageOverlayVersion_courseId_releaseSetId_releaseId_idx"
  ON "CourseCoverageOverlayVersion"("courseId", "releaseSetId", "releaseId");
CREATE UNIQUE INDEX "CourseCoverageOverlayEntry_overlayVersionId_ordinal_key"
  ON "CourseCoverageOverlayEntry"("overlayVersionId", "ordinal");
CREATE INDEX "CourseCoverageOverlayEntry_releaseId_canonicalId_idx"
  ON "CourseCoverageOverlayEntry"("releaseId", "canonicalId");
CREATE UNIQUE INDEX "CourseCoverageImportReceipt_overlayVersionId_key"
  ON "CourseCoverageImportReceipt"("overlayVersionId");

ALTER TABLE "CourseCoverageOverlayVersion"
  ADD CONSTRAINT "CourseCoverageOverlayVersion_releaseSetId_fkey"
  FOREIGN KEY ("releaseSetId") REFERENCES "ActkgReleaseSet"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseCoverageOverlayVersion"
  ADD CONSTRAINT "CourseCoverageOverlayVersion_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseCoverageOverlayEntry"
  ADD CONSTRAINT "CourseCoverageOverlayEntry_overlayVersionId_fkey"
  FOREIGN KEY ("overlayVersionId", "releaseId")
  REFERENCES "CourseCoverageOverlayVersion"("id", "releaseId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseCoverageOverlayEntry"
  ADD CONSTRAINT "CourseCoverageOverlayEntry_canonical_fkey"
  FOREIGN KEY ("releaseId", "canonicalId")
  REFERENCES "ActkgAuthoritativeObject"("releaseId", "canonicalId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseCoverageImportReceipt"
  ADD CONSTRAINT "CourseCoverageImportReceipt_overlayVersionId_fkey"
  FOREIGN KEY ("overlayVersionId") REFERENCES "CourseCoverageOverlayVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION reject_course_coverage_immutable_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Course coverage Overlay is immutable';
END;
$$;

CREATE TRIGGER "CourseCoverageOverlayVersion_immutable"
  BEFORE UPDATE OR DELETE ON "CourseCoverageOverlayVersion"
  FOR EACH ROW EXECUTE FUNCTION reject_course_coverage_immutable_mutation();
CREATE TRIGGER "CourseCoverageImportReceipt_immutable"
  BEFORE UPDATE OR DELETE ON "CourseCoverageImportReceipt"
  FOR EACH ROW EXECUTE FUNCTION reject_course_coverage_immutable_mutation();

CREATE FUNCTION reject_course_coverage_entry_mutation_after_receipt() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_version TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_version := NEW."overlayVersionId";
  ELSE
    target_version := OLD."overlayVersionId";
  END IF;
  IF EXISTS (
    SELECT 1 FROM "CourseCoverageImportReceipt"
    WHERE "overlayVersionId" = target_version
  ) OR (
    TG_OP = 'UPDATE' AND EXISTS (
      SELECT 1 FROM "CourseCoverageImportReceipt"
      WHERE "overlayVersionId" = NEW."overlayVersionId"
    )
  ) THEN
      RAISE EXCEPTION 'Course coverage Overlay entries are sealed by the import receipt';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "CourseCoverageOverlayEntry_sealed"
  BEFORE INSERT OR UPDATE OR DELETE ON "CourseCoverageOverlayEntry"
  FOR EACH ROW EXECUTE FUNCTION reject_course_coverage_entry_mutation_after_receipt();
