-- Add Control Odyssey profile fields
ALTER TABLE "StudentProfile" ADD COLUMN "controlCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StudentProfile" ADD COLUMN "controlUnlocks" JSONB NOT NULL DEFAULT '[]';
