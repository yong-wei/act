ALTER TABLE "TeachingResource"
  ADD COLUMN "generatedCoursewarePublicationId" TEXT;

ALTER TABLE "LessonPlan"
  ADD COLUMN "generatedCoursewarePublicationId" TEXT,
  ADD COLUMN "generatedCoursewareManifestHash" TEXT;

ALTER TABLE "LessonItem"
  ADD COLUMN "generatedCoursewarePublicationId" TEXT;

ALTER TABLE "ClassSession"
  ADD COLUMN "coursewarePublicationRevisionId" TEXT,
  ADD COLUMN "coursewareDisplayName" TEXT,
  ADD COLUMN "coursewareRevisionNumber" INTEGER,
  ADD COLUMN "coursewarePlanRevisionNumber" INTEGER;

ALTER TABLE "TeachingResource" ADD CONSTRAINT "TeachingResource_generated_courseware_student_safe_check" CHECK (
  "generatedCoursewarePublicationId" IS NULL OR ("teacherOnly" = false AND "aiHints" IS NULL)
);
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_generated_courseware_identity_check" CHECK (
  ("generatedCoursewarePublicationId" IS NULL AND "generatedCoursewareManifestHash" IS NULL)
  OR ("generatedCoursewarePublicationId" IS NOT NULL AND "generatedCoursewareManifestHash" IS NOT NULL)
);
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_generated_courseware_identity_check" CHECK (
  ("coursewarePublicationRevisionId" IS NULL
    AND "coursewareDisplayName" IS NULL
    AND "coursewareRevisionNumber" IS NULL
    AND "coursewarePlanRevisionNumber" IS NULL)
  OR ("coursewarePublicationRevisionId" IS NOT NULL
    AND "manifestHash" IS NOT NULL
    AND "coursewareDisplayName" IS NOT NULL
    AND "coursewareRevisionNumber" >= 1
    AND "coursewarePlanRevisionNumber" >= 1)
);

CREATE TABLE "ClassSessionIntegrityIncident" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "expected" JSONB NOT NULL DEFAULT '{}',
  "observed" JSONB NOT NULL DEFAULT '{}',
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ClassSessionIntegrityIncident_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassSessionIntegrityIncident_occurrence_count_check" CHECK ("occurrenceCount" >= 1)
);

CREATE UNIQUE INDEX "LessonPlan_generatedCoursewarePublicationId_key" ON "LessonPlan"("generatedCoursewarePublicationId");
CREATE INDEX "TeachingResource_generatedCoursewarePublicationId_idx" ON "TeachingResource"("generatedCoursewarePublicationId");
CREATE INDEX "LessonItem_generatedCoursewarePublicationId_idx" ON "LessonItem"("generatedCoursewarePublicationId");
CREATE INDEX "ClassSession_coursewarePublicationRevisionId_idx" ON "ClassSession"("coursewarePublicationRevisionId");
CREATE UNIQUE INDEX "ClassSessionIntegrityIncident_sessionId_fingerprint_key" ON "ClassSessionIntegrityIncident"("sessionId", "fingerprint");
CREATE INDEX "ClassSessionIntegrityIncident_sessionId_firstDetectedAt_idx" ON "ClassSessionIntegrityIncident"("sessionId", "firstDetectedAt");

ALTER TABLE "TeachingResource" ADD CONSTRAINT "TeachingResource_generatedCoursewarePublicationId_fkey" FOREIGN KEY ("generatedCoursewarePublicationId") REFERENCES "SmartCoursewarePublicationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_generatedCoursewarePublicationId_fkey" FOREIGN KEY ("generatedCoursewarePublicationId") REFERENCES "SmartCoursewarePublicationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_generatedCoursewarePublicationId_fkey" FOREIGN KEY ("generatedCoursewarePublicationId") REFERENCES "SmartCoursewarePublicationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_coursewarePublicationRevisionId_fkey" FOREIGN KEY ("coursewarePublicationRevisionId") REFERENCES "SmartCoursewarePublicationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassSessionIntegrityIncident" ADD CONSTRAINT "ClassSessionIntegrityIncident_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "reject_generated_courseware_projection_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN
    RETURN OLD;
  END IF;
  IF OLD."generatedCoursewarePublicationId" IS NOT NULL THEN
    RAISE EXCEPTION '% generated courseware projection is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TeachingResource_generated_courseware_immutable" BEFORE UPDATE OR DELETE ON "TeachingResource" FOR EACH ROW EXECUTE FUNCTION "reject_generated_courseware_projection_mutation"();
CREATE TRIGGER "LessonPlan_generated_courseware_immutable" BEFORE UPDATE OR DELETE ON "LessonPlan" FOR EACH ROW EXECUTE FUNCTION "reject_generated_courseware_projection_mutation"();
CREATE TRIGGER "LessonItem_generated_courseware_immutable" BEFORE UPDATE OR DELETE ON "LessonItem" FOR EACH ROW EXECUTE FUNCTION "reject_generated_courseware_projection_mutation"();

CREATE FUNCTION "reject_class_session_courseware_rebinding"() RETURNS trigger AS $$
BEGIN
  IF (OLD."coursewarePublicationRevisionId" IS NOT NULL OR NEW."coursewarePublicationRevisionId" IS NOT NULL) AND (
    NEW."coursewarePublicationRevisionId" IS DISTINCT FROM OLD."coursewarePublicationRevisionId"
    OR NEW."planId" IS DISTINCT FROM OLD."planId"
    OR NEW."manifestHash" IS DISTINCT FROM OLD."manifestHash"
    OR NEW."coursewareDisplayName" IS DISTINCT FROM OLD."coursewareDisplayName"
    OR NEW."coursewareRevisionNumber" IS DISTINCT FROM OLD."coursewareRevisionNumber"
    OR NEW."coursewarePlanRevisionNumber" IS DISTINCT FROM OLD."coursewarePlanRevisionNumber"
  ) THEN
    RAISE EXCEPTION 'ClassSession courseware binding is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClassSession_courseware_binding_immutable" BEFORE UPDATE ON "ClassSession" FOR EACH ROW EXECUTE FUNCTION "reject_class_session_courseware_rebinding"();
