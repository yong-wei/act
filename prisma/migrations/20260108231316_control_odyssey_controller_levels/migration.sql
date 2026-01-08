-- Add controller upgrade levels for Control Odyssey
ALTER TABLE "StudentProfile"
ADD COLUMN "controlControllerLevels" JSONB NOT NULL DEFAULT '{}'::jsonb;
