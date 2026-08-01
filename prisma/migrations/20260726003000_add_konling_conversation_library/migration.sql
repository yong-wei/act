BEGIN;

ALTER TABLE "KonlingSession"
  ADD COLUMN IF NOT EXISTS "titleIsManual" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "libraryVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "migrationSourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "activeTurnId" TEXT,
  ADD COLUMN IF NOT EXISTS "activeTurnClaimedAt" TIMESTAMP(3);

ALTER TABLE "AgentSession"
  ADD COLUMN IF NOT EXISTS "konlingSessionId" TEXT;

UPDATE "KonlingSession"
SET
  "migrationSourceId" = 'legacy:KonlingSession:' || "id",
  "lastActivityAt" = "updatedAt"
WHERE "migrationSourceId" IS NULL;

UPDATE "AgentSession" AS agent_session
SET "konlingSessionId" = agent_session."stateJson"->>'konlingSessionId'
WHERE agent_session."stateJson" ? 'konlingSessionId'
  AND EXISTS (
    SELECT 1
    FROM "KonlingSession" AS conversation
    WHERE conversation."id" = agent_session."stateJson"->>'konlingSessionId'
      AND conversation."userId" = COALESCE(agent_session."actorUserId", agent_session."ownerUserId")
  );

WITH usable_sessions AS (
  SELECT conversation."id"
  FROM "KonlingSession" AS conversation
  WHERE conversation."migrationSourceId" LIKE 'legacy:KonlingSession:%'
    AND conversation."expiresAt" > CURRENT_TIMESTAMP
    AND jsonb_typeof(conversation."messages") = 'array'
    AND (
      (
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(conversation."messages") = 'array' THEN conversation."messages"
              ELSE '[]'::jsonb
            END
          ) AS message
          WHERE message->>'role' = 'user'
        )
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(conversation."messages") = 'array' THEN conversation."messages"
              ELSE '[]'::jsonb
            END
          ) AS message
          WHERE message->>'role' = 'assistant'
        )
      )
      OR EXISTS (
        SELECT 1
        FROM "AgentSession" AS agent_session
        JOIN "AgentToolRun" AS tool_run
          ON tool_run."agentSessionId" = agent_session."id"
        WHERE agent_session."konlingSessionId" = conversation."id"
          AND tool_run."status" IN ('succeeded', 'awaiting_approval')
      )
    )
)
UPDATE "KonlingSession" AS conversation
SET "libraryVisible" = EXISTS (
  SELECT 1
  FROM usable_sessions
  WHERE usable_sessions."id" = conversation."id"
)
WHERE conversation."migrationSourceId" LIKE 'legacy:KonlingSession:%';

WITH first_prompts AS (
  SELECT
    conversation."id",
    LEFT(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            COALESCE(first_message.message->>'content', first_message.message#>>'{parts,0,text}', ''),
            '\s+',
            ' ',
            'g'
          ),
          '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}',
          '[隐私信息]',
          'gi'
        ),
        '1[3-9][0-9]{9}',
        '[隐私信息]',
        'g'
      ),
      64
    ) AS title
  FROM "KonlingSession" AS conversation
  CROSS JOIN LATERAL (
    SELECT message
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(conversation."messages") = 'array' THEN conversation."messages"
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS entry(message, position)
    WHERE message->>'role' = 'user'
    ORDER BY position
    LIMIT 1
  ) AS first_message
)
UPDATE "KonlingSession" AS conversation
SET "title" = COALESCE(NULLIF(BTRIM(first_prompts.title), ''), conversation."title")
FROM first_prompts
WHERE conversation."id" = first_prompts."id"
  AND conversation."libraryVisible" = true
  AND conversation."migrationSourceId" LIKE 'legacy:KonlingSession:%';

CREATE UNIQUE INDEX IF NOT EXISTS "KonlingSession_migrationSourceId_key"
  ON "KonlingSession"("migrationSourceId");
CREATE INDEX IF NOT EXISTS "KonlingSession_userId_libraryVisible_pinnedAt_lastActivityAt_idx"
  ON "KonlingSession"("userId", "libraryVisible", "pinnedAt", "lastActivityAt");
CREATE INDEX IF NOT EXISTS "AgentSession_konlingSessionId_updatedAt_idx"
  ON "AgentSession"("konlingSessionId", "updatedAt");

DO $$
BEGIN
  ALTER TABLE "AgentSession"
    DROP CONSTRAINT IF EXISTS "AgentSession_konlingSessionId_fkey";
  ALTER TABLE "AgentSession"
    ADD CONSTRAINT "AgentSession_konlingSessionId_fkey"
    FOREIGN KEY ("konlingSessionId") REFERENCES "KonlingSession"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
END
$$;

COMMIT;
