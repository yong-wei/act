DROP INDEX IF EXISTS "KnowledgeLink_sourceId_targetId_key";

ALTER TABLE "KnowledgeLink"
ADD COLUMN "strength" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "KnowledgeLink_sourceId_idx" ON "KnowledgeLink"("sourceId");
CREATE INDEX "KnowledgeLink_targetId_idx" ON "KnowledgeLink"("targetId");

-- Historical endpoint-collapsed rows have no trustworthy relation ownership marker.
-- They remain external/unowned. The canonical seed claims only exact canonical IDs
-- that it upserts and never infers ownership from endpoints.
