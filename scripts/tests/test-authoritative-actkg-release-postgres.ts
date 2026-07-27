import 'dotenv/config';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { Client } from 'pg';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  AuthoritativeKnowledgeRepository,
  type AuthoritativeKnowledgeDatabase,
} from '../../src/lib/authoritative-knowledge';
import {
  canonicalJson,
  importValidatedRelease,
  loadAndValidateRelease,
  reconstructRelease,
  sha256,
} from '../actkg-release/authoritative-release';

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  if (process.env.ACTKG_POSTGRES_REQUIRED === '1') throw new Error('DATABASE_URL is required');
  console.log('authoritative ActKG PostgreSQL integration skipped: DATABASE_URL is unavailable');
  process.exit(0);
}

const databaseName = `actkg_release_${process.pid}_${Date.now()}`;
let adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
let testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
let admin = new Client({ connectionString: adminUrl.toString() });
let db: ReturnType<typeof createPrismaClient> | null = null;
let ephemeralPgCtl: string | null = null;
let ephemeralDataDir: string | null = null;
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'actkg-postgres-'));

function migrate(): void {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function main(): Promise<void> {
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  } catch (error) {
    if ((error as { code?: string }).code !== '42501') throw error;
    await admin.end();
    const bindir = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8' });
    assert.equal(bindir.status, 0, bindir.stderr || bindir.stdout);
    const postgresBin = bindir.stdout.trim();
    const initdb = path.join(postgresBin, 'initdb');
    ephemeralPgCtl = path.join(postgresBin, 'pg_ctl');
    ephemeralDataDir = path.join(tempRoot, 'data');
    const initialized = spawnSync(initdb, [
      '-D', ephemeralDataDir, '--auth=trust', '--username=postgres', '--no-locale',
    ], { encoding: 'utf8' });
    assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
    const port = await availablePort();
    const started = spawnSync(ephemeralPgCtl, [
      '-D', ephemeralDataDir,
      '-l', path.join(tempRoot, 'postgres.log'),
      '-o', `-p ${port} -h 127.0.0.1`,
      '-w', 'start',
    ], { encoding: 'utf8' });
    assert.equal(started.status, 0, started.stderr || started.stdout);
    adminUrl = new URL(`postgresql://postgres@127.0.0.1:${port}/postgres`);
    testUrl = new URL(`postgresql://postgres@127.0.0.1:${port}/${databaseName}`);
    admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  }
  migrate();
  process.env.DATABASE_URL = testUrl.toString();
  db = createPrismaClient({ log: ['warn', 'error'] });
  const validated = await loadAndValidateRelease({ captureRevision: 'a'.repeat(40) });

  await db.actkgReleaseSet.create({
    data: {
      id: validated.lock.release_set_id,
      controlledPath: 'conflicting-controlled-path',
      lockVersion: validated.lock.lock_version,
    },
  });
  await assert.rejects(importValidatedRelease(db, validated), /ReleaseSet identity conflicts/u);
  assert.equal(await db.actkgRelease.count(), 0);
  assert.equal(await db.actkgAuthoritativeObject.count(), 0);
  await db.$executeRawUnsafe('TRUNCATE TABLE "ActkgReleaseSet" CASCADE');

  const legacyBefore = {
    nodes: await db.knowledgeNode.count(),
    links: await db.knowledgeLink.count(),
  };
  const expected = {
    canonicalObjects: 103,
    sourceMappings: 125,
    goldRelations: 38,
    silverRelations: 3,
    sourceObjects: 1165,
    evidenceSegments: 2753,
  };
  assert.deepEqual(await importValidatedRelease(db, validated), expected);
  assert.deepEqual(await importValidatedRelease(db, validated), expected);

  assert.equal(await db.actkgRelease.count(), 1);
  assert.equal(await db.actkgAuthoritativeObject.count(), expected.canonicalObjects);
  assert.equal(await db.actkgSourceMapping.count(), expected.sourceMappings);
  assert.equal(await db.actkgAuthoritativeRelation.count({ where: { qualityTier: 'GOLD' } }), expected.goldRelations);
  assert.equal(await db.actkgAuthoritativeRelation.count({ where: { qualityTier: 'SILVER' } }), expected.silverRelations);
  assert.equal(await db.actkgSourceObject.count(), expected.sourceObjects);
  assert.equal(await db.actkgEvidenceSegment.count(), expected.evidenceSegments);
  assert.deepEqual({
    nodes: await db.knowledgeNode.count(),
    links: await db.knowledgeLink.count(),
  }, legacyBefore);

  const receipt = await db.actkgImportReceipt.findUniqueOrThrow({
    where: { releaseId: validated.entry.release_id },
  });
  assert.equal(receipt.sourceRun, 'v14p-fd0216551aa62debe2ef6209');
  assert.equal(receipt.sourceImplementationCommit, '52fc3ef1e03b991cbac0d534497736c2d51633d6');
  assert.equal(receipt.captureRevision, validated.captureRevision);
  assert.equal(receipt.lockRawHash, validated.lockRawHash);
  assert.equal(receipt.ctkgDatasetAvailability, 'UNAVAILABLE');
  assert.equal(receipt.ctkgDatasetHash, null);
  assert.equal(receipt.ctkgDatasetPublicationIdentity, null);
  assert.equal(receipt.ctkgDatasetResolvableLocation, null);
  assert.equal(receipt.revisionRegistryAvailability, 'UNAVAILABLE');
  assert.equal(receipt.revisionRegistryVersion, null);
  assert.equal(receipt.revisionRegistryHash, null);

  const reconstructed = await reconstructRelease(db, validated.entry.release_id);
  const withoutHash = structuredClone(reconstructed);
  delete withoutHash.release_hash;
  assert.equal(sha256(canonicalJson(withoutHash)), validated.entry.release_hash);
  assert.equal(canonicalJson(reconstructed), canonicalJson(validated.release));

  const repository = new AuthoritativeKnowledgeRepository(
    db as unknown as AuthoritativeKnowledgeDatabase,
  );
  const candidateSelector = {
    authorityState: 'candidate' as const,
    releaseSetId: validated.lock.release_set_id,
    releaseId: validated.entry.release_id,
  };
  const candidate = await repository.read(candidateSelector);
  assert.equal(candidate.status, 'available');
  if (candidate.status === 'available') {
    assert.equal(candidate.snapshot.objects.length, expected.canonicalObjects);
    assert.equal(candidate.snapshot.relations.length, expected.goldRelations + expected.silverRelations);
    assert.equal(candidate.snapshot.sourceMappings.length, expected.sourceMappings);
    assert.equal(candidate.snapshot.sourceObjects.length, expected.sourceObjects);
    assert.equal(candidate.snapshot.evidence.length, expected.evidenceSegments);
    assert.equal(candidate.snapshot.productionAuthoritative, false);
  }
  assert.deepEqual(await repository.read({ authorityState: 'active' }), {
    status: 'unavailable',
    selector: { authorityState: 'active' },
    reason: 'active-pointer-unavailable',
    diagnostics: [],
  });

  await db.$executeRawUnsafe('ALTER TABLE "ActkgImportReceipt" DISABLE TRIGGER "ActkgImportReceipt_immutable"');
  await db.$executeRawUnsafe(
    'UPDATE "ActkgImportReceipt" SET "objectCount" = "objectCount" + 1 WHERE "releaseId" = $1',
    validated.entry.release_id,
  );
  await db.$executeRawUnsafe('ALTER TABLE "ActkgImportReceipt" ENABLE TRIGGER "ActkgImportReceipt_immutable"');
  const drift = await repository.read(candidateSelector);
  assert.equal(drift.status, 'drift');
  if (drift.status === 'drift') {
    assert(drift.diagnostics.some((item) => (
      item.code === 'receipt-count-mismatch' && item.field === 'receipt.objectCount'
    )));
  }
  await assert.rejects(importValidatedRelease(db, validated), /different authoritative content/u);
  await db.$executeRawUnsafe('ALTER TABLE "ActkgImportReceipt" DISABLE TRIGGER "ActkgImportReceipt_immutable"');
  await db.$executeRawUnsafe(
    'UPDATE "ActkgImportReceipt" SET "objectCount" = $2 WHERE "releaseId" = $1',
    validated.entry.release_id,
    expected.canonicalObjects,
  );
  await db.$executeRawUnsafe('ALTER TABLE "ActkgImportReceipt" ENABLE TRIGGER "ActkgImportReceipt_immutable"');
  assert.deepEqual(await importValidatedRelease(db, validated), expected);

  for (const table of [
    'ActkgAuthoritativeObject',
    'ActkgAuthoritativeRelation',
    'ActkgSourceObject',
    'ActkgSourceMapping',
    'ActkgEvidenceSegment',
  ]) {
    await assert.rejects(
      db.$executeRawUnsafe(`INSERT INTO "${table}" SELECT * FROM "${table}" LIMIT 1`),
      /sealed by its import receipt/u,
    );
  }

  await assert.rejects(
    db.actkgAuthoritativeObject.update({
      where: {
        releaseId_canonicalId: {
          releaseId: validated.entry.release_id,
          canonicalId: String((validated.release.canonical_nodes as Array<{ id: string }>)[0]!.id),
        },
      },
      data: { reviewStatus: 'mutated' },
    }),
    /immutable/u,
  );

  console.log(JSON.stringify({
    releaseId: validated.entry.release_id,
    candidateState: 'CANDIDATE',
    counts: expected,
    idempotentReimport: true,
    conflictRollback: true,
    roundTripHash: validated.entry.release_hash,
    legacyAuthorityUnchanged: true,
    repositoryCandidateComplete: true,
    repositoryActiveUnavailable: true,
    repositoryDriftDetected: true,
  }));
}

async function run(): Promise<void> {
  try {
    await main();
  } finally {
    if (db) await db.$disconnect();
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [databaseName],
    ).catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => undefined);
    await admin.end().catch(() => undefined);
    if (ephemeralPgCtl && ephemeralDataDir) {
      spawnSync(ephemeralPgCtl, ['-D', ephemeralDataDir, '-m', 'fast', '-w', 'stop'], { encoding: 'utf8' });
    }
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
