import { readFileSync } from 'node:fs';
import { deepEqual, equal } from 'node:assert/strict';
import path from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Client } from 'pg';

const schema = `trusted_portrait_${process.pid}_${Date.now()}`;
const migrationSql = readFileSync(
  path.join(
    process.cwd(),
    'prisma/migrations/20260806010000_add_trusted_portrait_traceability/migration.sql',
  ),
  'utf8',
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function closeClient(client: Client): Promise<void> {
  const ended = client.end().then(() => true);
  const closed = await Promise.race([
    ended,
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 1_000)),
  ]);

  if (!closed) {
    client.connection.stream.destroy();
    await ended;
  }
}

async function main(): Promise<void> {
  const database = new PGlite();
  const server = new PGLiteSocketServer({
    db: database,
    host: '127.0.0.1',
    maxConnections: 1,
    port: 0,
  });
  await server.start();

  const [host, port] = server.getServerConn().split(':');
  const client = new Client({
    database: 'template1',
    host,
    port: Number(port),
    user: 'postgres',
  });
  await client.connect();

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);

    await client.query(`
      CREATE TABLE "LearnerPortraitStateVersion" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "calculationVersion" TEXT NOT NULL,
        "generation" BIGINT NOT NULL,
        "queueGeneration" BIGINT NOT NULL,
        "stateWatermark" BIGINT NOT NULL,
        "taskInputDigest" TEXT NOT NULL DEFAULT '',
        "stateKind" TEXT NOT NULL,
        "snapshotId" TEXT,
        "overallScore" DOUBLE PRECISION,
        "dimensionCoverage" JSONB NOT NULL DEFAULT '{}',
        "evidenceAsOf" TIMESTAMP(3),
        "confidence" DOUBLE PRECISION,
        "lastTrend" TEXT,
        "lastRisk" JSONB,
        "availabilityReason" TEXT NOT NULL,
        "generatedAt" TIMESTAMP(3) NOT NULL,
        "cutoverFence" BIGINT NOT NULL,
        "migrationRunId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "LearnerPortraitCurrentState" (
        "userId" TEXT PRIMARY KEY,
        "stateVersionId" TEXT NOT NULL UNIQUE,
        "calculationVersion" TEXT NOT NULL,
        "generation" BIGINT NOT NULL,
        "queueGeneration" BIGINT NOT NULL,
        "stateWatermark" BIGINT NOT NULL,
        "taskInputDigest" TEXT NOT NULL DEFAULT '',
        "cutoverFence" BIGINT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "LearnerPortraitCurrentState_stateVersion_fkey"
          FOREIGN KEY ("stateVersionId")
          REFERENCES "LearnerPortraitStateVersion"("id")
          ON DELETE RESTRICT
      );
    `);

    await client.query(`
      INSERT INTO "LearnerPortraitStateVersion" (
        "id", "userId", "calculationVersion", "generation", "queueGeneration",
        "stateWatermark", "stateKind", "dimensionCoverage", "availabilityReason",
        "generatedAt", "cutoverFence"
      ) VALUES (
        'legacy-1', 'learner-1', 'portrait-v2-cumulative.v2', 1, 1, 1,
        'SNAPSHOT', '{}', 'available', CURRENT_TIMESTAMP, 1
      );

      INSERT INTO "LearnerPortraitCurrentState" (
        "userId", "stateVersionId", "calculationVersion", "generation",
        "queueGeneration", "stateWatermark", "cutoverFence"
      ) VALUES (
        'learner-1', 'legacy-1', 'portrait-v2-cumulative.v2', 1, 1, 1, 1
      );
    `);

    const before = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = 'LearnerPortraitStateVersion'
        AND column_name IN (
          'trustedFactIds', 'trustedFactPolicyVersion', 'trustedInputDigest'
        )
    `, [schema]);
    assert(before.rows.length === 0, 'trusted fields must be absent before migration');

    await client.query(migrationSql);

    const after = await client.query(`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = 'LearnerPortraitStateVersion'
        AND column_name IN (
          'trustedFactIds', 'trustedFactPolicyVersion', 'trustedInputDigest'
        )
      ORDER BY column_name
    `, [schema]);
    assert(after.rows.length === 3, 'trusted fields must exist after migration');
    assert(
      after.rows.every((row) => row.is_nullable === 'NO'),
      'trusted fields must remain NOT NULL',
    );

    const legacy = await client.query<{
      trustedFactIds: unknown[];
      trustedFactPolicyVersion: string;
      trustedInputDigest: string;
    }>(`
      SELECT "trustedFactIds", "trustedFactPolicyVersion", "trustedInputDigest"
      FROM "LearnerPortraitStateVersion"
      WHERE "id" = 'legacy-1'
    `);
    assert(legacy.rows.length === 1, 'legacy row must survive migration');
    deepEqual(legacy.rows[0].trustedFactIds, [], 'legacy trustedFactIds default must be empty array');
    equal(legacy.rows[0].trustedFactPolicyVersion, '', 'legacy policy version default must be empty');
    equal(legacy.rows[0].trustedInputDigest, '', 'legacy input digest default must be empty');

    await client.query('BEGIN');
    await client.query(`
      INSERT INTO "LearnerPortraitStateVersion" (
        "id", "userId", "calculationVersion", "generation", "queueGeneration",
        "stateWatermark", "stateKind", "dimensionCoverage", "availabilityReason",
        "generatedAt", "cutoverFence", "trustedFactIds",
        "trustedFactPolicyVersion", "trustedInputDigest"
      ) VALUES (
        'trusted-1', 'learner-1', 'portrait-v2-cumulative.v3', 2, 2, 2,
        'SNAPSHOT', '{}', 'available', CURRENT_TIMESTAMP, 2,
        '["fact-1","fact-2"]', 'trusted-learning-fact-policy.v1', 'digest-1'
      );

      INSERT INTO "LearnerPortraitCurrentState" (
        "userId", "stateVersionId", "calculationVersion", "generation",
        "queueGeneration", "stateWatermark", "cutoverFence"
      ) VALUES (
        'learner-1', 'trusted-1', 'portrait-v2-cumulative.v3', 2, 2, 2, 2
      )
      ON CONFLICT ("userId") DO UPDATE SET
        "stateVersionId" = EXCLUDED."stateVersionId",
        "calculationVersion" = EXCLUDED."calculationVersion",
        "generation" = EXCLUDED."generation",
        "queueGeneration" = EXCLUDED."queueGeneration",
        "stateWatermark" = EXCLUDED."stateWatermark",
        "taskInputDigest" = EXCLUDED."taskInputDigest",
        "cutoverFence" = EXCLUDED."cutoverFence",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
    await client.query('COMMIT');

    const current = await client.query<{
      stateVersionId: string;
      trustedFactIds: unknown[];
      trustedFactPolicyVersion: string;
      trustedInputDigest: string;
    }>(`
      SELECT
        c."stateVersionId",
        v."trustedFactIds",
        v."trustedFactPolicyVersion",
        v."trustedInputDigest"
      FROM "LearnerPortraitCurrentState" c
      JOIN "LearnerPortraitStateVersion" v ON v."id" = c."stateVersionId"
      WHERE c."userId" = 'learner-1'
    `);
    assert(current.rows.length === 1, 'current pointer must reference a state version');
    equal(current.rows[0].stateVersionId, 'trusted-1', 'current pointer must cut over to trusted state');
    deepEqual(current.rows[0].trustedFactIds, ['fact-1', 'fact-2'], 'current trusted fact ids must be readable');
    equal(current.rows[0].trustedFactPolicyVersion, 'trusted-learning-fact-policy.v1', 'current policy version must be readable');
    equal(current.rows[0].trustedInputDigest, 'digest-1', 'current input digest must be readable');

    const retained = await client.query(`
      SELECT count(*)::int AS count
      FROM "LearnerPortraitStateVersion"
      WHERE "userId" = 'learner-1'
    `);
    assert(retained.rows[0].count === 2, 'legacy and trusted versions must both be retained');

    console.log(JSON.stringify({
      ok: true,
      schema,
      legacyDefaults: legacy.rows[0],
      currentPointer: current.rows[0],
    }, null, 2));
  } finally {
    await closeClient(client);
    try {
      await server.stop();
    } finally {
      await database.close();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
