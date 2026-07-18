CREATE TYPE "CourseBasisDocumentKind" AS ENUM ('STANDARD', 'TEXTBOOK', 'OTHER');
CREATE TYPE "CourseBasisSourceType" AS ENUM ('MARKDOWN', 'PLAIN_TEXT', 'PASTED_TEXT', 'SEARCHABLE_PDF');
CREATE TYPE "CourseBasisExtractionState" AS ENUM ('EXTRACTED', 'UNSUPPORTED', 'FAILED');
CREATE TYPE "CourseBasisReviewState" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
CREATE TYPE "CourseBasisReferenceType" AS ENUM ('LESSON_PLAN_REVISION', 'COURSEWARE_REVISION');

CREATE TABLE "CourseBasis" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "courseIdentity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseBasis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseBasisDocument" (
  "id" TEXT NOT NULL,
  "courseBasisId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "CourseBasisDocumentKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseBasisDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseBasisDocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "sourceType" "CourseBasisSourceType" NOT NULL,
  "sourceName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "contentHash" TEXT NOT NULL,
  "originalContent" BYTEA NOT NULL,
  "normalizedText" TEXT,
  "extractionState" "CourseBasisExtractionState" NOT NULL,
  "extractionVersion" TEXT NOT NULL,
  "failureReason" TEXT,
  "reviewState" "CourseBasisReviewState" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "retiredById" TEXT,
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseBasisDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseBasisSegment" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "stableAnchor" TEXT NOT NULL,
  "headingPath" TEXT[] NOT NULL,
  "pageNumber" INTEGER,
  "paragraphNumber" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  CONSTRAINT "CourseBasisSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseBasisProjection" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  "projectionKey" TEXT NOT NULL,
  "corpusSourceId" TEXT NOT NULL,
  "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseBasisProjection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseBasisReferenceLink" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "referenceType" "CourseBasisReferenceType" NOT NULL,
  "referenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseBasisReferenceLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseBasis_ownerId_updatedAt_idx" ON "CourseBasis"("ownerId", "updatedAt");
CREATE INDEX "CourseBasis_ownerId_courseIdentity_idx" ON "CourseBasis"("ownerId", "courseIdentity");
CREATE INDEX "CourseBasisDocument_courseBasisId_updatedAt_idx" ON "CourseBasisDocument"("courseBasisId", "updatedAt");
CREATE UNIQUE INDEX "CourseBasisDocumentVersion_documentId_versionNumber_key" ON "CourseBasisDocumentVersion"("documentId", "versionNumber");
CREATE INDEX "CourseBasisDocumentVersion_documentId_reviewState_retiredAt_idx" ON "CourseBasisDocumentVersion"("documentId", "reviewState", "retiredAt");
CREATE INDEX "CourseBasisDocumentVersion_contentHash_idx" ON "CourseBasisDocumentVersion"("contentHash");
CREATE UNIQUE INDEX "CourseBasisSegment_versionId_stableAnchor_key" ON "CourseBasisSegment"("versionId", "stableAnchor");
CREATE UNIQUE INDEX "CourseBasisSegment_versionId_orderIndex_key" ON "CourseBasisSegment"("versionId", "orderIndex");
CREATE UNIQUE INDEX "CourseBasisSegment_id_versionId_key" ON "CourseBasisSegment"("id", "versionId");
CREATE UNIQUE INDEX "CourseBasisProjection_segmentId_key" ON "CourseBasisProjection"("segmentId");
CREATE UNIQUE INDEX "CourseBasisProjection_projectionKey_key" ON "CourseBasisProjection"("projectionKey");
CREATE UNIQUE INDEX "CourseBasisProjection_corpusSourceId_key" ON "CourseBasisProjection"("corpusSourceId");
CREATE INDEX "CourseBasisProjection_versionId_idx" ON "CourseBasisProjection"("versionId");
CREATE UNIQUE INDEX "CourseBasisReferenceLink_versionId_referenceType_referenceI_key" ON "CourseBasisReferenceLink"("versionId", "referenceType", "referenceId");
CREATE INDEX "CourseBasisReferenceLink_referenceType_referenceId_idx" ON "CourseBasisReferenceLink"("referenceType", "referenceId");

ALTER TABLE "CourseBasis" ADD CONSTRAINT "CourseBasis_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseBasisDocument" ADD CONSTRAINT "CourseBasisDocument_courseBasisId_fkey" FOREIGN KEY ("courseBasisId") REFERENCES "CourseBasis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseBasisDocumentVersion" ADD CONSTRAINT "CourseBasisDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CourseBasisDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseBasisDocumentVersion" ADD CONSTRAINT "CourseBasisDocumentVersion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseBasisDocumentVersion" ADD CONSTRAINT "CourseBasisDocumentVersion_retiredById_fkey" FOREIGN KEY ("retiredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseBasisSegment" ADD CONSTRAINT "CourseBasisSegment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CourseBasisDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseBasisProjection" ADD CONSTRAINT "CourseBasisProjection_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CourseBasisDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseBasisProjection" ADD CONSTRAINT "CourseBasisProjection_segmentId_versionId_fkey" FOREIGN KEY ("segmentId", "versionId") REFERENCES "CourseBasisSegment"("id", "versionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseBasisReferenceLink" ADD CONSTRAINT "CourseBasisReferenceLink_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CourseBasisDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
