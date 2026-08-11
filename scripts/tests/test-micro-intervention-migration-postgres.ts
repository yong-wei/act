import { Client } from 'pg';

const databaseUrl = process.env.MICRO_INTERVENTION_MIGRATION_TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('MICRO_INTERVENTION_MIGRATION_TEST_DATABASE_URL is required');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectSqlState(
  client: Client,
  sql: string,
  expectedCode: string,
): Promise<void> {
  try {
    await client.query(sql);
  } catch (error) {
    const code = (error as { code?: string }).code;
    assert(code === expectedCode, `expected PostgreSQL ${expectedCode}, received ${code ?? 'unknown'}`);
    return;
  }
  throw new Error(`expected PostgreSQL ${expectedCode}: ${sql}`);
}

async function createRaceClient(): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const predecessor = await client.query(`
      SELECT to_regclass('public."RemediationOrchestrationResult"') AS table_name
    `);
    assert(
      predecessor.rows[0]?.table_name === '"RemediationOrchestrationResult"',
      'pre-migration orchestration table is unavailable after migration',
    );

    const constraints = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname IN (
        'MicroInterventionEvent_type_check',
        'MicroInterventionEvent_duration_check',
        'MicroInterventionValidation_duration_check',
        'MicroInterventionOutcome_result_fkey',
        'MicroInterventionEvent_intervention_fkey',
        'MicroInterventionValidation_intervention_fkey'
      )
    `);
    assert(constraints.rows.length === 6, 'micro-intervention check or foreign-key constraint is missing');
    assert(
      constraints.rows.some((row) => (
        row.conname === 'MicroInterventionOutcome_result_fkey' && /ON DELETE RESTRICT/.test(row.definition)
      )),
      'outcome retention foreign key is not ON DELETE RESTRICT',
    );

    const indexes = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('MicroInterventionOutcome', 'MicroInterventionEvent', 'MicroInterventionValidation')
        AND indexname IN (
          'MicroInterventionOutcome_result_session_start_key',
          'MicroInterventionEvent_intervention_event_key',
          'MicroInterventionValidation_intervention_key',
          'MicroInterventionValidation_intervention_event_key'
        )
    `);
    assert(indexes.rows.length === 4, 'micro-intervention unique index is missing');

    await expectSqlState(client, `
      INSERT INTO "MicroInterventionEvent" ("id", "interventionId", "eventKey", "eventType", "occurredAt")
      VALUES ('invalid-type', 'missing-parent', 'event', 'INVALID', CURRENT_TIMESTAMP)
    `, '23514');
    await expectSqlState(client, `
      INSERT INTO "MicroInterventionEvent" ("id", "interventionId", "eventKey", "eventType", "occurredAt")
      VALUES ('missing-parent', 'missing-parent', 'event', 'HINT_REQUESTED', CURRENT_TIMESTAMP)
    `, '23503');

    await client.query('SET session_replication_role = replica');
    try {
      await client.query(`
        INSERT INTO "RemediationOrchestrationResult" (
          "id", "wrongAnswerAttributionId", "orchestratorVersion", "userId", "status", "taskSnapshot"
        ) VALUES ('result-1', 'legacy-attribution', 'remediation-orchestrator.v1', 'learner-1', 'AVAILABLE', '{}')
      `);
    } finally {
      await client.query('RESET session_replication_role');
    }
    await client.query(`
      INSERT INTO "MicroInterventionOutcome" (
        "id", "remediationOrchestrationResultId", "userId", "learnerSessionId", "startEventKey", "sourceSnapshot"
      ) VALUES ('outcome-1', 'result-1', 'learner-1', 'session-1', 'start-1', '{}')
    `);
    await client.query(`
      INSERT INTO "MicroInterventionOutcome" (
        "id", "remediationOrchestrationResultId", "userId", "learnerSessionId", "startEventKey", "sourceSnapshot"
      ) VALUES ('outcome-2', 'result-1', 'learner-1', 'session-1', 'start-2', '{}')
    `);
    await expectSqlState(client, `
      DELETE FROM "RemediationOrchestrationResult" WHERE "id" = 'result-1'
    `, '23503');
    await expectSqlState(client, `
      INSERT INTO "MicroInterventionValidation" (
        "id", "interventionId", "eventKey", "selectedOptionKey", "isCorrect", "durationSeconds",
        "questionId", "questionContentHash", "questionVersion", "recommendationSnapshot"
      ) VALUES ('invalid-duration', 'outcome-2', 'validation-1', 'A', false, 0, 'question', 'hash', 'v1', '{}')
    `, '23514');
    await client.query(`
      INSERT INTO "MicroInterventionValidation" (
        "id", "interventionId", "eventKey", "selectedOptionKey", "isCorrect", "durationSeconds",
        "questionId", "questionContentHash", "questionVersion", "recommendationSnapshot"
      ) VALUES ('validation-1', 'outcome-2', 'validation-1', 'A', false, 20, 'question', 'hash', 'v1', '{}')
    `);
    await expectSqlState(client, `
      INSERT INTO "MicroInterventionValidation" (
        "id", "interventionId", "eventKey", "selectedOptionKey", "isCorrect", "durationSeconds",
        "questionId", "questionContentHash", "questionVersion", "recommendationSnapshot"
      ) VALUES ('validation-2', 'outcome-2', 'validation-2', 'B', true, 20, 'question', 'hash', 'v1', '{}')
    `, '23505');

    const first = await createRaceClient();
    const second = await createRaceClient();
    try {
      const writes = await Promise.allSettled([
        first.query(`
          INSERT INTO "MicroInterventionEvent" ("id", "interventionId", "eventKey", "eventType", "occurredAt")
          VALUES ('event-race-1', 'outcome-1', 'event-race', 'HINT_REQUESTED', CURRENT_TIMESTAMP)
        `),
        second.query(`
          INSERT INTO "MicroInterventionEvent" ("id", "interventionId", "eventKey", "eventType", "occurredAt")
          VALUES ('event-race-2', 'outcome-1', 'event-race', 'HINT_REQUESTED', CURRENT_TIMESTAMP)
        `),
      ]);
      assert(writes.filter((result) => result.status === 'fulfilled').length === 1, 'concurrent event write did not preserve one first record');
      const rejected = writes.find((result) => result.status === 'rejected');
      assert((rejected as PromiseRejectedResult | undefined)?.reason?.code === '23505', 'concurrent event write did not return a unique conflict');
    } finally {
      await Promise.all([first.end(), second.end()]);
    }

    await client.query('DROP TABLE "MicroInterventionValidation", "MicroInterventionEvent", "MicroInterventionOutcome"');
    const rollback = await client.query(`
      SELECT to_regclass('public."RemediationOrchestrationResult"') AS table_name
    `);
    assert(
      rollback.rows[0]?.table_name === '"RemediationOrchestrationResult"',
      'rollback sequence removed the pre-existing orchestration table',
    );
  } finally {
    await client.end();
  }
}

main().then(
  () => console.log('micro-intervention PostgreSQL migration smoke passed'),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
