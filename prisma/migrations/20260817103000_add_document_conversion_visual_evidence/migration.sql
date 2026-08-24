CREATE TABLE "DocumentConversionVisualEvidence" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT,
    "sourceKind" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "imageChecksum" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "bbox" JSONB,
    "description" TEXT,
    "confidence" DOUBLE PRECISION,
    "processorVersion" TEXT NOT NULL,
    "limitations" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    "readiness" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentConversionVisualEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentConversionVisualEvidence_conversionId_imageChecksum_key"
ON "DocumentConversionVisualEvidence"("conversionId", "imageChecksum");

CREATE INDEX "DocumentConversionVisualEvidence_attemptId_questionId_readiness_idx"
ON "DocumentConversionVisualEvidence"("attemptId", "questionId", "readiness");

CREATE INDEX "DocumentConversionVisualEvidence_conversionId_readiness_idx"
ON "DocumentConversionVisualEvidence"("conversionId", "readiness");

CREATE INDEX "DocumentConversionVisualEvidence_objectKey_idx"
ON "DocumentConversionVisualEvidence"("objectKey");

ALTER TABLE "DocumentConversionVisualEvidence"
ADD CONSTRAINT "DocumentConversionVisualEvidence_conversionId_fkey"
FOREIGN KEY ("conversionId") REFERENCES "DocumentConversion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradingRun"
ADD COLUMN "attachmentManifest" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "attachmentManifestHash" TEXT;
