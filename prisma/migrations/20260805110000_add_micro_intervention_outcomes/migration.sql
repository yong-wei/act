CREATE TABLE "MicroInterventionOutcome" (
  "id" TEXT NOT NULL,
  "remediationOrchestrationResultId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "learnerSessionId" TEXT NOT NULL,
  "startEventKey" TEXT NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MicroInterventionOutcome_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MicroInterventionEvent" (
  "id" TEXT NOT NULL,
  "interventionId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "resourceId" TEXT,
  "durationSeconds" INTEGER,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MicroInterventionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MicroInterventionEvent_type_check"
    CHECK ("eventType" IN ('RESOURCE_USED', 'HINT_REQUESTED', 'COMPLETED')),
  CONSTRAINT "MicroInterventionEvent_duration_check"
    CHECK ("durationSeconds" IS NULL OR ("durationSeconds" >= 0 AND "durationSeconds" <= 3600))
);

CREATE TABLE "MicroInterventionValidation" (
  "id" TEXT NOT NULL,
  "interventionId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "selectedOptionKey" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "questionId" TEXT NOT NULL,
  "questionContentHash" TEXT NOT NULL,
  "questionVersion" TEXT NOT NULL,
  "recommendationSnapshot" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MicroInterventionValidation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MicroInterventionValidation_duration_check"
    CHECK ("durationSeconds" >= 1 AND "durationSeconds" <= 3600)
);

CREATE UNIQUE INDEX "MicroInterventionOutcome_result_session_start_key"
  ON "MicroInterventionOutcome"("remediationOrchestrationResultId", "userId", "learnerSessionId", "startEventKey");
CREATE INDEX "MicroInterventionOutcome_user_session_created_idx"
  ON "MicroInterventionOutcome"("userId", "learnerSessionId", "createdAt");
CREATE UNIQUE INDEX "MicroInterventionEvent_intervention_event_key"
  ON "MicroInterventionEvent"("interventionId", "eventKey");
CREATE INDEX "MicroInterventionEvent_intervention_occurred_idx"
  ON "MicroInterventionEvent"("interventionId", "occurredAt");
CREATE UNIQUE INDEX "MicroInterventionValidation_intervention_key"
  ON "MicroInterventionValidation"("interventionId");
CREATE UNIQUE INDEX "MicroInterventionValidation_intervention_event_key"
  ON "MicroInterventionValidation"("interventionId", "eventKey");
CREATE INDEX "MicroInterventionValidation_question_created_idx"
  ON "MicroInterventionValidation"("questionId", "createdAt");

ALTER TABLE "MicroInterventionOutcome"
  ADD CONSTRAINT "MicroInterventionOutcome_result_fkey"
  FOREIGN KEY ("remediationOrchestrationResultId") REFERENCES "RemediationOrchestrationResult"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MicroInterventionEvent"
  ADD CONSTRAINT "MicroInterventionEvent_intervention_fkey"
  FOREIGN KEY ("interventionId") REFERENCES "MicroInterventionOutcome"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MicroInterventionValidation"
  ADD CONSTRAINT "MicroInterventionValidation_intervention_fkey"
  FOREIGN KEY ("interventionId") REFERENCES "MicroInterventionOutcome"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
