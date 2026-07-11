ALTER TABLE "SimulationLog"
ADD COLUMN "odysseyRunId" TEXT,
ADD COLUMN "odysseyCompletedAt" TIMESTAMP(3);

-- Historical JSON logs may contain duplicate run ids. Claim only the earliest
-- row so the uniqueness constraint is deployable without deleting evidence.
WITH ranked_runs AS (
    SELECT
        "id",
        NULLIF("inputParams"->>'runId', '') AS "runId",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", NULLIF("inputParams"->>'runId', '')
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS "runRank"
    FROM "SimulationLog"
    WHERE NULLIF("inputParams"->>'runId', '') IS NOT NULL
      AND "controlMode" = 'GAME'
      AND NULLIF("inputParams"->>'levelId', '') IS NOT NULL
)
UPDATE "SimulationLog" AS log
SET "odysseyRunId" = ranked_runs."runId",
    "odysseyCompletedAt" = log."createdAt"
FROM ranked_runs
WHERE log."id" = ranked_runs."id"
  AND ranked_runs."runRank" = 1;

CREATE UNIQUE INDEX "SimulationLog_userId_odysseyRunId_key"
ON "SimulationLog"("userId", "odysseyRunId");
