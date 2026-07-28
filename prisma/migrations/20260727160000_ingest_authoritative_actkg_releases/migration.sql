CREATE TABLE "ActkgReleaseSet" (
    "id" TEXT NOT NULL,
    "controlledPath" TEXT NOT NULL,
    "lockVersion" TEXT NOT NULL,
    "candidateState" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActkgReleaseSet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActkgReleaseSet_candidateState_check" CHECK ("candidateState" = 'CANDIDATE')
);

CREATE TABLE "ActkgRelease" (
    "id" TEXT NOT NULL,
    "releaseSetId" TEXT NOT NULL,
    "releaseVersion" TEXT NOT NULL,
    "releaseStatus" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "contractHash" TEXT NOT NULL,
    "releaseHash" TEXT NOT NULL,
    "schemaRawHash" TEXT NOT NULL,
    "releaseRawHash" TEXT NOT NULL,
    "notesRawHash" TEXT NOT NULL,
    "captureRevision" TEXT NOT NULL,
    "lockRawHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActkgRelease_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActkgRelease_status_check" CHECK ("releaseStatus" = 'RELEASED')
);

CREATE TABLE "ActkgAuthoritativeObject" (
    "releaseId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "canonicalType" TEXT NOT NULL,
    "semanticName" TEXT,
    "reviewStatus" TEXT,
    "publicationStatus" TEXT,
    "lifecycleStatus" TEXT,
    "payload" JSONB NOT NULL,
    CONSTRAINT "ActkgAuthoritativeObject_pkey" PRIMARY KEY ("releaseId", "canonicalId"),
    CONSTRAINT "ActkgAuthoritativeObject_ordinal_check" CHECK ("ordinal" >= 0)
);

CREATE TABLE "ActkgSourceObject" (
    "releaseId" TEXT NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "sourceId" TEXT,
    "sectionId" TEXT,
    "nodeType" TEXT,
    "reviewStatus" TEXT,
    "payload" JSONB NOT NULL,
    CONSTRAINT "ActkgSourceObject_pkey" PRIMARY KEY ("releaseId", "sourceObjectId"),
    CONSTRAINT "ActkgSourceObject_ordinal_check" CHECK ("ordinal" >= 0)
);

CREATE TABLE "ActkgAuthoritativeRelation" (
    "releaseId" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "qualityTier" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "reviewStatus" TEXT,
    "publicationStatus" TEXT,
    "direct" BOOLEAN,
    "payload" JSONB NOT NULL,
    CONSTRAINT "ActkgAuthoritativeRelation_pkey" PRIMARY KEY ("releaseId", "relationId"),
    CONSTRAINT "ActkgAuthoritativeRelation_tier_check" CHECK ("qualityTier" IN ('GOLD', 'SILVER')),
    CONSTRAINT "ActkgAuthoritativeRelation_ordinal_check" CHECK ("ordinal" >= 0),
    CONSTRAINT "ActkgAuthoritativeRelation_distinct_endpoints_check" CHECK ("sourceId" <> "targetId")
);

CREATE TABLE "ActkgSourceMapping" (
    "releaseId" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "mappingType" TEXT NOT NULL,
    "reviewStatus" TEXT,
    "payload" JSONB NOT NULL,
    CONSTRAINT "ActkgSourceMapping_pkey" PRIMARY KEY ("releaseId", "mappingId"),
    CONSTRAINT "ActkgSourceMapping_ordinal_check" CHECK ("ordinal" >= 0)
);

CREATE TABLE "ActkgEvidenceSegment" (
    "releaseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "sourceEditionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "segmentOrdinal" INTEGER NOT NULL,
    "segmentType" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    CONSTRAINT "ActkgEvidenceSegment_pkey" PRIMARY KEY ("releaseId", "evidenceId"),
    CONSTRAINT "ActkgEvidenceSegment_ordinal_check" CHECK ("ordinal" >= 0),
    CONSTRAINT "ActkgEvidenceSegment_segmentOrdinal_check" CHECK ("segmentOrdinal" >= 0)
);

CREATE TABLE "ActkgOriginalReleasePayload" (
    "releaseId" TEXT NOT NULL,
    "normalization" TEXT NOT NULL,
    "canonicalHash" TEXT NOT NULL,
    "normalizedPayload" JSONB NOT NULL,
    CONSTRAINT "ActkgOriginalReleasePayload_pkey" PRIMARY KEY ("releaseId"),
    CONSTRAINT "ActkgOriginalReleasePayload_normalization_check" CHECK ("normalization" = 'canonical-json/rfc8785-subset-v1')
);

CREATE TABLE "ActkgImportReceipt" (
    "id" TEXT NOT NULL,
    "releaseSetId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "sourceRun" TEXT NOT NULL,
    "sourceImplementationCommit" TEXT NOT NULL,
    "captureRevision" TEXT NOT NULL,
    "lockRawHash" TEXT NOT NULL,
    "ctkgDatasetAvailability" TEXT NOT NULL,
    "ctkgDatasetHash" TEXT,
    "ctkgDatasetPublicationIdentity" TEXT,
    "ctkgDatasetResolvableLocation" TEXT,
    "revisionRegistryAvailability" TEXT NOT NULL,
    "revisionRegistryVersion" TEXT,
    "revisionRegistryHash" TEXT,
    "objectCount" INTEGER NOT NULL,
    "sourceMappingCount" INTEGER NOT NULL,
    "goldRelationCount" INTEGER NOT NULL,
    "silverRelationCount" INTEGER NOT NULL,
    "sourceObjectCount" INTEGER NOT NULL,
    "evidenceSegmentCount" INTEGER NOT NULL,
    "candidateState" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActkgImportReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActkgImportReceipt_unavailable_lineage_check" CHECK (
      "ctkgDatasetAvailability" = 'UNAVAILABLE'
      AND "ctkgDatasetHash" IS NULL
      AND "ctkgDatasetPublicationIdentity" IS NULL
      AND "ctkgDatasetResolvableLocation" IS NULL
      AND "revisionRegistryAvailability" = 'UNAVAILABLE'
      AND "revisionRegistryVersion" IS NULL
      AND "revisionRegistryHash" IS NULL
    ),
    CONSTRAINT "ActkgImportReceipt_candidateState_check" CHECK ("candidateState" = 'CANDIDATE')
);

CREATE UNIQUE INDEX "ActkgReleaseSet_controlledPath_key" ON "ActkgReleaseSet"("controlledPath");
CREATE UNIQUE INDEX "ActkgRelease_releaseVersion_key" ON "ActkgRelease"("releaseVersion");
CREATE UNIQUE INDEX "ActkgRelease_releaseHash_key" ON "ActkgRelease"("releaseHash");
CREATE UNIQUE INDEX "ActkgRelease_releaseSetId_releaseVersion_key" ON "ActkgRelease"("releaseSetId", "releaseVersion");
CREATE INDEX "ActkgRelease_releaseSetId_releaseStatus_idx" ON "ActkgRelease"("releaseSetId", "releaseStatus");
CREATE UNIQUE INDEX "ActkgAuthoritativeObject_releaseId_ordinal_key" ON "ActkgAuthoritativeObject"("releaseId", "ordinal");
CREATE INDEX "ActkgAuthoritativeObject_releaseId_canonicalType_idx" ON "ActkgAuthoritativeObject"("releaseId", "canonicalType");
CREATE INDEX "ActkgAuthoritativeObject_releaseId_semanticName_idx" ON "ActkgAuthoritativeObject"("releaseId", "semanticName");
CREATE UNIQUE INDEX "ActkgSourceObject_releaseId_ordinal_key" ON "ActkgSourceObject"("releaseId", "ordinal");
CREATE INDEX "ActkgSourceObject_releaseId_sourceId_sectionId_idx" ON "ActkgSourceObject"("releaseId", "sourceId", "sectionId");
CREATE UNIQUE INDEX "ActkgAuthoritativeRelation_releaseId_qualityTier_ordinal_key" ON "ActkgAuthoritativeRelation"("releaseId", "qualityTier", "ordinal");
CREATE UNIQUE INDEX "ActkgAuthoritativeRelation_releaseId_sourceId_targetId_relationType_key" ON "ActkgAuthoritativeRelation"("releaseId", "sourceId", "targetId", "relationType");
CREATE INDEX "ActkgAuthoritativeRelation_releaseId_relationType_qualityTier_idx" ON "ActkgAuthoritativeRelation"("releaseId", "relationType", "qualityTier");
CREATE INDEX "ActkgAuthoritativeRelation_releaseId_sourceId_idx" ON "ActkgAuthoritativeRelation"("releaseId", "sourceId");
CREATE INDEX "ActkgAuthoritativeRelation_releaseId_targetId_idx" ON "ActkgAuthoritativeRelation"("releaseId", "targetId");
CREATE UNIQUE INDEX "ActkgSourceMapping_releaseId_ordinal_key" ON "ActkgSourceMapping"("releaseId", "ordinal");
CREATE UNIQUE INDEX "ActkgSourceMapping_releaseId_sourceObjectId_canonicalId_mappingType_key" ON "ActkgSourceMapping"("releaseId", "sourceObjectId", "canonicalId", "mappingType");
CREATE INDEX "ActkgSourceMapping_releaseId_canonicalId_idx" ON "ActkgSourceMapping"("releaseId", "canonicalId");
CREATE UNIQUE INDEX "ActkgEvidenceSegment_releaseId_ordinal_key" ON "ActkgEvidenceSegment"("releaseId", "ordinal");
CREATE INDEX "ActkgEvidenceSegment_releaseId_sourceEditionId_sectionId_segmentOrdinal_idx" ON "ActkgEvidenceSegment"("releaseId", "sourceEditionId", "sectionId", "segmentOrdinal");
CREATE UNIQUE INDEX "ActkgImportReceipt_releaseSetId_key" ON "ActkgImportReceipt"("releaseSetId");
CREATE UNIQUE INDEX "ActkgImportReceipt_releaseId_key" ON "ActkgImportReceipt"("releaseId");

ALTER TABLE "ActkgRelease" ADD CONSTRAINT "ActkgRelease_releaseSetId_fkey" FOREIGN KEY ("releaseSetId") REFERENCES "ActkgReleaseSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgAuthoritativeObject" ADD CONSTRAINT "ActkgAuthoritativeObject_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgSourceObject" ADD CONSTRAINT "ActkgSourceObject_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgAuthoritativeRelation" ADD CONSTRAINT "ActkgAuthoritativeRelation_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgAuthoritativeRelation" ADD CONSTRAINT "ActkgAuthoritativeRelation_source_fkey" FOREIGN KEY ("releaseId", "sourceId") REFERENCES "ActkgAuthoritativeObject"("releaseId", "canonicalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgAuthoritativeRelation" ADD CONSTRAINT "ActkgAuthoritativeRelation_target_fkey" FOREIGN KEY ("releaseId", "targetId") REFERENCES "ActkgAuthoritativeObject"("releaseId", "canonicalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgSourceMapping" ADD CONSTRAINT "ActkgSourceMapping_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgSourceMapping" ADD CONSTRAINT "ActkgSourceMapping_sourceObject_fkey" FOREIGN KEY ("releaseId", "sourceObjectId") REFERENCES "ActkgSourceObject"("releaseId", "sourceObjectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgSourceMapping" ADD CONSTRAINT "ActkgSourceMapping_canonical_fkey" FOREIGN KEY ("releaseId", "canonicalId") REFERENCES "ActkgAuthoritativeObject"("releaseId", "canonicalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgEvidenceSegment" ADD CONSTRAINT "ActkgEvidenceSegment_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgOriginalReleasePayload" ADD CONSTRAINT "ActkgOriginalReleasePayload_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgImportReceipt" ADD CONSTRAINT "ActkgImportReceipt_releaseSetId_fkey" FOREIGN KEY ("releaseSetId") REFERENCES "ActkgReleaseSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgImportReceipt" ADD CONSTRAINT "ActkgImportReceipt_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION reject_actkg_authoritative_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ActKG authoritative candidate content is immutable';
END;
$$;

CREATE TRIGGER "ActkgRelease_immutable" BEFORE UPDATE OR DELETE ON "ActkgRelease" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgReleaseSet_immutable" BEFORE UPDATE OR DELETE ON "ActkgReleaseSet" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgAuthoritativeObject_immutable" BEFORE UPDATE OR DELETE ON "ActkgAuthoritativeObject" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgAuthoritativeRelation_immutable" BEFORE UPDATE OR DELETE ON "ActkgAuthoritativeRelation" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgSourceObject_immutable" BEFORE UPDATE OR DELETE ON "ActkgSourceObject" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgSourceMapping_immutable" BEFORE UPDATE OR DELETE ON "ActkgSourceMapping" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgEvidenceSegment_immutable" BEFORE UPDATE OR DELETE ON "ActkgEvidenceSegment" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgOriginalReleasePayload_immutable" BEFORE UPDATE OR DELETE ON "ActkgOriginalReleasePayload" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgImportReceipt_immutable" BEFORE UPDATE OR DELETE ON "ActkgImportReceipt" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();

CREATE FUNCTION reject_actkg_authoritative_append_after_receipt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ActkgImportReceipt"
    WHERE "releaseId" = NEW."releaseId"
  ) THEN
    RAISE EXCEPTION 'ActKG authoritative candidate content is sealed by its import receipt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ActkgAuthoritativeObject_sealed_insert" BEFORE INSERT ON "ActkgAuthoritativeObject" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
CREATE TRIGGER "ActkgAuthoritativeRelation_sealed_insert" BEFORE INSERT ON "ActkgAuthoritativeRelation" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
CREATE TRIGGER "ActkgSourceObject_sealed_insert" BEFORE INSERT ON "ActkgSourceObject" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
CREATE TRIGGER "ActkgSourceMapping_sealed_insert" BEFORE INSERT ON "ActkgSourceMapping" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
CREATE TRIGGER "ActkgEvidenceSegment_sealed_insert" BEFORE INSERT ON "ActkgEvidenceSegment" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
