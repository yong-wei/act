-- One draft revision can produce at most one successful publication operation.
-- Older deployments may contain repeated operation receipts for the same
-- already-frozen revision; retain the earliest receipt before adding the guard.
DELETE FROM "AssignmentPublicationOperation" duplicate
USING "AssignmentPublicationOperation" retained
WHERE duplicate."revisionId" = retained."revisionId"
  AND (
    duplicate."createdAt" > retained."createdAt"
    OR (
      duplicate."createdAt" = retained."createdAt"
      AND duplicate."id" > retained."id"
    )
  );

DROP INDEX IF EXISTS "AssignmentPublicationOperation_revisionId_idx";
CREATE UNIQUE INDEX "AssignmentPublicationOperation_revisionId_key"
  ON "AssignmentPublicationOperation"("revisionId");
