import 'dotenv/config';

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
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
import {
  computeCourseCoverageSourceHash,
  importCourseCoverageOverlay,
  validateCourseCoverageOverlay,
  type CourseCoverageOverlay,
} from '../course-coverage/course-coverage-overlay';
import { buildCourseCoverageAdmissionProjection } from '../../src/lib/authoritative-knowledge';
import {
  CanonicalResourceBindingRepository,
  canonicalSha256 as bindingDigest,
  type CanonicalResourceBindingDatabase,
} from '../../src/lib/canonical-resource-binding';

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

function assertBindingSchemaMigrationParity(): void {
  const result = spawnSync(process.execPath, [
    'node_modules/prisma/build/index.js',
    'migrate',
    'diff',
    '--from-config-datasource',
    '--to-schema',
    'prisma/schema.prisma',
    '--script',
  ], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(
    result.stdout,
    /CanonicalResourceBindingDecision_(?:release_fkey|evidence_fkey|releaseSetId_releaseId_fkey|releaseId_evidenceId_fkey)/u,
  );
}

function runDeploymentCli(script: string, mode?: '--verify-only'): string {
  const args = [
    path.join('node_modules', 'tsx', 'dist', 'cli.mjs'),
    script,
    ...(mode ? [mode] : []),
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: testUrl.toString(),
      APP_REVISION: 'b'.repeat(40),
      APP_REVISION_FILE: path.join(tempRoot, 'missing-image-revision'),
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function runBindingVerify(revision: string) {
  return spawnSync(process.execPath, [
    path.join('node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/db/import-canonical-resource-binding-shadow.ts',
    '--verify-only',
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: testUrl.toString(),
      APP_REVISION: revision,
      APP_REVISION_FILE: path.join(tempRoot, 'missing-image-revision'),
    },
    encoding: 'utf8',
  });
}

function runConcurrentBindingImport(revision: string): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join('node_modules', 'tsx', 'dist', 'cli.mjs'),
      'scripts/db/import-canonical-resource-binding-shadow.ts',
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: testUrl.toString(),
        APP_REVISION: revision,
        APP_REVISION_FILE: path.join(tempRoot, 'missing-image-revision'),
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (status) => resolve({ status, stdout, stderr }));
  });
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
  assertBindingSchemaMigrationParity();
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

  const coverageSchema = JSON.parse(readFileSync(
    path.join(
      process.cwd(),
      'course-content/authoring/knowledge/course-coverage/course-coverage-overlay.schema.json',
    ),
    'utf8',
  )) as unknown;
  const coverageSource = JSON.parse(readFileSync(
    path.join(
      process.cwd(),
      'course-content/authoring/knowledge/course-coverage/active/automatic-control.json',
    ),
    'utf8',
  )) as CourseCoverageOverlay;
  const validatedCoverage = await validateCourseCoverageOverlay(
    coverageSource,
    validated,
    coverageSchema,
    { captureRevision: validated.captureRevision },
  );
  assert.deepEqual(await importCourseCoverageOverlay(db, validatedCoverage), {
    versionId: 'automatic-control-root-locus-coverage-v1@1',
    entryCount: 1,
  });
  assert.deepEqual(await importCourseCoverageOverlay(db, validatedCoverage), {
    versionId: 'automatic-control-root-locus-coverage-v1@1',
    entryCount: 1,
  });

  const roleFixtureIds = (
    validated.release.canonical_nodes as Array<{ id: string }>
  ).slice(0, 3).map((row) => row.id);
  const threeRoleSource: CourseCoverageOverlay = {
    ...structuredClone(coverageSource),
    overlayVersion: '2',
    entries: [
      { canonicalId: roleFixtureIds[2]!, role: 'explicit_extension' },
      { canonicalId: roleFixtureIds[0]!, role: 'formal_objective' },
      { canonicalId: roleFixtureIds[1]!, role: 'necessary_prerequisite' },
    ],
  };
  threeRoleSource.sourceHash = computeCourseCoverageSourceHash(threeRoleSource);
  const threeRoleCoverage = await validateCourseCoverageOverlay(
    threeRoleSource,
    validated,
    coverageSchema,
    { captureRevision: validated.captureRevision },
  );
  assert.deepEqual(await importCourseCoverageOverlay(db, threeRoleCoverage), {
    versionId: 'automatic-control-root-locus-coverage-v1@2',
    entryCount: 3,
  });

  for (const script of [
    'scripts/db/import-authoritative-actkg-release.ts',
    'scripts/db/import-course-coverage-overlay.ts',
  ]) {
    assert.match(runDeploymentCli(script), /"mode":"import"/u);
    assert.match(runDeploymentCli(script, '--verify-only'), /"mode":"verify-only"/u);
  }
  const bindingImportOutput = JSON.parse(runDeploymentCli(
    'scripts/db/import-canonical-resource-binding-shadow.ts',
  )) as {
    runId: string;
    reused: boolean;
    inventory: {
      summary: {
        itemCount: number;
        includedCount: number;
        excludedCount: number;
        unresolvedCount: number;
      };
    };
  };
  assert.deepEqual(bindingImportOutput.inventory.summary, {
    itemCount: 7050,
    includedCount: 489,
    excludedCount: 3105,
    unresolvedCount: 3456,
  });
  assert.equal(bindingImportOutput.reused, false);
  const bindingRetryOutput = JSON.parse(runDeploymentCli(
    'scripts/db/import-canonical-resource-binding-shadow.ts',
  )) as { runId: string; reused: boolean };
  assert.equal(bindingRetryOutput.runId, bindingImportOutput.runId);
  assert.equal(bindingRetryOutput.reused, true);
  assert.equal(await db.resourceBindingInventoryRun.count({
    where: { captureRevision: 'b'.repeat(40) },
  }), 1);

  const concurrentRevision = 'd'.repeat(40);
  const concurrentImports = await Promise.all([
    runConcurrentBindingImport(concurrentRevision),
    runConcurrentBindingImport(concurrentRevision),
  ]);
  for (const result of concurrentImports) {
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  const concurrentOutputs = concurrentImports.map((result) => (
    JSON.parse(result.stdout) as { runId: string; reused: boolean; itemCount: number }
  ));
  assert.equal(new Set(concurrentOutputs.map((output) => output.runId)).size, 1);
  assert.deepEqual(
    concurrentOutputs.map((output) => output.reused).sort(),
    [false, true],
  );
  const concurrentRun = await db.resourceBindingInventoryRun.findFirstOrThrow({
    where: { captureRevision: concurrentRevision },
    include: { items: true },
  });
  assert.equal(concurrentRun.items.length, 7050);
  assert.equal(await db.resourceBindingInventoryRun.count({
    where: { captureRevision: concurrentRevision },
  }), 1);
  assert.match(
    runDeploymentCli('scripts/db/import-canonical-resource-binding-shadow.ts', '--verify-only'),
    /"mode":"verify-only"/u,
  );
  const bindingInventory = await db.resourceBindingInventoryRun.findFirstOrThrow({
    where: { captureRevision: 'b'.repeat(40) },
    orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
    include: { items: true },
  });
  assert.equal(bindingInventory.complete, true);
  assert.equal(bindingInventory.cutoverReady, false);
  assert.equal(bindingInventory.authorityState, 'SHADOW');
  assert.equal(bindingInventory.items.length, bindingInventory.itemCount);
  assert(bindingInventory.unresolvedCount > 0);
  assert.notEqual(runBindingVerify('c'.repeat(40)).status, 0);
  await db.$executeRawUnsafe(
    'ALTER TABLE "ResourceBindingInventoryRun" DISABLE TRIGGER "ResourceBindingInventoryRun_immutable"',
  );
  await db.resourceBindingInventoryRun.update({
    where: { id: bindingInventory.id },
    data: { complete: false },
  });
  assert.notEqual(runBindingVerify('b'.repeat(40)).status, 0);
  await db.resourceBindingInventoryRun.update({
    where: { id: bindingInventory.id },
    data: { complete: true },
  });
  await db.$executeRawUnsafe(
    'ALTER TABLE "ResourceBindingInventoryRun" ENABLE TRIGGER "ResourceBindingInventoryRun_immutable"',
  );
  assert.equal(await db.actkgEvidenceStructuralUnitCrosswalk.count(), 0);
  assert.equal(await db.canonicalResourceBindingDecision.count(), 0);
  assert.equal(
    (await db.actkgRelease.findUniqueOrThrow({
      where: { id: validated.entry.release_id },
      select: { captureRevision: true },
    })).captureRevision,
    validated.captureRevision,
  );
  assert.equal(
    (await db.courseCoverageOverlayVersion.findUniqueOrThrow({
      where: { id: validatedCoverage.versionId },
      select: { captureRevision: true },
    })).captureRevision,
    validatedCoverage.captureRevision,
  );

  for (const mutate of [
    (overlay: CourseCoverageOverlay) => {
      overlay.entries[0]!.canonicalId = 'ctc:missing-object';
    },
    (overlay: CourseCoverageOverlay) => {
      overlay.entries[0]!.role = 'unsupported' as never;
    },
    (overlay: CourseCoverageOverlay) => {
      overlay.entries.push(structuredClone(overlay.entries[0]!));
    },
    (overlay: CourseCoverageOverlay) => {
      overlay.releaseHash = 'f'.repeat(64);
    },
  ]) {
    const invalid = structuredClone(threeRoleSource);
    invalid.overlayVersion = '3';
    mutate(invalid);
    invalid.sourceHash = computeCourseCoverageSourceHash(invalid);
    await assert.rejects(
      validateCourseCoverageOverlay(
        invalid,
        validated,
        coverageSchema,
        { captureRevision: validated.captureRevision },
      ),
    );
  }
  assert.equal(await db.courseCoverageOverlayVersion.count(), 2);

  const conflicting = structuredClone(threeRoleSource);
  conflicting.entries = conflicting.entries.slice(0, 2);
  conflicting.sourceHash = computeCourseCoverageSourceHash(conflicting);
  const validatedConflict = await validateCourseCoverageOverlay(
    conflicting,
    validated,
    coverageSchema,
    { captureRevision: validated.captureRevision },
  );
  await assert.rejects(
    importCourseCoverageOverlay(db, validatedConflict),
    /already exists with different content/u,
  );
  assert.equal(await db.courseCoverageOverlayVersion.count(), 2);
  assert.equal(await db.courseCoverageOverlayEntry.count(), 4);

  const coverageSelector = {
    courseId: coverageSource.courseId,
    overlayId: coverageSource.overlayId,
    overlayVersion: coverageSource.overlayVersion,
    releaseSetId: coverageSource.releaseSetId,
    releaseId: coverageSource.releaseId,
  };

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
  assert.equal((await repository.read(candidateSelector)).status, 'available');
  const coverage = await repository.readCourseCoverage(coverageSelector);
  assert.equal(coverage.status, 'available');
  if (coverage.status === 'available') {
    assert.equal(coverage.entries.length, 1);
    assert.equal(
      coverage.entries[0]!.canonicalId,
      'ctc:v11g-5845390ded447e37f06ea222',
    );
    assert.equal(coverage.entries[0]!.role, 'formal_objective');
    assert.equal(coverage.productionAuthoritative, false);
    for (const target of ['recommendation', 'kaq', 'path', 'assessment', 'new-fact'] as const) {
      assert.deepEqual(
        buildCourseCoverageAdmissionProjection(coverage, target).coveredCanonicalIds,
        ['ctc:v11g-5845390ded447e37f06ea222'],
      );
    }
  }
  assert.deepEqual(await repository.readCourseCoverage(), {
    status: 'unavailable',
    selector: null,
    reason: 'missing-selector',
    diagnostics: [],
    productionAuthoritative: false,
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

  await db.$executeRawUnsafe(
    'ALTER TABLE "CourseCoverageImportReceipt" DISABLE TRIGGER "CourseCoverageImportReceipt_immutable"',
  );
  await db.$executeRawUnsafe(
    'UPDATE "CourseCoverageImportReceipt" SET "entryCount" = "entryCount" + 1 WHERE "overlayVersionId" = $1',
    validatedCoverage.versionId,
  );
  await db.$executeRawUnsafe(
    'ALTER TABLE "CourseCoverageImportReceipt" ENABLE TRIGGER "CourseCoverageImportReceipt_immutable"',
  );
  const coverageDrift = await repository.readCourseCoverage(coverageSelector);
  assert.equal(coverageDrift.status, 'drift');
  assert.deepEqual(
    buildCourseCoverageAdmissionProjection(coverageDrift, 'assessment').coveredCanonicalIds,
    [],
  );
  await db.$executeRawUnsafe(
    'ALTER TABLE "CourseCoverageImportReceipt" DISABLE TRIGGER "CourseCoverageImportReceipt_immutable"',
  );
  await db.$executeRawUnsafe(
    'UPDATE "CourseCoverageImportReceipt" SET "entryCount" = $2 WHERE "overlayVersionId" = $1',
    validatedCoverage.versionId,
    validatedCoverage.entries.length,
  );
  await db.$executeRawUnsafe(
    'ALTER TABLE "CourseCoverageImportReceipt" ENABLE TRIGGER "CourseCoverageImportReceipt_immutable"',
  );

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

  await assert.rejects(
    db.courseCoverageOverlayEntry.create({
      data: {
        overlayVersionId: validatedCoverage.versionId,
        releaseId: validatedCoverage.overlay.releaseId,
        canonicalId: roleFixtureIds[0]!,
        role: 'explicit_extension',
        ordinal: 99,
      },
    }),
    /sealed by the import receipt/u,
  );
  await assert.rejects(
    db.courseCoverageOverlayEntry.update({
      where: {
        overlayVersionId_canonicalId_role: {
          overlayVersionId: validatedCoverage.versionId,
          canonicalId: validatedCoverage.entries[0]!.canonicalId,
          role: validatedCoverage.entries[0]!.role,
        },
      },
      data: { ordinal: 99 },
    }),
    /sealed by the import receipt/u,
  );
  await assert.rejects(
    db.courseCoverageOverlayEntry.delete({
      where: {
        overlayVersionId_canonicalId_role: {
          overlayVersionId: validatedCoverage.versionId,
          canonicalId: validatedCoverage.entries[0]!.canonicalId,
          role: validatedCoverage.entries[0]!.role,
        },
      },
    }),
    /sealed by the import receipt/u,
  );

  const includedResource = await db.resourceBindingInventoryItem.findFirstOrThrow({
    where: { runId: bindingInventory.id, disposition: 'INCLUDED' },
    orderBy: { atomicResourceId: 'asc' },
  });
  const evidence = await db.actkgEvidenceSegment.findFirstOrThrow({
    where: { releaseId: validated.entry.release_id },
    orderBy: { ordinal: 'asc' },
  });
  const canonicalId = String(
    (validated.release.canonical_nodes as Array<{ id: string }>)[0]!.id,
  );
  const crosswalkProjection = {
    releaseId: validated.entry.release_id,
    evidenceId: evidence.evidenceId,
    evidenceContentHash: evidence.contentHash,
    inventoryRunId: bindingInventory.id,
    atomicResourceId: includedResource.atomicResourceId,
    resourceId: includedResource.resourceId,
    structuralUnitId: includedResource.structuralUnitId,
    segmentId: includedResource.segmentId,
    resourceSegmentHash: includedResource.resourceSegmentHash,
    captureRevision: bindingInventory.captureRevision,
    canonicalId,
  };
  const crosswalkBase = {
    ...crosswalkProjection,
    sourceEditionId: evidence.sourceEditionId,
    sourceVersion: 'postgres-test/v1',
    structuralUnitHash: includedResource.resourceSegmentHash,
    validationState: 'VALIDATED',
    validationDigest: bindingDigest(crosswalkProjection),
  };
  await assert.rejects(db.actkgEvidenceStructuralUnitCrosswalk.create({
    data: {
      id: 'postgres-crosswalk-wrong-version',
      ...crosswalkBase,
      structuralUnitVersion: 'c'.repeat(40),
    },
  }), /invalid or stale/u);
  await assert.rejects(db.actkgEvidenceStructuralUnitCrosswalk.create({
    data: {
      id: 'postgres-crosswalk-wrong-hash',
      ...crosswalkBase,
      structuralUnitVersion: bindingInventory.captureRevision,
      structuralUnitHash: sha256('wrong-structural-unit'),
    },
  }), /invalid or stale/u);
  const crosswalk = await db.actkgEvidenceStructuralUnitCrosswalk.create({
    data: {
      id: 'postgres-crosswalk',
      ...crosswalkBase,
      structuralUnitVersion: bindingInventory.captureRevision,
    },
  });
  const decisionBase = {
    pairId: 'postgres-pair',
    releaseSetId: validated.lock.release_set_id,
    releaseId: validated.entry.release_id,
    canonicalId,
    objectRevision: validated.entry.release_hash,
    resourceId: includedResource.resourceId,
    structuralUnitId: includedResource.structuralUnitId,
    segmentId: includedResource.segmentId,
    resourceSegmentHash: includedResource.resourceSegmentHash,
    role: 'EXPLAINS',
    evidenceId: evidence.evidenceId,
    evidenceDigest: sha256(evidence.evidenceId),
    generatorPromptVersion: 'postgres-generator/v1',
    reviewerPromptVersion: 'postgres-reviewer/v1',
    generatorCacheKey: sha256('postgres-generator-cache'),
    reviewerCacheKey: sha256('postgres-reviewer-cache'),
    reviewerRole: 'INDEPENDENT_REVIEWER',
    reviewerInputDigest: sha256('postgres-review-input'),
    candidateDigest: sha256('postgres-candidate'),
    reviewProvider: 'GPT',
    reviewState: 'ACCEPTED',
    lifecycleState: 'CURRENT',
    attemptSequence: 1,
    supersedesDecisionId: null,
    highImpactPolicyVersion: 'binding-impact/v1',
    highImpactReasons: [],
  };
  await assert.rejects(db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-no-crosswalk',
      ...decisionBase,
      publicationState: 'SHADOW_PUBLISHED',
      crosswalkId: null,
      validationDigest: null,
    },
  }), /exact validated crosswalk/u);
  await assert.rejects(db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-stale-revision',
      ...decisionBase,
      objectRevision: sha256('stale-release'),
      publicationState: 'SHADOW_PUBLISHED',
      crosswalkId: crosswalk.id,
      validationDigest: crosswalk.validationDigest,
    },
  }), /release revision/u);
  await assert.rejects(db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-fixture-direct',
      ...decisionBase,
      reviewProvider: 'FIXTURE',
      publicationState: 'SHADOW_PUBLISHED',
      crosswalkId: crosswalk.id,
      validationDigest: crosswalk.validationDigest,
    },
  }), /review state is not authoritative/u);
  await db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-published',
      ...decisionBase,
      publicationState: 'SHADOW_PUBLISHED',
      crosswalkId: crosswalk.id,
      validationDigest: crosswalk.validationDigest,
    },
  });
  await assert.rejects(db.canonicalResourceBindingDecision.update({
    where: { id: 'postgres-published' },
    data: { lifecycleState: 'SUPERSEDED' },
  }), /replacement/u);
  await db.$transaction(async (transaction) => {
    await transaction.canonicalResourceBindingDecision.create({
      data: {
        id: 'postgres-published-replacement',
        ...decisionBase,
        reviewerPromptVersion: 'postgres-reviewer/v2',
        reviewerInputDigest: sha256('postgres-review-input-v2'),
        attemptSequence: 2,
        supersedesDecisionId: 'postgres-published',
        publicationState: 'CANDIDATE',
        crosswalkId: crosswalk.id,
        validationDigest: crosswalk.validationDigest,
      },
    });
    await transaction.canonicalResourceBindingDecision.update({
      where: { id: 'postgres-published' },
      data: { lifecycleState: 'SUPERSEDED' },
    });
    await transaction.canonicalResourceBindingDecision.update({
      where: { id: 'postgres-published-replacement' },
      data: { publicationState: 'SHADOW_PUBLISHED' },
    });
  });
  assert.equal(await db.canonicalResourceBindingDecision.count({
    where: {
      pairId: decisionBase.pairId,
      role: decisionBase.role,
      lifecycleState: 'CURRENT',
      publicationState: 'SHADOW_PUBLISHED',
    },
  }), 1);
  await assert.rejects(db.canonicalResourceBindingDecision.update({
    where: { id: 'postgres-published-replacement' },
    data: { lifecycleState: 'SUPERSEDED' },
  }), /replacement/u);
  await db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-out-of-transaction-replacement',
      ...decisionBase,
      reviewerPromptVersion: 'postgres-reviewer/v3',
      reviewerInputDigest: sha256('postgres-review-input-v3'),
      attemptSequence: 3,
      supersedesDecisionId: 'postgres-published-replacement',
      publicationState: 'CANDIDATE',
      crosswalkId: crosswalk.id,
      validationDigest: crosswalk.validationDigest,
    },
  });
  await assert.rejects(db.canonicalResourceBindingDecision.update({
    where: { id: 'postgres-published-replacement' },
    data: { lifecycleState: 'SUPERSEDED' },
  }), /replacement/u);
  const repositoryPublished = {
    ...decisionBase,
    id: 'postgres-repository-published',
    pairId: 'postgres-repository-pair',
    role: 'REFERENCES' as const,
    trigger: 'RESOURCE_CHANGE' as const,
    proposedRole: 'REFERENCES' as const,
    evidenceIds: [evidence.evidenceId],
    publicationState: 'SHADOW_PUBLISHED' as const,
    crosswalkId: crosswalk.id,
    validationDigest: crosswalk.validationDigest,
  };
  const {
    trigger: _repositoryTrigger,
    proposedRole: _repositoryProposedRole,
    evidenceIds: _repositoryEvidenceIds,
    ...repositoryPublishedData
  } = repositoryPublished;
  await db.canonicalResourceBindingDecision.create({
    data: repositoryPublishedData,
  });
  const bindingRepository = new CanonicalResourceBindingRepository(
    db as unknown as CanonicalResourceBindingDatabase,
  );
  const repositoryReplacement = {
    ...repositoryPublished,
    id: 'postgres-repository-replacement',
    reviewerPromptVersion: 'postgres-reviewer/v2',
    reviewerInputDigest: sha256('postgres-repository-input-v2'),
    attemptSequence: 2,
    supersedesDecisionId: repositoryPublished.id,
  };
  await bindingRepository.persistDecisions([repositoryReplacement], {
    canonicalObjects: [{
      releaseSetId: validated.lock.release_set_id,
      releaseId: validated.entry.release_id,
      canonicalId,
      objectRevision: validated.entry.release_hash,
      canonicalType: 'DomainConcept',
    }],
    crosswalks: [crosswalk],
    evidenceAlignments: [{
      releaseId: validated.entry.release_id,
      evidenceId: evidence.evidenceId,
      canonicalId,
    }],
    existingPublished: [repositoryPublished],
  });
  assert.equal(
    (await db.canonicalResourceBindingDecision.findUniqueOrThrow({
      where: { id: repositoryPublished.id },
    })).lifecycleState,
    'SUPERSEDED',
  );
  assert.equal(
    (await db.canonicalResourceBindingDecision.findUniqueOrThrow({
      where: { id: repositoryReplacement.id },
    })).publicationState,
    'SHADOW_PUBLISHED',
  );
  assert.notEqual(runBindingVerify('b'.repeat(40)).status, 0);

  await db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-retry-1',
      ...decisionBase,
      pairId: 'postgres-retry-pair',
      reviewerInputDigest: sha256('postgres-retry-input'),
      reviewState: 'REVIEW_RETRYABLE',
      publicationState: 'REVIEW_RETRYABLE',
      crosswalkId: null,
      validationDigest: null,
    },
  });
  await db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-retry-2',
      ...decisionBase,
      pairId: 'postgres-retry-pair',
      reviewerInputDigest: sha256('postgres-retry-input'),
      reviewerPromptVersion: 'postgres-reviewer/v2',
      attemptSequence: 2,
      supersedesDecisionId: 'postgres-retry-1',
      reviewState: 'REVIEW_RETRYABLE',
      publicationState: 'REVIEW_RETRYABLE',
      crosswalkId: null,
      validationDigest: null,
    },
  });
  await db.canonicalResourceBindingDecision.update({
    where: { id: 'postgres-retry-1' },
    data: { lifecycleState: 'SUPERSEDED' },
  });
  assert.equal(
    (await db.canonicalResourceBindingDecision.findUniqueOrThrow({
      where: { id: 'postgres-retry-1' },
    })).lifecycleState,
    'SUPERSEDED',
  );
  const decisionHistory = await bindingRepository.readShadowRoleBindings(
    validated.entry.release_id,
  );
  assert(decisionHistory.some((row) => (
    row.id === 'postgres-retry-1' && row.lifecycleState === 'SUPERSEDED'
  )));
  assert(decisionHistory.some((row) => (
    row.id === 'postgres-retry-2' && row.lifecycleState === 'CURRENT'
  )));

  const humanInputDigest = sha256('postgres-human-input');
  const humanContextDigest = sha256('postgres-human-context');
  await db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-human-queued',
      ...decisionBase,
      pairId: 'postgres-human-pair',
      role: 'PRACTICES',
      reviewerInputDigest: humanInputDigest,
      reviewProvider: 'FIXTURE',
      reviewState: 'HUMAN_REQUIRED',
      publicationState: 'HUMAN_REQUIRED',
      crosswalkId: null,
      validationDigest: null,
      highImpactReasons: ['fixture-review-not-authoritative'],
    },
  });
  await db.canonicalResourceBindingHumanQueueItem.create({
    data: {
      id: 'postgres-human-queue',
      bindingDecisionId: 'postgres-human-queued',
      reasonCodes: ['fixture-review-not-authoritative'],
      contextDigest: humanContextDigest,
      inputDigest: humanInputDigest,
    },
  });
  await assert.rejects(db.canonicalResourceBindingHumanQueueItem.update({
    where: { id: 'postgres-human-queue' },
    data: { reasonCodes: [] },
  }), /immutable/u);
  await assert.rejects(db.canonicalResourceBindingHumanQueueItem.delete({
    where: { id: 'postgres-human-queue' },
  }), /immutable/u);
  await db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-human-accepted',
      ...decisionBase,
      pairId: 'postgres-human-pair',
      role: 'PRACTICES',
      reviewerInputDigest: humanInputDigest,
      reviewerPromptVersion: 'human-adjudication/v1',
      reviewProvider: 'HUMAN',
      attemptSequence: 2,
      supersedesDecisionId: 'postgres-human-queued',
      publicationState: 'SHADOW_PUBLISHED',
      crosswalkId: crosswalk.id,
      validationDigest: crosswalk.validationDigest,
      highImpactReasons: ['fixture-review-not-authoritative'],
    },
  });
  await db.canonicalResourceBindingDecision.update({
    where: { id: 'postgres-human-queued' },
    data: { lifecycleState: 'SUPERSEDED' },
  });
  await assert.rejects(db.canonicalResourceBindingHumanDecisionReceipt.create({
    data: {
      id: 'postgres-human-receipt-contradiction',
      queueId: 'postgres-human-queue',
      actorId: 'teacher-reviewer',
      decidedAt: new Date('2026-07-28T12:29:00.000Z'),
      outcome: 'REJECT',
      rationale: '矛盾裁决必须失败。',
      contextDigest: humanContextDigest,
      inputDigest: humanInputDigest,
      decisionId: 'postgres-human-accepted',
    },
  }), /does not bind/u);
  await db.canonicalResourceBindingHumanDecisionReceipt.create({
    data: {
      id: 'postgres-human-receipt',
      queueId: 'postgres-human-queue',
      actorId: 'teacher-reviewer',
      decidedAt: new Date('2026-07-28T12:30:00.000Z'),
      outcome: 'ACCEPT',
      rationale: '已核对证据与资源端点。',
      contextDigest: humanContextDigest,
      inputDigest: humanInputDigest,
      decisionId: 'postgres-human-accepted',
    },
  });
  await assert.rejects(db.canonicalResourceBindingHumanDecisionReceipt.create({
    data: {
      id: 'postgres-human-receipt-replay',
      queueId: 'postgres-human-queue',
      actorId: 'teacher-reviewer',
      decidedAt: new Date('2026-07-28T12:31:00.000Z'),
      outcome: 'ACCEPT',
      rationale: '重复裁决。',
      contextDigest: humanContextDigest,
      inputDigest: humanInputDigest,
      decisionId: 'postgres-human-accepted',
    },
  }));
  await assert.rejects(db.canonicalResourceBindingHumanDecisionReceipt.update({
    where: { id: 'postgres-human-receipt' },
    data: { rationale: '修改后的理由。' },
  }), /immutable/u);
  await assert.rejects(db.canonicalResourceBindingHumanDecisionReceipt.delete({
    where: { id: 'postgres-human-receipt' },
  }), /immutable/u);
  await assert.rejects(
    db.resourceBindingInventoryRun.update({
      where: { id: bindingInventory.id },
      data: { cutoverReady: true },
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
    courseCoverageEntryCount: 1,
    courseCoverageThreeRoleFixture: true,
    courseCoverageIdempotentReimport: true,
    courseCoverageConflictRollback: true,
    courseCoverageReceiptSealed: true,
    courseCoverageAdmissionTargetsBounded: true,
    deploymentCliExistingCaptureRevisionReused: true,
    resourceBindingInventoryComplete: true,
    resourceBindingCutoverBlocked: true,
    resourceBindingAuthorityLegacy: true,
    resourceBindingInventoryCounts: bindingImportOutput.inventory.summary,
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
