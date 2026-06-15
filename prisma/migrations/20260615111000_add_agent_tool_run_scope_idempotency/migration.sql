BEGIN;

-- Historical data was previously unique only within one AgentSession. First move
-- any pre-existing business keys out of this migration's reserved namespace, so
-- generated duplicate keys cannot collide with old user-supplied idempotency keys.
UPDATE "AgentToolRun"
SET "idempotencyKey" = '__agent_tool_run_scope_idempotency__:legacy:' || "id"
WHERE starts_with("idempotencyKey", '__agent_tool_run_scope_idempotency__:');

-- Keep the newest run for each widened scope idempotency key and preserve older
-- audit rows by giving them deterministic keys in the reserved namespace.
WITH duplicate_scope_tool_runs AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY
        "ownerUserId",
        "toolName",
        "idempotencyKey",
        "courseId",
        "pageId",
        COALESCE("classId", '__null__'),
        COALESCE("resourceId", '__null__'),
        COALESCE("pathNodeId", '__null__')
      ORDER BY "startedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS duplicate_rank
  FROM "AgentToolRun"
  WHERE "idempotencyKey" IS NOT NULL
)
UPDATE "AgentToolRun" AS tool_run
SET "idempotencyKey" = '__agent_tool_run_scope_idempotency__:duplicate:' || tool_run."id"
FROM duplicate_scope_tool_runs
WHERE tool_run."id" = duplicate_scope_tool_runs."id"
  AND duplicate_scope_tool_runs.duplicate_rank > 1;

CREATE UNIQUE INDEX "AgentToolRun_scope_idempotency_unique"
ON "AgentToolRun" (
  "ownerUserId",
  "toolName",
  "idempotencyKey",
  "courseId",
  "pageId",
  COALESCE("classId", '__null__'),
  COALESCE("resourceId", '__null__'),
  COALESCE("pathNodeId", '__null__')
)
WHERE "idempotencyKey" IS NOT NULL;

COMMIT;
