import { Client } from 'pg';

const databaseUrl = process.env.DIAGNOSIS_GENERATION_MIGRATION_TEST_DATABASE_URL;

if (!databaseUrl) throw new Error('DIAGNOSIS_GENERATION_MIGRATION_TEST_DATABASE_URL is required');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectSqlState(client: Client, sql: string, expectedCode: string) {
  try {
    await client.query(sql);
  } catch (error) {
    assert((error as { code?: string }).code === expectedCode, `expected PostgreSQL ${expectedCode}`);
    return;
  }
  throw new Error(`expected PostgreSQL ${expectedCode}: ${sql}`);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const governedInputColumn = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'DiagnosisGenerationJob'
        AND column_name = 'governedInput'
    `);
    assert(governedInputColumn.rows[0]?.data_type === 'jsonb', 'governed input snapshot column is missing');

    const indexes = await client.query(`
      SELECT indexname FROM pg_indexes WHERE indexname IN (
        'DiagnosisGenerationJob_activeScopeKey_key',
        'DiagnosisGenerationJob_userId_idempotencyKey_key',
        'DiagnosisGenerationJob_ordinaryGenerationIdentity_key',
        'DiagnosisGenerationAttempt_jobId_attemptNumber_key',
        'DiagnosisReport_generationJobId_key'
      )
    `);
    assert(indexes.rows.length === 5, 'diagnosis generation unique indexes are missing');

    const foreignKeys = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conname IN (
        'DiagnosisGenerationAttempt_jobId_fkey',
        'DiagnosisReport_generationJobId_fkey',
        'DiagnosisGenerationJob_previousReportId_fkey',
        'DiagnosisReport_previousReportId_fkey'
      )
    `);
    assert(foreignKeys.rows.length === 4, 'diagnosis generation foreign keys are missing');
    assert(foreignKeys.rows.some((row) => row.conname === 'DiagnosisGenerationAttempt_jobId_fkey' && /ON DELETE CASCADE/.test(row.definition)), 'attempt job FK must cascade');
    assert(foreignKeys.rows.some((row) => row.conname === 'DiagnosisReport_generationJobId_fkey' && /ON DELETE RESTRICT/.test(row.definition)), 'report job FK must restrict');
    assert(foreignKeys.rows.some((row) => row.conname === 'DiagnosisGenerationJob_previousReportId_fkey' && /ON DELETE RESTRICT/.test(row.definition)), 'job predecessor FK must restrict');
    assert(foreignKeys.rows.some((row) => row.conname === 'DiagnosisReport_previousReportId_fkey' && /ON DELETE RESTRICT/.test(row.definition)), 'report predecessor FK must restrict');

    await client.query(`
      INSERT INTO "DiagnosisGenerationJob" (
        "id", "userId", "classId", "scopeType", "scopeId", "activeScopeKey", "idempotencyKey",
        "state", "evidenceCutoff", "generatorVersion", "updatedAt"
      ) VALUES (
        'job-active', 'teacher-1', 'class-1', 'class', 'class-1', 'teacher-1:class-1:class', 'key-1',
        'QUEUED', CURRENT_TIMESTAMP, 'teacher-diagnosis.v1', CURRENT_TIMESTAMP
      )
    `);
    await expectSqlState(client, `
      INSERT INTO "DiagnosisGenerationJob" (
        "id", "userId", "classId", "scopeType", "scopeId", "activeScopeKey", "idempotencyKey",
        "state", "evidenceCutoff", "generatorVersion", "updatedAt"
      ) VALUES (
        'job-scope-conflict', 'teacher-1', 'class-1', 'class', 'class-1', 'teacher-1:class-1:class', 'key-2',
        'QUEUED', CURRENT_TIMESTAMP, 'teacher-diagnosis.v1', CURRENT_TIMESTAMP
      )
    `, '23505');
    await expectSqlState(client, `
      INSERT INTO "DiagnosisGenerationJob" (
        "id", "userId", "classId", "scopeType", "scopeId", "activeScopeKey", "idempotencyKey",
        "state", "evidenceCutoff", "generatorVersion", "updatedAt"
      ) VALUES (
        'job-idempotency-conflict', 'teacher-1', 'class-1', 'class', 'class-1', 'other-scope', 'key-1',
        'QUEUED', CURRENT_TIMESTAMP, 'teacher-diagnosis.v1', CURRENT_TIMESTAMP
      )
    `, '23505');

    await client.query(`
      INSERT INTO "DiagnosisGenerationAttempt" ("id", "jobId", "attemptNumber")
      VALUES ('attempt-1', 'job-active', 1)
    `);
    await expectSqlState(client, `
      INSERT INTO "DiagnosisGenerationAttempt" ("id", "jobId", "attemptNumber")
      VALUES ('attempt-duplicate', 'job-active', 1)
    `, '23505');

    await client.query(`
      UPDATE "DiagnosisGenerationJob" SET "state" = 'COMPLETED', "activeScopeKey" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'job-active'
    `);
    await client.query(`
      INSERT INTO "DiagnosisGenerationJob" (
        "id", "userId", "classId", "scopeType", "scopeId", "activeScopeKey", "idempotencyKey",
        "state", "evidenceCutoff", "generatorVersion", "updatedAt"
      ) VALUES (
        'job-later-snapshot', 'teacher-1', 'class-1', 'class', 'class-1', 'teacher-1:class-1:class', 'key-3',
        'QUEUED', CURRENT_TIMESTAMP, 'teacher-diagnosis.v1', CURRENT_TIMESTAMP
      )
    `);

    await client.query('SET session_replication_role = replica');
    try {
      await client.query(`
        INSERT INTO "DiagnosisReport" (
          "id", "scopeType", "scopeId", "classId", "userId", "reportBody", "evidenceCutoff", "generatorVersion", "generationJobId"
        ) VALUES ('report-1', 'class', 'class-1', 'class-1', 'teacher-1', '{}', CURRENT_TIMESTAMP, 'teacher-diagnosis.v1', 'job-active')
      `);
    } finally {
      await client.query('RESET session_replication_role');
    }
    await expectSqlState(client, `
      INSERT INTO "DiagnosisReport" (
        "id", "scopeType", "scopeId", "classId", "userId", "reportBody", "evidenceCutoff", "generatorVersion", "generationJobId"
      ) VALUES ('report-duplicate', 'class', 'class-1', 'class-1', 'teacher-1', '{}', CURRENT_TIMESTAMP, 'teacher-diagnosis.v1', 'job-active')
    `, '23505');
    await expectSqlState(client, 'DELETE FROM "DiagnosisGenerationJob" WHERE "id" = \'job-active\'', '23001');

    await client.query(`
      UPDATE "DiagnosisGenerationJob"
      SET "previousReportId" = 'report-1', "ordinaryGenerationIdentity" = 'ordinary-input-1'
      WHERE "id" = 'job-later-snapshot'
    `);
    await expectSqlState(client, `
      INSERT INTO "DiagnosisGenerationJob" (
        "id", "userId", "classId", "scopeType", "scopeId", "idempotencyKey",
        "state", "evidenceCutoff", "generatorVersion", "ordinaryGenerationIdentity", "updatedAt"
      ) VALUES (
        'job-ordinary-conflict', 'teacher-1', 'class-1', 'class', 'class-1', 'key-ordinary-conflict',
        'FAILED', CURRENT_TIMESTAMP, 'teacher-diagnosis.v1', 'ordinary-input-1', CURRENT_TIMESTAMP
      )
    `, '23505');
    await expectSqlState(client, 'DELETE FROM "DiagnosisReport" WHERE "id" = \'report-1\'', '23001');

    await client.query(`
      UPDATE "DiagnosisGenerationJob"
      SET "previousReportId" = NULL
      WHERE "id" = 'job-later-snapshot'
    `);
    await client.query('DELETE FROM "DiagnosisReport" WHERE "id" = \'report-1\'');
    await client.query('DELETE FROM "DiagnosisGenerationJob" WHERE "id" = \'job-active\'');
    const attempts = await client.query('SELECT count(*)::int AS count FROM "DiagnosisGenerationAttempt" WHERE "jobId" = \'job-active\'');
    assert(attempts.rows[0]?.count === 0, 'attempt rows must cascade when an unreported job is deleted');
  } finally {
    await client.end();
  }
}

main().then(
  () => console.log('diagnosis generation PostgreSQL migration smoke passed'),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
