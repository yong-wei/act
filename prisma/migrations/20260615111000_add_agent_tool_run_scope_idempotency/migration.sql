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
