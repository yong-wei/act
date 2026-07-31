-- #1126 additive compatibility migration for CanonicalResourceBindingDecision.
--
-- BEFORE → AFTER (non-destructive):
-- 1. Legacy #1124 columns, FKs, publication states, and EvidenceStructuralUnit
--    Crosswalk links are UNCHANGED. Existing rows are NOT rewritten.
-- 2. Adds optional sealed review metadata: reviewIdentity, reviewRationale.
-- 3. Adds optional governed Crosswalk identity columns (separate from legacy
--    crosswalkId/inventoryRunId/captureRevision/structuralUnitVersion).
-- 4. Expands reviewProvider CHECK to allow GROK (in addition to GPT/FIXTURE/
--    HUMAN/NONE). Historical values remain valid.
-- 5. New #1126 decisions may set governed* fields + reviewProvider=GROK while
--    leaving legacy crosswalk tuple NULL.
--
-- Does NOT drop AuthoritativeObject / EvidenceSegment / legacy Crosswalk FKs.
-- Does NOT clear or downgrade SHADOW_PUBLISHED historical rows.

-- Composite unique for governed Crosswalk FK target (nullable inventory/version
-- remain valid for unresolved diagnostics; decisions require non-null tuple).
CREATE UNIQUE INDEX IF NOT EXISTS "ActGovernedStructuralUnitCrosswalk_releaseId_id_inventoryRunId_captureRevision_structuralUnitVersion_key"
  ON "ActGovernedStructuralUnitCrosswalk" (
    "releaseId",
    "id",
    "inventoryRunId",
    "captureRevision",
    "structuralUnitVersion"
  );

-- Additive sealed review metadata (null on all existing rows).
ALTER TABLE "CanonicalResourceBindingDecision"
  ADD COLUMN IF NOT EXISTS "reviewIdentity" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewRationale" TEXT;

-- Additive #1126 governed Crosswalk identity (null on all existing rows).
ALTER TABLE "CanonicalResourceBindingDecision"
  ADD COLUMN IF NOT EXISTS "governedCrosswalkId" TEXT,
  ADD COLUMN IF NOT EXISTS "governedInventoryRunId" TEXT,
  ADD COLUMN IF NOT EXISTS "governedCaptureRevision" TEXT,
  ADD COLUMN IF NOT EXISTS "governedStructuralUnitVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "governedValidationDigest" TEXT;

-- Governed tuple: all-null OR fully populated (mirrors legacy identity check).
ALTER TABLE "CanonicalResourceBindingDecision"
  DROP CONSTRAINT IF EXISTS "CanonicalResourceBindingDecision_governed_crosswalk_identity_check";

ALTER TABLE "CanonicalResourceBindingDecision"
  ADD CONSTRAINT "CanonicalResourceBindingDecision_governed_crosswalk_identity_check"
  CHECK (
    (
      "governedCrosswalkId" IS NULL
      AND "governedInventoryRunId" IS NULL
      AND "governedCaptureRevision" IS NULL
      AND "governedStructuralUnitVersion" IS NULL
      AND "governedValidationDigest" IS NULL
    )
    OR (
      "governedCrosswalkId" IS NOT NULL
      AND "governedInventoryRunId" IS NOT NULL
      AND "governedCaptureRevision" IS NOT NULL
      AND "governedStructuralUnitVersion" IS NOT NULL
      AND "governedValidationDigest" IS NOT NULL
    )
  );

-- Allow GROK without invalidating historical providers.
ALTER TABLE "CanonicalResourceBindingDecision"
  DROP CONSTRAINT IF EXISTS "CanonicalResourceBindingDecision_review_provider_check";

ALTER TABLE "CanonicalResourceBindingDecision"
  ADD CONSTRAINT "CanonicalResourceBindingDecision_review_provider_check"
  CHECK ("reviewProvider" IN ('GPT', 'FIXTURE', 'HUMAN', 'NONE', 'GROK'));

-- Fail closed on invalid new review metadata when present.
ALTER TABLE "CanonicalResourceBindingDecision"
  DROP CONSTRAINT IF EXISTS "CanonicalResourceBindingDecision_review_metadata_check";

ALTER TABLE "CanonicalResourceBindingDecision"
  ADD CONSTRAINT "CanonicalResourceBindingDecision_review_metadata_check"
  CHECK (
    (
      "reviewIdentity" IS NULL
      AND "reviewRationale" IS NULL
    )
    OR (
      "reviewIdentity" IS NOT NULL
      AND length(btrim("reviewIdentity")) > 0
      AND "reviewIdentity" !~* 'candidate-generator|unreviewed|unbound'
      AND "reviewRationale" IS NOT NULL
      AND length(btrim("reviewRationale")) > 0
    )
  );

-- Optional FK: #1126 governed Crosswalk (does not touch legacy Crosswalk FK).
ALTER TABLE "CanonicalResourceBindingDecision"
  DROP CONSTRAINT IF EXISTS "CanonicalResourceBindingDecision_governed_crosswalk_fkey";

ALTER TABLE "CanonicalResourceBindingDecision"
  ADD CONSTRAINT "CanonicalResourceBindingDecision_governed_crosswalk_fkey"
  FOREIGN KEY (
    "releaseId",
    "governedCrosswalkId",
    "governedInventoryRunId",
    "governedCaptureRevision",
    "governedStructuralUnitVersion"
  )
  REFERENCES "ActGovernedStructuralUnitCrosswalk"(
    "releaseId",
    "id",
    "inventoryRunId",
    "captureRevision",
    "structuralUnitVersion"
  )
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
