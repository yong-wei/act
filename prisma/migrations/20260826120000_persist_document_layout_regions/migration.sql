-- Preserve the replayable PDF layout and question-region decision independently of
-- the mutable worker runtime. Existing evidence remains valid with a null questionId.
ALTER TABLE "AnswerEvidenceBlock" ADD COLUMN "questionId" TEXT;

ALTER TABLE "DocumentConversion" ADD COLUMN "renderedPageCount" INTEGER;
ALTER TABLE "DocumentConversion" ADD COLUMN "layoutRepresentation" JSONB;

DROP INDEX "AnswerEvidenceBlock_evidenceId_pageNumber_idx";
CREATE INDEX "AnswerEvidenceBlock_evidenceId_questionId_pageNumber_idx"
  ON "AnswerEvidenceBlock"("evidenceId", "questionId", "pageNumber");
