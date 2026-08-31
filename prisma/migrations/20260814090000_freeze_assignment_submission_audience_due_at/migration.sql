ALTER TABLE "AssignmentSubmission"
ADD COLUMN "frozenAudienceDueAt" TIMESTAMP(3);

UPDATE "AssignmentSubmission" AS submission
SET "frozenAudienceDueAt" = audience."dueAt"
FROM "AssignmentAudience" AS audience
WHERE submission."audienceId" = audience."id"
  AND submission."frozenAudienceDueAt" IS NULL;

ALTER TABLE "AssignmentSubmission"
ALTER COLUMN "frozenAudienceDueAt" SET NOT NULL;
