CREATE UNIQUE INDEX "AIIntervention_arenaOfficial_userId_sessionId_key"
ON "AIIntervention"("userId", "sessionId")
WHERE "sessionId" LIKE 'arena-official:%';
