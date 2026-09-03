ALTER TABLE "GradingRun" ADD COLUMN "overallFeedback" JSONB;
ALTER TABLE "GradingAnnotation" ADD COLUMN "reason" TEXT;
