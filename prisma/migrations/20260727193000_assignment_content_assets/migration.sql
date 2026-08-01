CREATE TYPE "AssignmentContentAssetState" AS ENUM ('PENDING', 'AVAILABLE');
CREATE TYPE "AssignmentContentAssetField" AS ENUM ('PROMPT', 'REFERENCE_ANSWER');

CREATE TABLE "AssignmentContentAsset" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "state" "AssignmentContentAssetState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3),
    CONSTRAINT "AssignmentContentAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentRevisionAssetReference" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "stableQuestionId" TEXT NOT NULL,
    "field" "AssignmentContentAssetField" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssignmentRevisionAssetReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssignmentContentAsset_objectKey_key" ON "AssignmentContentAsset"("objectKey");
CREATE INDEX "AssignmentContentAsset_assignmentId_uploaderId_state_idx" ON "AssignmentContentAsset"("assignmentId", "uploaderId", "state");
CREATE UNIQUE INDEX "AssignmentRevisionAssetReference_revisionId_stableQuestionId_field_assetId_key" ON "AssignmentRevisionAssetReference"("revisionId", "stableQuestionId", "field", "assetId");
CREATE INDEX "AssignmentRevisionAssetReference_assetId_revisionId_idx" ON "AssignmentRevisionAssetReference"("assetId", "revisionId");

ALTER TABLE "AssignmentContentAsset" ADD CONSTRAINT "AssignmentContentAsset_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentContentAsset" ADD CONSTRAINT "AssignmentContentAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentRevisionAssetReference" ADD CONSTRAINT "AssignmentRevisionAssetReference_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "AssignmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentRevisionAssetReference" ADD CONSTRAINT "AssignmentRevisionAssetReference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AssignmentContentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
