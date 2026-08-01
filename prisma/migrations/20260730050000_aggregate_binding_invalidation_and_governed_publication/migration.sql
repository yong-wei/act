-- #1126 additive protocol: aggregate invalidation supersession + dual-path
-- SHADOW_PUBLISHED validation (legacy EvidenceStructuralUnitCrosswalk XOR
-- governed ActGovernedStructuralUnitCrosswalk). Does not rewrite historical
-- rows. Does not modify 20260730020000 (already applied).
--
-- Also rebinds CanonicalResourceBindingDecision canonical membership from
-- private ActkgAuthoritativeObject to public ActkgProjectionNode so standard
-- Bundle candidates (zero private objects) can persist governed decisions.

-- ---------------------------------------------------------------------------
-- Deterministic payload revision (shared by runner + trigger)
-- Used for both private authoritative-object payloads and public Projection
-- node payloads. Matches:
--   encode(public.digest(convert_to(payload::text, 'UTF8'), 'sha256'::text), 'hex')
-- Schema-qualify public.digest so schema-isolated harness migrate (search_path
-- without public) still resolves pgcrypto, and cast the algorithm argument so
-- PostgreSQL does not leave it as unknown.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION actkg_authoritative_object_revision(payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(public.digest(convert_to(payload::text, 'UTF8'), 'sha256'::text), 'hex')
$$;

-- ---------------------------------------------------------------------------
-- Canonical membership FK: private object → public Projection node
-- Fail closed if any historical decision lacks matching Projection membership.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM "CanonicalResourceBindingDecision" decision
  WHERE NOT EXISTS (
    SELECT 1
    FROM "ActkgProjectionNode" projection
    WHERE projection."releaseId" = decision."releaseId"
      AND projection."entityId" = decision."canonicalId"
  );
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'migration 20260730050000 rejected: % CanonicalResourceBindingDecision row(s) lack matching ActkgProjectionNode membership',
      orphan_count;
  END IF;
END
$$;

ALTER TABLE "CanonicalResourceBindingDecision"
  DROP CONSTRAINT IF EXISTS "CanonicalResourceBindingDecision_canonical_fkey";

ALTER TABLE "CanonicalResourceBindingDecision"
  ADD CONSTRAINT "CanonicalResourceBindingDecision_canonical_fkey"
  FOREIGN KEY ("releaseId", "canonicalId")
  REFERENCES "ActkgProjectionNode"("releaseId", "entityId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Aggregate invalidation tombstone supersession (non-publishable replacement)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_aggregate_invalidation_tombstone(
  replacement "CanonicalResourceBindingDecision"
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    replacement."lifecycleState" = 'CURRENT'
    AND replacement."publicationState" = 'CANDIDATE'
    AND replacement."reviewState" = 'REJECTED'
    AND replacement."reviewIdentity" = 'issue-1126-aggregate-invalidation-tombstone'
    AND replacement."highImpactReasons" @> '["aggregate-invalidation"]'::jsonb
$$;

-- Supersession guard restores the safe same-transaction staging protocol:
--   1) insert CURRENT CANDIDATE child (supersedesDecisionId = predecessor)
--   2) mark predecessor SUPERSEDED (allowed because same-tx CURRENT child exists)
--   3) elevate child CANDIDATE → SHADOW_PUBLISHED (predecessor already SUPERSEDED)
--   4) deferred commit trigger requires final child SHADOW_PUBLISHED or tombstone
--
-- Do NOT require the child to already be SHADOW_PUBLISHED at step (2) — that
-- created a circular dependency with the CANDIDATE→SHADOW elevation guard.
CREATE OR REPLACE FUNCTION guard_canonical_resource_binding_decision_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical resource binding decisions cannot be deleted';
  END IF;
  IF NEW IS DISTINCT FROM OLD AND (
    OLD."lifecycleState" = 'CURRENT'
    AND NEW."lifecycleState" = 'SUPERSEDED'
    AND NEW."id" = OLD."id"
    AND to_jsonb(NEW) - 'lifecycleState' = to_jsonb(OLD) - 'lifecycleState'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM "CanonicalResourceBindingDecision" replacement
      WHERE replacement."supersedesDecisionId" = OLD."id"
        AND replacement."pairId" = OLD."pairId"
        AND replacement."role" = OLD."role"
        AND replacement."lifecycleState" = 'CURRENT'
        AND (
          OLD."publicationState" <> 'SHADOW_PUBLISHED'
          OR replacement."createdTransactionId" = txid_current()
        )
    ) THEN
      RAISE EXCEPTION 'supersession requires a persisted current replacement';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW IS DISTINCT FROM OLD AND (
    OLD."publicationState" = 'CANDIDATE'
    AND NEW."publicationState" = 'SHADOW_PUBLISHED'
    AND to_jsonb(NEW) - 'publicationState' = to_jsonb(OLD) - 'publicationState'
    AND EXISTS (
      SELECT 1 FROM "CanonicalResourceBindingDecision" predecessor
      WHERE predecessor."id" = NEW."supersedesDecisionId"
        AND predecessor."pairId" = NEW."pairId"
        AND predecessor."role" = NEW."role"
        AND predecessor."lifecycleState" = 'SUPERSEDED'
        AND NEW."createdTransactionId" = txid_current()
    )
  ) THEN
    RETURN NEW;
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    IF OLD."publicationState" = 'SHADOW_PUBLISHED' THEN
      RAISE EXCEPTION 'shadow-published canonical resource binding decision is sealed';
    END IF;
    RAISE EXCEPTION 'canonical resource binding decision transition is not permitted';
  END IF;
  RETURN NEW;
END;
$$;

-- Deferred commit: published predecessors must end the transaction with either
-- a CURRENT SHADOW_PUBLISHED replacement or the narrow invalidation tombstone.
CREATE OR REPLACE FUNCTION enforce_published_replacement_at_commit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (
    OLD."lifecycleState" = 'CURRENT'
    AND OLD."publicationState" = 'SHADOW_PUBLISHED'
    AND NEW."lifecycleState" = 'SUPERSEDED'
    AND NOT EXISTS (
      SELECT 1
      FROM "CanonicalResourceBindingDecision" replacement
      WHERE replacement."supersedesDecisionId" = OLD."id"
        AND replacement."pairId" = OLD."pairId"
        AND replacement."role" = OLD."role"
        AND replacement."lifecycleState" = 'CURRENT'
        AND (
          replacement."publicationState" = 'SHADOW_PUBLISHED'
          OR is_aggregate_invalidation_tombstone(replacement)
        )
    )
  ) THEN
    RAISE EXCEPTION 'published replacement must be CURRENT SHADOW_PUBLISHED at transaction commit';
  END IF;
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Dual-path SHADOW_PUBLISHED validation
--
-- Strict XOR on field presence (not only complete tuples):
--   legacy fields: evidenceId, crosswalkId, inventoryRunId, captureRevision,
--                  structuralUnitVersion, validationDigest
--   governed fields: governedCrosswalkId, governedInventoryRunId,
--                    governedCaptureRevision, governedStructuralUnitVersion,
--                    governedValidationDigest
-- Exactly one complete path; zero fields from the other path.
-- Partial or mixed tuples fail closed.
--
-- Lifecycle-only CURRENT→SUPERSEDE updates skip re-validation (content sealed
-- at insert/elevation). INSERT and ordinary UPDATE still fully gated.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_canonical_resource_binding_publication()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  legacy_any boolean;
  legacy_complete boolean;
  governed_any boolean;
  governed_complete boolean;
  legacy_ok boolean;
  governed_ok boolean;
BEGIN
  -- Lifecycle-only supersession: do not re-run publication gates.
  IF TG_OP = 'UPDATE'
    AND OLD."lifecycleState" = 'CURRENT'
    AND NEW."lifecycleState" = 'SUPERSEDED'
    AND NEW."id" = OLD."id"
    AND to_jsonb(NEW) - 'lifecycleState' = to_jsonb(OLD) - 'lifecycleState'
  THEN
    RETURN NEW;
  END IF;

  IF NEW."publicationState" <> 'SHADOW_PUBLISHED' THEN
    RETURN NEW;
  END IF;

  IF NEW."reviewState" NOT IN ('NOT_REQUIRED', 'ACCEPTED')
    OR NEW."reviewProvider" = 'FIXTURE'
    OR (
      jsonb_array_length(NEW."highImpactReasons") > 0
      AND NEW."reviewProvider" <> 'HUMAN'
    )
  THEN
    RAISE EXCEPTION 'shadow publication review state is not authoritative';
  END IF;

  IF NEW."reviewProvider" = 'HUMAN'
     AND NOT EXISTS (
       SELECT 1
       FROM "CanonicalResourceBindingHumanDecisionReceipt" receipt
       JOIN "CanonicalResourceBindingHumanQueueItem" queue
         ON queue."id" = receipt."queueId"
       WHERE receipt."decisionId" = NEW."id"
         AND receipt."outcome" = 'ACCEPT'
         AND queue."bindingDecisionId" = NEW."supersedesDecisionId"
         AND receipt."contextDigest" = queue."contextDigest"
         AND receipt."inputDigest" = queue."inputDigest"
     ) THEN
    RAISE EXCEPTION 'human shadow publication requires a matching accepted queue receipt';
  END IF;

  legacy_any := (
    NEW."evidenceId" IS NOT NULL
    OR NEW."crosswalkId" IS NOT NULL
    OR NEW."inventoryRunId" IS NOT NULL
    OR NEW."captureRevision" IS NOT NULL
    OR NEW."structuralUnitVersion" IS NOT NULL
    OR NEW."validationDigest" IS NOT NULL
  );
  legacy_complete := (
    NEW."evidenceId" IS NOT NULL
    AND NEW."crosswalkId" IS NOT NULL
    AND NEW."inventoryRunId" IS NOT NULL
    AND NEW."captureRevision" IS NOT NULL
    AND NEW."structuralUnitVersion" IS NOT NULL
    AND NEW."validationDigest" IS NOT NULL
  );
  governed_any := (
    NEW."governedCrosswalkId" IS NOT NULL
    OR NEW."governedInventoryRunId" IS NOT NULL
    OR NEW."governedCaptureRevision" IS NOT NULL
    OR NEW."governedStructuralUnitVersion" IS NOT NULL
    OR NEW."governedValidationDigest" IS NOT NULL
  );
  governed_complete := (
    NEW."governedCrosswalkId" IS NOT NULL
    AND NEW."governedInventoryRunId" IS NOT NULL
    AND NEW."governedCaptureRevision" IS NOT NULL
    AND NEW."governedStructuralUnitVersion" IS NOT NULL
    AND NEW."governedValidationDigest" IS NOT NULL
  );

  -- Any field from both paths is a mix, even if only one path is complete.
  IF legacy_any AND governed_any THEN
    RAISE EXCEPTION 'shadow publication must not mix legacy and governed crosswalk identity';
  END IF;

  -- Exactly one complete path.
  IF legacy_complete AND NOT governed_any THEN
    PERFORM pg_advisory_xact_lock(canonical_resource_crosswalk_endpoint_lock_key(
      NEW."releaseId",
      NEW."evidenceId",
      NEW."canonicalId",
      NEW."resourceId",
      NEW."structuralUnitId",
      NEW."segmentId",
      NEW."resourceSegmentHash",
      NEW."inventoryRunId",
      NEW."captureRevision",
      NEW."structuralUnitVersion"
    ));
    SELECT EXISTS (
      SELECT 1
      FROM "ActkgEvidenceStructuralUnitCrosswalk" crosswalk
      JOIN "ActkgRelease" release ON release."id" = NEW."releaseId"
      WHERE crosswalk."releaseId" = NEW."releaseId"
        AND crosswalk."evidenceId" = NEW."evidenceId"
        AND crosswalk."canonicalId" = NEW."canonicalId"
        AND crosswalk."resourceId" = NEW."resourceId"
        AND crosswalk."structuralUnitId" = NEW."structuralUnitId"
        AND crosswalk."segmentId" = NEW."segmentId"
        AND crosswalk."resourceSegmentHash" = NEW."resourceSegmentHash"
        AND crosswalk."inventoryRunId" = NEW."inventoryRunId"
        AND crosswalk."captureRevision" = NEW."captureRevision"
        AND crosswalk."structuralUnitVersion" = NEW."structuralUnitVersion"
        AND crosswalk."validationState" = 'VALIDATED'
        AND release."releaseSetId" = NEW."releaseSetId"
        AND release."releaseHash" = NEW."objectRevision"
      HAVING count(*) = 1
        AND min(crosswalk."id") = NEW."crosswalkId"
        AND min(crosswalk."validationDigest") = NEW."validationDigest"
    ) INTO legacy_ok;
    IF NOT COALESCE(legacy_ok, false) THEN
      RAISE EXCEPTION 'shadow publication requires an exact validated crosswalk and release revision';
    END IF;
    RETURN NEW;
  END IF;

  IF governed_complete AND NOT legacy_any THEN
    -- Governed #1126 path: ActGovernedStructuralUnitCrosswalk + exact public
    -- Projection membership revision (standard Bundle has no private objects).
    -- objectRevision must equal actkg_authoritative_object_revision(projection.payload).
    PERFORM pg_advisory_xact_lock(hashtextextended(
      concat_ws(
        E'\x1f',
        NEW."releaseId",
        NEW."governedCrosswalkId",
        NEW."canonicalId",
        NEW."resourceId",
        NEW."structuralUnitId",
        NEW."segmentId",
        NEW."resourceSegmentHash",
        NEW."governedInventoryRunId",
        NEW."governedCaptureRevision",
        NEW."governedStructuralUnitVersion"
      ),
      0
    ));
    SELECT EXISTS (
      SELECT 1
      FROM "ActGovernedStructuralUnitCrosswalk" crosswalk
      JOIN "ActkgRelease" release
        ON release."id" = NEW."releaseId"
       AND release."releaseSetId" = NEW."releaseSetId"
      JOIN "ActkgProjectionNode" projection
        ON projection."releaseId" = NEW."releaseId"
       AND projection."entityId" = NEW."canonicalId"
      WHERE crosswalk."id" = NEW."governedCrosswalkId"
        AND crosswalk."releaseId" = NEW."releaseId"
        AND crosswalk."releaseSetId" = NEW."releaseSetId"
        AND crosswalk."canonicalId" = NEW."canonicalId"
        AND crosswalk."resourceId" = NEW."resourceId"
        AND crosswalk."structuralUnitId" = NEW."structuralUnitId"
        AND crosswalk."segmentId" = NEW."segmentId"
        AND crosswalk."resourceSegmentHash" = NEW."resourceSegmentHash"
        AND crosswalk."inventoryRunId" = NEW."governedInventoryRunId"
        AND crosswalk."captureRevision" = NEW."governedCaptureRevision"
        AND crosswalk."structuralUnitVersion" = NEW."governedStructuralUnitVersion"
        AND crosswalk."validationDigest" = NEW."governedValidationDigest"
        AND crosswalk."validationState" = 'VALIDATED'
        AND crosswalk."lifecycleState" = 'CURRENT'
        AND NEW."objectRevision" = actkg_authoritative_object_revision(projection."payload")
    ) INTO governed_ok;
    IF NOT COALESCE(governed_ok, false) THEN
      RAISE EXCEPTION 'shadow publication requires an exact validated governed crosswalk and release revision';
    END IF;
    RETURN NEW;
  END IF;

  -- Partial legacy, partial governed, or empty.
  RAISE EXCEPTION 'shadow publication requires an exact validated crosswalk and release revision';
END;
$$;
