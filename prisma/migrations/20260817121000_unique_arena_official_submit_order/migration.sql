DROP INDEX IF EXISTS "ArenaOfficialSubmitReservation_scope_submittedAt_idx";

CREATE UNIQUE INDEX "ArenaOfficialSubmitReservation_scope_submittedAt_key"
ON "ArenaOfficialSubmitReservation"("userId", "taskId", "classId", "submittedAt");
