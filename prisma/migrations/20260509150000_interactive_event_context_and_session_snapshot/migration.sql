ALTER TABLE "ClassSession"
ADD COLUMN IF NOT EXISTS "lessonVersion" TEXT,
ADD COLUMN IF NOT EXISTS "manifestHash" TEXT,
ADD COLUMN IF NOT EXISTS "totalSteps" INTEGER;

ALTER TABLE "InteractionLog"
ADD COLUMN IF NOT EXISTS "clientEventId" TEXT,
ADD COLUMN IF NOT EXISTS "learningContext" TEXT,
ADD COLUMN IF NOT EXISTS "invalidContextReason" TEXT;

UPDATE "InteractionLog"
SET "clientEventId" = NULLIF("eventData"->>'clientEventId', '')
WHERE "clientEventId" IS NULL
  AND "eventData" IS NOT NULL
  AND jsonb_typeof("eventData"::jsonb) = 'object'
  AND "eventData"->>'clientEventId' IS NOT NULL;

WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "userId", "clientEventId"
      ORDER BY "createdAt", "id"
    ) AS rn
  FROM "InteractionLog"
  WHERE "clientEventId" IS NOT NULL
)
UPDATE "InteractionLog"
SET "invalidContextReason" = COALESCE("invalidContextReason", 'duplicate_client_event_id'),
    "clientEventId" = NULL
WHERE "id" IN (
  SELECT "id"
  FROM ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "InteractionLog_userId_clientEventId_unique"
ON "InteractionLog"("userId", "clientEventId")
WHERE "clientEventId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "InteractionLog_userId_clientEventId_idx"
ON "InteractionLog"("userId", "clientEventId");

CREATE INDEX IF NOT EXISTS "InteractionLog_learningContext_idx"
ON "InteractionLog"("learningContext");

CREATE INDEX IF NOT EXISTS "InteractionLog_invalidContextReason_idx"
ON "InteractionLog"("invalidContextReason");
