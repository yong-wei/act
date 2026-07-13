-- Issue #916: keep ordinary assignment submissions usable when deployment
-- does not run the environment-backed grading policy materializer.
INSERT INTO "GradingLifecyclePolicy" (
  "id",
  "dataClass",
  "version",
  "retentionSeconds",
  "governedRecordRule",
  "deleteStrategy",
  "providerRetentionSeconds",
  "enabled",
  "createdAt",
  "updatedAt"
)
VALUES
  ('grading-lifecycle:source-asset:baseline.v1', 'source-asset', 'baseline.v1', 2592000, NULL, 'delete-content', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('grading-lifecycle:answer-evidence:baseline.v1', 'answer-evidence', 'baseline.v1', 2592000, NULL, 'delete-content', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("dataClass", "version") DO NOTHING;
