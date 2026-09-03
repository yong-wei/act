CREATE TYPE "GradingSource" AS ENUM ('AI', 'MANUAL');

ALTER TABLE "GradingRun"
ADD COLUMN "source" "GradingSource" NOT NULL DEFAULT 'AI';
