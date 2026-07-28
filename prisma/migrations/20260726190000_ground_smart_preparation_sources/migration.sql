ALTER TYPE "SmartLessonSourceState"
ADD VALUE IF NOT EXISTS 'NO_RELIABLE_SOURCE';

ALTER TABLE "SmartLessonTask"
ADD COLUMN "selectedClassId" TEXT,
ADD COLUMN "textbookRanges" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "classContextStaleAt" TIMESTAMP(3),
ADD COLUMN "classContextStaleReason" TEXT;

ALTER TABLE "SmartLessonKnowledgePoint"
ADD COLUMN "gapReason" TEXT;

ALTER TABLE "SmartLessonGoal"
ADD COLUMN "gapReason" TEXT;

ALTER TABLE "SmartLessonTask"
ADD CONSTRAINT "SmartLessonTask_selectedClassId_fkey"
FOREIGN KEY ("selectedClassId") REFERENCES "Class"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SmartLessonKnowledgePoint"
ADD CONSTRAINT "SmartLessonKnowledgePoint_gap_reason_check"
CHECK (
  ("sourceState" = 'VERIFIED' AND "gapReason" IS NULL)
  OR (
    "sourceState" = 'NO_RELIABLE_SOURCE'
    AND "gapReason" IS NOT NULL
    AND "sourceBindings" = '[]'::jsonb
  )
  OR (
    "sourceState" IN ('AI_GENERATED_SOURCE_PENDING', 'TEACHER_CREATED_SOURCE_PENDING')
    AND "gapReason" IS NULL
  )
);

ALTER TABLE "SmartLessonGoal"
ADD CONSTRAINT "SmartLessonGoal_gap_reason_check"
CHECK (
  ("sourceState" = 'VERIFIED' AND "gapReason" IS NULL)
  OR (
    "sourceState" = 'NO_RELIABLE_SOURCE'
    AND "gapReason" IS NOT NULL
    AND "sourceBindings" = '[]'::jsonb
  )
  OR (
    "sourceState" IN ('AI_GENERATED_SOURCE_PENDING', 'TEACHER_CREATED_SOURCE_PENDING')
    AND "gapReason" IS NULL
  )
);

CREATE INDEX "SmartLessonTask_ownerId_selectedClassId_idx"
ON "SmartLessonTask"("ownerId", "selectedClassId");
