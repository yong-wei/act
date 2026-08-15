ALTER TABLE "PromptAssessment"
  ADD COLUMN "auditTaskContext" JSONB,
  ADD COLUMN "consistencyResult" JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PromptAssessment"
    GROUP BY "userId", "sessionId", "version"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PromptAssessment duplicate user/session/version rows require remediation before migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "PromptAssessment_userId_sessionId_version_key"
  ON "PromptAssessment"("userId", "sessionId", "version");
