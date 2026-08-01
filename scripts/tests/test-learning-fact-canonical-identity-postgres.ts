/**
 * PostgreSQL fixture: LearningFact Canonical identity DB gates (#1116).
 *
 * Isolated schema. Does not touch production data.
 * - historical NULL / LEGACY rows insert OK
 * - CANONICAL with missing Release / CANDIDATE / pair mismatch / object miss rejected
 * - Projection-only objects remain rejected without CURRENT CourseCoverage
 * - CANONICAL with ACTIVE ReleaseSet + CURRENT CourseCoverage accepted
 */
import 'dotenv/config';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  if (process.env.ACTKG_POSTGRES_REQUIRED === '1') {
    throw new Error('DATABASE_URL is required');
  }
  console.log(JSON.stringify({
    ok: false,
    deferred: true,
    reason: 'DATABASE_URL unavailable',
  }));
  process.exit(0);
}

const schema = `lf_canonical_${process.pid}_${Date.now()}`;
const root = process.cwd();
const migrationSql = readFileSync(
  path.join(
    root,
    'prisma/migrations/20260730120000_write_learning_facts_with_canonical_knowledge/migration.sql',
  ),
  'utf8',
);

function withSchema(url: string, schemaName: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('schema', schemaName);
  parsed.searchParams.set('options', `-csearch_path=${schemaName},public`);
  return parsed.toString();
}

async function main(): Promise<void> {
  const admin = new Client({ connectionString: sourceUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
  } finally {
    await admin.end();
  }

  const client = new Client({ connectionString: withSchema(sourceUrl, schema) });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE "ActkgReleaseSet" (
        "id" TEXT PRIMARY KEY,
        "candidateState" TEXT NOT NULL
      );
      CREATE TABLE "ActkgRelease" (
        "id" TEXT PRIMARY KEY,
        "releaseSetId" TEXT NOT NULL,
        "projectionId" TEXT,
        "releaseHash" TEXT NOT NULL,
        UNIQUE ("releaseSetId", "id")
      );
      CREATE TABLE "ActkgProjectionNode" (
        "releaseId" TEXT NOT NULL,
        "nodeId" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        PRIMARY KEY ("releaseId", "nodeId"),
        UNIQUE ("releaseId", "entityId")
      );
      CREATE TABLE "ActkgProjectionIdentity" (
        "releaseId" TEXT NOT NULL,
        "projectionId" TEXT NOT NULL,
        PRIMARY KEY ("releaseId", "projectionId")
      );
      CREATE TABLE "AggregateCourseCoverageVersion" (
        "id" TEXT PRIMARY KEY,
        "releaseSetId" TEXT NOT NULL,
        "releaseId" TEXT NOT NULL,
        "lifecycleState" TEXT NOT NULL
      );
      CREATE TABLE "AggregateCourseCoverageEntry" (
        "versionId" TEXT NOT NULL,
        "releaseId" TEXT NOT NULL,
        "canonicalId" TEXT NOT NULL,
        "lifecycleState" TEXT NOT NULL,
        PRIMARY KEY ("versionId", "canonicalId")
      );
      CREATE TABLE "LearningFact" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "factType" TEXT NOT NULL,
        "startedAt" TIMESTAMP(3) NOT NULL,
        "outcome" TEXT NOT NULL,
        "competencyContribution" JSONB NOT NULL DEFAULT '{}',
        "sourceEventId" TEXT UNIQUE,
        "sourceLogId" TEXT,
        "contextJson" JSONB NOT NULL DEFAULT '{}'
      );
    `);

    await client.query(migrationSql);

    // Historical NULL row
    await client.query(`
      INSERT INTO "LearningFact" ("id","userId","factType","startedAt","outcome","sourceEventId")
      VALUES ('hist-1','u1','question', NOW(), 'success', 'event-hist-1');
    `);

    // LEGACY stamp
    await client.query(`
      INSERT INTO "LearningFact" (
        "id","userId","factType","startedAt","outcome","sourceEventId",
        "knowledgeIdentityNamespace","knowledgeRevisionRef"
      ) VALUES (
        'legacy-1','u1','question', NOW(), 'success', 'event-legacy-1',
        'LEGACY','legacy-rev-1'
      );
    `);

    // Fixture ACTIVE aggregate
    await client.query(`
      INSERT INTO "ActkgReleaseSet" ("id","candidateState") VALUES ('rs-active','ACTIVE');
      INSERT INTO "ActkgReleaseSet" ("id","candidateState") VALUES ('rs-candidate','CANDIDATE');
      INSERT INTO "ActkgReleaseSet" ("id","candidateState") VALUES ('rs-accepted','ACCEPTED_CANDIDATE');
      INSERT INTO "ActkgRelease" ("id","releaseSetId","projectionId","releaseHash")
        VALUES ('rel-active','rs-active','proj-1','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      INSERT INTO "ActkgRelease" ("id","releaseSetId","projectionId","releaseHash")
        VALUES ('rel-candidate','rs-candidate','proj-c','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      INSERT INTO "ActkgProjectionNode" ("releaseId","nodeId","entityId")
        VALUES ('rel-active','n1','ctr:object:feedback-loop');
      INSERT INTO "ActkgProjectionNode" ("releaseId","nodeId","entityId")
        VALUES ('rel-active','n2','ctr:object:projection-only');
      INSERT INTO "ActkgProjectionIdentity" ("releaseId","projectionId")
        VALUES ('rel-active','proj-1');
      INSERT INTO "AggregateCourseCoverageVersion" (
        "id","releaseSetId","releaseId","lifecycleState"
      ) VALUES (
        'coverage-current','rs-active','rel-active','CURRENT'
      );
      INSERT INTO "AggregateCourseCoverageEntry" (
        "versionId","releaseId","canonicalId","lifecycleState"
      ) VALUES (
        'coverage-current','rel-active','ctr:object:feedback-loop','CURRENT'
      );
    `);

    async function expectReject(label: string, sql: string): Promise<void> {
      let failed = false;
      try {
        await client.query(sql);
      } catch {
        failed = true;
      }
      assert.equal(failed, true, `${label} should be rejected`);
    }

    await expectReject(
      'missing release set',
      `INSERT INTO "LearningFact" (
        "id","userId","factType","startedAt","outcome","sourceEventId",
        "knowledgeIdentityNamespace","canonicalObjectId","aggregateReleaseSetId",
        "aggregateReleaseId","knowledgeProjectionId","knowledgeRevisionRef"
      ) VALUES (
        'bad-missing-rs','u1','question', NOW(), 'success', 'e-bad-1',
        'CANONICAL','ctr:object:feedback-loop','rs-missing','rel-active','proj-1','rev-1'
      )`,
    );

    await expectReject(
      'candidate release set',
      `INSERT INTO "LearningFact" (
        "id","userId","factType","startedAt","outcome","sourceEventId",
        "knowledgeIdentityNamespace","canonicalObjectId","aggregateReleaseSetId",
        "aggregateReleaseId","knowledgeProjectionId","knowledgeRevisionRef"
      ) VALUES (
        'bad-candidate','u1','question', NOW(), 'success', 'e-bad-2',
        'CANONICAL','ctr:object:feedback-loop','rs-candidate','rel-candidate','proj-c','rev-1'
      )`,
    );

    await expectReject(
      'accepted candidate still closed',
      `INSERT INTO "LearningFact" (
        "id","userId","factType","startedAt","outcome","sourceEventId",
        "knowledgeIdentityNamespace","canonicalObjectId","aggregateReleaseSetId",
        "aggregateReleaseId","knowledgeProjectionId","knowledgeRevisionRef"
      ) VALUES (
        'bad-accepted','u1','question', NOW(), 'success', 'e-bad-3',
        'CANONICAL','ctr:object:feedback-loop','rs-accepted','rel-active','proj-1','rev-1'
      )`,
    );

    await expectReject(
      'release pair mismatch',
      `INSERT INTO "LearningFact" (
        "id","userId","factType","startedAt","outcome","sourceEventId",
        "knowledgeIdentityNamespace","canonicalObjectId","aggregateReleaseSetId",
        "aggregateReleaseId","knowledgeProjectionId","knowledgeRevisionRef"
      ) VALUES (
        'bad-pair','u1','question', NOW(), 'success', 'e-bad-4',
        'CANONICAL','ctr:object:feedback-loop','rs-active','rel-candidate','proj-1','rev-1'
      )`,
    );

    await expectReject(
      'object not in current coverage',
      `INSERT INTO "LearningFact" (
        "id","userId","factType","startedAt","outcome","sourceEventId",
        "knowledgeIdentityNamespace","canonicalObjectId","aggregateReleaseSetId",
        "aggregateReleaseId","knowledgeProjectionId","knowledgeRevisionRef"
      ) VALUES (
        'bad-object','u1','question', NOW(), 'success', 'e-bad-5',
        'CANONICAL','ctr:object:unknown','rs-active','rel-active','proj-1','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      )`,
    );

    await expectReject(
      'projection membership without current coverage',
      `INSERT INTO "LearningFact" (
        "id","userId","factType","startedAt","outcome","sourceEventId",
        "knowledgeIdentityNamespace","canonicalObjectId","aggregateReleaseSetId",
        "aggregateReleaseId","knowledgeProjectionId","knowledgeRevisionRef"
      ) VALUES (
        'bad-projection-only','u1','question', NOW(), 'success', 'e-bad-proj-only',
        'CANONICAL','ctr:object:projection-only','rs-active','rel-active','proj-1','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      )`,
    );

    await expectReject(
      'projection drift',
      `INSERT INTO "LearningFact" (
        "id","userId","factType","startedAt","outcome","sourceEventId",
        "knowledgeIdentityNamespace","canonicalObjectId","aggregateReleaseSetId",
        "aggregateReleaseId","knowledgeProjectionId","knowledgeRevisionRef"
      ) VALUES (
        'bad-proj','u1','question', NOW(), 'success', 'e-bad-6',
        'CANONICAL','ctr:object:feedback-loop','rs-active','rel-active','proj-wrong','${'a'.repeat(64)}'
      )`,
    );

    await expectReject(
      'arbitrary knowledgeRevisionRef with valid release/projection',
      `INSERT INTO "LearningFact" (
        "id","userId","factType","startedAt","outcome","sourceEventId",
        "knowledgeIdentityNamespace","canonicalObjectId","aggregateReleaseSetId",
        "aggregateReleaseId","knowledgeProjectionId","knowledgeRevisionRef"
      ) VALUES (
        'bad-rev','u1','question', NOW(), 'success', 'e-bad-rev',
        'CANONICAL','ctr:object:feedback-loop','rs-active','rel-active','proj-1','${'f'.repeat(64)}'
      )`,
    );

    // Happy path ACTIVE + membership + releaseHash revision
    await client.query(`
      INSERT INTO "LearningFact" (
        "id","userId","factType","startedAt","outcome","sourceEventId",
        "knowledgeIdentityNamespace","canonicalObjectId","aggregateReleaseSetId",
        "aggregateReleaseId","knowledgeProjectionId","knowledgeRevisionRef"
      ) VALUES (
        'ok-canonical','u1','question', NOW(), 'success', 'e-ok-1',
        'CANONICAL','ctr:object:feedback-loop','rs-active','rel-active','proj-1','${'a'.repeat(64)}'
      );
    `);

    const counts = await client.query<{ namespace: string | null; n: string }>(`
      SELECT "knowledgeIdentityNamespace" AS namespace, count(*)::text AS n
      FROM "LearningFact"
      GROUP BY 1
      ORDER BY 1 NULLS FIRST
    `);

    console.log(JSON.stringify({
      ok: true,
      schema,
      counts: counts.rows,
    }, null, 2));
  } finally {
    await client.end();
    const cleanup = new Client({ connectionString: sourceUrl });
    await cleanup.connect();
    try {
      await cleanup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await cleanup.end();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
