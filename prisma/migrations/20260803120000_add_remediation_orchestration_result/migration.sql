CREATE TABLE "RemediationOrchestrationResult" (
  "id" TEXT NOT NULL,
  "wrongAnswerAttributionId" TEXT NOT NULL,
  "orchestratorVersion" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "unavailableReason" TEXT,
  "manualPracticePath" TEXT,
  "taskSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RemediationOrchestrationResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RemediationOrchestrationResult_status_check"
    CHECK ("status" IN ('AVAILABLE', 'UNAVAILABLE')),
  CONSTRAINT "RemediationOrchestrationResult_payload_check"
    CHECK (
      ("status" = 'AVAILABLE' AND "taskSnapshot" IS NOT NULL AND "unavailableReason" IS NULL AND "manualPracticePath" IS NULL)
      OR
      ("status" = 'UNAVAILABLE' AND "taskSnapshot" IS NULL AND "unavailableReason" IS NOT NULL AND "manualPracticePath" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "RemediationOrchestrationResult_wrongAnswerAttributionId_orchestratorVersion_key"
  ON "RemediationOrchestrationResult"("wrongAnswerAttributionId", "orchestratorVersion");

CREATE INDEX "RemediationOrchestrationResult_userId_createdAt_idx"
  ON "RemediationOrchestrationResult"("userId", "createdAt");

ALTER TABLE "RemediationOrchestrationResult"
  ADD CONSTRAINT "RemediationOrchestrationResult_wrongAnswerAttributionId_fkey"
  FOREIGN KEY ("wrongAnswerAttributionId") REFERENCES "WrongAnswerAttribution"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
