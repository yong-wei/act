-- Issue #916 data-plane reconciliation: make physical deletion facts durable
-- per grading object and preserve an explicit hold/takeover outcome.

ALTER TYPE "GradingTombstoneState" ADD VALUE IF NOT EXISTS 'DELETED_WITH_HOLD';

CREATE TYPE "GradingTombstoneObjectState" AS ENUM (
  'PENDING',
  'RETRYABLE',
  'DELETED_WITH_HOLD',
  'DELETED'
);

CREATE TABLE "GradingTombstoneObject" (
  "id" TEXT NOT NULL,
  "tombstoneId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "status" "GradingTombstoneObjectState" NOT NULL DEFAULT 'PENDING',
  "deletionClaimToken" TEXT,
  "physicalDeletedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GradingTombstoneObject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradingTombstoneObject_tombstoneId_objectKey_key"
  ON "GradingTombstoneObject"("tombstoneId", "objectKey");
CREATE INDEX "GradingTombstoneObject_status_updatedAt_idx"
  ON "GradingTombstoneObject"("status", "updatedAt");
CREATE INDEX "GradingTombstoneObject_tombstoneId_status_idx"
  ON "GradingTombstoneObject"("tombstoneId", "status");

ALTER TABLE "GradingTombstoneObject"
  ADD CONSTRAINT "GradingTombstoneObject_tombstoneId_fkey"
  FOREIGN KEY ("tombstoneId") REFERENCES "GradingTombstone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
