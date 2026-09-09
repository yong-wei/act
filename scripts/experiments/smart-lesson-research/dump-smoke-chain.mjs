import 'dotenv/config';
import path from 'node:path';
import pg from 'pg';

import { queryRows, writeJsonFile } from './lib.mjs';

const taskId = process.argv[2];
if (!taskId) throw new Error('用法: dump-smoke-chain.mjs <taskId>');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
try {
  const taskRows = await queryRows(
    pool,
    `select id, "ownerId", "courseBasisId", topic, audience, "prerequisites",
            "durationMinutes", "selectedClassId", "archivedAt",
            "outlineConfirmationRequired", "createdAt", "updatedAt"
     from "SmartLessonTask"
     where id = $1`,
    [taskId],
  );
  const sourceRows = await queryRows(
    pool,
    `select id, "sourceVersionId", state, "selectedAt", "removedAt"
     from "SmartLessonSourceSelection"
     where "taskId" = $1
     order by "selectedAt" asc`,
    [taskId],
  );
  const knowledgeRows = await queryRows(
    pool,
    `select id, title, "contentHash", "sourceState", "sourceBindings",
            "sourceBindingSetHash", "gapReason", origin, state,
            "confirmedAt", "removedAt", "createdAt", "updatedAt"
     from "SmartLessonKnowledgePoint"
     where "taskId" = $1
     order by "createdAt" asc`,
    [taskId],
  );
  const goalRows = await queryRows(
    pool,
    `select id, content, "contentHash", "sourceState", "sourceBindings",
            "sourceBindingSetHash", "gapReason", state,
            "confirmedAt", "removedAt", "createdAt", "updatedAt"
     from "SmartLessonGoal"
     where "taskId" = $1
     order by "createdAt" asc`,
    [taskId],
  );
  const draftRows = await queryRows(
    pool,
    `select id, "taskId", state, "contentHash", "createdAt", "updatedAt"
     from "SmartLessonDraft"
     where "taskId" = $1
     order by "createdAt" asc`,
    [taskId],
  );
  const draftIds = draftRows.map((row) => row.id);
  const jobRows = draftIds.length
    ? await queryRows(
        pool,
        `select id, "draftId", state, "failureCode", "inputHash",
                "startedAt", "completedAt", "createdAt"
         from "SmartLessonGenerationJob"
         where "draftId" = any($1)
         order by "createdAt" asc`,
        [draftIds],
      )
    : [];
  const jobIds = jobRows.map((row) => row.id);
  const stageRows = jobIds.length
    ? await queryRows(
        pool,
        `select id, "jobId", kind, state, "orderIndex", "outputHash",
                "startedAt", "completedAt"
         from "SmartLessonGenerationStage"
         where "jobId" = any($1)
         order by "orderIndex" asc`,
        [jobIds],
      )
    : [];
  const stageIds = stageRows.map((row) => row.id);
  const attemptRows = stageIds.length
    ? await queryRows(
        pool,
        `select id, "stageId", "attemptNumber", kind, outcome, "correctsAttemptId",
                "providerKind", model, "promptVersion", "schemaVersion",
                "requestHash", "inputTokens", "outputTokens",
                "startedAt", "finishedAt"
         from "SmartLessonProviderAttempt"
         where "stageId" = any($1)
         order by "startedAt" asc`,
        [stageIds],
      )
    : [];

  const output = {
    taskId,
    dumpedAt: new Date().toISOString(),
    task: taskRows[0] ?? null,
    sources: sourceRows,
    knowledgePoints: knowledgeRows,
    goals: goalRows,
    drafts: draftRows,
    jobs: jobRows,
    stages: stageRows,
    attempts: attemptRows,
  };
  console.log(JSON.stringify(output, null, 2));
  writeJsonFile(
    path.join('scripts/experiments/outputs/2026-09-08-autocontrol-root-locus', `smoke-chain-${taskId}.json`),
    output,
  );
} finally {
  await pool.end();
}
