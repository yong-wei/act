ALTER TABLE "SmartLessonTask"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "SmartLessonTask_ownerId_archivedAt_updatedAt_idx"
ON "SmartLessonTask"("ownerId", "archivedAt", "updatedAt");

CREATE OR REPLACE FUNCTION "reject_smart_lesson_revision_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND current_setting('app.smart_lesson_task_delete', true) = OLD."taskId"
  THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'SmartLessonRevision rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "reject_smart_courseware_revision_mutation"() RETURNS trigger AS $$
DECLARE
  task_matches BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I."SmartLessonRevision" WHERE "id" = $1 AND "taskId" = $2)',
      TG_TABLE_SCHEMA
    )
    INTO task_matches
    USING OLD."planRevisionId", current_setting('app.smart_lesson_task_delete', true);
    IF task_matches THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'SmartCoursewareRevision rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "reject_smart_courseware_module_revision_mutation"() RETURNS trigger AS $$
DECLARE
  task_matches BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    EXECUTE format(
      'SELECT EXISTS (
        SELECT 1
        FROM %1$I."SmartCoursewareModule" module
        JOIN %1$I."SmartCoursewareDraft" draft ON draft."id" = module."draftId"
        JOIN %1$I."SmartLessonRevision" plan_revision ON plan_revision."id" = draft."planRevisionId"
        WHERE module."id" = $1 AND plan_revision."taskId" = $2
      )',
      TG_TABLE_SCHEMA
    )
    INTO task_matches
    USING OLD."moduleRecordId", current_setting('app.smart_lesson_task_delete', true);
    IF task_matches THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'SmartCoursewareModuleRevision rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "reject_smart_courseware_publication_mutation"() RETURNS trigger AS $$
DECLARE
  task_matches BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE'
    AND TG_TABLE_NAME <> 'SmartCoursewarePublicationRevision'
  THEN
    EXECUTE format(
      'SELECT EXISTS (
        SELECT 1
        FROM %1$I."SmartCoursewareRevision" revision
        JOIN %1$I."SmartLessonRevision" plan_revision ON plan_revision."id" = revision."planRevisionId"
        WHERE revision."id" = $1 AND plan_revision."taskId" = $2
      )',
      TG_TABLE_SCHEMA
    )
    INTO task_matches
    USING OLD."sourceRevisionId", current_setting('app.smart_lesson_task_delete', true);
    IF task_matches THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DO $migration$
DECLARE
  target_schema TEXT := current_schema();
  publication_table TEXT;
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS "SmartLessonRevision_immutable" ON %I."SmartLessonRevision"', target_schema);
  EXECUTE format(
    'CREATE TRIGGER "SmartLessonRevision_immutable" BEFORE UPDATE OR DELETE ON %I."SmartLessonRevision" FOR EACH ROW EXECUTE FUNCTION %I."reject_smart_lesson_revision_mutation"()',
    target_schema,
    target_schema
  );

  EXECUTE format('DROP TRIGGER IF EXISTS "SmartCoursewareRevision_immutable" ON %I."SmartCoursewareRevision"', target_schema);
  EXECUTE format(
    'CREATE TRIGGER "SmartCoursewareRevision_immutable" BEFORE UPDATE OR DELETE ON %I."SmartCoursewareRevision" FOR EACH ROW EXECUTE FUNCTION %I."reject_smart_courseware_revision_mutation"()',
    target_schema,
    target_schema
  );

  EXECUTE format('DROP TRIGGER IF EXISTS "SmartCoursewareModuleRevision_immutable" ON %I."SmartCoursewareModuleRevision"', target_schema);
  EXECUTE format(
    'CREATE TRIGGER "SmartCoursewareModuleRevision_immutable" BEFORE UPDATE OR DELETE ON %I."SmartCoursewareModuleRevision" FOR EACH ROW EXECUTE FUNCTION %I."reject_smart_courseware_module_revision_mutation"()',
    target_schema,
    target_schema
  );

  FOREACH publication_table IN ARRAY ARRAY[
    'SmartCoursewarePublicationReceipt',
    'SmartCoursewareGapAcknowledgement',
    'SmartCoursewareStalePlanAcknowledgement',
    'SmartCoursewarePublicationRevision',
    'SmartCoursewarePublicationOperation'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', publication_table || '_immutable', target_schema, publication_table);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION %I."reject_smart_courseware_publication_mutation"()',
      publication_table || '_immutable',
      target_schema,
      publication_table,
      target_schema
    );
  END LOOP;
END;
$migration$;
