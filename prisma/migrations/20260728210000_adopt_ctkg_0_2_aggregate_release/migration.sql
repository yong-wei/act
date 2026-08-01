ALTER TABLE "ActkgRelease"
ADD COLUMN "schemaVersion" TEXT,
ADD COLUMN "upstreamReleaseId" TEXT,
ADD COLUMN "projectionId" TEXT,
ADD COLUMN "projectionDigest" TEXT,
ADD COLUMN "sourceDatasetHash" TEXT,
ADD COLUMN "upstreamPublicationCommit" TEXT,
ADD COLUMN "upstreamClosedCommit" TEXT;

ALTER TABLE "ActkgImportReceipt"
ALTER COLUMN "sourceRun" DROP NOT NULL,
ALTER COLUMN "sourceImplementationCommit" DROP NOT NULL,
ADD COLUMN "schemaVersion" TEXT,
ADD COLUMN "upstreamReleaseId" TEXT,
ADD COLUMN "projectionId" TEXT,
ADD COLUMN "projectionDigest" TEXT,
ADD COLUMN "sourceDatasetHash" TEXT,
ADD COLUMN "upstreamPublicationCommit" TEXT,
ADD COLUMN "upstreamClosedCommit" TEXT,
ADD COLUMN "releaseEntryCount" INTEGER,
ADD COLUMN "projectionNodeCount" INTEGER,
ADD COLUMN "projectionLinkCount" INTEGER,
ADD COLUMN "upstreamRagReferenceCount" INTEGER,
ADD COLUMN "artifactCount" INTEGER,
ADD COLUMN "componentCount" INTEGER;

CREATE TABLE "ActkgReleaseArtifact" (
    "releaseId" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    CONSTRAINT "ActkgReleaseArtifact_pkey" PRIMARY KEY ("releaseId", "relativePath"),
    CONSTRAINT "ActkgReleaseArtifact_ordinal_check" CHECK ("ordinal" >= 0),
    CONSTRAINT "ActkgReleaseArtifact_byteLength_check" CHECK ("byteLength" >= 0)
);

CREATE TABLE "ActkgReleaseComponent" (
    "releaseId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "componentReleaseId" TEXT NOT NULL,
    "releaseVersion" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "controlledPath" TEXT NOT NULL,
    "releaseHash" TEXT NOT NULL,
    "releaseRawSha256" TEXT NOT NULL,
    "sha256sumsSha256" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    CONSTRAINT "ActkgReleaseComponent_pkey" PRIMARY KEY ("releaseId", "componentReleaseId"),
    CONSTRAINT "ActkgReleaseComponent_ordinal_check" CHECK ("ordinal" >= 0)
);

CREATE TABLE "ActkgReleaseEntry" (
    "releaseId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "releaseTier" TEXT NOT NULL,
    "entityRole" TEXT NOT NULL,
    "inclusionReason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    CONSTRAINT "ActkgReleaseEntry_pkey" PRIMARY KEY ("releaseId", "entityId"),
    CONSTRAINT "ActkgReleaseEntry_ordinal_check" CHECK ("ordinal" >= 0),
    CONSTRAINT "ActkgReleaseEntry_releaseTier_check" CHECK ("releaseTier" IN ('gold', 'silver', 'support'))
);

CREATE TABLE "ActkgProjectionNode" (
    "releaseId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "releaseTier" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL,
    "publicationStatus" TEXT NOT NULL,
    "semanticName" TEXT,
    "sourceCoverageCount" INTEGER NOT NULL,
    "candidate" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    CONSTRAINT "ActkgProjectionNode_pkey" PRIMARY KEY ("releaseId", "nodeId"),
    CONSTRAINT "ActkgProjectionNode_ordinal_check" CHECK ("ordinal" >= 0),
    CONSTRAINT "ActkgProjectionNode_releaseTier_check" CHECK ("releaseTier" IN ('gold', 'silver', 'support')),
    CONSTRAINT "ActkgProjectionNode_sourceCoverageCount_check" CHECK ("sourceCoverageCount" >= 0)
);

CREATE TABLE "ActkgProjectionLink" (
    "releaseId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "relationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "relationFamily" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "evidenceState" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    CONSTRAINT "ActkgProjectionLink_pkey" PRIMARY KEY ("releaseId", "linkId"),
    CONSTRAINT "ActkgProjectionLink_ordinal_check" CHECK ("ordinal" >= 0),
    CONSTRAINT "ActkgProjectionLink_evidenceState_check" CHECK ("evidenceState" IN ('available', 'unavailable')),
    CONSTRAINT "ActkgProjectionLink_distinct_endpoints_check" CHECK ("sourceId" <> "targetId")
);

CREATE TABLE "ActkgUpstreamRagReference" (
    "releaseId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "publishedEntityId" TEXT NOT NULL,
    "retrievalChunkId" TEXT NOT NULL,
    "citationTargetId" TEXT NOT NULL,
    CONSTRAINT "ActkgUpstreamRagReference_pkey" PRIMARY KEY ("releaseId", "publishedEntityId", "retrievalChunkId", "citationTargetId"),
    CONSTRAINT "ActkgUpstreamRagReference_ordinal_check" CHECK ("ordinal" >= 0)
);

CREATE UNIQUE INDEX "ActkgReleaseArtifact_releaseId_ordinal_key" ON "ActkgReleaseArtifact"("releaseId", "ordinal");
CREATE UNIQUE INDEX "ActkgReleaseComponent_releaseId_ordinal_key" ON "ActkgReleaseComponent"("releaseId", "ordinal");
CREATE UNIQUE INDEX "ActkgReleaseEntry_releaseId_ordinal_key" ON "ActkgReleaseEntry"("releaseId", "ordinal");
CREATE INDEX "ActkgReleaseEntry_releaseId_releaseTier_idx" ON "ActkgReleaseEntry"("releaseId", "releaseTier");
CREATE INDEX "ActkgReleaseEntry_releaseId_entityRole_idx" ON "ActkgReleaseEntry"("releaseId", "entityRole");
CREATE UNIQUE INDEX "ActkgProjectionNode_releaseId_ordinal_key" ON "ActkgProjectionNode"("releaseId", "ordinal");
CREATE INDEX "ActkgProjectionNode_releaseId_entityId_idx" ON "ActkgProjectionNode"("releaseId", "entityId");
CREATE INDEX "ActkgProjectionNode_releaseId_entityType_idx" ON "ActkgProjectionNode"("releaseId", "entityType");
CREATE INDEX "ActkgProjectionNode_releaseId_releaseTier_idx" ON "ActkgProjectionNode"("releaseId", "releaseTier");
CREATE UNIQUE INDEX "ActkgProjectionLink_releaseId_ordinal_key" ON "ActkgProjectionLink"("releaseId", "ordinal");
CREATE UNIQUE INDEX "ActkgProjectionLink_releaseId_relationId_key" ON "ActkgProjectionLink"("releaseId", "relationId");
CREATE INDEX "ActkgProjectionLink_releaseId_sourceId_idx" ON "ActkgProjectionLink"("releaseId", "sourceId");
CREATE INDEX "ActkgProjectionLink_releaseId_targetId_idx" ON "ActkgProjectionLink"("releaseId", "targetId");
CREATE INDEX "ActkgProjectionLink_releaseId_relationType_idx" ON "ActkgProjectionLink"("releaseId", "relationType");
CREATE UNIQUE INDEX "ActkgUpstreamRagReference_releaseId_ordinal_key" ON "ActkgUpstreamRagReference"("releaseId", "ordinal");
CREATE INDEX "ActkgUpstreamRagReference_releaseId_publishedEntityId_idx" ON "ActkgUpstreamRagReference"("releaseId", "publishedEntityId");

ALTER TABLE "ActkgReleaseArtifact" ADD CONSTRAINT "ActkgReleaseArtifact_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgReleaseComponent" ADD CONSTRAINT "ActkgReleaseComponent_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgReleaseEntry" ADD CONSTRAINT "ActkgReleaseEntry_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgProjectionNode" ADD CONSTRAINT "ActkgProjectionNode_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgProjectionNode" ADD CONSTRAINT "ActkgProjectionNode_releaseId_entityId_fkey" FOREIGN KEY ("releaseId", "entityId") REFERENCES "ActkgReleaseEntry"("releaseId", "entityId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgProjectionLink" ADD CONSTRAINT "ActkgProjectionLink_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgProjectionLink" ADD CONSTRAINT "ActkgProjectionLink_releaseId_relationId_fkey" FOREIGN KEY ("releaseId", "relationId") REFERENCES "ActkgReleaseEntry"("releaseId", "entityId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgProjectionLink" ADD CONSTRAINT "ActkgProjectionLink_releaseId_sourceId_fkey" FOREIGN KEY ("releaseId", "sourceId") REFERENCES "ActkgProjectionNode"("releaseId", "nodeId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgProjectionLink" ADD CONSTRAINT "ActkgProjectionLink_releaseId_targetId_fkey" FOREIGN KEY ("releaseId", "targetId") REFERENCES "ActkgProjectionNode"("releaseId", "nodeId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgUpstreamRagReference" ADD CONSTRAINT "ActkgUpstreamRagReference_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgUpstreamRagReference" ADD CONSTRAINT "ActkgUpstreamRagReference_releaseId_publishedEntityId_fkey" FOREIGN KEY ("releaseId", "publishedEntityId") REFERENCES "ActkgReleaseEntry"("releaseId", "entityId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "ActkgReleaseArtifact_immutable" BEFORE UPDATE OR DELETE ON "ActkgReleaseArtifact" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgReleaseComponent_immutable" BEFORE UPDATE OR DELETE ON "ActkgReleaseComponent" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgReleaseEntry_immutable" BEFORE UPDATE OR DELETE ON "ActkgReleaseEntry" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgProjectionNode_immutable" BEFORE UPDATE OR DELETE ON "ActkgProjectionNode" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgProjectionLink_immutable" BEFORE UPDATE OR DELETE ON "ActkgProjectionLink" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();
CREATE TRIGGER "ActkgUpstreamRagReference_immutable" BEFORE UPDATE OR DELETE ON "ActkgUpstreamRagReference" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_mutation();

CREATE TRIGGER "ActkgReleaseArtifact_sealed_insert" BEFORE INSERT ON "ActkgReleaseArtifact" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
CREATE TRIGGER "ActkgReleaseComponent_sealed_insert" BEFORE INSERT ON "ActkgReleaseComponent" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
CREATE TRIGGER "ActkgReleaseEntry_sealed_insert" BEFORE INSERT ON "ActkgReleaseEntry" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
CREATE TRIGGER "ActkgProjectionNode_sealed_insert" BEFORE INSERT ON "ActkgProjectionNode" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
CREATE TRIGGER "ActkgProjectionLink_sealed_insert" BEFORE INSERT ON "ActkgProjectionLink" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
CREATE TRIGGER "ActkgUpstreamRagReference_sealed_insert" BEFORE INSERT ON "ActkgUpstreamRagReference" FOR EACH ROW EXECUTE FUNCTION reject_actkg_authoritative_append_after_receipt();
