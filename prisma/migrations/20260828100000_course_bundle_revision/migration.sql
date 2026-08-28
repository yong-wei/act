-- CourseBundleRevision expand migration: immutable course bundle identity for classroom sessions.
-- Historical sessions keep NULL course_bundle_revision_id (legacy-incomplete); new sessions
-- capture a required binding at the application boundary.

CREATE TABLE "CourseBundleRevision" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "canonicalLessonId" TEXT NOT NULL,
    "bundleRevision" INTEGER NOT NULL,
    "runtimeReleaseId" TEXT NOT NULL,
    "runtimeTreeSha256" TEXT NOT NULL,
    "runtimeManifestSha256" TEXT,
    "runtimeSourceRevision" TEXT NOT NULL,
    "runtimeObjectLocator" JSONB,
    "bundleDigest" TEXT NOT NULL,
    "identityProjectionHash" TEXT NOT NULL,
    "manifestHash" TEXT,
    "resourceHashes" JSONB NOT NULL,
    "qualification" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseBundleRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseBundleRevision_bundleId_bundleRevision_key" ON "CourseBundleRevision"("bundleId", "bundleRevision");
-- Content addressing alone is not the reuse key: the exact release locator is
-- part of the revision identity, so identical bytes published under a new
-- release get a new revision instead of silently keeping the old locator.
CREATE UNIQUE INDEX "CourseBundleRevision_bundleId_bundleDigest_release_key" ON "CourseBundleRevision"("bundleId", "bundleDigest", "runtimeReleaseId", "runtimeTreeSha256");
CREATE INDEX "CourseBundleRevision_canonicalLessonId_idx" ON "CourseBundleRevision"("canonicalLessonId");
CREATE INDEX "CourseBundleRevision_runtimeReleaseId_idx" ON "CourseBundleRevision"("runtimeReleaseId");

-- Denormalized binding fields on ClassSession. They are read-path fast comparisons and
-- must equal the referenced revision; disagreement is drift and fails closed.
ALTER TABLE "ClassSession" ADD COLUMN "courseBundleRevisionId" TEXT,
ADD COLUMN "bundleRuntimeReleaseId" TEXT,
ADD COLUMN "bundleDigest" TEXT;

CREATE INDEX "ClassSession_courseBundleRevisionId_idx" ON "ClassSession"("courseBundleRevisionId");

ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_courseBundleRevisionId_fkey"
  FOREIGN KEY ("courseBundleRevisionId") REFERENCES "CourseBundleRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
