-- Standard ActKG public Bundle candidate persistence.
-- Extends #1125 tables with optional Bundle/Artifact/Projection fields and
-- packaging-scoped receipts. Historical v0.2 rows remain byte-stable;
-- newly added columns stay NULL (explicitly unavailable) for those rows.
--
-- Bundle receipt lifecycle: STAGED (after stage) → ACCEPTED_CANDIDATE (after
-- round-trip in the same transaction). Only that transition is mutable.

-- Optional standard contract identities on the import receipt.
ALTER TABLE "ActkgImportReceipt"
ADD COLUMN "bundleContractVersion" TEXT,
ADD COLUMN "bundleId" TEXT,
ADD COLUMN "bundleRevision" INTEGER,
ADD COLUMN "bundleDigest" TEXT,
ADD COLUMN "bundleKind" TEXT,
ADD COLUMN "releaseStage" TEXT,
ADD COLUMN "manifestRawSha256" TEXT,
ADD COLUMN "schemaContractVersion" TEXT;

-- #1125 exact receipts keep candidateState='CANDIDATE'.
-- Standard public Bundle receipts use 'ACCEPTED_CANDIDATE' after round-trip.
ALTER TABLE "ActkgImportReceipt"
DROP CONSTRAINT "ActkgImportReceipt_candidateState_check";

ALTER TABLE "ActkgImportReceipt"
ADD CONSTRAINT "ActkgImportReceipt_candidateState_check"
CHECK ("candidateState" IN ('CANDIDATE', 'ACCEPTED_CANDIDATE'));

-- Optional Artifact role/profile/contract metadata for standard path.
-- #1125 historical artifacts leave these NULL.
ALTER TABLE "ActkgReleaseArtifact"
ADD COLUMN "role" TEXT,
ADD COLUMN "profile" TEXT,
ADD COLUMN "contractVersion" TEXT,
ADD COLUMN "required" BOOLEAN,
ADD COLUMN "recordCount" INTEGER;

-- Component references may be legacy_exact or standard_bundle.
ALTER TABLE "ActkgReleaseComponent"
ALTER COLUMN "releaseRawSha256" DROP NOT NULL,
ALTER COLUMN "sha256sumsSha256" DROP NOT NULL,
ADD COLUMN "referenceKind" TEXT,
ADD COLUMN "componentRole" TEXT,
ADD COLUMN "componentBundleId" TEXT,
ADD COLUMN "componentBundleDigest" TEXT,
ADD COLUMN "componentManifestSha256" TEXT;

-- Bundle packaging receipt (distinct from semantic Release).
CREATE TABLE "ActkgBundleReceipt" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "bundleRevision" INTEGER NOT NULL,
    "bundleDigest" TEXT NOT NULL,
    "bundleKind" TEXT NOT NULL,
    "releaseStage" TEXT NOT NULL,
    "bundleContractVersion" TEXT NOT NULL,
    "controlledPath" TEXT NOT NULL,
    "manifestRawSha256" TEXT NOT NULL,
    "normalization" TEXT NOT NULL,
    "publicationTag" TEXT NOT NULL,
    "sourceCommit" TEXT NOT NULL,
    "sourceTag" TEXT NOT NULL,
    "releaseSetId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "releaseHash" TEXT NOT NULL,
    "sourceDatasetHash" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "schemaRawSha256" TEXT NOT NULL,
    "lockVersion" TEXT NOT NULL,
    "lockPath" TEXT NOT NULL,
    "lockRawSha256" TEXT NOT NULL,
    "captureRevision" TEXT NOT NULL,
    "candidateState" TEXT NOT NULL,
    "compatibilityCode" TEXT NOT NULL,
    "runtimeProjectionId" TEXT NOT NULL,
    "runtimeProjectionProfile" TEXT NOT NULL,
    "runtimeProjectionDigest" TEXT NOT NULL,
    "artifactCount" INTEGER NOT NULL,
    "statistics" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActkgBundleReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActkgBundleReceipt_bundleRevision_check" CHECK ("bundleRevision" >= 0),
    CONSTRAINT "ActkgBundleReceipt_artifactCount_check" CHECK ("artifactCount" >= 0),
    CONSTRAINT "ActkgBundleReceipt_candidateState_check" CHECK ("candidateState" IN ('STAGED', 'ACCEPTED_CANDIDATE'))
);

CREATE UNIQUE INDEX "ActkgBundleReceipt_bundleDigest_key" ON "ActkgBundleReceipt"("bundleDigest");
CREATE UNIQUE INDEX "ActkgBundleReceipt_bundleId_bundleRevision_key" ON "ActkgBundleReceipt"("bundleId", "bundleRevision");
CREATE INDEX "ActkgBundleReceipt_releaseSetId_releaseId_idx" ON "ActkgBundleReceipt"("releaseSetId", "releaseId");
CREATE INDEX "ActkgBundleReceipt_releaseId_candidateState_idx" ON "ActkgBundleReceipt"("releaseId", "candidateState");

ALTER TABLE "ActkgBundleReceipt"
ADD CONSTRAINT "ActkgBundleReceipt_releaseSetId_fkey"
FOREIGN KEY ("releaseSetId") REFERENCES "ActkgReleaseSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActkgBundleReceipt"
ADD CONSTRAINT "ActkgBundleReceipt_releaseId_fkey"
FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Packaging-scoped raw Artifacts.
CREATE TABLE "ActkgBundleArtifact" (
    "bundleReceiptId" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "role" TEXT NOT NULL,
    "profile" TEXT,
    "profiles" JSONB,
    "contractVersion" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL,
    "recordCount" INTEGER,
    CONSTRAINT "ActkgBundleArtifact_pkey" PRIMARY KEY ("bundleReceiptId", "relativePath"),
    CONSTRAINT "ActkgBundleArtifact_ordinal_check" CHECK ("ordinal" >= 0),
    CONSTRAINT "ActkgBundleArtifact_byteLength_check" CHECK ("byteLength" >= 0)
);

CREATE UNIQUE INDEX "ActkgBundleArtifact_bundleReceiptId_ordinal_key" ON "ActkgBundleArtifact"("bundleReceiptId", "ordinal");
CREATE INDEX "ActkgBundleArtifact_role_idx" ON "ActkgBundleArtifact"("role");

ALTER TABLE "ActkgBundleArtifact"
ADD CONSTRAINT "ActkgBundleArtifact_bundleReceiptId_fkey"
FOREIGN KEY ("bundleReceiptId") REFERENCES "ActkgBundleReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Multi-Projection identities (runtime + domain + review). Semantic rows are
-- release-scoped; bundleReceiptId is optional packaging provenance only.
CREATE TABLE "ActkgProjectionIdentity" (
    "releaseId" TEXT NOT NULL,
    "projectionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "profile" TEXT NOT NULL,
    "projectionProfile" TEXT NOT NULL,
    "versionDigest" TEXT NOT NULL,
    "sourceRelease" TEXT NOT NULL,
    "sourceReleaseHash" TEXT NOT NULL,
    "sourceDatasetHash" TEXT NOT NULL,
    "nodeCount" INTEGER NOT NULL,
    "linkCount" INTEGER NOT NULL,
    "artifactPath" TEXT NOT NULL,
    "artifactSha256" TEXT NOT NULL,
    "isRuntime" BOOLEAN NOT NULL,
    "bundleReceiptId" TEXT,
    CONSTRAINT "ActkgProjectionIdentity_pkey" PRIMARY KEY ("releaseId", "projectionId"),
    CONSTRAINT "ActkgProjectionIdentity_ordinal_check" CHECK ("ordinal" >= 0),
    CONSTRAINT "ActkgProjectionIdentity_nodeCount_check" CHECK ("nodeCount" >= 0),
    CONSTRAINT "ActkgProjectionIdentity_linkCount_check" CHECK ("linkCount" >= 0)
);

CREATE UNIQUE INDEX "ActkgProjectionIdentity_releaseId_profile_key" ON "ActkgProjectionIdentity"("releaseId", "profile");
CREATE UNIQUE INDEX "ActkgProjectionIdentity_releaseId_ordinal_key" ON "ActkgProjectionIdentity"("releaseId", "ordinal");
CREATE INDEX "ActkgProjectionIdentity_releaseId_isRuntime_idx" ON "ActkgProjectionIdentity"("releaseId", "isRuntime");

ALTER TABLE "ActkgProjectionIdentity"
ADD CONSTRAINT "ActkgProjectionIdentity_releaseId_fkey"
FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActkgProjectionIdentity"
ADD CONSTRAINT "ActkgProjectionIdentity_bundleReceiptId_fkey"
FOREIGN KEY ("bundleReceiptId") REFERENCES "ActkgBundleReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Link Metadata rows for standard Bundles (full unique relation set).
CREATE TABLE "ActkgProjectionLinkMetadata" (
    "releaseId" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "releaseTier" TEXT NOT NULL,
    "sourceRelease" TEXT NOT NULL,
    "sourceReleaseHash" TEXT NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "sourceComponentRelease" TEXT,
    "targetComponentRelease" TEXT,
    "relationComponentRelease" TEXT,
    "profiles" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "bundleReceiptId" TEXT,
    CONSTRAINT "ActkgProjectionLinkMetadata_pkey" PRIMARY KEY ("releaseId", "relationId"),
    CONSTRAINT "ActkgProjectionLinkMetadata_ordinal_check" CHECK ("ordinal" >= 0)
);

CREATE UNIQUE INDEX "ActkgProjectionLinkMetadata_releaseId_ordinal_key" ON "ActkgProjectionLinkMetadata"("releaseId", "ordinal");
CREATE INDEX "ActkgProjectionLinkMetadata_releaseId_releaseTier_idx" ON "ActkgProjectionLinkMetadata"("releaseId", "releaseTier");

ALTER TABLE "ActkgProjectionLinkMetadata"
ADD CONSTRAINT "ActkgProjectionLinkMetadata_releaseId_fkey"
FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActkgProjectionLinkMetadata"
ADD CONSTRAINT "ActkgProjectionLinkMetadata_bundleReceiptId_fkey"
FOREIGN KEY ("bundleReceiptId") REFERENCES "ActkgBundleReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bundle receipt lifecycle is closed at the database layer:
--   INSERT must be STAGED only (no direct ACCEPTED_CANDIDATE insert)
--   UPDATE may only perform the sole STAGED → ACCEPTED_CANDIDATE transition
--   DELETE is always rejected; ACCEPTED rows are fully immutable
CREATE OR REPLACE FUNCTION actkg_bundle_receipt_insert_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."candidateState" IS DISTINCT FROM 'STAGED' THEN
    RAISE EXCEPTION 'ActKG Bundle receipt INSERT requires candidateState=STAGED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ActkgBundleReceipt_insert_guard"
BEFORE INSERT ON "ActkgBundleReceipt"
FOR EACH ROW EXECUTE FUNCTION actkg_bundle_receipt_insert_guard();

CREATE OR REPLACE FUNCTION actkg_bundle_receipt_mutation_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ActKG Bundle receipt is immutable';
  END IF;

  IF OLD."candidateState" = 'ACCEPTED_CANDIDATE' THEN
    RAISE EXCEPTION 'ActKG accepted Bundle receipt is immutable';
  END IF;

  IF OLD."candidateState" = 'STAGED' AND NEW."candidateState" = 'ACCEPTED_CANDIDATE' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id"
      OR NEW."bundleId" IS DISTINCT FROM OLD."bundleId"
      OR NEW."bundleRevision" IS DISTINCT FROM OLD."bundleRevision"
      OR NEW."bundleDigest" IS DISTINCT FROM OLD."bundleDigest"
      OR NEW."bundleKind" IS DISTINCT FROM OLD."bundleKind"
      OR NEW."releaseStage" IS DISTINCT FROM OLD."releaseStage"
      OR NEW."bundleContractVersion" IS DISTINCT FROM OLD."bundleContractVersion"
      OR NEW."controlledPath" IS DISTINCT FROM OLD."controlledPath"
      OR NEW."manifestRawSha256" IS DISTINCT FROM OLD."manifestRawSha256"
      OR NEW."normalization" IS DISTINCT FROM OLD."normalization"
      OR NEW."publicationTag" IS DISTINCT FROM OLD."publicationTag"
      OR NEW."sourceCommit" IS DISTINCT FROM OLD."sourceCommit"
      OR NEW."sourceTag" IS DISTINCT FROM OLD."sourceTag"
      OR NEW."releaseSetId" IS DISTINCT FROM OLD."releaseSetId"
      OR NEW."releaseId" IS DISTINCT FROM OLD."releaseId"
      OR NEW."releaseHash" IS DISTINCT FROM OLD."releaseHash"
      OR NEW."sourceDatasetHash" IS DISTINCT FROM OLD."sourceDatasetHash"
      OR NEW."schemaVersion" IS DISTINCT FROM OLD."schemaVersion"
      OR NEW."schemaRawSha256" IS DISTINCT FROM OLD."schemaRawSha256"
      OR NEW."lockVersion" IS DISTINCT FROM OLD."lockVersion"
      OR NEW."lockPath" IS DISTINCT FROM OLD."lockPath"
      OR NEW."lockRawSha256" IS DISTINCT FROM OLD."lockRawSha256"
      OR NEW."captureRevision" IS DISTINCT FROM OLD."captureRevision"
      OR NEW."compatibilityCode" IS DISTINCT FROM OLD."compatibilityCode"
      OR NEW."runtimeProjectionId" IS DISTINCT FROM OLD."runtimeProjectionId"
      OR NEW."runtimeProjectionProfile" IS DISTINCT FROM OLD."runtimeProjectionProfile"
      OR NEW."runtimeProjectionDigest" IS DISTINCT FROM OLD."runtimeProjectionDigest"
      OR NEW."artifactCount" IS DISTINCT FROM OLD."artifactCount"
      OR NEW."statistics" IS DISTINCT FROM OLD."statistics"
    THEN
      RAISE EXCEPTION 'ActKG Bundle receipt STAGED→ACCEPTED may only change candidateState';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ActKG Bundle receipt mutation is not a permitted STAGED→ACCEPTED_CANDIDATE transition';
END;
$$;

CREATE TRIGGER "ActkgBundleReceipt_mutation_guard"
BEFORE UPDATE OR DELETE ON "ActkgBundleReceipt"
FOR EACH ROW EXECUTE FUNCTION actkg_bundle_receipt_mutation_guard();

-- Bundle artifacts: immutable after write; insert only while parent is STAGED.
CREATE TRIGGER "ActkgBundleArtifact_immutable"
BEFORE UPDATE OR DELETE ON "ActkgBundleArtifact"
FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();

CREATE OR REPLACE FUNCTION actkg_bundle_artifact_insert_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent_state TEXT;
BEGIN
  SELECT "candidateState" INTO parent_state
  FROM "ActkgBundleReceipt"
  WHERE "id" = NEW."bundleReceiptId";

  IF parent_state IS NULL THEN
    RAISE EXCEPTION 'ActKG Bundle Artifact requires its packaging receipt';
  END IF;
  IF parent_state = 'ACCEPTED_CANDIDATE' THEN
    RAISE EXCEPTION 'ActKG Bundle Artifact is sealed by its accepted packaging receipt';
  END IF;
  IF parent_state <> 'STAGED' THEN
    RAISE EXCEPTION 'ActKG Bundle Artifact requires a STAGED packaging receipt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ActkgBundleArtifact_insert_guard"
BEFORE INSERT ON "ActkgBundleArtifact"
FOR EACH ROW EXECUTE FUNCTION actkg_bundle_artifact_insert_guard();

-- Semantic multi-Projection / metadata: immutable + sealed after import receipt.
CREATE TRIGGER "ActkgProjectionIdentity_immutable"
BEFORE UPDATE OR DELETE ON "ActkgProjectionIdentity"
FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();

CREATE TRIGGER "ActkgProjectionLinkMetadata_immutable"
BEFORE UPDATE OR DELETE ON "ActkgProjectionLinkMetadata"
FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();

CREATE TRIGGER "ActkgProjectionIdentity_sealed_insert"
BEFORE INSERT ON "ActkgProjectionIdentity"
FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();

CREATE TRIGGER "ActkgProjectionLinkMetadata_sealed_insert"
BEFORE INSERT ON "ActkgProjectionLinkMetadata"
FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
