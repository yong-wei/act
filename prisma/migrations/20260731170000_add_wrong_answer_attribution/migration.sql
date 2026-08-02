-- #1157: Store one immutable, privacy-safe attribution per answer and rule version.
CREATE TABLE "WrongAnswerAttribution" (
  "id" TEXT NOT NULL,
  "answerId" TEXT NOT NULL,
  "attributionVersion" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "questionRefId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "itemContentHash" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "knowledgeNodeIds" TEXT[],
  "misconceptionTags" TEXT[],
  "evidenceSummary" JSONB NOT NULL,
  "evidenceRefs" TEXT[],
  "confidence" DOUBLE PRECISION NOT NULL,
  "limitations" TEXT[],
  "nextAction" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WrongAnswerAttribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WrongAnswerAttribution_state_check"
    CHECK ("state" IN ('ATTRIBUTED', 'UNCERTAIN')),
  CONSTRAINT "WrongAnswerAttribution_confidence_check"
    CHECK ("confidence" >= 0 AND "confidence" <= 1),
  CONSTRAINT "WrongAnswerAttribution_nextAction_check"
    CHECK ("nextAction" IN ('NONE', 'MANUAL_REVIEW', 'REPEAT_PRACTICE'))
);

CREATE UNIQUE INDEX "WrongAnswerAttribution_answerId_attributionVersion_key"
  ON "WrongAnswerAttribution" ("answerId", "attributionVersion");
CREATE INDEX "WrongAnswerAttribution_userId_createdAt_idx"
  ON "WrongAnswerAttribution" ("userId", "createdAt");
CREATE INDEX "WrongAnswerAttribution_sessionId_createdAt_idx"
  ON "WrongAnswerAttribution" ("sessionId", "createdAt");
CREATE INDEX "WrongAnswerAttribution_questionRefId_idx"
  ON "WrongAnswerAttribution" ("questionRefId");

ALTER TABLE "WrongAnswerAttribution"
  ADD CONSTRAINT "WrongAnswerAttribution_answerId_fkey"
  FOREIGN KEY ("answerId") REFERENCES "AdaptiveAssessmentAnswer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
