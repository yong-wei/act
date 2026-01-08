-- Add tier progress for Control Odyssey
ALTER TABLE "StudentProfile" ADD COLUMN "controlOdysseyProgress" JSONB NOT NULL DEFAULT '{}';
