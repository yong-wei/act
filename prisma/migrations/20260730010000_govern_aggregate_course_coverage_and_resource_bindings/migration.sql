-- Aggregate CourseCoverage + ACT structural-unit Crosswalk governance (#1126).
-- Shadow-only records. Production candidate/active/Legacy selectors unchanged.
--
-- Identity integrity:
-- - composite [releaseSetId, releaseId] → ActkgRelease
-- - composite [deltaReceiptId, releaseSetId, releaseId] →
--   ActkgReleaseSetDeltaReceipt[id, candidateReleaseSetId, candidateReleaseId]
-- - coverage entries bind real Canonical Objects with non-empty evidenceRefs
-- - VALIDATED Crosswalks require complete structure/inventory tuple

-- Referable composite identity for Delta → candidate Release binding.
CREATE UNIQUE INDEX "ActkgReleaseSetDeltaReceipt_id_candidate_release_key"
  ON "ActkgReleaseSetDeltaReceipt"("id", "candidateReleaseSetId", "candidateReleaseId");

-- Public Projection Canonical membership identity for #1126 coverage/Crosswalk FKs.
-- Standard public Bundle imports do not materialize private ActkgAuthoritativeObject rows;
-- runtime Projection nodes are the authority target (1:1 with knowledge_object entities).
DROP INDEX IF EXISTS "ActkgProjectionNode_releaseId_entityId_idx";
CREATE UNIQUE INDEX "ActkgProjectionNode_releaseId_entityId_key"
  ON "ActkgProjectionNode"("releaseId", "entityId");

CREATE TABLE "AggregateCourseCoverageVersion" (
    "id" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "overlayId" TEXT NOT NULL,
    "overlayVersion" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "releaseSetId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "releaseHash" TEXT NOT NULL,
    "sourceDatasetHash" TEXT,
    "deltaReceiptId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "authoringRevision" TEXT NOT NULL,
    "captureRevision" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL DEFAULT 'CURRENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AggregateCourseCoverageVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AggregateCourseCoverageVersion_schema_check"
      CHECK ("schemaVersion" = 'act-course-coverage-overlay/v2'),
    CONSTRAINT "AggregateCourseCoverageVersion_mode_check"
      CHECK ("mode" IN ('baseline', 'incremental')),
    CONSTRAINT "AggregateCourseCoverageVersion_lifecycle_check"
      CHECK ("lifecycleState" IN ('CURRENT', 'STALE', 'SUPERSEDED')),
    CONSTRAINT "AggregateCourseCoverageVersion_revision_check"
      CHECK (
        "authoringRevision" ~ '^[a-f0-9]{40}$'
        AND "captureRevision" ~ '^[a-f0-9]{40}$'
      ),
    CONSTRAINT "AggregateCourseCoverageVersion_hash_check"
      CHECK (
        "releaseHash" ~ '^[a-f0-9]{64}$'
        AND "sourceHash" ~ '^[a-f0-9]{64}$'
      )
);

CREATE TABLE "AggregateCourseCoverageEntry" (
    "versionId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "rationale" TEXT,
    "evidenceRefs" JSONB NOT NULL,
    "reviewIdentity" TEXT NOT NULL,
    "sourceEvidenceDigest" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL DEFAULT 'CURRENT',

    CONSTRAINT "AggregateCourseCoverageEntry_pkey"
      PRIMARY KEY ("versionId", "canonicalId"),
    CONSTRAINT "AggregateCourseCoverageEntry_role_check"
      CHECK ("role" IN (
        'formal_objective',
        'necessary_prerequisite',
        'explicit_extension',
        'excluded_with_rationale'
      )),
    CONSTRAINT "AggregateCourseCoverageEntry_exclusion_check"
      CHECK (
        "role" <> 'excluded_with_rationale'
        OR (
          "rationale" IS NOT NULL
          AND length(btrim("rationale")) > 0
        )
      ),
    -- Every disposition requires non-empty JSON array of evidence refs.
    CONSTRAINT "AggregateCourseCoverageEntry_evidence_check"
      CHECK (
        jsonb_typeof("evidenceRefs") = 'array'
        AND jsonb_array_length("evidenceRefs") > 0
      ),
    -- Case-insensitive, anywhere-in-string markers for non-production identities.
    CONSTRAINT "AggregateCourseCoverageEntry_review_identity_check"
      CHECK (
        length(btrim("reviewIdentity")) > 0
        AND "reviewIdentity" !~* 'candidate-generator\s*:'
        AND "reviewIdentity" !~* 'unreviewed'
        AND "reviewIdentity" !~* 'unbound'
      ),
    CONSTRAINT "AggregateCourseCoverageEntry_lifecycle_check"
      CHECK ("lifecycleState" IN ('CURRENT', 'STALE', 'SUPERSEDED'))
);

CREATE TABLE "ActGovernedStructuralUnitCrosswalk" (
    "id" TEXT NOT NULL,
    "releaseSetId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "deltaReceiptId" TEXT NOT NULL,
    "publishedEntityId" TEXT NOT NULL,
    "retrievalChunkId" TEXT NOT NULL,
    "citationTargetId" TEXT NOT NULL,
    "canonicalId" TEXT,
    "sourceEditionId" TEXT,
    "sourceVersion" TEXT,
    "structuralUnitId" TEXT,
    "structuralUnitVersion" TEXT,
    "structuralUnitHash" TEXT,
    "evidenceContentHash" TEXT,
    "inventoryRunId" TEXT,
    "atomicResourceId" TEXT,
    "resourceId" TEXT,
    "segmentId" TEXT,
    "resourceSegmentHash" TEXT,
    "captureRevision" TEXT NOT NULL,
    "resolutionState" TEXT NOT NULL,
    "validationState" TEXT NOT NULL,
    "validationDigest" TEXT,
    "reviewIdentity" TEXT,
    "evidenceDigest" TEXT,
    "lifecycleState" TEXT NOT NULL DEFAULT 'CURRENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActGovernedStructuralUnitCrosswalk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActGovernedStructuralUnitCrosswalk_resolution_check"
      CHECK ("resolutionState" IN ('DETERMINISTIC', 'SEMANTIC', 'UNRESOLVED', 'STALE')),
    CONSTRAINT "ActGovernedStructuralUnitCrosswalk_validation_check"
      CHECK ("validationState" IN ('VALIDATED', 'UNRESOLVED', 'REJECTED', 'STALE')),
    CONSTRAINT "ActGovernedStructuralUnitCrosswalk_lifecycle_check"
      CHECK ("lifecycleState" IN ('CURRENT', 'STALE', 'SUPERSEDED')),
    CONSTRAINT "ActGovernedStructuralUnitCrosswalk_revision_check"
      CHECK ("captureRevision" ~ '^[a-f0-9]{40}$'),
    CONSTRAINT "ActGovernedStructuralUnitCrosswalk_inventory_pair_check"
      CHECK (
        ("inventoryRunId" IS NULL AND "atomicResourceId" IS NULL)
        OR ("inventoryRunId" IS NOT NULL AND "atomicResourceId" IS NOT NULL)
      ),
    CONSTRAINT "ActGovernedStructuralUnitCrosswalk_validated_tuple_check"
      CHECK (
        "validationState" <> 'VALIDATED'
        OR (
          "lifecycleState" <> 'CURRENT'
          OR (
            "canonicalId" IS NOT NULL
            AND "sourceEditionId" IS NOT NULL
            AND "sourceVersion" IS NOT NULL
            AND "structuralUnitId" IS NOT NULL
            AND "structuralUnitVersion" IS NOT NULL
            AND "structuralUnitHash" IS NOT NULL
            AND "inventoryRunId" IS NOT NULL
            AND "atomicResourceId" IS NOT NULL
            AND "resourceId" IS NOT NULL
            AND "segmentId" IS NOT NULL
            AND "resourceSegmentHash" IS NOT NULL
            AND "validationDigest" IS NOT NULL
          )
        )
      )
);

CREATE TABLE "AggregateRevalidationReceipt" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "priorPublicationIdentity" TEXT NOT NULL,
    "newReleaseSetId" TEXT NOT NULL,
    "newReleaseId" TEXT NOT NULL,
    "newDeltaReceiptId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "identityDigest" TEXT NOT NULL,
    "captureRevision" TEXT NOT NULL,
    "copiesPriorPublication" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AggregateRevalidationReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AggregateRevalidationReceipt_kind_check"
      CHECK ("kind" IN ('coverage', 'crosswalk', 'binding', 'packaging')),
    CONSTRAINT "AggregateRevalidationReceipt_outcome_check"
      CHECK ("outcome" IN ('REVALIDATED', 'REQUIRES_REVIEW', 'INVALIDATED', 'NO_OP_PACKAGING')),
    CONSTRAINT "AggregateRevalidationReceipt_no_copy_check"
      CHECK ("copiesPriorPublication" = false),
    CONSTRAINT "AggregateRevalidationReceipt_identity_check"
      CHECK ("id" <> "priorPublicationIdentity"),
    CONSTRAINT "AggregateRevalidationReceipt_revision_check"
      CHECK ("captureRevision" ~ '^[a-f0-9]{40}$')
);

CREATE TABLE "AggregateGovernanceReceipt" (
    "id" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "captureRevision" TEXT NOT NULL,
    "importCaptureRevision" TEXT NOT NULL,
    "deltaCaptureRevision" TEXT NOT NULL,
    "dbWatermark" TEXT NOT NULL,
    "releaseSetId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "releaseHash" TEXT NOT NULL,
    "sourceDatasetHash" TEXT,
    "deltaReceiptId" TEXT NOT NULL,
    "deltaOutputDigest" TEXT NOT NULL,
    "deltaClassification" TEXT NOT NULL,
    "runtimeProjectionId" TEXT,
    "runtimeProjectionDigest" TEXT,
    "inventoryRunId" TEXT,
    "structuralUnitIndexVersion" TEXT,
    "authoringRevision" TEXT,
    "coverageSourceHash" TEXT,
    "coverageVersionId" TEXT,
    "inputDigest" TEXT NOT NULL,
    "outputDigest" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "authorityState" TEXT NOT NULL DEFAULT 'SHADOW',
    "productionAuthoritative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AggregateGovernanceReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AggregateGovernanceReceipt_schema_check"
      CHECK ("schemaVersion" = 'act-aggregate-course-resource-governance/v1'),
    CONSTRAINT "AggregateGovernanceReceipt_mode_check"
      CHECK ("mode" IN ('baseline', 'incremental', 'packaging_noop')),
    CONSTRAINT "AggregateGovernanceReceipt_authority_check"
      CHECK ("authorityState" = 'SHADOW' AND "productionAuthoritative" = false),
    CONSTRAINT "AggregateGovernanceReceipt_revision_check"
      CHECK (
        "captureRevision" ~ '^[a-f0-9]{40}$'
        AND "importCaptureRevision" ~ '^[a-f0-9]{40}$'
        AND "deltaCaptureRevision" ~ '^[a-f0-9]{40}$'
      ),
    CONSTRAINT "AggregateGovernanceReceipt_hash_check"
      CHECK (
        "releaseHash" ~ '^[a-f0-9]{64}$'
        AND "deltaOutputDigest" ~ '^[a-f0-9]{64}$'
        AND "inputDigest" ~ '^[a-f0-9]{64}$'
        AND "outputDigest" ~ '^[a-f0-9]{64}$'
      )
);

CREATE UNIQUE INDEX "AggregateCourseCoverageVersion_id_releaseId_key"
  ON "AggregateCourseCoverageVersion"("id", "releaseId");
CREATE UNIQUE INDEX "AggregateCourseCoverageVersion_overlayId_overlayVersion_key"
  ON "AggregateCourseCoverageVersion"("overlayId", "overlayVersion");
CREATE UNIQUE INDEX "AggregateCourseCoverageVersion_course_release_version_key"
  ON "AggregateCourseCoverageVersion"("courseId", "releaseSetId", "releaseId", "overlayVersion");
CREATE INDEX "AggregateCourseCoverageVersion_release_lifecycle_idx"
  ON "AggregateCourseCoverageVersion"("releaseSetId", "releaseId", "lifecycleState");
CREATE INDEX "AggregateCourseCoverageVersion_capture_idx"
  ON "AggregateCourseCoverageVersion"("captureRevision");
CREATE INDEX "AggregateCourseCoverageVersion_delta_idx"
  ON "AggregateCourseCoverageVersion"("deltaReceiptId");

CREATE UNIQUE INDEX "AggregateCourseCoverageEntry_versionId_ordinal_key"
  ON "AggregateCourseCoverageEntry"("versionId", "ordinal");
CREATE INDEX "AggregateCourseCoverageEntry_release_canonical_idx"
  ON "AggregateCourseCoverageEntry"("releaseId", "canonicalId");
CREATE INDEX "AggregateCourseCoverageEntry_canonical_role_idx"
  ON "AggregateCourseCoverageEntry"("canonicalId", "role");

CREATE UNIQUE INDEX "ActGovernedStructuralUnitCrosswalk_endpoint_key"
  ON "ActGovernedStructuralUnitCrosswalk"(
    "releaseSetId",
    "releaseId",
    "publishedEntityId",
    "retrievalChunkId",
    "citationTargetId",
    "captureRevision"
  );
CREATE INDEX "ActGovernedStructuralUnitCrosswalk_release_state_idx"
  ON "ActGovernedStructuralUnitCrosswalk"("releaseSetId", "releaseId", "lifecycleState", "validationState");
CREATE INDEX "ActGovernedStructuralUnitCrosswalk_canonical_idx"
  ON "ActGovernedStructuralUnitCrosswalk"("canonicalId");
CREATE INDEX "ActGovernedStructuralUnitCrosswalk_unit_idx"
  ON "ActGovernedStructuralUnitCrosswalk"("structuralUnitId", "structuralUnitVersion", "structuralUnitHash");
CREATE INDEX "ActGovernedStructuralUnitCrosswalk_delta_idx"
  ON "ActGovernedStructuralUnitCrosswalk"("deltaReceiptId");

CREATE INDEX "AggregateRevalidationReceipt_release_kind_idx"
  ON "AggregateRevalidationReceipt"("newReleaseSetId", "newReleaseId", "kind");
CREATE INDEX "AggregateRevalidationReceipt_prior_idx"
  ON "AggregateRevalidationReceipt"("priorPublicationIdentity");
CREATE INDEX "AggregateRevalidationReceipt_capture_idx"
  ON "AggregateRevalidationReceipt"("captureRevision");
CREATE INDEX "AggregateRevalidationReceipt_delta_idx"
  ON "AggregateRevalidationReceipt"("newDeltaReceiptId");

CREATE UNIQUE INDEX "AggregateGovernanceReceipt_outputDigest_key"
  ON "AggregateGovernanceReceipt"("outputDigest");
CREATE INDEX "AggregateGovernanceReceipt_release_mode_idx"
  ON "AggregateGovernanceReceipt"("releaseSetId", "releaseId", "mode");
CREATE INDEX "AggregateGovernanceReceipt_delta_idx"
  ON "AggregateGovernanceReceipt"("deltaReceiptId");
CREATE INDEX "AggregateGovernanceReceipt_capture_idx"
  ON "AggregateGovernanceReceipt"("captureRevision");
CREATE INDEX "AggregateGovernanceReceipt_import_capture_idx"
  ON "AggregateGovernanceReceipt"("importCaptureRevision");
CREATE INDEX "AggregateGovernanceReceipt_delta_capture_idx"
  ON "AggregateGovernanceReceipt"("deltaCaptureRevision");

-- Composite Release identity.
ALTER TABLE "AggregateCourseCoverageVersion"
  ADD CONSTRAINT "AggregateCourseCoverageVersion_release_fkey"
  FOREIGN KEY ("releaseSetId", "releaseId") REFERENCES "ActkgRelease"("releaseSetId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
-- Delta must be the accepted receipt for this same candidate Release.
ALTER TABLE "AggregateCourseCoverageVersion"
  ADD CONSTRAINT "AggregateCourseCoverageVersion_delta_release_fkey"
  FOREIGN KEY ("deltaReceiptId", "releaseSetId", "releaseId")
  REFERENCES "ActkgReleaseSetDeltaReceipt"("id", "candidateReleaseSetId", "candidateReleaseId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AggregateCourseCoverageEntry"
  ADD CONSTRAINT "AggregateCourseCoverageEntry_version_release_fkey"
  FOREIGN KEY ("versionId", "releaseId") REFERENCES "AggregateCourseCoverageVersion"("id", "releaseId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AggregateCourseCoverageEntry"
  ADD CONSTRAINT "AggregateCourseCoverageEntry_canonical_fkey"
  FOREIGN KEY ("releaseId", "canonicalId") REFERENCES "ActkgProjectionNode"("releaseId", "entityId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActGovernedStructuralUnitCrosswalk"
  ADD CONSTRAINT "ActGovernedStructuralUnitCrosswalk_release_fkey"
  FOREIGN KEY ("releaseSetId", "releaseId") REFERENCES "ActkgRelease"("releaseSetId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActGovernedStructuralUnitCrosswalk"
  ADD CONSTRAINT "ActGovernedStructuralUnitCrosswalk_delta_release_fkey"
  FOREIGN KEY ("deltaReceiptId", "releaseSetId", "releaseId")
  REFERENCES "ActkgReleaseSetDeltaReceipt"("id", "candidateReleaseSetId", "candidateReleaseId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActGovernedStructuralUnitCrosswalk"
  ADD CONSTRAINT "ActGovernedStructuralUnitCrosswalk_upstream_fkey"
  FOREIGN KEY ("releaseId", "publishedEntityId", "retrievalChunkId", "citationTargetId")
  REFERENCES "ActkgUpstreamRagReference"("releaseId", "publishedEntityId", "retrievalChunkId", "citationTargetId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActGovernedStructuralUnitCrosswalk"
  ADD CONSTRAINT "ActGovernedStructuralUnitCrosswalk_canonical_fkey"
  FOREIGN KEY ("releaseId", "canonicalId") REFERENCES "ActkgProjectionNode"("releaseId", "entityId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActGovernedStructuralUnitCrosswalk"
  ADD CONSTRAINT "ActGovernedStructuralUnitCrosswalk_inventory_fkey"
  FOREIGN KEY ("inventoryRunId", "atomicResourceId")
  REFERENCES "ResourceBindingInventoryItem"("runId", "atomicResourceId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AggregateRevalidationReceipt"
  ADD CONSTRAINT "AggregateRevalidationReceipt_release_fkey"
  FOREIGN KEY ("newReleaseSetId", "newReleaseId") REFERENCES "ActkgRelease"("releaseSetId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AggregateRevalidationReceipt"
  ADD CONSTRAINT "AggregateRevalidationReceipt_delta_release_fkey"
  FOREIGN KEY ("newDeltaReceiptId", "newReleaseSetId", "newReleaseId")
  REFERENCES "ActkgReleaseSetDeltaReceipt"("id", "candidateReleaseSetId", "candidateReleaseId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AggregateGovernanceReceipt"
  ADD CONSTRAINT "AggregateGovernanceReceipt_release_fkey"
  FOREIGN KEY ("releaseSetId", "releaseId") REFERENCES "ActkgRelease"("releaseSetId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AggregateGovernanceReceipt"
  ADD CONSTRAINT "AggregateGovernanceReceipt_delta_release_fkey"
  FOREIGN KEY ("deltaReceiptId", "releaseSetId", "releaseId")
  REFERENCES "ActkgReleaseSetDeltaReceipt"("id", "candidateReleaseSetId", "candidateReleaseId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AggregateGovernanceReceipt"
  ADD CONSTRAINT "AggregateGovernanceReceipt_coverage_release_fkey"
  FOREIGN KEY ("coverageVersionId", "releaseId")
  REFERENCES "AggregateCourseCoverageVersion"("id", "releaseId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
