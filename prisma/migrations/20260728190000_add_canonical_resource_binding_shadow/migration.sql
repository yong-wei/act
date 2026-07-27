CREATE TABLE "ResourceBindingInventoryRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "captureRevision" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "dbWatermark" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "includedCount" INTEGER NOT NULL,
    "excludedCount" INTEGER NOT NULL,
    "unresolvedCount" INTEGER NOT NULL,
    "complete" BOOLEAN NOT NULL,
    "cutoverReady" BOOLEAN NOT NULL DEFAULT false,
    "authorityState" TEXT NOT NULL DEFAULT 'SHADOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResourceBindingInventoryRun_revision_check"
      CHECK ("captureRevision" ~ '^[a-f0-9]{40}$'),
    CONSTRAINT "ResourceBindingInventoryRun_hash_check"
      CHECK ("sourceHash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "ResourceBindingInventoryRun_counts_check"
      CHECK ("itemCount" = "includedCount" + "excludedCount" + "unresolvedCount"),
    CONSTRAINT "ResourceBindingInventoryRun_shadow_check"
      CHECK ("authorityState" = 'SHADOW' AND NOT "cutoverReady")
);

CREATE TABLE "ResourceBindingInventoryItem" (
    "runId" TEXT NOT NULL,
    "atomicResourceId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "structuralUnitId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "resourceSegmentHash" TEXT NOT NULL,
    "disposition" TEXT NOT NULL,
    "reasonCodes" JSONB NOT NULL,
    "sourceObservations" JSONB NOT NULL,
    "observationDigest" TEXT NOT NULL,
    PRIMARY KEY ("runId", "atomicResourceId"),
    CONSTRAINT "ResourceBindingInventoryItem_hashes_check"
      CHECK ("resourceSegmentHash" ~ '^[a-f0-9]{64}$' AND "observationDigest" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "ResourceBindingInventoryItem_disposition_check"
      CHECK ("disposition" IN ('INCLUDED', 'EXCLUDED', 'UNRESOLVED')),
    CONSTRAINT "ResourceBindingInventoryItem_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "ResourceBindingInventoryRun"("id") ON DELETE RESTRICT
);

CREATE TABLE "ActkgEvidenceStructuralUnitCrosswalk" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "sourceEditionId" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "evidenceContentHash" TEXT NOT NULL,
    "structuralUnitId" TEXT NOT NULL,
    "structuralUnitVersion" TEXT NOT NULL,
    "structuralUnitHash" TEXT NOT NULL,
    "inventoryRunId" TEXT NOT NULL,
    "atomicResourceId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "resourceSegmentHash" TEXT NOT NULL,
    "captureRevision" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "validationState" TEXT NOT NULL,
    "validationDigest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("releaseId", "id"),
    CONSTRAINT "ActkgEvidenceStructuralUnitCrosswalk_hashes_check"
      CHECK (
        "evidenceContentHash" ~ '^[a-f0-9]{64}$'
        AND "structuralUnitHash" ~ '^[a-f0-9]{64}$'
        AND "resourceSegmentHash" ~ '^[a-f0-9]{64}$'
        AND "validationDigest" ~ '^[a-f0-9]{64}$'
        AND "captureRevision" ~ '^[a-f0-9]{40}$'
      ),
    CONSTRAINT "ActkgEvidenceStructuralUnitCrosswalk_state_check"
      CHECK ("validationState" = 'VALIDATED'),
    CONSTRAINT "ActkgEvidenceStructuralUnitCrosswalk_releaseId_fkey"
      FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT,
    CONSTRAINT "ActkgEvidenceStructuralUnitCrosswalk_evidence_fkey"
      FOREIGN KEY ("releaseId", "evidenceId")
      REFERENCES "ActkgEvidenceSegment"("releaseId", "evidenceId") ON DELETE RESTRICT,
    CONSTRAINT "ActkgEvidenceStructuralUnitCrosswalk_canonical_fkey"
      FOREIGN KEY ("releaseId", "canonicalId")
      REFERENCES "ActkgAuthoritativeObject"("releaseId", "canonicalId") ON DELETE RESTRICT,
    CONSTRAINT "ActkgEvidenceStructuralUnitCrosswalk_inventory_fkey"
      FOREIGN KEY ("inventoryRunId", "atomicResourceId")
      REFERENCES "ResourceBindingInventoryItem"("runId", "atomicResourceId") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "ActkgEvidenceStructuralUnitCrosswalk_identity_key"
  ON "ActkgEvidenceStructuralUnitCrosswalk"(
    "releaseId", "evidenceId", "sourceVersion", "evidenceContentHash",
    "inventoryRunId", "atomicResourceId", "resourceSegmentHash", "canonicalId"
  );
CREATE UNIQUE INDEX "ActkgEvidenceStructuralUnitCrosswalk_releaseId_id_inventory_key"
  ON "ActkgEvidenceStructuralUnitCrosswalk"(
    "releaseId", "id", "inventoryRunId", "captureRevision", "structuralUnitVersion"
  );

CREATE UNIQUE INDEX "ActkgRelease_releaseSetId_id_key"
  ON "ActkgRelease"("releaseSetId", "id");

CREATE TABLE "CanonicalResourceBindingDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pairId" TEXT NOT NULL,
    "releaseSetId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "objectRevision" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "structuralUnitId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "resourceSegmentHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "evidenceId" TEXT,
    "evidenceDigest" TEXT NOT NULL,
    "generatorPromptVersion" TEXT NOT NULL,
    "reviewerPromptVersion" TEXT NOT NULL,
    "generatorCacheKey" TEXT NOT NULL,
    "reviewerCacheKey" TEXT NOT NULL,
    "reviewerRole" TEXT NOT NULL,
    "reviewerInputDigest" TEXT NOT NULL,
    "candidateDigest" TEXT NOT NULL,
    "reviewProvider" TEXT NOT NULL,
    "reviewState" TEXT NOT NULL,
    "publicationState" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "attemptSequence" INTEGER NOT NULL,
    "supersedesDecisionId" TEXT,
    "crosswalkId" TEXT,
    "inventoryRunId" TEXT,
    "captureRevision" TEXT,
    "structuralUnitVersion" TEXT,
    "validationDigest" TEXT,
    "highImpactPolicyVersion" TEXT NOT NULL,
    "highImpactReasons" JSONB NOT NULL,
    "createdTransactionId" BIGINT NOT NULL DEFAULT txid_current(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanonicalResourceBindingDecision_hashes_check"
      CHECK (
        "resourceSegmentHash" ~ '^[a-f0-9]{64}$'
        AND "evidenceDigest" ~ '^[a-f0-9]{64}$'
        AND "generatorCacheKey" ~ '^[a-f0-9]{64}$'
        AND "reviewerCacheKey" ~ '^[a-f0-9]{64}$'
        AND "reviewerInputDigest" ~ '^[a-f0-9]{64}$'
        AND "candidateDigest" ~ '^[a-f0-9]{64}$'
        AND ("captureRevision" IS NULL OR "captureRevision" ~ '^[a-f0-9]{40}$')
        AND ("validationDigest" IS NULL OR "validationDigest" ~ '^[a-f0-9]{64}$')
      ),
    CONSTRAINT "CanonicalResourceBindingDecision_crosswalk_identity_check"
      CHECK (
        (
          "crosswalkId" IS NULL
          AND "inventoryRunId" IS NULL
          AND "captureRevision" IS NULL
          AND "structuralUnitVersion" IS NULL
          AND "validationDigest" IS NULL
        )
        OR (
          "crosswalkId" IS NOT NULL
          AND "inventoryRunId" IS NOT NULL
          AND "captureRevision" IS NOT NULL
          AND "structuralUnitVersion" IS NOT NULL
          AND "validationDigest" IS NOT NULL
        )
      ),
    CONSTRAINT "CanonicalResourceBindingDecision_role_check"
      CHECK ("role" IN ('EXPLAINS', 'PRACTICES', 'ASSESSES', 'REFERENCES')),
    CONSTRAINT "CanonicalResourceBindingDecision_review_check"
      CHECK ("reviewState" IN ('NOT_REQUIRED', 'ACCEPTED', 'REJECTED', 'DISPUTED', 'REVIEW_RETRYABLE', 'HUMAN_REQUIRED')),
    CONSTRAINT "CanonicalResourceBindingDecision_publication_check"
      CHECK ("publicationState" IN ('CANDIDATE', 'REVIEW_RETRYABLE', 'HUMAN_REQUIRED', 'SHADOW_PUBLISHED')),
    CONSTRAINT "CanonicalResourceBindingDecision_lifecycle_check"
      CHECK ("lifecycleState" IN ('CURRENT', 'SUPERSEDED')),
    CONSTRAINT "CanonicalResourceBindingDecision_attempt_check" CHECK ("attemptSequence" > 0),
    CONSTRAINT "CanonicalResourceBindingDecision_releaseSetId_releaseId_fkey"
      FOREIGN KEY ("releaseSetId", "releaseId")
      REFERENCES "ActkgRelease"("releaseSetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CanonicalResourceBindingDecision_canonical_fkey"
      FOREIGN KEY ("releaseId", "canonicalId")
      REFERENCES "ActkgAuthoritativeObject"("releaseId", "canonicalId") ON DELETE RESTRICT,
    CONSTRAINT "CanonicalResourceBindingDecision_releaseId_evidenceId_fkey"
      FOREIGN KEY ("releaseId", "evidenceId")
      REFERENCES "ActkgEvidenceSegment"("releaseId", "evidenceId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CanonicalResourceBindingDecision_releaseId_crosswalkId_inv_fkey"
      FOREIGN KEY (
        "releaseId", "crosswalkId", "inventoryRunId", "captureRevision", "structuralUnitVersion"
      )
      REFERENCES "ActkgEvidenceStructuralUnitCrosswalk"(
        "releaseId", "id", "inventoryRunId", "captureRevision", "structuralUnitVersion"
      ) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CanonicalResourceBindingDecision_supersedes_fkey"
      FOREIGN KEY ("supersedesDecisionId") REFERENCES "CanonicalResourceBindingDecision"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "CanonicalResourceBindingDecision_attempt_key"
  ON "CanonicalResourceBindingDecision"(
    "pairId", "generatorPromptVersion", "reviewerPromptVersion", "reviewerInputDigest", "attemptSequence"
  );
CREATE UNIQUE INDEX "CanonicalResourceBindingDecision_current_published_pair_role_key"
  ON "CanonicalResourceBindingDecision"("pairId", "role")
  WHERE "lifecycleState" = 'CURRENT' AND "publicationState" = 'SHADOW_PUBLISHED';

CREATE TABLE "CanonicalResourceBindingHumanQueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bindingDecisionId" TEXT NOT NULL UNIQUE,
    "reasonCodes" JSONB NOT NULL,
    "contextDigest" TEXT NOT NULL,
    "inputDigest" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanonicalResourceBindingHumanQueueItem_hash_check"
      CHECK ("contextDigest" ~ '^[a-f0-9]{64}$' AND "inputDigest" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "CanonicalResourceBindingHumanQueueItem_state_check" CHECK ("state" = 'PENDING'),
    CONSTRAINT "CanonicalResourceBindingHumanQueueItem_bindingDecisionId_fkey"
      FOREIGN KEY ("bindingDecisionId") REFERENCES "CanonicalResourceBindingDecision"("id") ON DELETE RESTRICT
);

CREATE TABLE "CanonicalResourceBindingHumanDecisionReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queueId" TEXT NOT NULL UNIQUE,
    "actorId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "contextDigest" TEXT NOT NULL,
    "inputDigest" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanonicalResourceBindingHumanDecisionReceipt_outcome_check"
      CHECK ("outcome" IN ('ACCEPT', 'REJECT')),
    CONSTRAINT "CanonicalResourceBindingHumanDecisionReceipt_hash_check"
      CHECK ("contextDigest" ~ '^[a-f0-9]{64}$' AND "inputDigest" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "CanonicalResourceBindingHumanDecisionReceipt_queueId_fkey"
      FOREIGN KEY ("queueId") REFERENCES "CanonicalResourceBindingHumanQueueItem"("id") ON DELETE RESTRICT,
    CONSTRAINT "CanonicalResourceBindingHumanDecisionReceipt_decisionId_fkey"
      FOREIGN KEY ("decisionId") REFERENCES "CanonicalResourceBindingDecision"("id") ON DELETE RESTRICT
);

CREATE INDEX "ResourceBindingInventoryRun_captureRevision_capturedAt_idx"
  ON "ResourceBindingInventoryRun"("captureRevision", "capturedAt");
CREATE INDEX "ResourceBindingInventoryItem_runId_disposition_idx"
  ON "ResourceBindingInventoryItem"("runId", "disposition");
CREATE INDEX "ResourceBindingInventoryItem_resourceId_structuralUnitId_idx"
  ON "ResourceBindingInventoryItem"("resourceId", "structuralUnitId");
CREATE INDEX "ActkgEvidenceStructuralUnitCrosswalk_structural_unit_idx"
  ON "ActkgEvidenceStructuralUnitCrosswalk"("structuralUnitId", "structuralUnitVersion", "structuralUnitHash");
CREATE INDEX "CanonicalResourceBindingDecision_resource_shadow_idx"
  ON "CanonicalResourceBindingDecision"("resourceId", "structuralUnitId", "publicationState");
CREATE INDEX "CanonicalResourceBindingDecision_canonical_role_idx"
  ON "CanonicalResourceBindingDecision"("releaseId", "canonicalId", "role");
CREATE INDEX "CanonicalResourceBindingHumanQueueItem_state_createdAt_idx"
  ON "CanonicalResourceBindingHumanQueueItem"("state", "createdAt");
CREATE INDEX "CanonicalResourceBindingHumanDecisionReceipt_decisionId_idx"
  ON "CanonicalResourceBindingHumanDecisionReceipt"("decisionId");
CREATE FUNCTION reject_canonical_resource_binding_shadow_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'canonical resource binding shadow records are immutable';
END;
$$;

CREATE FUNCTION canonical_resource_crosswalk_endpoint_lock_key(
  release_id TEXT,
  evidence_id TEXT,
  canonical_id TEXT,
  resource_id TEXT,
  structural_unit_id TEXT,
  segment_id TEXT,
  resource_segment_hash TEXT,
  inventory_run_id TEXT,
  capture_revision TEXT,
  structural_unit_version TEXT
)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT hashtextextended(concat_ws(
    E'\x1f',
    release_id,
    evidence_id,
    canonical_id,
    resource_id,
    structural_unit_id,
    segment_id,
    resource_segment_hash,
    inventory_run_id,
    capture_revision,
    structural_unit_version
  ), 0);
$$;

CREATE FUNCTION validate_canonical_resource_crosswalk()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
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
  IF NOT EXISTS (
    SELECT 1
    FROM "ResourceBindingInventoryItem" item
    JOIN "ResourceBindingInventoryRun" run ON run."id" = item."runId"
    WHERE item."runId" = NEW."inventoryRunId"
      AND item."atomicResourceId" = NEW."atomicResourceId"
      AND item."resourceId" = NEW."resourceId"
      AND item."structuralUnitId" = NEW."structuralUnitId"
      AND item."segmentId" = NEW."segmentId"
      AND item."resourceSegmentHash" = NEW."resourceSegmentHash"
      AND NEW."structuralUnitVersion" = run."captureRevision"
      AND NEW."structuralUnitHash" = item."resourceSegmentHash"
      AND item."disposition" = 'INCLUDED'
      AND run."captureRevision" = NEW."captureRevision"
      AND run."complete" = true
  ) THEN
    RAISE EXCEPTION 'crosswalk ACT inventory endpoint is invalid or stale';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM (
      SELECT
        count(DISTINCT mapping."canonicalId") AS canonical_count,
        min(mapping."canonicalId") AS canonical_id
      FROM "ActkgSourceMapping" mapping
      JOIN "ActkgSourceObject" source_object
        ON source_object."releaseId" = mapping."releaseId"
       AND source_object."sourceObjectId" = mapping."sourceObjectId"
      WHERE mapping."releaseId" = NEW."releaseId"
        AND jsonb_typeof(source_object."payload"->'evidence_segment_ids') = 'array'
        AND (source_object."payload"->'evidence_segment_ids') ? NEW."evidenceId"
    ) alignment
    WHERE alignment.canonical_count = 1
      AND alignment.canonical_id = NEW."canonicalId"
  ) THEN
    RAISE EXCEPTION 'crosswalk evidence is not authoritatively mapped to the canonical object';
  END IF;
  IF TG_OP = 'INSERT'
     AND EXISTS (
       SELECT 1
       FROM "CanonicalResourceBindingDecision" decision
       WHERE decision."releaseId" = NEW."releaseId"
         AND decision."evidenceId" = NEW."evidenceId"
         AND decision."canonicalId" = NEW."canonicalId"
         AND decision."resourceId" = NEW."resourceId"
         AND decision."structuralUnitId" = NEW."structuralUnitId"
         AND decision."segmentId" = NEW."segmentId"
         AND decision."resourceSegmentHash" = NEW."resourceSegmentHash"
         AND decision."inventoryRunId" = NEW."inventoryRunId"
         AND decision."captureRevision" = NEW."captureRevision"
         AND decision."structuralUnitVersion" = NEW."structuralUnitVersion"
         AND decision."lifecycleState" = 'CURRENT'
         AND decision."publicationState" = 'SHADOW_PUBLISHED'
     )
     AND EXISTS (
       SELECT 1
       FROM "ActkgEvidenceStructuralUnitCrosswalk" crosswalk
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
     )
  THEN
    RAISE EXCEPTION 'published canonical resource crosswalk endpoint must remain unique';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION validate_canonical_resource_binding_publication()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."publicationState" = 'SHADOW_PUBLISHED' THEN
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
  END IF;
  IF NEW."publicationState" = 'SHADOW_PUBLISHED' AND (
    NEW."reviewState" NOT IN ('NOT_REQUIRED', 'ACCEPTED')
    OR NEW."reviewProvider" = 'FIXTURE'
    OR (
      jsonb_array_length(NEW."highImpactReasons") > 0
      AND NEW."reviewProvider" <> 'HUMAN'
    )
  ) THEN
    RAISE EXCEPTION 'shadow publication review state is not authoritative';
  END IF;
  IF NEW."publicationState" = 'SHADOW_PUBLISHED'
     AND NEW."reviewProvider" = 'HUMAN'
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
  IF NEW."publicationState" = 'SHADOW_PUBLISHED' AND NOT EXISTS (
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
  ) THEN
    RAISE EXCEPTION 'shadow publication requires an exact validated crosswalk and release revision';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION guard_canonical_resource_binding_decision_mutation()
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

CREATE FUNCTION validate_canonical_resource_human_receipt()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF length(trim(NEW."actorId")) = 0 OR length(trim(NEW."rationale")) = 0 THEN
    RAISE EXCEPTION 'human decision actor and rationale are required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM "CanonicalResourceBindingHumanQueueItem" queue
    JOIN "CanonicalResourceBindingDecision" old_decision
      ON old_decision."id" = queue."bindingDecisionId"
    JOIN "CanonicalResourceBindingDecision" decision
      ON decision."id" = NEW."decisionId"
    WHERE queue."id" = NEW."queueId"
      AND queue."contextDigest" = NEW."contextDigest"
      AND queue."inputDigest" = NEW."inputDigest"
      AND old_decision."reviewerInputDigest" = queue."inputDigest"
      AND decision."supersedesDecisionId" = old_decision."id"
      AND decision."reviewerInputDigest" = queue."inputDigest"
      AND decision."reviewProvider" = 'HUMAN'
      AND (
        (NEW."outcome" = 'ACCEPT' AND decision."reviewState" = 'ACCEPTED')
        OR (NEW."outcome" = 'REJECT' AND decision."reviewState" = 'REJECTED')
      )
  ) THEN
    RAISE EXCEPTION 'human decision receipt does not bind the immutable queue input';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION enforce_published_replacement_at_commit()
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
        AND replacement."publicationState" = 'SHADOW_PUBLISHED'
    )
  ) THEN
    RAISE EXCEPTION 'published replacement must be CURRENT SHADOW_PUBLISHED at transaction commit';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "ResourceBindingInventoryRun_immutable"
  BEFORE UPDATE OR DELETE ON "ResourceBindingInventoryRun"
  FOR EACH ROW EXECUTE FUNCTION reject_canonical_resource_binding_shadow_mutation();
CREATE TRIGGER "ResourceBindingInventoryItem_immutable"
  BEFORE UPDATE OR DELETE ON "ResourceBindingInventoryItem"
  FOR EACH ROW EXECUTE FUNCTION reject_canonical_resource_binding_shadow_mutation();
CREATE TRIGGER "ActkgEvidenceStructuralUnitCrosswalk_00_validate"
  BEFORE INSERT OR UPDATE ON "ActkgEvidenceStructuralUnitCrosswalk"
  FOR EACH ROW EXECUTE FUNCTION validate_canonical_resource_crosswalk();
CREATE TRIGGER "ActkgEvidenceStructuralUnitCrosswalk_10_immutable"
  BEFORE UPDATE OR DELETE ON "ActkgEvidenceStructuralUnitCrosswalk"
  FOR EACH ROW EXECUTE FUNCTION reject_canonical_resource_binding_shadow_mutation();
CREATE TRIGGER "CanonicalResourceBindingDecision_validate_publication"
  BEFORE INSERT OR UPDATE ON "CanonicalResourceBindingDecision"
  FOR EACH ROW EXECUTE FUNCTION validate_canonical_resource_binding_publication();
CREATE TRIGGER "CanonicalResourceBindingDecision_guarded"
  BEFORE UPDATE OR DELETE ON "CanonicalResourceBindingDecision"
  FOR EACH ROW EXECUTE FUNCTION guard_canonical_resource_binding_decision_mutation();
CREATE CONSTRAINT TRIGGER "CanonicalResourceBindingDecision_published_replacement_commit"
  AFTER UPDATE ON "CanonicalResourceBindingDecision"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_published_replacement_at_commit();
CREATE TRIGGER "CanonicalResourceBindingHumanQueueItem_immutable"
  BEFORE UPDATE OR DELETE ON "CanonicalResourceBindingHumanQueueItem"
  FOR EACH ROW EXECUTE FUNCTION reject_canonical_resource_binding_shadow_mutation();
CREATE TRIGGER "CanonicalResourceBindingHumanDecisionReceipt_validate"
  BEFORE INSERT ON "CanonicalResourceBindingHumanDecisionReceipt"
  FOR EACH ROW EXECUTE FUNCTION validate_canonical_resource_human_receipt();
CREATE TRIGGER "CanonicalResourceBindingHumanDecisionReceipt_immutable"
  BEFORE UPDATE OR DELETE ON "CanonicalResourceBindingHumanDecisionReceipt"
  FOR EACH ROW EXECUTE FUNCTION reject_canonical_resource_binding_shadow_mutation();
