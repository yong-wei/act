-- ACT-owned ReleaseSet Delta receipts and generic governance signals (#1132).
-- Receipts are immutable after insert; concurrent recomputation is idempotent
-- on naturalKey / inputDigest. No selector or consumer migration side effects.

CREATE TABLE "ActkgReleaseSetDeltaReceipt" (
    "id" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "captureRevision" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "authorizationState" TEXT NOT NULL,

    "baseEvidenceKind" TEXT NOT NULL,
    "baseReleaseSetId" TEXT,
    "baseReleaseId" TEXT,
    "baseReleaseVersion" TEXT,
    "baseReleaseHash" TEXT,
    "baseSourceDatasetHash" TEXT,
    "baseImportReceiptId" TEXT,
    "baseBundleReceiptId" TEXT,
    "baseBundleId" TEXT,
    "baseBundleRevision" INTEGER,
    "baseBundleDigest" TEXT,
    "baseRuntimeProjectionId" TEXT,
    "baseRuntimeProjectionDigest" TEXT,
    "baseEvidenceCaptureRevision" TEXT,
    "baseSemanticSnapshotDigest" TEXT,

    "candidateEvidenceKind" TEXT NOT NULL,
    "candidateReleaseSetId" TEXT NOT NULL,
    "candidateReleaseId" TEXT NOT NULL,
    "candidateReleaseVersion" TEXT NOT NULL,
    "candidateReleaseHash" TEXT NOT NULL,
    "candidateSourceDatasetHash" TEXT NOT NULL,
    "candidateImportReceiptId" TEXT,
    "candidateBundleReceiptId" TEXT,
    "candidateBundleId" TEXT,
    "candidateBundleRevision" INTEGER,
    "candidateBundleDigest" TEXT,
    "candidateRuntimeProjectionId" TEXT,
    "candidateRuntimeProjectionDigest" TEXT,
    "candidateEvidenceCaptureRevision" TEXT NOT NULL,
    "candidateSemanticSnapshotDigest" TEXT NOT NULL,

    "inputDigest" TEXT NOT NULL,
    "outputDigest" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "identityViolations" JSONB NOT NULL,

    "upstreamCrosscheckStatus" TEXT NOT NULL,
    "upstreamCrosscheckDetails" JSONB,

    "naturalKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActkgReleaseSetDeltaReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_classification_check"
      CHECK ("classification" IN (
        'BASELINE',
        'SEMANTIC_CONTENT_UPDATE',
        'COMPATIBLE_PACKAGING_REVISION'
      )),
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_authorization_check"
      CHECK ("authorizationState" IN (
        'ACCEPTED',
        'REJECTED_IDENTITY',
        'REJECTED_UPSTREAM'
      )),
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_base_evidence_check"
      CHECK ("baseEvidenceKind" IN ('none', 'exact_import', 'standard_bundle')),
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_candidate_evidence_check"
      CHECK ("candidateEvidenceKind" IN ('exact_import', 'standard_bundle')),
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_upstream_status_check"
      CHECK ("upstreamCrosscheckStatus" IN (
        'NOT_REQUIRED',
        'AGREED',
        'DISAGREED',
        'PARSE_FAILED'
      )),
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_bundle_revision_positive"
      CHECK (
        ("baseBundleRevision" IS NULL OR "baseBundleRevision" > 0)
        AND ("candidateBundleRevision" IS NULL OR "candidateBundleRevision" > 0)
      ),
    -- classification = BASELINE iff baseEvidenceKind = none.
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_baseline_iff_none"
      CHECK (
        ("classification" = 'BASELINE' AND "baseEvidenceKind" = 'none')
        OR ("classification" <> 'BASELINE' AND "baseEvidenceKind" <> 'none')
      ),
    -- BASELINE: every base identity field must be empty.
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_baseline_base_null"
      CHECK (
        "classification" <> 'BASELINE'
        OR (
          "baseEvidenceKind" = 'none'
          AND "baseReleaseSetId" IS NULL
          AND "baseReleaseId" IS NULL
          AND "baseReleaseVersion" IS NULL
          AND "baseReleaseHash" IS NULL
          AND "baseSourceDatasetHash" IS NULL
          AND "baseImportReceiptId" IS NULL
          AND "baseBundleReceiptId" IS NULL
          AND "baseBundleId" IS NULL
          AND "baseBundleRevision" IS NULL
          AND "baseBundleDigest" IS NULL
          AND "baseRuntimeProjectionId" IS NULL
          AND "baseRuntimeProjectionDigest" IS NULL
          AND "baseEvidenceCaptureRevision" IS NULL
          AND "baseSemanticSnapshotDigest" IS NULL
        )
      ),
    -- none base: all base identity fields empty (paired with baseline_iff_none).
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_base_none_shape"
      CHECK (
        "baseEvidenceKind" <> 'none'
        OR (
          "baseReleaseSetId" IS NULL
          AND "baseReleaseId" IS NULL
          AND "baseReleaseVersion" IS NULL
          AND "baseReleaseHash" IS NULL
          AND "baseSourceDatasetHash" IS NULL
          AND "baseImportReceiptId" IS NULL
          AND "baseBundleReceiptId" IS NULL
          AND "baseBundleId" IS NULL
          AND "baseBundleRevision" IS NULL
          AND "baseBundleDigest" IS NULL
          AND "baseRuntimeProjectionId" IS NULL
          AND "baseRuntimeProjectionDigest" IS NULL
          AND "baseEvidenceCaptureRevision" IS NULL
          AND "baseSemanticSnapshotDigest" IS NULL
        )
      ),
    -- exact_import base: import + runtime Projection required; bundle packaging null.
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_base_exact_shape"
      CHECK (
        "baseEvidenceKind" <> 'exact_import'
        OR (
          "baseReleaseSetId" IS NOT NULL
          AND "baseReleaseId" IS NOT NULL
          AND "baseReleaseVersion" IS NOT NULL
          AND "baseReleaseHash" IS NOT NULL
          AND "baseSourceDatasetHash" IS NOT NULL
          AND "baseImportReceiptId" IS NOT NULL
          AND "baseEvidenceCaptureRevision" IS NOT NULL
          AND "baseSemanticSnapshotDigest" IS NOT NULL
          AND "baseRuntimeProjectionId" IS NOT NULL
          AND "baseRuntimeProjectionDigest" IS NOT NULL
          AND "baseBundleReceiptId" IS NULL
          AND "baseBundleId" IS NULL
          AND "baseBundleRevision" IS NULL
          AND "baseBundleDigest" IS NULL
        )
      ),
    -- standard_bundle base: full packaging + import + runtime Projection required.
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_base_standard_shape"
      CHECK (
        "baseEvidenceKind" <> 'standard_bundle'
        OR (
          "baseReleaseSetId" IS NOT NULL
          AND "baseReleaseId" IS NOT NULL
          AND "baseReleaseVersion" IS NOT NULL
          AND "baseReleaseHash" IS NOT NULL
          AND "baseSourceDatasetHash" IS NOT NULL
          AND "baseImportReceiptId" IS NOT NULL
          AND "baseBundleReceiptId" IS NOT NULL
          AND "baseBundleId" IS NOT NULL
          AND "baseBundleRevision" IS NOT NULL
          AND "baseBundleDigest" IS NOT NULL
          AND "baseEvidenceCaptureRevision" IS NOT NULL
          AND "baseSemanticSnapshotDigest" IS NOT NULL
          AND "baseRuntimeProjectionId" IS NOT NULL
          AND "baseRuntimeProjectionDigest" IS NOT NULL
        )
      ),
    -- exact_import candidate: import + runtime Projection required; bundle null.
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_candidate_exact_shape"
      CHECK (
        "candidateEvidenceKind" <> 'exact_import'
        OR (
          "candidateImportReceiptId" IS NOT NULL
          AND "candidateRuntimeProjectionId" IS NOT NULL
          AND "candidateRuntimeProjectionDigest" IS NOT NULL
          AND "candidateBundleReceiptId" IS NULL
          AND "candidateBundleId" IS NULL
          AND "candidateBundleRevision" IS NULL
          AND "candidateBundleDigest" IS NULL
        )
      ),
    -- standard_bundle candidate: packaging + import + runtime Projection required.
    CONSTRAINT "ActkgReleaseSetDeltaReceipt_candidate_standard_shape"
      CHECK (
        "candidateEvidenceKind" <> 'standard_bundle'
        OR (
          "candidateImportReceiptId" IS NOT NULL
          AND "candidateBundleReceiptId" IS NOT NULL
          AND "candidateBundleId" IS NOT NULL
          AND "candidateBundleRevision" IS NOT NULL
          AND "candidateBundleDigest" IS NOT NULL
          AND "candidateRuntimeProjectionId" IS NOT NULL
          AND "candidateRuntimeProjectionDigest" IS NOT NULL
        )
      )
);

CREATE UNIQUE INDEX "ActkgReleaseSetDeltaReceipt_naturalKey_key"
  ON "ActkgReleaseSetDeltaReceipt"("naturalKey");
CREATE UNIQUE INDEX "ActkgReleaseSetDeltaReceipt_inputDigest_algorithmVersion_key"
  ON "ActkgReleaseSetDeltaReceipt"("inputDigest", "algorithmVersion");
CREATE INDEX "ActkgReleaseSetDeltaReceipt_candidateReleaseSetId_candidateReleaseId_idx"
  ON "ActkgReleaseSetDeltaReceipt"("candidateReleaseSetId", "candidateReleaseId");
CREATE INDEX "ActkgReleaseSetDeltaReceipt_baseReleaseSetId_baseReleaseId_idx"
  ON "ActkgReleaseSetDeltaReceipt"("baseReleaseSetId", "baseReleaseId");
CREATE INDEX "ActkgReleaseSetDeltaReceipt_classification_authorizationState_idx"
  ON "ActkgReleaseSetDeltaReceipt"("classification", "authorizationState");
CREATE INDEX "ActkgReleaseSetDeltaReceipt_createdAt_idx"
  ON "ActkgReleaseSetDeltaReceipt"("createdAt");

ALTER TABLE "ActkgReleaseSetDeltaReceipt"
ADD CONSTRAINT "ActkgReleaseSetDeltaReceipt_baseReleaseSetId_fkey"
FOREIGN KEY ("baseReleaseSetId") REFERENCES "ActkgReleaseSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActkgReleaseSetDeltaReceipt"
ADD CONSTRAINT "ActkgReleaseSetDeltaReceipt_candidateReleaseSetId_fkey"
FOREIGN KEY ("candidateReleaseSetId") REFERENCES "ActkgReleaseSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActkgReleaseSetDeltaReceipt"
ADD CONSTRAINT "ActkgReleaseSetDeltaReceipt_baseReleaseId_fkey"
FOREIGN KEY ("baseReleaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActkgReleaseSetDeltaReceipt"
ADD CONSTRAINT "ActkgReleaseSetDeltaReceipt_candidateReleaseId_fkey"
FOREIGN KEY ("candidateReleaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActkgReleaseSetDeltaReceipt"
ADD CONSTRAINT "ActkgReleaseSetDeltaReceipt_baseBundleReceiptId_fkey"
FOREIGN KEY ("baseBundleReceiptId") REFERENCES "ActkgBundleReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActkgReleaseSetDeltaReceipt"
ADD CONSTRAINT "ActkgReleaseSetDeltaReceipt_candidateBundleReceiptId_fkey"
FOREIGN KEY ("candidateBundleReceiptId") REFERENCES "ActkgBundleReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActkgReleaseSetDeltaReceipt"
ADD CONSTRAINT "ActkgReleaseSetDeltaReceipt_baseImportReceiptId_fkey"
FOREIGN KEY ("baseImportReceiptId") REFERENCES "ActkgImportReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActkgReleaseSetDeltaReceipt"
ADD CONSTRAINT "ActkgReleaseSetDeltaReceipt_candidateImportReceiptId_fkey"
FOREIGN KEY ("candidateImportReceiptId") REFERENCES "ActkgImportReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ActkgReleaseSetDeltaSignal" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "digests" JSONB,
    "signalDigest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActkgReleaseSetDeltaSignal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActkgReleaseSetDeltaSignal_scope_check"
      CHECK ("scope" IN (
        'object',
        'relation',
        'crosswalk',
        'component',
        'projection',
        'vocabulary'
      )),
    CONSTRAINT "ActkgReleaseSetDeltaSignal_action_check"
      CHECK ("action" IN ('candidate', 'invalidation')),
    CONSTRAINT "ActkgReleaseSetDeltaSignal_reason_check"
      CHECK ("reason" IN (
        'added',
        'removed',
        'payload_changed',
        'type_changed',
        'tier_changed',
        'superseded',
        'predicate_changed',
        'direction_changed',
        'endpoint_changed',
        'digest_changed',
        'profile_added',
        'profile_removed',
        'changed'
      ))
);

CREATE UNIQUE INDEX "ActkgReleaseSetDeltaSignal_receiptId_signalDigest_key"
  ON "ActkgReleaseSetDeltaSignal"("receiptId", "signalDigest");
CREATE INDEX "ActkgReleaseSetDeltaSignal_scope_identity_idx"
  ON "ActkgReleaseSetDeltaSignal"("scope", "identity");
CREATE INDEX "ActkgReleaseSetDeltaSignal_action_reason_idx"
  ON "ActkgReleaseSetDeltaSignal"("action", "reason");

ALTER TABLE "ActkgReleaseSetDeltaSignal"
ADD CONSTRAINT "ActkgReleaseSetDeltaSignal_receiptId_fkey"
FOREIGN KEY ("receiptId") REFERENCES "ActkgReleaseSetDeltaReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Immutability: receipts and signals never update or delete after insert.
CREATE OR REPLACE FUNCTION reject_actkg_release_set_delta_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ActKG ReleaseSet Delta % is immutable', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "ActkgReleaseSetDeltaReceipt_immutable"
BEFORE UPDATE OR DELETE ON "ActkgReleaseSetDeltaReceipt"
FOR EACH ROW EXECUTE FUNCTION reject_actkg_release_set_delta_mutation();

CREATE TRIGGER "ActkgReleaseSetDeltaSignal_immutable"
BEFORE UPDATE OR DELETE ON "ActkgReleaseSetDeltaSignal"
FOR EACH ROW EXECUTE FUNCTION reject_actkg_release_set_delta_mutation();

-- Signals may only be appended for ACCEPTED receipts.
CREATE OR REPLACE FUNCTION actkg_delta_signal_insert_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  auth_state TEXT;
BEGIN
  SELECT "authorizationState" INTO auth_state
  FROM "ActkgReleaseSetDeltaReceipt"
  WHERE "id" = NEW."receiptId";

  IF auth_state IS NULL THEN
    RAISE EXCEPTION 'ActKG Delta signal requires its parent receipt';
  END IF;
  IF auth_state <> 'ACCEPTED' THEN
    RAISE EXCEPTION 'ActKG Delta signals require an ACCEPTED receipt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ActkgReleaseSetDeltaSignal_insert_guard"
BEFORE INSERT ON "ActkgReleaseSetDeltaSignal"
FOR EACH ROW EXECUTE FUNCTION actkg_delta_signal_insert_guard();
