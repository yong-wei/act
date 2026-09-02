-- CreateTable
CREATE TYPE "PortfolioReflectionProvenance" AS ENUM ('PLATFORM_VERIFIED', 'STUDENT_PROVIDED', 'LEGACY_UNVERIFIED');

-- AddColumn with explicit legacy backfill: existing drafts predate server-side
-- provenance classification and must not appear platform-verified.
ALTER TABLE "PortfolioReflectionDraft" ADD COLUMN "provenance" "PortfolioReflectionProvenance" NOT NULL DEFAULT 'LEGACY_UNVERIFIED';
