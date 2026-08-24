-- Preserve V2-only typed evidence without reinterpreting V1 records.
DROP INDEX IF EXISTS "ActkgBundleReceipt_bundleDigest_key";
CREATE UNIQUE INDEX "ActkgBundleReceipt_bundleContractVersion_bundleDigest_key"
  ON "ActkgBundleReceipt"("bundleContractVersion", "bundleDigest");

CREATE TABLE "ActkgV2ProjectionProfile" (
    "releaseId" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "manifestProfile" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "profileSha256" TEXT NOT NULL,
    "projectionKind" TEXT NOT NULL,
    "profileVersion" TEXT NOT NULL,
    "mappingContractVersion" TEXT NOT NULL,
    "aggregationPolicy" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "ActkgV2ProjectionProfile_pkey" PRIMARY KEY ("releaseId", "profileKey")
);

CREATE UNIQUE INDEX "ActkgV2ProjectionProfile_releaseId_profileId_key"
  ON "ActkgV2ProjectionProfile"("releaseId", "profileId");
CREATE INDEX "ActkgV2ProjectionProfile_releaseId_manifestProfile_idx"
  ON "ActkgV2ProjectionProfile"("releaseId", "manifestProfile");

CREATE TABLE "ActkgV2MultilingualLabel" (
    "releaseId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "entityId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelType" TEXT NOT NULL,
    "terminologyAssertionId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "ActkgV2MultilingualLabel_pkey" PRIMARY KEY ("releaseId", "terminologyAssertionId")
);

CREATE UNIQUE INDEX "ActkgV2MultilingualLabel_releaseId_ordinal_key"
  ON "ActkgV2MultilingualLabel"("releaseId", "ordinal");
CREATE INDEX "ActkgV2MultilingualLabel_releaseId_entityId_idx"
  ON "ActkgV2MultilingualLabel"("releaseId", "entityId");
CREATE INDEX "ActkgV2MultilingualLabel_releaseId_language_idx"
  ON "ActkgV2MultilingualLabel"("releaseId", "language");

CREATE TABLE "ActkgV2AdmissionBinding" (
    "releaseId" TEXT NOT NULL,
    "bundleReceiptId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "verificationScope" TEXT NOT NULL,
    "verifiedDuringLoad" BOOLEAN NOT NULL,
    "registryIdentity" JSONB NOT NULL,
    "upstreamRepository" JSONB NOT NULL,
    "publicationRevision" JSONB NOT NULL,
    "sourceRevision" JSONB NOT NULL,
    "bundleIdentity" JSONB NOT NULL,
    "bindingDigest" TEXT NOT NULL,

    CONSTRAINT "ActkgV2AdmissionBinding_pkey" PRIMARY KEY ("releaseId")
);

CREATE UNIQUE INDEX "ActkgV2AdmissionBinding_bundleReceiptId_key"
  ON "ActkgV2AdmissionBinding"("bundleReceiptId");

ALTER TABLE "ActkgV2ProjectionProfile"
  ADD CONSTRAINT "ActkgV2ProjectionProfile_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgV2MultilingualLabel"
  ADD CONSTRAINT "ActkgV2MultilingualLabel_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgV2AdmissionBinding"
  ADD CONSTRAINT "ActkgV2AdmissionBinding_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "ActkgRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActkgV2AdmissionBinding"
  ADD CONSTRAINT "ActkgV2AdmissionBinding_bundleReceiptId_fkey"
  FOREIGN KEY ("bundleReceiptId") REFERENCES "ActkgBundleReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
