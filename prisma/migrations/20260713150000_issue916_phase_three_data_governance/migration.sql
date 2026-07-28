ALTER TABLE "SubmissionAsset"
  ALTER COLUMN "answerId" DROP NOT NULL,
  ADD COLUMN "redactionCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SubmissionObjectTombstone"
  ADD COLUMN "redactionCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "GradingAuditEvent"
  ADD COLUMN "redactionCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "GradingTombstone"
  ADD COLUMN "providerRetentionSeconds" INTEGER,
  ADD COLUMN "redactionCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "GradingBatch"
  ALTER COLUMN "assignmentRevisionId" DROP NOT NULL,
  ALTER COLUMN "classId" DROP NOT NULL;

-- Historical audit rows may predate purpose-scoped pseudonymization. HMAC
-- backfill is intentionally not attempted here. Keep the event's operational
-- identity (action, purpose, role, resource type, and policy version) and the
-- bounded runtime fields needed to explain retry/attempt/error behavior. Raw
-- identifiers, request hashes, provider locators, and content-bearing keys
-- are replaced with nulls or opaque markers.
UPDATE "GradingAuditEvent"
SET
  "actorPseudoId" = 'redacted:actor:' || md5("id"),
  "eventKey" = 'redacted:audit:' || md5("id"),
  "resourceId" = 'redacted:resource:' || md5("id"),
  "classId" = NULL,
  "assignmentId" = NULL,
  "answerId" = NULL,
  "provider" = NULL,
  "providerRequestId" = NULL,
  "requestHash" = NULL,
  "metadata" = jsonb_build_object(
    'redacted', true,
    'redactionCount', GREATEST("redactionCount", 1),
    'redactedFields', COALESCE((
      SELECT jsonb_agg(key ORDER BY key)
      FROM jsonb_object_keys(CASE WHEN jsonb_typeof("metadata") = 'object' THEN "metadata" ELSE '{}'::jsonb END) AS metadata_key(key)
      WHERE key NOT IN ('attempt', 'attemptNumber', 'attempts', 'retryCount', 'retryable', 'errorCode', 'error', 'state', 'status', 'outcome', 'stage', 'durationMs', 'latencyMs', 'policyVersion', 'deleteStrategy', 'blockedReason', 'provider')
    ), '[]'::jsonb),
    'safeRuntime', jsonb_strip_nulls(jsonb_build_object(
      'attempt', CASE WHEN ("metadata"->>'attempt') ~ '^[0-9]{1,6}$' THEN ("metadata"->>'attempt')::integer END,
      'attemptNumber', CASE WHEN ("metadata"->>'attemptNumber') ~ '^[0-9]{1,6}$' THEN ("metadata"->>'attemptNumber')::integer END,
      'attempts', CASE WHEN ("metadata"->>'attempts') ~ '^[0-9]{1,6}$' THEN ("metadata"->>'attempts')::integer END,
      'retryCount', CASE WHEN ("metadata"->>'retryCount') ~ '^[0-9]{1,6}$' THEN ("metadata"->>'retryCount')::integer END,
      'retryable', CASE WHEN jsonb_typeof("metadata"->'retryable') = 'boolean' THEN "metadata"->'retryable' END,
      'errorCode', CASE
        WHEN ("metadata"->>'errorCode') ~ '^[A-Za-z0-9:_-]{1,120}$' THEN "metadata"->>'errorCode'
        WHEN ("metadata"->>'error') ~ '^[A-Za-z0-9:_-]{1,120}$' THEN "metadata"->>'error'
      END,
      'state', CASE WHEN ("metadata"->>'state') ~ '^[A-Za-z0-9:_-]{1,120}$' THEN "metadata"->>'state' END,
      'status', CASE WHEN ("metadata"->>'status') ~ '^[A-Za-z0-9:_-]{1,120}$' THEN "metadata"->>'status' END,
      'outcome', CASE WHEN ("metadata"->>'outcome') ~ '^[A-Za-z0-9:_-]{1,120}$' THEN "metadata"->>'outcome' END,
      'stage', CASE WHEN ("metadata"->>'stage') ~ '^[A-Za-z0-9:_-]{1,120}$' THEN "metadata"->>'stage' END,
      'durationMs', CASE WHEN ("metadata"->>'durationMs') ~ '^[0-9]{1,9}$' THEN ("metadata"->>'durationMs')::integer END,
      'latencyMs', CASE WHEN ("metadata"->>'latencyMs') ~ '^[0-9]{1,9}$' THEN ("metadata"->>'latencyMs')::integer END,
      'policyVersion', CASE WHEN ("metadata"->>'policyVersion') ~ '^[A-Za-z0-9:_-]{1,120}$' THEN "metadata"->>'policyVersion' END,
      'deleteStrategy', CASE WHEN ("metadata"->>'deleteStrategy') IN ('delete-content', 'pseudonymize-lineage', 'retain-governed-record') THEN "metadata"->>'deleteStrategy' END,
      'blockedReason', CASE WHEN ("metadata"->>'blockedReason') ~ '^[A-Za-z0-9:_-]{1,120}$' THEN "metadata"->>'blockedReason' END,
      'provider', CASE WHEN ("metadata"->>'provider') ~ '^[A-Za-z0-9:_-]{1,64}$' THEN "metadata"->>'provider' END
    ))
  ),
  "redactionCount" = GREATEST(
    "redactionCount",
    1
    + CASE WHEN "classId" IS NULL THEN 0 ELSE 1 END
    + CASE WHEN "assignmentId" IS NULL THEN 0 ELSE 1 END
    + CASE WHEN "answerId" IS NULL THEN 0 ELSE 1 END
    + CASE WHEN "provider" IS NULL THEN 0 ELSE 1 END
    + CASE WHEN "providerRequestId" IS NULL THEN 0 ELSE 1 END
    + CASE WHEN "requestHash" IS NULL THEN 0 ELSE 1 END
    + COALESCE((
      SELECT count(*)
      FROM jsonb_object_keys(CASE WHEN jsonb_typeof("metadata") = 'object' THEN "metadata" ELSE '{}'::jsonb END) AS metadata_key(key)
      WHERE key NOT IN ('attempt', 'attemptNumber', 'attempts', 'retryCount', 'retryable', 'errorCode', 'error', 'state', 'status', 'outcome', 'stage', 'durationMs', 'latencyMs', 'policyVersion', 'deleteStrategy', 'blockedReason', 'provider')
    ), 0)::integer
  );
