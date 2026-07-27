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
  assert.doesNotMatch(
    result.stdout,
    /CanonicalResourceBindingDecision_releaseId_crosswalkId_inv_fkey|ActkgEvidenceStructuralUnitCrosswalk_releaseId_id_inventory_key/u,
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
  const missingBindingVerify = runBindingVerify('c'.repeat(40));
  assert.notEqual(missingBindingVerify.status, 0);
  assert.match(
    missingBindingVerify.stderr,
    /current resource binding inventory .* is missing/u,
  );
  await db.$executeRawUnsafe(
    'ALTER TABLE "ResourceBindingInventoryRun" DISABLE TRIGGER "ResourceBindingInventoryRun_immutable"',
  );
  await db.resourceBindingInventoryRun.update({
    where: { id: bindingInventory.id },
    data: { complete: false },
  });
  const incompleteBindingVerify = runBindingVerify('b'.repeat(40));
  assert.notEqual(incompleteBindingVerify.status, 0);
  assert.match(
    incompleteBindingVerify.stderr,
    /persisted resource binding inventory is missing or incomplete/u,
  );
  await db.resourceBindingInventoryRun.update({
    where: { id: bindingInventory.id },
    data: { complete: true },
  });
  await db.$executeRawUnsafe(
    'ALTER TABLE "ResourceBindingInventoryRun" ENABLE TRIGGER "ResourceBindingInventoryRun_immutable"',
  );

  const verifyIdentityAuthorId = 'binding-verify-identity-author';
  const verifyIdentityResourceId = 'binding-verify-identity-resource';
  const verifyIdentityRevision = '9'.repeat(40);
  const verifyIdentityConfigA = {
    resourceNodePlanning: { pathEligible: true },
    verifyRunIdentity: 'A',
  };
  await db.user.create({
    data: {
      id: verifyIdentityAuthorId,
      email: 'binding-verify-identity@example.test',
      role: 'TEACHER',
    },
  });
  await db.teachingResource.create({
    data: {
      id: verifyIdentityResourceId,
      title: 'Resource binding verify identity fixture',
      type: 'STATIC_TEXT',
      config: verifyIdentityConfigA,
      authorId: verifyIdentityAuthorId,
    },
  });
  const verifyIdentityImportA = await runConcurrentBindingImport(verifyIdentityRevision);
  assert.equal(
    verifyIdentityImportA.status,
    0,
    verifyIdentityImportA.stderr || verifyIdentityImportA.stdout,
  );
  const verifyIdentityOutputA = JSON.parse(verifyIdentityImportA.stdout) as {
    runId: string;
  };
  await db.teachingResource.update({
    where: { id: verifyIdentityResourceId },
    data: {
      config: {
        resourceNodePlanning: { pathEligible: true },
        verifyRunIdentity: 'B',
      },
    },
  });
  const verifyIdentityImportB = await runConcurrentBindingImport(verifyIdentityRevision);
  assert.equal(
    verifyIdentityImportB.status,
    0,
    verifyIdentityImportB.stderr || verifyIdentityImportB.stdout,
  );
  const verifyIdentityOutputB = JSON.parse(verifyIdentityImportB.stdout) as {
    runId: string;
  };
  assert.notEqual(verifyIdentityOutputB.runId, verifyIdentityOutputA.runId);
  const verifyIdentityRunA = await db.resourceBindingInventoryRun.findUniqueOrThrow({
    where: { id: verifyIdentityOutputA.runId },
  });
  await db.$executeRawUnsafe(
    'ALTER TABLE "ResourceBindingInventoryRun" DISABLE TRIGGER "ResourceBindingInventoryRun_immutable"',
  );
  try {
    await db.resourceBindingInventoryRun.update({
      where: { id: verifyIdentityOutputB.runId },
      data: { capturedAt: new Date(verifyIdentityRunA.capturedAt.getTime() + 60_000) },
    });
  } finally {
    await db.$executeRawUnsafe(
      'ALTER TABLE "ResourceBindingInventoryRun" ENABLE TRIGGER "ResourceBindingInventoryRun_immutable"',
    );
  }
  await db.teachingResource.update({
    where: { id: verifyIdentityResourceId },
    data: { config: verifyIdentityConfigA },
  });
  const verifyIdentityResult = runBindingVerify(verifyIdentityRevision);
  assert.equal(
    verifyIdentityResult.status,
    0,
    verifyIdentityResult.stderr || verifyIdentityResult.stdout,
  );
  assert.equal(
    (JSON.parse(verifyIdentityResult.stdout) as { runId: string }).runId,
    verifyIdentityOutputA.runId,
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
  const authoritativeAlignment = await db.$queryRaw<Array<{
    canonicalId: string;
    evidenceId: string;
  }>>`
    WITH evidence_alignments AS (
      SELECT DISTINCT
        mapping."canonicalId" AS canonical_id,
        evidence_id.value AS evidence_id
      FROM "ActkgSourceMapping" mapping
      JOIN "ActkgSourceObject" source_object
        ON source_object."releaseId" = mapping."releaseId"
       AND source_object."sourceObjectId" = mapping."sourceObjectId"
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(source_object."payload"->'evidence_segment_ids') = 'array'
          THEN source_object."payload"->'evidence_segment_ids'
          ELSE '[]'::jsonb
        END
      ) evidence_id(value)
      WHERE mapping."releaseId" = ${validated.entry.release_id}
    )
    SELECT
      min(canonical_id) AS "canonicalId",
      evidence_id AS "evidenceId"
    FROM evidence_alignments
    GROUP BY evidence_id
    HAVING count(DISTINCT canonical_id) = 1
    ORDER BY evidence_id
    LIMIT 1
  `;
  assert.equal(authoritativeAlignment.length, 1);
  const canonicalId = authoritativeAlignment[0]!.canonicalId;
  const evidence = await db.actkgEvidenceSegment.findUniqueOrThrow({
    where: {
      releaseId_evidenceId: {
        releaseId: validated.entry.release_id,
        evidenceId: authoritativeAlignment[0]!.evidenceId,
      },
    },
  });
  const mismatchedCanonical = await db.actkgAuthoritativeObject.findFirstOrThrow({
    where: {
      releaseId: validated.entry.release_id,
      canonicalId: { not: canonicalId },
    },
    orderBy: { ordinal: 'asc' },
  });
  const ambiguousAlignments = await db.$queryRaw<Array<{
    canonicalId: string;
    evidenceId: string;
  }>>`
    WITH evidence_alignments AS (
      SELECT DISTINCT
        mapping."canonicalId" AS canonical_id,
        evidence_id.value AS evidence_id
      FROM "ActkgSourceMapping" mapping
      JOIN "ActkgSourceObject" source_object
        ON source_object."releaseId" = mapping."releaseId"
       AND source_object."sourceObjectId" = mapping."sourceObjectId"
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(source_object."payload"->'evidence_segment_ids') = 'array'
          THEN source_object."payload"->'evidence_segment_ids'
          ELSE '[]'::jsonb
        END
      ) evidence_id(value)
      WHERE mapping."releaseId" = ${validated.entry.release_id}
    ),
    ambiguous AS (
      SELECT evidence_id
      FROM evidence_alignments
      GROUP BY evidence_id
      HAVING count(DISTINCT canonical_id) > 1
      ORDER BY evidence_id
      LIMIT 1
    )
    SELECT
      alignment.canonical_id AS "canonicalId",
      alignment.evidence_id AS "evidenceId"
    FROM evidence_alignments alignment
    JOIN ambiguous USING (evidence_id)
    ORDER BY alignment.canonical_id
  `;
  assert(ambiguousAlignments.length > 1);
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
    validationState: 'VALIDATED' as const,
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
  const bindingRepository = new CanonicalResourceBindingRepository(
    db as unknown as CanonicalResourceBindingDatabase,
  );
  const mismatchedProjection = {
    ...crosswalkProjection,
    canonicalId: mismatchedCanonical.canonicalId,
  };
  const mismatchedCrosswalk = {
    id: 'postgres-crosswalk-mismatched-canonical',
    ...crosswalkBase,
    ...mismatchedProjection,
    structuralUnitVersion: bindingInventory.captureRevision,
    validationDigest: bindingDigest(mismatchedProjection),
  };
  await assert.rejects(
    bindingRepository.persistEvidenceCrosswalks([mismatchedCrosswalk]),
    /authoritative evidence alignment/u,
  );
  await assert.rejects(
    db.actkgEvidenceStructuralUnitCrosswalk.create({ data: mismatchedCrosswalk }),
    /not authoritatively mapped/u,
  );
  const ambiguousEvidence = await db.actkgEvidenceSegment.findUniqueOrThrow({
    where: {
      releaseId_evidenceId: {
        releaseId: validated.entry.release_id,
        evidenceId: ambiguousAlignments[0]!.evidenceId,
      },
    },
  });
  const ambiguousProjection = {
    ...crosswalkProjection,
    evidenceId: ambiguousEvidence.evidenceId,
    evidenceContentHash: ambiguousEvidence.contentHash,
    canonicalId: ambiguousAlignments[0]!.canonicalId,
  };
  const ambiguousCrosswalk = {
    id: 'postgres-crosswalk-ambiguous-evidence',
    ...crosswalkBase,
    ...ambiguousProjection,
    sourceEditionId: ambiguousEvidence.sourceEditionId,
    structuralUnitVersion: bindingInventory.captureRevision,
    validationDigest: bindingDigest(ambiguousProjection),
  };
  await assert.rejects(
    bindingRepository.persistEvidenceCrosswalks([ambiguousCrosswalk]),
    /authoritative evidence alignment/u,
  );
  await assert.rejects(
    db.actkgEvidenceStructuralUnitCrosswalk.create({ data: ambiguousCrosswalk }),
    /not authoritatively mapped/u,
  );
  await bindingRepository.persistEvidenceCrosswalks([{
    id: 'postgres-crosswalk',
    ...crosswalkBase,
    structuralUnitVersion: bindingInventory.captureRevision,
  }]);
  const crosswalk = await db.actkgEvidenceStructuralUnitCrosswalk.findUniqueOrThrow({
    where: {
      releaseId_id: {
        releaseId: validated.entry.release_id,
        id: 'postgres-crosswalk',
      },
    },
  });
  const historicalCaptureRevision = 'd'.repeat(40);
  const historicalInventoryRunId = `${bindingInventory.id}:historical`;
  await db.resourceBindingInventoryRun.create({
    data: {
      id: historicalInventoryRunId,
      captureRevision: historicalCaptureRevision,
      capturedAt: new Date('2026-07-28T11:00:00.000Z'),
      dbWatermark: '0/HISTORICAL',
      sourceHash: sha256('historical-inventory-source'),
      itemCount: 1,
      includedCount: 1,
      excludedCount: 0,
      unresolvedCount: 0,
      complete: true,
      cutoverReady: false,
      authorityState: 'SHADOW',
    },
  });
  await db.resourceBindingInventoryItem.create({
    data: {
      runId: historicalInventoryRunId,
      atomicResourceId: includedResource.atomicResourceId,
      resourceId: includedResource.resourceId,
      structuralUnitId: includedResource.structuralUnitId,
      segmentId: includedResource.segmentId,
      resourceSegmentHash: includedResource.resourceSegmentHash,
      disposition: 'INCLUDED',
      reasonCodes: includedResource.reasonCodes,
      sourceObservations: includedResource.sourceObservations,
      observationDigest: includedResource.observationDigest,
    },
  });
  const historicalCrosswalkProjection = {
    ...crosswalkProjection,
    inventoryRunId: historicalInventoryRunId,
    captureRevision: historicalCaptureRevision,
  };
  await bindingRepository.persistEvidenceCrosswalks([{
    id: 'postgres-crosswalk-historical-capture',
    ...crosswalkBase,
    ...historicalCrosswalkProjection,
    structuralUnitVersion: historicalCaptureRevision,
    validationDigest: bindingDigest(historicalCrosswalkProjection),
  }]);
  const historicalCrosswalk = await db.actkgEvidenceStructuralUnitCrosswalk.findUniqueOrThrow({
    where: {
      releaseId_id: {
        releaseId: validated.entry.release_id,
        id: 'postgres-crosswalk-historical-capture',
      },
    },
  });
  const currentCaptureIdentity = {
    inventoryRunId: bindingInventory.id,
    captureRevision: bindingInventory.captureRevision,
    structuralUnitVersion: bindingInventory.captureRevision,
  };
  const unboundDecisionCapture = {
    crosswalkId: null,
    inventoryRunId: null,
    captureRevision: null,
    structuralUnitVersion: null,
    validationDigest: null,
  };
  const currentCrosswalkBinding = {
    crosswalkId: crosswalk.id,
    ...currentCaptureIdentity,
    validationDigest: crosswalk.validationDigest,
  };
  const ambiguousCrosswalkBinding = {
    crosswalkId: ambiguousCrosswalk.id,
    inventoryRunId: ambiguousCrosswalk.inventoryRunId,
    captureRevision: ambiguousCrosswalk.captureRevision,
    structuralUnitVersion: ambiguousCrosswalk.structuralUnitVersion,
    validationDigest: ambiguousCrosswalk.validationDigest,
  };
  const currentCrosswalks = await bindingRepository.readEvidenceCrosswalks(
    validated.entry.release_id,
    currentCaptureIdentity,
  );
  assert.deepEqual(currentCrosswalks.map((row) => row.id), [crosswalk.id]);
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
    ...unboundDecisionCapture,
    highImpactPolicyVersion: 'binding-impact/v1',
    highImpactReasons: [],
  };
  await assert.rejects(db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-no-crosswalk',
      ...decisionBase,
      publicationState: 'SHADOW_PUBLISHED',
      ...unboundDecisionCapture,
    },
  }), /exact validated crosswalk/u);
  await assert.rejects(db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-ambiguous-evidence-publication',
      ...decisionBase,
      pairId: 'postgres-ambiguous-evidence-pair',
      canonicalId: ambiguousAlignments[0]!.canonicalId,
      evidenceId: ambiguousEvidence.evidenceId,
      evidenceDigest: sha256(ambiguousEvidence.evidenceId),
      publicationState: 'SHADOW_PUBLISHED',
      ...ambiguousCrosswalkBinding,
    },
  }), /exact validated crosswalk/u);
  await assert.rejects(db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-stale-revision',
      ...decisionBase,
      objectRevision: sha256('stale-release'),
      publicationState: 'SHADOW_PUBLISHED',
      ...currentCrosswalkBinding,
    },
  }), /release revision/u);
  await assert.rejects(db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-mismatched-canonical-publication',
      ...decisionBase,
      pairId: 'postgres-mismatched-canonical-pair',
      canonicalId: mismatchedCanonical.canonicalId,
      publicationState: 'SHADOW_PUBLISHED',
      ...currentCrosswalkBinding,
    },
  }), /exact validated crosswalk/u);
  await assert.rejects(db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-fixture-direct',
      ...decisionBase,
      reviewProvider: 'FIXTURE',
      publicationState: 'SHADOW_PUBLISHED',
      ...currentCrosswalkBinding,
    },
  }), /review state is not authoritative/u);
  await db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-published',
      ...decisionBase,
      publicationState: 'SHADOW_PUBLISHED',
      ...currentCrosswalkBinding,
    },
  });
  await assert.rejects(db.$executeRawUnsafe(`
    INSERT INTO "CanonicalResourceBindingDecision"
    SELECT (
      jsonb_populate_record(
        NULL::"CanonicalResourceBindingDecision",
        to_jsonb(source) || jsonb_build_object(
          'id', 'postgres-partial-crosswalk-capture',
          'pairId', 'postgres-partial-crosswalk-capture-pair',
          'publicationState', 'CANDIDATE',
          'inventoryRunId', NULL
        )
      )
    ).*
    FROM "CanonicalResourceBindingDecision" source
    WHERE source."id" = 'postgres-published'
  `), /crosswalk_identity_check/u);
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
        ...currentCrosswalkBinding,
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
  await assert.rejects(db.$transaction(async (transaction) => {
    await transaction.canonicalResourceBindingDecision.create({
      data: {
        id: 'postgres-unpromoted-replacement',
        ...decisionBase,
        reviewerPromptVersion: 'postgres-reviewer/v4',
        reviewerInputDigest: sha256('postgres-review-input-v4'),
        attemptSequence: 4,
        supersedesDecisionId: 'postgres-published-replacement',
        publicationState: 'CANDIDATE',
        ...currentCrosswalkBinding,
      },
    });
    await transaction.canonicalResourceBindingDecision.update({
      where: { id: 'postgres-published-replacement' },
      data: { lifecycleState: 'SUPERSEDED' },
    });
  }), /must be CURRENT SHADOW_PUBLISHED at transaction commit/u);
  await db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-out-of-transaction-replacement',
      ...decisionBase,
      reviewerPromptVersion: 'postgres-reviewer/v3',
      reviewerInputDigest: sha256('postgres-review-input-v3'),
      attemptSequence: 3,
      supersedesDecisionId: 'postgres-published-replacement',
      publicationState: 'CANDIDATE',
      ...currentCrosswalkBinding,
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
    ...currentCrosswalkBinding,
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
  const repositoryReplacement = {
    ...repositoryPublished,
    id: 'postgres-repository-replacement',
    reviewerPromptVersion: 'postgres-reviewer/v2',
    reviewerInputDigest: sha256('postgres-repository-input-v2'),
    attemptSequence: 2,
    supersedesDecisionId: repositoryPublished.id,
  };
  const repositoryContext = {
    captureIdentity: currentCaptureIdentity,
    canonicalObjects: [{
      releaseSetId: validated.lock.release_set_id,
      releaseId: validated.entry.release_id,
      canonicalId,
      objectRevision: validated.entry.release_hash,
      canonicalType: 'DomainConcept',
    }],
    crosswalks: [historicalCrosswalk, crosswalk],
    evidenceAlignments: [{
      releaseId: validated.entry.release_id,
      evidenceId: evidence.evidenceId,
      canonicalId,
    }],
    existingPublished: [repositoryPublished],
  };
  await assert.rejects(bindingRepository.persistDecisions([{
    ...repositoryReplacement,
    id: 'postgres-repository-partial-crosswalk-capture',
    pairId: 'postgres-repository-partial-crosswalk-capture-pair',
    supersedesDecisionId: null,
    inventoryRunId: null,
  }], {
    ...repositoryContext,
    existingPublished: [],
  }), /bypasses publication gates/u);
  await bindingRepository.persistDecisions([repositoryReplacement], repositoryContext);
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
  await assert.rejects(bindingRepository.persistDecisions([{
    ...repositoryReplacement,
    id: 'postgres-repository-nonpublished-replacement',
    reviewerPromptVersion: 'postgres-reviewer/v3',
    reviewerInputDigest: sha256('postgres-repository-input-v3'),
    attemptSequence: 3,
    supersedesDecisionId: repositoryReplacement.id,
    publicationState: 'CANDIDATE',
  }], {
    ...repositoryContext,
    existingPublished: [repositoryReplacement],
  }), /requires a published replacement/u);
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
  const humanContext = {
    ...repositoryContext,
    existingPublished: [repositoryReplacement],
  };
  const humanContextDigest = bindingDigest(humanContext);
  await assert.rejects(bindingRepository.persistDecisions([{
    ...repositoryReplacement,
    id: 'postgres-caller-human-publication',
    pairId: 'postgres-caller-human-pair',
    role: 'PRACTICES',
    proposedRole: 'PRACTICES',
    reviewerPromptVersion: 'human-adjudication/v1',
    reviewerInputDigest: sha256('postgres-caller-human-input'),
    reviewProvider: 'HUMAN',
    attemptSequence: 3,
    supersedesDecisionId: null,
  }], humanContext), /controlled queue adjudication/u);
  await assert.rejects(db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-direct-human-shadow',
      ...decisionBase,
      pairId: 'postgres-direct-human-pair',
      role: 'PRACTICES',
      reviewerPromptVersion: 'human-adjudication/v1',
      reviewerInputDigest: sha256('postgres-direct-human-input'),
      reviewProvider: 'HUMAN',
      publicationState: 'SHADOW_PUBLISHED',
      ...currentCrosswalkBinding,
    },
  }), /matching accepted queue receipt/u);
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
      id: 'postgres-human-wrong-queue-candidate',
      ...decisionBase,
      pairId: 'postgres-human-wrong-queue-pair',
      role: 'PRACTICES',
      reviewerInputDigest: sha256('postgres-human-wrong-queue-input'),
      reviewerPromptVersion: 'human-adjudication/v1',
      reviewProvider: 'HUMAN',
      attemptSequence: 2,
      supersedesDecisionId: 'postgres-retry-2',
      publicationState: 'CANDIDATE',
      ...currentCrosswalkBinding,
    },
  });
  await assert.rejects(db.canonicalResourceBindingHumanDecisionReceipt.create({
    data: {
      id: 'postgres-human-wrong-queue-receipt',
      queueId: 'postgres-human-queue',
      actorId: 'forged-reviewer',
      decidedAt: new Date('2026-07-28T12:28:00.000Z'),
      outcome: 'ACCEPT',
      rationale: '错误队列。',
      contextDigest: humanContextDigest,
      inputDigest: humanInputDigest,
      decisionId: 'postgres-human-wrong-queue-candidate',
    },
  }), /does not bind/u);
  await assert.rejects(db.canonicalResourceBindingHumanDecisionReceipt.create({
    data: {
      id: 'postgres-fixture-forged-receipt',
      queueId: 'postgres-human-queue',
      actorId: 'fixture',
      decidedAt: new Date('2026-07-28T12:28:30.000Z'),
      outcome: 'ACCEPT',
      rationale: 'Fixture 不能伪造人工裁决。',
      contextDigest: humanContextDigest,
      inputDigest: humanInputDigest,
      decisionId: 'postgres-human-queued',
    },
  }), /does not bind/u);
  await db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-human-drifted-queued',
      ...decisionBase,
      pairId: 'postgres-human-drifted-pair',
      role: 'PRACTICES',
      reviewerInputDigest: sha256('postgres-human-drifted-input'),
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
      id: 'postgres-human-drifted-queue',
      bindingDecisionId: 'postgres-human-drifted-queued',
      reasonCodes: ['fixture-review-not-authoritative'],
      contextDigest: humanContextDigest,
      inputDigest: sha256('postgres-human-forged-input'),
    },
  });
  await assert.rejects(bindingRepository.adjudicateHumanQueue({
    queueId: 'postgres-human-drifted-queue',
    actorId: 'teacher-reviewer',
    decidedAt: '2026-07-28T12:29:00.000Z',
    outcome: 'ACCEPT',
    rationale: '伪造输入不得通过。',
    context: humanContext,
  }), /input has drifted/u);
  await assert.rejects(db.$transaction(async (transaction) => {
    await transaction.canonicalResourceBindingDecision.create({
      data: {
        id: 'postgres-human-drifted-candidate',
        ...decisionBase,
        pairId: 'postgres-human-drifted-pair',
        role: 'PRACTICES',
        reviewerInputDigest: sha256('postgres-human-drifted-input'),
        reviewerPromptVersion: 'human-adjudication/v1',
        reviewProvider: 'HUMAN',
        attemptSequence: 2,
        supersedesDecisionId: 'postgres-human-drifted-queued',
        publicationState: 'CANDIDATE',
        ...currentCrosswalkBinding,
      },
    });
    await transaction.canonicalResourceBindingDecision.update({
      where: { id: 'postgres-human-drifted-queued' },
      data: { lifecycleState: 'SUPERSEDED' },
    });
    await transaction.canonicalResourceBindingHumanDecisionReceipt.create({
      data: {
        id: 'postgres-human-drifted-receipt',
        queueId: 'postgres-human-drifted-queue',
        actorId: 'teacher-reviewer',
        decidedAt: new Date('2026-07-28T12:29:30.000Z'),
        outcome: 'ACCEPT',
        rationale: '伪造输入不得通过。',
        contextDigest: humanContextDigest,
        inputDigest: sha256('postgres-human-forged-input'),
        decisionId: 'postgres-human-drifted-candidate',
      },
    });
  }), /does not bind/u);
  const humanAccepted = await bindingRepository.adjudicateHumanQueue({
    queueId: 'postgres-human-queue',
    actorId: 'teacher-reviewer',
    decidedAt: '2026-07-28T12:30:00.000Z',
    outcome: 'ACCEPT',
    rationale: '已核对证据与资源端点。',
    context: humanContext,
  });
  assert.equal(humanAccepted.publicationState, 'SHADOW_PUBLISHED');
  assert.equal(
    (await db.canonicalResourceBindingDecision.findUniqueOrThrow({
      where: { id: humanAccepted.id },
    })).publicationState,
    'SHADOW_PUBLISHED',
  );
  const humanReceipt = await db.canonicalResourceBindingHumanDecisionReceipt.findUniqueOrThrow({
    where: { queueId: 'postgres-human-queue' },
  });
  assert.equal(humanReceipt.outcome, 'ACCEPT');
  assert.equal(humanReceipt.decisionId, humanAccepted.id);
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
      decisionId: humanAccepted.id,
    },
  }));
  await assert.rejects(db.canonicalResourceBindingHumanDecisionReceipt.update({
    where: { id: humanReceipt.id },
    data: { rationale: '修改后的理由。' },
  }), /immutable/u);
  await assert.rejects(db.canonicalResourceBindingHumanDecisionReceipt.delete({
    where: { id: humanReceipt.id },
  }), /immutable/u);
  const humanRejectedInputDigest = sha256('postgres-human-rejected-input');
  await db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-human-rejected-queued',
      ...decisionBase,
      pairId: 'postgres-human-rejected-pair',
      role: 'PRACTICES',
      reviewerInputDigest: humanRejectedInputDigest,
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
      id: 'postgres-human-rejected-queue',
      bindingDecisionId: 'postgres-human-rejected-queued',
      reasonCodes: ['fixture-review-not-authoritative'],
      contextDigest: humanContextDigest,
      inputDigest: humanRejectedInputDigest,
    },
  });
  const humanRejected = await bindingRepository.adjudicateHumanQueue({
    queueId: 'postgres-human-rejected-queue',
    actorId: 'teacher-reviewer',
    decidedAt: '2026-07-28T12:32:00.000Z',
    outcome: 'REJECT',
    rationale: '证据不足，拒绝发布。',
    context: humanContext,
  });
  assert.equal(humanRejected.reviewState, 'REJECTED');
  assert.equal(humanRejected.publicationState, 'CANDIDATE');
  assert.equal(
    (await db.canonicalResourceBindingDecision.findUniqueOrThrow({
      where: { id: humanRejected.id },
    })).publicationState,
    'CANDIDATE',
  );
  const humanRejectedReceipt = await db.canonicalResourceBindingHumanDecisionReceipt.findUniqueOrThrow({
    where: { queueId: 'postgres-human-rejected-queue' },
  });
  assert.equal(humanRejectedReceipt.outcome, 'REJECT');
  assert.equal(humanRejectedReceipt.decisionId, humanRejected.id);
  const duplicateCurrentCrosswalk = {
    id: 'postgres-crosswalk-current-duplicate',
    ...crosswalkBase,
    sourceVersion: 'postgres-test/v2',
    structuralUnitVersion: bindingInventory.captureRevision,
  };
  await assert.rejects(
    bindingRepository.persistEvidenceCrosswalks([duplicateCurrentCrosswalk]),
    /must remain unique/u,
  );
  const duplicateHistoricalCrosswalk = {
    id: 'postgres-crosswalk-historical-duplicate',
    ...crosswalkBase,
    ...historicalCrosswalkProjection,
    sourceVersion: 'postgres-test/v2',
    structuralUnitVersion: historicalCaptureRevision,
    validationDigest: bindingDigest(historicalCrosswalkProjection),
  };
  await bindingRepository.persistEvidenceCrosswalks([duplicateHistoricalCrosswalk]);
  const historicalCaptureIdentity = {
    inventoryRunId: historicalInventoryRunId,
    captureRevision: historicalCaptureRevision,
    structuralUnitVersion: historicalCaptureRevision,
  };
  const historicalCrosswalkBinding = {
    crosswalkId: historicalCrosswalk.id,
    ...historicalCaptureIdentity,
    validationDigest: historicalCrosswalk.validationDigest,
  };
  const historicalRepositoryContext = {
    ...repositoryContext,
    captureIdentity: historicalCaptureIdentity,
    existingPublished: [],
    crosswalks: [historicalCrosswalk],
  };
  await assert.rejects(bindingRepository.persistDecisions([{
    ...repositoryReplacement,
    id: 'postgres-repository-hidden-prepublication-ambiguity',
    pairId: 'postgres-repository-hidden-prepublication-ambiguity-pair',
    role: 'PRACTICES',
    proposedRole: 'PRACTICES',
    supersedesDecisionId: null,
    ...historicalCrosswalkBinding,
  }], historicalRepositoryContext), /bypasses publication gates/u);
  await assert.rejects(db.canonicalResourceBindingDecision.create({
    data: {
      id: 'postgres-direct-prepublication-ambiguity',
      ...decisionBase,
      pairId: 'postgres-direct-prepublication-ambiguity-pair',
      role: 'ASSESSES',
      publicationState: 'SHADOW_PUBLISHED',
      ...historicalCrosswalkBinding,
    },
  }), /exact validated crosswalk/u);
  const concurrentCaptureRevision = 'e'.repeat(40);
  const concurrentInventoryRunId = `${bindingInventory.id}:concurrent`;
  await db.resourceBindingInventoryRun.create({
    data: {
      id: concurrentInventoryRunId,
      captureRevision: concurrentCaptureRevision,
      capturedAt: new Date('2026-07-28T11:30:00.000Z'),
      dbWatermark: '0/CONCURRENT',
      sourceHash: sha256('concurrent-inventory-source'),
      itemCount: 1,
      includedCount: 1,
      excludedCount: 0,
      unresolvedCount: 0,
      complete: true,
      cutoverReady: false,
      authorityState: 'SHADOW',
    },
  });
  await db.resourceBindingInventoryItem.create({
    data: {
      runId: concurrentInventoryRunId,
      atomicResourceId: includedResource.atomicResourceId,
      resourceId: includedResource.resourceId,
      structuralUnitId: includedResource.structuralUnitId,
      segmentId: includedResource.segmentId,
      resourceSegmentHash: includedResource.resourceSegmentHash,
      disposition: 'INCLUDED',
      reasonCodes: includedResource.reasonCodes,
      sourceObservations: includedResource.sourceObservations,
      observationDigest: includedResource.observationDigest,
    },
  });
  const concurrentCrosswalkProjection = {
    ...crosswalkProjection,
    inventoryRunId: concurrentInventoryRunId,
    captureRevision: concurrentCaptureRevision,
  };
  const concurrentCrosswalk = {
    id: 'postgres-crosswalk-concurrent-base',
    ...crosswalkBase,
    ...concurrentCrosswalkProjection,
    sourceVersion: 'postgres-concurrent/v1',
    structuralUnitVersion: concurrentCaptureRevision,
    validationDigest: bindingDigest(concurrentCrosswalkProjection),
  };
  await bindingRepository.persistEvidenceCrosswalks([concurrentCrosswalk]);
  const concurrentDuplicateCrosswalk = {
    ...concurrentCrosswalk,
    id: 'postgres-crosswalk-concurrent-duplicate',
    sourceVersion: 'postgres-concurrent/v2',
  };
  const concurrentDecision = {
    id: 'postgres-concurrent-publication',
    ...decisionBase,
    pairId: 'postgres-concurrent-publication-pair',
    role: 'REFERENCES',
    publicationState: 'SHADOW_PUBLISHED',
    crosswalkId: concurrentCrosswalk.id,
    inventoryRunId: concurrentInventoryRunId,
    captureRevision: concurrentCaptureRevision,
    structuralUnitVersion: concurrentCaptureRevision,
    validationDigest: concurrentCrosswalk.validationDigest,
  };
  const concurrentResults = await Promise.allSettled([
    db.$transaction((transaction) => (
      transaction.canonicalResourceBindingDecision.create({ data: concurrentDecision })
    )),
    db.$transaction((transaction) => (
      transaction.actkgEvidenceStructuralUnitCrosswalk.create({
        data: concurrentDuplicateCrosswalk,
      })
    )),
  ]);
  assert.equal(
    concurrentResults.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  const [concurrentCrosswalkCount, concurrentPublishedCount] = await Promise.all([
    db.actkgEvidenceStructuralUnitCrosswalk.count({
      where: {
        releaseId: validated.entry.release_id,
        evidenceId: evidence.evidenceId,
        canonicalId,
        inventoryRunId: concurrentInventoryRunId,
        captureRevision: concurrentCaptureRevision,
        structuralUnitVersion: concurrentCaptureRevision,
      },
    }),
    db.canonicalResourceBindingDecision.count({
      where: {
        id: concurrentDecision.id,
        publicationState: 'SHADOW_PUBLISHED',
      },
    }),
  ]);
  assert(
    (concurrentPublishedCount === 1 && concurrentCrosswalkCount === 1)
    || (concurrentPublishedCount === 0 && concurrentCrosswalkCount === 2),
  );
  const precedenceAuthorId = 'binding-precedence-author';
  const precedencePlanId = 'binding-precedence-plan';
  const disabledResourceId = 'binding-precedence-disabled';
  const enabledResourceId = 'binding-precedence-enabled';
  const disabledPlacementId = 'binding-precedence-disabled-placement';
  const enabledPlacementId = 'binding-precedence-enabled-placement';
  await db.user.create({
    data: {
      id: precedenceAuthorId,
      email: 'binding-precedence@example.test',
      role: 'TEACHER',
    },
  });
  await db.lessonPlan.create({
    data: {
      id: precedencePlanId,
      title: 'Canonical binding precedence fixture',
      authorId: precedenceAuthorId,
    },
  });
  await db.teachingResource.createMany({
    data: [
      {
        id: disabledResourceId,
        title: 'Resource disabled by lesson override',
        type: 'STATIC_TEXT',
        config: { resourceNodePlanning: { pathEligible: true } },
        authorId: precedenceAuthorId,
      },
      {
        id: enabledResourceId,
        title: 'Resource enabled by lesson override',
        type: 'STATIC_TEXT',
        config: { resourceNodePlanning: { pathEligible: false } },
        authorId: precedenceAuthorId,
      },
    ],
  });
  await db.lessonItem.createMany({
    data: [
      {
        id: disabledPlacementId,
        planId: precedencePlanId,
        resourceId: disabledResourceId,
        stage: 'PARTICIPATORY',
        order: 1,
        overrideConfig: { resourceNodePlanning: { pathEligible: false } },
      },
      {
        id: enabledPlacementId,
        planId: precedencePlanId,
        resourceId: enabledResourceId,
        stage: 'PARTICIPATORY',
        order: 2,
        overrideConfig: { resourceNodePlanning: { pathEligible: true } },
      },
    ],
  });
  const precedenceRevision = 'e'.repeat(40);
  const precedenceImport = await runConcurrentBindingImport(precedenceRevision);
  assert.equal(precedenceImport.status, 0, precedenceImport.stderr || precedenceImport.stdout);
  const precedenceRun = await db.resourceBindingInventoryRun.findFirstOrThrow({
    where: { captureRevision: precedenceRevision },
  });
  const precedenceItems = await db.resourceBindingInventoryItem.findMany({
    where: {
      runId: precedenceRun.id,
      resourceId: { in: [disabledResourceId, enabledResourceId] },
    },
    orderBy: { resourceId: 'asc' },
  });
  assert.deepEqual(
    precedenceItems.map((item) => ({
      resourceId: item.resourceId,
      structuralUnitId: item.structuralUnitId,
      disposition: item.disposition,
    })),
    [
      {
        resourceId: disabledResourceId,
        structuralUnitId: `lesson-item:${disabledPlacementId}`,
        disposition: 'UNRESOLVED',
      },
      {
        resourceId: enabledResourceId,
        structuralUnitId: `lesson-item:${enabledPlacementId}`,
        disposition: 'INCLUDED',
      },
    ],
  );
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
