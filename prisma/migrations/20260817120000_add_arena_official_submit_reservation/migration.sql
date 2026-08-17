CREATE TABLE "ArenaOfficialSubmitReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "classId" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaOfficialSubmitReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArenaOfficialSubmitReservation_scope_submittedAt_idx"
ON "ArenaOfficialSubmitReservation"("userId", "taskId", "classId", "submittedAt");

CREATE INDEX "ArenaOfficialSubmitReservation_submissionId_idx"
ON "ArenaOfficialSubmitReservation"("submissionId");
