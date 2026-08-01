-- #1116: Canonical LearningFact fixed-identity columns (additive, no backfill).
-- Historical rows keep NULL namespace and NULL Canonical fields (Legacy-compatible).
-- Formal Canonical writes require closed identity + non-candidate ReleaseSet.
-- Does not modify, backfill, or delete existing LearningFact rows.

ALTER TABLE "LearningFact"
  ADD COLUMN IF NOT EXISTS "knowledgeIdentityNamespace" TEXT,
  ADD COLUMN IF NOT EXISTS "canonicalObjectId" TEXT,
  ADD COLUMN IF NOT EXISTS "aggregateReleaseSetId" TEXT,
  ADD COLUMN IF NOT EXISTS "aggregateReleaseId" TEXT,
  ADD COLUMN IF NOT EXISTS "knowledgeProjectionId" TEXT,
  ADD COLUMN IF NOT EXISTS "knowledgeRevisionRef" TEXT;

ALTER TABLE "LearningFact"
  DROP CONSTRAINT IF EXISTS "LearningFact_knowledge_identity_check";

ALTER TABLE "LearningFact"
  ADD CONSTRAINT "LearningFact_knowledge_identity_check" CHECK (
    (
      ("knowledgeIdentityNamespace" IS NULL OR "knowledgeIdentityNamespace" = 'LEGACY')
      AND "canonicalObjectId" IS NULL
      AND "aggregateReleaseSetId" IS NULL
      AND "aggregateReleaseId" IS NULL
      AND "knowledgeProjectionId" IS NULL
    )
    OR
    (
      "knowledgeIdentityNamespace" = 'CANONICAL'
      AND "canonicalObjectId" IS NOT NULL
      AND btrim("canonicalObjectId") <> ''
      AND "aggregateReleaseSetId" IS NOT NULL
      AND btrim("aggregateReleaseSetId") <> ''
      AND "aggregateReleaseId" IS NOT NULL
      AND btrim("aggregateReleaseId") <> ''
      AND "knowledgeProjectionId" IS NOT NULL
      AND btrim("knowledgeProjectionId") <> ''
      AND "knowledgeRevisionRef" IS NOT NULL
      AND btrim("knowledgeRevisionRef") <> ''
      AND (
        ("sourceEventId" IS NOT NULL AND btrim("sourceEventId") <> '')
        OR ("sourceLogId" IS NOT NULL AND btrim("sourceLogId") <> '')
      )
    )
  );

CREATE INDEX IF NOT EXISTS "LearningFact_knowledgeIdentityNamespace_startedAt_idx"
  ON "LearningFact" ("knowledgeIdentityNamespace", "startedAt");

CREATE INDEX IF NOT EXISTS "LearningFact_canonicalObjectId_idx"
  ON "LearningFact" ("canonicalObjectId");

CREATE INDEX IF NOT EXISTS "LearningFact_aggregateReleaseSetId_aggregateReleaseId_idx"
  ON "LearningFact" ("aggregateReleaseSetId", "aggregateReleaseId");

CREATE INDEX IF NOT EXISTS "LearningFact_knowledgeRevisionRef_idx"
  ON "LearningFact" ("knowledgeRevisionRef");

-- Database-level candidate / Release identity closure for CANONICAL rows.
-- Only production-active ReleaseSets (candidateState = 'ACTIVE') may receive
-- formal Canonical facts. CANDIDATE / STAGED / ACCEPTED_CANDIDATE are rejected.
-- #1117 is responsible for flipping the active ReleaseSet to ACTIVE.
CREATE OR REPLACE FUNCTION enforce_learning_fact_canonical_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rs_state text;
  release_hash text;
  release_projection_id text;
  object_ok boolean;
  projection_ok boolean;
BEGIN
  IF NEW."knowledgeIdentityNamespace" IS DISTINCT FROM 'CANONICAL' THEN
    RETURN NEW;
  END IF;

  SELECT rs."candidateState" INTO rs_state
  FROM "ActkgReleaseSet" rs
  WHERE rs."id" = NEW."aggregateReleaseSetId";

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'LearningFact CANONICAL rejected: ReleaseSet % does not exist',
      NEW."aggregateReleaseSetId";
  END IF;

  IF rs_state IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION
      'LearningFact CANONICAL rejected: ReleaseSet % candidateState=% is not ACTIVE (candidate gates closed)',
      NEW."aggregateReleaseSetId",
      rs_state;
  END IF;

  SELECT r."releaseHash", r."projectionId"
  INTO release_hash, release_projection_id
  FROM "ActkgRelease" r
  WHERE r."id" = NEW."aggregateReleaseId"
    AND r."releaseSetId" = NEW."aggregateReleaseSetId";

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'LearningFact CANONICAL rejected: Release pair (%, %) does not exist',
      NEW."aggregateReleaseSetId",
      NEW."aggregateReleaseId";
  END IF;

  -- knowledgeRevisionRef must equal the authoritative ActkgRelease.releaseHash.
  -- Arbitrary revision tokens are rejected even when Release/Projection exist.
  IF NEW."knowledgeRevisionRef" IS DISTINCT FROM release_hash THEN
    RAISE EXCEPTION
      'LearningFact CANONICAL rejected: knowledgeRevisionRef % does not equal Release.releaseHash %',
      NEW."knowledgeRevisionRef",
      release_hash;
  END IF;

  -- Browsable Projection membership is insufficient: every formal fact target
  -- must be admitted by CURRENT aggregate CourseCoverage for the same release.
  SELECT EXISTS (
    SELECT 1
    FROM "AggregateCourseCoverageEntry" e
    INNER JOIN "AggregateCourseCoverageVersion" v
      ON v."id" = e."versionId"
     AND v."releaseId" = e."releaseId"
    WHERE e."canonicalId" = NEW."canonicalObjectId"
      AND v."releaseSetId" = NEW."aggregateReleaseSetId"
      AND v."releaseId" = NEW."aggregateReleaseId"
      AND v."lifecycleState" = 'CURRENT'
      AND e."lifecycleState" = 'CURRENT'
  ) INTO object_ok;

  IF NOT object_ok THEN
    RAISE EXCEPTION
      'LearningFact CANONICAL rejected: object % not admitted by CURRENT CourseCoverage for release %',
      NEW."canonicalObjectId",
      NEW."aggregateReleaseId";
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM "ActkgRelease" r
    WHERE r."id" = NEW."aggregateReleaseId"
      AND r."releaseSetId" = NEW."aggregateReleaseSetId"
      AND (
        r."projectionId" = NEW."knowledgeProjectionId"
        OR EXISTS (
          SELECT 1
          FROM "ActkgProjectionIdentity" p
          WHERE p."releaseId" = r."id"
            AND p."projectionId" = NEW."knowledgeProjectionId"
        )
      )
  ) INTO projection_ok;

  IF NOT projection_ok THEN
    RAISE EXCEPTION
      'LearningFact CANONICAL rejected: projection % does not belong to release %',
      NEW."knowledgeProjectionId",
      NEW."aggregateReleaseId";
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS learning_fact_canonical_identity_biu ON "LearningFact";
CREATE TRIGGER learning_fact_canonical_identity_biu
  BEFORE INSERT OR UPDATE OF
    "knowledgeIdentityNamespace",
    "canonicalObjectId",
    "aggregateReleaseSetId",
    "aggregateReleaseId",
    "knowledgeProjectionId",
    "knowledgeRevisionRef",
    "sourceEventId",
    "sourceLogId"
  ON "LearningFact"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_learning_fact_canonical_identity();
