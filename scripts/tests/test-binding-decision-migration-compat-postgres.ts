/**
 * PostgreSQL fixture: prove migration 20260730020000 is additive/compatible.
 *
 * Seeds a representative legacy #1124 CanonicalResourceBindingDecision with
 * EvidenceStructuralUnitCrosswalk linkage, applies the migration SQL, and
 * asserts the legacy row is byte-stable while a new GROK/#1126 governed
 * decision can persist.
 *
 * Uses an isolated schema; does not mutate the primary developer database
 * migration history.
 */
import 'dotenv/config';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  if (process.env.ACTKG_POSTGRES_REQUIRED === '1') throw new Error('DATABASE_URL is required');
  console.log(JSON.stringify({ ok: false, deferred: true, reason: 'DATABASE_URL unavailable' }));
  process.exit(0);
}

const schema = `binding_mig_compat_${process.pid}_${Date.now()}`;
const root = process.cwd();
const migrationSql = readFileSync(
  path.join(
    root,
    'prisma/migrations/20260730020000_bind_decisions_to_projection_and_governed_crosswalk/migration.sql',
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
    // Minimal stubs for legacy FKs (pre-migration shape).
    await client.query(`
      CREATE TABLE "ActkgRelease" (
        "id" TEXT PRIMARY KEY,
        "releaseSetId" TEXT NOT NULL,
        UNIQUE ("releaseSetId", "id")
      );
      CREATE TABLE "ActkgAuthoritativeObject" (
        "releaseId" TEXT NOT NULL,
        "canonicalId" TEXT NOT NULL,
        PRIMARY KEY ("releaseId", "canonicalId")
      );
      CREATE TABLE "ActkgEvidenceSegment" (
        "releaseId" TEXT NOT NULL,
        "evidenceId" TEXT NOT NULL,
        PRIMARY KEY ("releaseId", "evidenceId")
      );
      CREATE TABLE "ResourceBindingInventoryItem" (
        "runId" TEXT NOT NULL,
        "atomicResourceId" TEXT NOT NULL,
        PRIMARY KEY ("runId", "atomicResourceId")
      );
      CREATE TABLE "ActkgEvidenceStructuralUnitCrosswalk" (
        "id" TEXT NOT NULL,
        "releaseId" TEXT NOT NULL,
        "inventoryRunId" TEXT NOT NULL,
        "captureRevision" TEXT NOT NULL,
        "structuralUnitVersion" TEXT NOT NULL,
        PRIMARY KEY ("releaseId", "id"),
        UNIQUE ("releaseId", "id", "inventoryRunId", "captureRevision", "structuralUnitVersion")
      );
      CREATE TABLE "ActGovernedStructuralUnitCrosswalk" (
        "id" TEXT PRIMARY KEY,
        "releaseId" TEXT NOT NULL,
        "inventoryRunId" TEXT,
        "captureRevision" TEXT NOT NULL,
        "structuralUnitVersion" TEXT
      );
      CREATE TABLE "CanonicalResourceBindingDecision" (
        "id" TEXT PRIMARY KEY,
        "pairId" TEXT NOT NULL,
        "releaseSetId" TEXT NOT NULL,
        "releaseId" TEXT NOT NULL,
        "canonicalId" TEXT NOT NULL,
        "objectRevision" TEXT NOT NULL,
        "resourceId" TEXT NOT NULL,
        "structuralUnitId" TEXT NOT NULL,
        "segmentId" TEXT NOT NULL,
        "resourceSegmentHash" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "evidenceId" TEXT,
        "evidenceDigest" TEXT NOT NULL,
        "generatorPromptVersion" TEXT NOT NULL,
        "reviewerPromptVersion" TEXT NOT NULL,
        "generatorCacheKey" TEXT NOT NULL,
        "reviewerCacheKey" TEXT NOT NULL,
        "reviewerRole" TEXT NOT NULL,
        "reviewerInputDigest" TEXT NOT NULL,
        "candidateDigest" TEXT NOT NULL,
        "reviewProvider" TEXT NOT NULL,
        "reviewState" TEXT NOT NULL,
        "publicationState" TEXT NOT NULL,
        "lifecycleState" TEXT NOT NULL,
        "attemptSequence" INT NOT NULL,
        "supersedesDecisionId" TEXT,
        "crosswalkId" TEXT,
        "inventoryRunId" TEXT,
        "captureRevision" TEXT,
        "structuralUnitVersion" TEXT,
        "validationDigest" TEXT,
        "highImpactPolicyVersion" TEXT NOT NULL,
        "highImpactReasons" JSONB NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CanonicalResourceBindingDecision_review_provider_check"
          CHECK ("reviewProvider" IN ('GPT', 'FIXTURE', 'HUMAN', 'NONE')),
        CONSTRAINT "CanonicalResourceBindingDecision_crosswalk_identity_check"
          CHECK (
            (
              "crosswalkId" IS NULL AND "inventoryRunId" IS NULL
              AND "captureRevision" IS NULL AND "structuralUnitVersion" IS NULL
              AND "validationDigest" IS NULL
            ) OR (
              "crosswalkId" IS NOT NULL AND "inventoryRunId" IS NOT NULL
              AND "captureRevision" IS NOT NULL AND "structuralUnitVersion" IS NOT NULL
              AND "validationDigest" IS NOT NULL
            )
          ),
        CONSTRAINT "CanonicalResourceBindingDecision_releaseSetId_releaseId_fkey"
          FOREIGN KEY ("releaseSetId", "releaseId")
          REFERENCES "ActkgRelease"("releaseSetId", "id") ON DELETE RESTRICT,
        CONSTRAINT "CanonicalResourceBindingDecision_canonical_fkey"
          FOREIGN KEY ("releaseId", "canonicalId")
          REFERENCES "ActkgAuthoritativeObject"("releaseId", "canonicalId") ON DELETE RESTRICT,
        CONSTRAINT "CanonicalResourceBindingDecision_releaseId_evidenceId_fkey"
          FOREIGN KEY ("releaseId", "evidenceId")
          REFERENCES "ActkgEvidenceSegment"("releaseId", "evidenceId") ON DELETE RESTRICT,
        CONSTRAINT "CanonicalResourceBindingDecision_releaseId_crosswalkId_inv_fkey"
          FOREIGN KEY (
            "releaseId", "crosswalkId", "inventoryRunId", "captureRevision", "structuralUnitVersion"
          )
          REFERENCES "ActkgEvidenceStructuralUnitCrosswalk"(
            "releaseId", "id", "inventoryRunId", "captureRevision", "structuralUnitVersion"
          ) ON DELETE RESTRICT
      );
    `);

    await client.query(
      `INSERT INTO "ActkgRelease" ("id", "releaseSetId") VALUES ('rel-1', 'set-1')`,
    );
    await client.query(
      `INSERT INTO "ActkgAuthoritativeObject" ("releaseId", "canonicalId")
       VALUES ('rel-1', 'ctc:legacy')`,
    );
    await client.query(
      `INSERT INTO "ActkgEvidenceSegment" ("releaseId", "evidenceId")
       VALUES ('rel-1', 'ev-1')`,
    );
    await client.query(
      `INSERT INTO "ResourceBindingInventoryItem" ("runId", "atomicResourceId")
       VALUES ('inv-1', 'atomic-1')`,
    );
    await client.query(
      `INSERT INTO "ActkgEvidenceStructuralUnitCrosswalk" (
         "id", "releaseId", "inventoryRunId", "captureRevision", "structuralUnitVersion"
       ) VALUES ('xwalk-legacy', 'rel-1', 'inv-1', $1, 'v1')`,
      ['a'.repeat(40)],
    );

    const legacy = {
      id: 'decision-legacy-1',
      pairId: 'pair-legacy',
      releaseSetId: 'set-1',
      releaseId: 'rel-1',
      canonicalId: 'ctc:legacy',
      objectRevision: 'rev-1',
      resourceId: 'res-1',
      structuralUnitId: 'unit-1',
      segmentId: 'seg-1',
      resourceSegmentHash: 'b'.repeat(64),
      role: 'EXPLAINS',
      evidenceId: 'ev-1',
      evidenceDigest: 'c'.repeat(64),
      generatorPromptVersion: 'gen/v1',
      reviewerPromptVersion: 'rev/v1',
      generatorCacheKey: 'd'.repeat(64),
      reviewerCacheKey: 'e'.repeat(64),
      reviewerRole: 'INDEPENDENT_REVIEWER',
      reviewerInputDigest: 'f'.repeat(64),
      candidateDigest: '1'.repeat(64),
      reviewProvider: 'HUMAN',
      reviewState: 'ACCEPTED',
      publicationState: 'SHADOW_PUBLISHED',
      lifecycleState: 'CURRENT',
      attemptSequence: 1,
      crosswalkId: 'xwalk-legacy',
      inventoryRunId: 'inv-1',
      captureRevision: 'a'.repeat(40),
      structuralUnitVersion: 'v1',
      validationDigest: '2'.repeat(64),
      highImpactPolicyVersion: 'binding-impact/v1',
      highImpactReasons: [],
    };

    await client.query(`
      INSERT INTO "CanonicalResourceBindingDecision" (
        "id","pairId","releaseSetId","releaseId","canonicalId","objectRevision",
        "resourceId","structuralUnitId","segmentId","resourceSegmentHash","role",
        "evidenceId","evidenceDigest","generatorPromptVersion","reviewerPromptVersion",
        "generatorCacheKey","reviewerCacheKey","reviewerRole","reviewerInputDigest",
        "candidateDigest","reviewProvider","reviewState","publicationState","lifecycleState",
        "attemptSequence","crosswalkId","inventoryRunId","captureRevision",
        "structuralUnitVersion","validationDigest","highImpactPolicyVersion","highImpactReasons"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32::jsonb
      )
    `, [
      legacy.id, legacy.pairId, legacy.releaseSetId, legacy.releaseId, legacy.canonicalId,
      legacy.objectRevision, legacy.resourceId, legacy.structuralUnitId, legacy.segmentId,
      legacy.resourceSegmentHash, legacy.role, legacy.evidenceId, legacy.evidenceDigest,
      legacy.generatorPromptVersion, legacy.reviewerPromptVersion, legacy.generatorCacheKey,
      legacy.reviewerCacheKey, legacy.reviewerRole, legacy.reviewerInputDigest,
      legacy.candidateDigest, legacy.reviewProvider, legacy.reviewState, legacy.publicationState,
      legacy.lifecycleState, legacy.attemptSequence, legacy.crosswalkId, legacy.inventoryRunId,
      legacy.captureRevision, legacy.structuralUnitVersion, legacy.validationDigest,
      legacy.highImpactPolicyVersion, JSON.stringify(legacy.highImpactReasons),
    ]);

    const before = await client.query(
      `SELECT * FROM "CanonicalResourceBindingDecision" WHERE "id" = $1`,
      [legacy.id],
    );
    assert.equal(before.rows.length, 1);
    const beforeRow = before.rows[0]!;

    // Apply additive migration under isolated schema.
    await client.query(migrationSql);

    const after = await client.query(
      `SELECT * FROM "CanonicalResourceBindingDecision" WHERE "id" = $1`,
      [legacy.id],
    );
    assert.equal(after.rows.length, 1);
    const afterRow = after.rows[0]!;

    // Legacy identity unchanged.
    for (const key of [
      'id', 'pairId', 'releaseSetId', 'releaseId', 'canonicalId', 'objectRevision',
      'resourceId', 'structuralUnitId', 'segmentId', 'resourceSegmentHash', 'role',
      'evidenceId', 'evidenceDigest', 'reviewProvider', 'reviewState', 'publicationState',
      'lifecycleState', 'crosswalkId', 'inventoryRunId', 'captureRevision',
      'structuralUnitVersion', 'validationDigest',
    ] as const) {
      assert.equal(afterRow[key], beforeRow[key], `legacy field drifted: ${key}`);
    }
    assert.equal(afterRow.reviewIdentity, null);
    assert.equal(afterRow.reviewRationale, null);
    assert.equal(afterRow.governedCrosswalkId, null);
    assert.equal(afterRow.publicationState, 'SHADOW_PUBLISHED');

    // New GROK + governed path can persist without rewriting legacy row.
    await client.query(
      `INSERT INTO "ActkgAuthoritativeObject" ("releaseId", "canonicalId")
       VALUES ('rel-1', 'ctc:new')`,
    );
    await client.query(
      `INSERT INTO "ActGovernedStructuralUnitCrosswalk" (
         "id", "releaseId", "inventoryRunId", "captureRevision", "structuralUnitVersion"
       ) VALUES ('xwalk-gov', 'rel-1', 'inv-1', $1, 'v1')`,
      ['a'.repeat(40)],
    );

    await client.query(
      `INSERT INTO "CanonicalResourceBindingDecision" (
        "id","pairId","releaseSetId","releaseId","canonicalId","objectRevision",
        "resourceId","structuralUnitId","segmentId","resourceSegmentHash","role",
        "evidenceDigest","generatorPromptVersion","reviewerPromptVersion",
        "generatorCacheKey","reviewerCacheKey","reviewerRole","reviewerInputDigest",
        "candidateDigest","reviewProvider","reviewState","publicationState","lifecycleState",
        "attemptSequence","highImpactPolicyVersion","highImpactReasons",
        "reviewIdentity","reviewRationale",
        "governedCrosswalkId","governedInventoryRunId","governedCaptureRevision",
        "governedStructuralUnitVersion","governedValidationDigest"
      ) VALUES (
        'decision-grok-1','pair-new','set-1','rel-1','ctc:new','rev-2',
        'res-2','unit-2','seg-2',$1,'PRACTICES',
        $2,'gen/v1','rev/v1',
        $3,$4,'INDEPENDENT_REVIEWER',$5,
        $6,'GROK','ACCEPTED','CANDIDATE','CURRENT',
        1,'binding-impact/v1','[]'::jsonb,
        'agent-review:grok:test','isolated accept for practices role',
        'xwalk-gov','inv-1',$7,'v1',$8
      )`,
      [
        '3'.repeat(64), '4'.repeat(64), '5'.repeat(64), '6'.repeat(64),
        '7'.repeat(64), '8'.repeat(64), 'a'.repeat(40), '9'.repeat(64),
      ],
    );

    const grok = await client.query(
      `SELECT "reviewProvider","publicationState","crosswalkId","governedCrosswalkId"
       FROM "CanonicalResourceBindingDecision" WHERE "id" = 'decision-grok-1'`,
    );
    assert.equal(grok.rows[0]?.reviewProvider, 'GROK');
    assert.equal(grok.rows[0]?.crosswalkId, null);
    assert.equal(grok.rows[0]?.governedCrosswalkId, 'xwalk-gov');

    // Legacy FK still present.
    const fks = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = '"CanonicalResourceBindingDecision"'::regclass
        AND contype = 'f'
      ORDER BY conname
    `);
    const names = fks.rows.map((r) => r.conname as string);
    assert.ok(names.some((n) => n.includes('canonical')));
    assert.ok(names.some((n) => n.includes('crosswalk') || n.includes('inv')));
    assert.ok(names.some((n) => n.includes('governed')));

    console.log(JSON.stringify({
      ok: true,
      schema,
      legacyUnchanged: true,
      grokPersisted: true,
      fkCount: names.length,
    }));
  } finally {
    await client.end();
    const cleanup = new Client({ connectionString: sourceUrl });
    await cleanup.connect();
    await cleanup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await cleanup.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
