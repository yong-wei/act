ALTER TYPE "CourseBasisReferenceType" ADD VALUE IF NOT EXISTS 'SMART_LESSON_KNOWLEDGE_POINT';
ALTER TYPE "CourseBasisReferenceType" ADD VALUE IF NOT EXISTS 'SMART_LESSON_GOAL';
ALTER TYPE "CourseBasisReferenceType" ADD VALUE IF NOT EXISTS 'GENERATION_JOB';
ALTER TYPE "CourseBasisReferenceType" ADD VALUE IF NOT EXISTS 'PUBLICATION_REVISION';
ALTER TYPE "CourseBasisReferenceType" ADD VALUE IF NOT EXISTS 'CLASSROOM_SESSION';
ALTER TYPE "CourseBasisReferenceType" ADD VALUE IF NOT EXISTS 'RESOURCE_PACK';

ALTER TABLE "CourseBasisReferenceLink"
  ADD COLUMN "contentHash" TEXT DEFAULT '',
  ADD COLUMN "anchors" JSONB DEFAULT '[]'::jsonb;

UPDATE "CourseBasisReferenceLink" AS link
SET
  "contentHash" = version."contentHash",
  "anchors" = CASE link."referenceType"
    WHEN 'LESSON_PLAN_REVISION' THEN COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'stableAnchor', recovered."stableAnchor",
            'contentHash', recovered."contentHash"
          )
          ORDER BY recovered."stableAnchor", recovered."contentHash"
        )
        FROM (
          SELECT DISTINCT
            binding ->> 'anchor' AS "stableAnchor",
            binding ->> 'contentHash' AS "contentHash"
          FROM "SmartLessonRevision" AS revision
          CROSS JOIN LATERAL jsonb_array_elements(
            COALESCE(revision."content" -> 'sources', '[]'::jsonb)
          ) AS binding
          WHERE revision."id" = link."referenceId"
            AND binding ->> 'sourceVersionId' = link."versionId"
            AND binding ->> 'anchor' <> ''
            AND binding ->> 'contentHash' <> ''
        ) AS recovered
      ),
      '[]'::jsonb
    )
    WHEN 'COURSEWARE_REVISION' THEN COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'stableAnchor', recovered."stableAnchor",
            'contentHash', recovered."contentHash"
          )
          ORDER BY recovered."stableAnchor", recovered."contentHash"
        )
        FROM (
          SELECT DISTINCT
            candidate.binding ->> 'anchor' AS "stableAnchor",
            candidate.binding ->> 'contentHash' AS "contentHash"
          FROM (
            SELECT plan_binding AS binding
            FROM "SmartCoursewareRevision" AS courseware
            JOIN "SmartLessonRevision" AS plan
              ON plan."id" = courseware."planRevisionId"
            CROSS JOIN LATERAL jsonb_array_elements(
              COALESCE(plan."content" -> 'sources', '[]'::jsonb)
            ) AS plan_binding
            WHERE courseware."id" = link."referenceId"

            UNION ALL

            SELECT module_binding AS binding
            FROM "SmartCoursewareRevision" AS courseware
            CROSS JOIN LATERAL jsonb_array_elements(
              COALESCE(courseware."moduleMetadataSnapshot", '[]'::jsonb)
            ) AS module
            CROSS JOIN LATERAL jsonb_array_elements(
              COALESCE(module -> 'sourceBindings', '[]'::jsonb)
            ) AS module_binding
            WHERE courseware."id" = link."referenceId"
          ) AS candidate
          WHERE candidate.binding ->> 'sourceVersionId' = link."versionId"
            AND candidate.binding ->> 'anchor' <> ''
            AND candidate.binding ->> 'contentHash' <> ''
        ) AS recovered
      ),
      '[]'::jsonb
    )
    ELSE '[]'::jsonb
  END
FROM "CourseBasisDocumentVersion" AS version
WHERE version."id" = link."versionId";

ALTER TABLE "CourseBasisReferenceLink"
  ALTER COLUMN "contentHash" SET NOT NULL,
  ALTER COLUMN "contentHash" DROP DEFAULT,
  ALTER COLUMN "anchors" SET NOT NULL,
  ALTER COLUMN "anchors" DROP DEFAULT,
  ADD CONSTRAINT "CourseBasisReferenceLink_contentHash_nonempty"
    CHECK (length(btrim("contentHash")) > 0),
  ADD CONSTRAINT "CourseBasisReferenceLink_anchors_nonempty"
    CHECK (jsonb_typeof("anchors") = 'array' AND jsonb_array_length("anchors") > 0);

INSERT INTO "CourseBasisProjection" (
  "id",
  "versionId",
  "segmentId",
  "projectionKey",
  "corpusSourceId",
  "projectedAt"
)
SELECT
  md5('course-basis-projection:' || version."id" || ':' || segment."id"),
  version."id",
  segment."id",
  'course-basis-projection:migrated:' || version."id" || ':' || segment."id",
  'teacher-course-basis:migrated:' || version."id" || ':' || segment."id",
  version."createdAt"
FROM "CourseBasisDocumentVersion" AS version
JOIN "CourseBasisSegment" AS segment ON segment."versionId" = version."id"
LEFT JOIN "CourseBasisProjection" AS projection ON projection."segmentId" = segment."id"
WHERE
  projection."id" IS NULL
  AND version."extractionState" = 'EXTRACTED'
  AND version."reviewState" <> 'REJECTED';
