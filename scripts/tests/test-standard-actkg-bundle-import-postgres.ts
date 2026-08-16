import 'dotenv/config';

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Client } from 'pg';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  ACCEPTED_CANDIDATE_STATE,
  STANDARD_PUBLIC_BUNDLE_PROTOCOL,
  AuthoritativeKnowledgeRepository,
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
  STANDARD_PUBLIC_BUNDLE_PROTOCOL,
  type AuthoritativeKnowledgeDatabase,
} from '../../src/lib/authoritative-knowledge';
import {
  computeCanonicalReleaseHash,
  computeProjectionVersionDigest,
} from '../actkg-release/actkg-canonical-digests';
import { canonicalJson, sha256 as fileSha256 } from '../actkg-release/authoritative-release';
import {
  importValidatedAggregateRelease,
  loadAndValidateAggregateRelease,
  reconstructAggregateArtifacts,
} from '../actkg-release/ctkg-0-2-aggregate-release';
import { loadAndValidatePublicBundleV1 } from '../actkg-release/public-bundle-v1';
import type { JsonObject, ValidatedActKGBundle } from '../actkg-release/public-bundle-types';
import {
  importValidatedActKGBundle,
  reconstructBundleArtifacts,
} from '../actkg-release/standard-bundle-import';

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  if (process.env.ACTKG_POSTGRES_REQUIRED === '1') throw new Error('DATABASE_URL is required');
  console.log('standard ActKG Bundle PostgreSQL integration skipped: DATABASE_URL is unavailable');
  process.exit(0);
}

const schemaName = `actkg_std_${process.pid}_${Date.now()}`;
const root = process.cwd();
const R2_PATH = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2';
const LOCK_V3 = 'course-content/authoring/knowledge/releases/release-set.lock.v3.control-theory-engineering-v0.3-r2.json';
const COMPONENT_PATHS = [
  'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1',
  'course-content/authoring/knowledge/releases/system-modeling-engineering-v0.1',
  'course-content/authoring/knowledge/releases/control-theory-integration-v0.1',
] as const;

const checkoutRevision = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).stdout.trim();
assert.match(checkoutRevision, /^[a-f0-9]{40}$/u);

let admin: Client | null = null;
let db: ReturnType<typeof createPrismaClient> | null = null;
let testUrl = '';
let fixtureDir = '';

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function withSchema(url: string, schema: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('schema', schema);
  // PrismaPg uses the schema option for generated relation names, while raw
  // trigger SQL still follows PostgreSQL search_path. Keep both paths inside
  // the isolated schema so public receipts cannot contaminate the harness.
  parsed.searchParams.set('options', `-csearch_path=${schema},public`);
  return parsed.toString();
}

async function ensureIsolatedDatabaseUrl(): Promise<{ url: string; mode: 'database' | 'schema' }> {
  admin = new Client({ connectionString: sourceUrl });
  await admin.connect();

  // Prefer a dedicated database when the role can CREATE DATABASE.
  const databaseName = schemaName;
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(sourceUrl!);
    url.pathname = `/${databaseName}`;
    url.searchParams.delete('schema');
    return { url: url.toString(), mode: 'database' };
  } catch (error) {
    if ((error as { code?: string }).code !== '42501') throw error;
  }

  // Fallback: unique schema on the existing database. Never initdb/ephemeral
  // Postgres here — sandbox environments often block shmget.
  //
  // Known limitation: PrismaPg schema mode + unqualified-trigger functions that
  // query unqualified "ActkgImportReceipt" can fail with
  // "table ActkgImportReceipt does not exist" even after migrate deploy.
  // If that happens, report SCHEMA_ISOLATION_UNSUPPORTED and leave tasks open.
  await admin.query(`CREATE SCHEMA "${schemaName}"`);
  return { url: withSchema(sourceUrl!, schemaName), mode: 'schema' };
}

function migrate(url: string): void {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

async function copyTree(sourceRelative: string, destinationRoot: string, destinationRelative: string): Promise<void> {
  await cp(path.join(root, sourceRelative), path.join(destinationRoot, destinationRelative), {
    recursive: true,
  });
}

async function buildValidatedV03(): Promise<ValidatedActKGBundle> {
  // Production-root load through the #1130 compatibility validator.
  return loadAndValidatePublicBundleV1({
    lockPath: LOCK_V3,
    captureRevision: checkoutRevision,
    gitRoot: root,
  });
}

async function writeJson(filePath: string, value: unknown): Promise<Buffer> {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await writeFile(filePath, bytes);
  return bytes;
}

function recomputeBundleDigest(manifest: JsonObject): string {
  const body = structuredClone(manifest) as JsonObject;
  delete body.bundle_digest;
  return fileSha256(Buffer.from(canonicalJson(body)));
}

async function rewriteSha256Sums(bundleDir: string): Promise<void> {
  const { readdir } = await import('node:fs/promises');
  const names = (await readdir(bundleDir)).filter((name) => name !== 'SHA256SUMS').sort();
  const lines: string[] = [];
  for (const name of names) {
    lines.push(`${fileSha256(await readFile(path.join(bundleDir, name)))}  ${name}`);
  }
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), `${lines.join('\n')}\n`);
}

/**
 * Build a synthetic semantic update from r2 using the same helper pattern as the
 * #1130 compatibility tests, then revalidate through loadAndValidatePublicBundleV1.
 */
async function buildValidatedSemanticV04ThroughCompatibility(): Promise<ValidatedActKGBundle> {
  // Distinct controlled path so ActkgReleaseSet.controlledPath uniqueness is preserved
  // when v0.3 is already imported in the same database.
  const V04_PATH = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.4-synthetic';
  const V04_LOCK = 'course-content/authoring/knowledge/releases/release-set.lock.v3.control-theory-engineering-v0.4-synthetic.json';
  fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'actkg-std-v04-'));
  await copyTree(R2_PATH, fixtureDir, V04_PATH);
  await copyTree(LOCK_V3, fixtureDir, V04_LOCK);
  for (const component of COMPONENT_PATHS) {
    await copyTree(component, fixtureDir, component);
  }
  await copyTree(
    'scripts/actkg-release/schemas/public-bundle',
    fixtureDir,
    'scripts/actkg-release/schemas/public-bundle',
  );

  const bundleDir = path.join(fixtureDir, V04_PATH);
  const manifestPath = path.join(bundleDir, 'bundle-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject & {
    artifacts: JsonObject[];
    statistics: JsonObject;
    release: JsonObject;
    components: JsonObject[];
  };

  const releaseArtifact = manifest.artifacts.find((item) => item.role === 'release')!;
  const releasePath = path.join(bundleDir, String(releaseArtifact.path));
  const release = JSON.parse(await readFile(releasePath, 'utf8')) as JsonObject;
  // Semantic content update: drop one relation entity from membership + projections.
  const projections: Record<string, JsonObject> = {};
  const projectionArtifacts = manifest.artifacts.filter((item) => item.role === 'projection');
  for (const artifact of projectionArtifacts) {
    const profile = String(artifact.profile ?? 'runtime');
    projections[profile] = JSON.parse(
      await readFile(path.join(bundleDir, String(artifact.path)), 'utf8'),
    ) as JsonObject;
  }
  const runtimeLinks = projections.runtime.links as JsonObject[];
  const removed = runtimeLinks[runtimeLinks.length - 1]!;
  const removedRelationId = String(removed.relation_id);
  for (const profile of Object.keys(projections)) {
    const payload = projections[profile]!;
    payload.links = (payload.links as JsonObject[]).filter(
      (link) => link.relation_id !== removedRelationId,
    );
  }
  const metaArtifact = manifest.artifacts.find((item) => item.role === 'projection_link_metadata')!;
  const metaLines = (await readFile(path.join(bundleDir, String(metaArtifact.path)), 'utf8'))
    .split(/\r?\n/u)
    .filter(Boolean)
    .filter((line) => JSON.parse(line).relation_id !== removedRelationId);
  const entries = (release.entries as JsonObject[]).filter(
    (entry) => entry.entity !== removedRelationId,
  );
  const included = (release.included_entities as string[]).filter(
    (entity) => entity !== removedRelationId,
  );
  release.entries = entries;
  release.included_entities = included;
  release.id = 'ctr:release:control-theory-engineering-v0.4';
  release.release_version = 'control-theory-engineering-v0.4';
  release.release_hash = computeCanonicalReleaseHash(release);

  for (const profile of Object.keys(projections)) {
    const payload = projections[profile]!;
    payload.source_release = String(release.id);
    payload.source_release_hash = String(release.release_hash);
    if (typeof payload.id === 'string') payload.id = payload.id.replace('v0.3', 'v0.4');
    if (typeof payload.projection_profile === 'string') {
      payload.projection_profile = payload.projection_profile.replace('v0.3', 'v0.4');
    }
    payload.version_digest = computeProjectionVersionDigest(payload, null, profile);
    const artifact = projectionArtifacts.find((item) => String(item.profile) === profile)!;
    const bytes = await writeJson(path.join(bundleDir, String(artifact.path)), payload);
    artifact.sha256 = fileSha256(bytes);
    artifact.byte_length = bytes.byteLength;
  }

  const updatedMeta = metaLines.map((line) => {
    const row = JSON.parse(line) as JsonObject;
    row.source_release = String(release.id);
    row.source_release_hash = String(release.release_hash);
    return JSON.stringify(row);
  });
  const metaBytes = Buffer.from(`${updatedMeta.join('\n')}\n`, 'utf8');
  await writeFile(path.join(bundleDir, String(metaArtifact.path)), metaBytes);
  metaArtifact.sha256 = fileSha256(metaBytes);
  metaArtifact.byte_length = metaBytes.byteLength;
  metaArtifact.record_count = updatedMeta.length;

  const crosswalkArtifact = manifest.artifacts.find((item) => item.role === 'rag_crosswalk')!;
  const crosswalkLines = (await readFile(path.join(bundleDir, String(crosswalkArtifact.path)), 'utf8'))
    .split(/\r?\n/u)
    .filter(Boolean)
    .filter((line) => JSON.parse(line).published_entity_id !== removedRelationId);
  const crosswalkBytes = Buffer.from(`${crosswalkLines.join('\n')}\n`, 'utf8');
  await writeFile(path.join(bundleDir, String(crosswalkArtifact.path)), crosswalkBytes);
  crosswalkArtifact.sha256 = fileSha256(crosswalkBytes);
  crosswalkArtifact.byte_length = crosswalkBytes.byteLength;
  crosswalkArtifact.record_count = crosswalkLines.length;

  const releaseBytes = await writeJson(releasePath, release);
  releaseArtifact.sha256 = fileSha256(releaseBytes);
  releaseArtifact.byte_length = releaseBytes.byteLength;

  const expectedLinks = (projections.runtime.links as JsonObject[]).length;
  const expectedEntries = entries.length;
  manifest.bundle_id = 'ctb:control-theory-engineering-v0.4:r1';
  manifest.bundle_revision = 1;
  manifest.release = {
    release_id: String(release.id),
    release_version: String(release.release_version),
    release_hash: String(release.release_hash),
    source_dataset_hash: String(release.source_dataset_hash),
  };
  manifest.statistics = {
    ...manifest.statistics,
    release_entries: expectedEntries,
    published_relations: expectedLinks,
    projection_links: expectedLinks,
    rag_crosswalk_rows: crosswalkLines.length,
  };

  const reportArtifact = manifest.artifacts.find((item) => item.role === 'validation_report')!;
  const reportPath = path.join(bundleDir, String(reportArtifact.path));
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as JsonObject;
  report.bundle_id = manifest.bundle_id;
  report.release = manifest.release;
  report.statistics = manifest.statistics;
  report.result = 'PASS';
  const gates = (report.gates && typeof report.gates === 'object')
    ? report.gates as JsonObject
    : {};
  for (const key of Object.keys(gates)) gates[key] = 'PASS';
  report.gates = gates;
  // Nested evidence must match final Manifest artifact digests (closed-world).
  report.artifact_validation = manifest.artifacts
    .filter((artifact) => artifact.role !== 'validation_report')
    .map((artifact) => ({
      path: artifact.path,
      sha256: artifact.sha256,
      byte_length: artifact.byte_length,
      record_count: artifact.record_count ?? null,
      result: 'PASS',
    }));
  report.component_validation = (manifest.components as JsonObject[]).map((component) => ({
    release_id: component.release_id,
    reference_kind: component.reference_kind,
    // Validation Report reuses release_raw_sha256 for both kinds: legacy Release
    // JSON hash, or standard_bundle Manifest raw hash.
    release_raw_sha256: component.reference_kind === 'standard_bundle'
      ? component.manifest_sha256
      : component.release_raw_sha256,
    result: 'PASS',
  }));
  const reportBytes = await writeJson(reportPath, report);
  reportArtifact.sha256 = fileSha256(reportBytes);
  reportArtifact.byte_length = reportBytes.byteLength;

  manifest.bundle_digest = recomputeBundleDigest(manifest);
  const manifestBytes = await writeJson(manifestPath, manifest);
  await rewriteSha256Sums(bundleDir);

  const lockPath = path.join(fixtureDir, V04_LOCK);
  const lock = JSON.parse(await readFile(lockPath, 'utf8')) as JsonObject;
  lock.release_set_id = 'actkg-authoritative-candidate-v4-synthetic';
  const bundle = lock.bundle as JsonObject;
  bundle.controlled_path = V04_PATH;
  bundle.bundle_id = String(manifest.bundle_id);
  bundle.bundle_revision = Number(manifest.bundle_revision);
  bundle.bundle_digest = String(manifest.bundle_digest);
  bundle.manifest_raw_sha256 = fileSha256(manifestBytes);
  const lockRelease = lock.release as JsonObject;
  lockRelease.release_id = String(manifest.release.release_id);
  lockRelease.release_version = String(manifest.release.release_version);
  lockRelease.release_hash = String(manifest.release.release_hash);
  lockRelease.source_dataset_hash = String(manifest.release.source_dataset_hash);
  await writeJson(lockPath, lock);

  return loadAndValidatePublicBundleV1({
    root: fixtureDir,
    lockPath: V04_LOCK,
    captureRevision: checkoutRevision,
    gitRoot: root,
  });
}

async function main(): Promise<void> {
  const isolated = await ensureIsolatedDatabaseUrl();
  testUrl = isolated.url;
  migrate(testUrl);
  process.env.DATABASE_URL = testUrl;
  db = createPrismaClient({ log: ['warn', 'error'] });

  // 1) Frozen #1125 exact candidate remains byte-stable after migration.
  const validatedExact = await loadAndValidateAggregateRelease({ captureRevision: checkoutRevision });
  let exactCounts: Awaited<ReturnType<typeof importValidatedAggregateRelease>>;
  try {
    exactCounts = await importValidatedAggregateRelease(db, validatedExact);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      isolated.mode === 'schema'
      && /ActkgImportReceipt does not exist|does not exist in the current database|ActKG authoritative candidate content is sealed by its import receipt/u.test(message)
    ) {
      const required = process.env.ACTKG_POSTGRES_REQUIRED === '1';
      const exitCode = required ? 1 : 0;
      console.log(JSON.stringify({
        ok: false,
        mode: isolated.mode,
        schema: schemaName,
        code: 'SCHEMA_ISOLATION_UNSUPPORTED',
        error: message.replace(/\s+/gu, ' ').slice(0, 240),
        note: 'Prisma schema isolation is incompatible with unqualified sealed-trigger lookups; CREATEDB is unavailable and initdb is disabled',
        required,
        exitCode,
      }));
      process.exitCode = exitCode;
      if (required) {
        throw new Error(
          'SCHEMA_ISOLATION_UNSUPPORTED while ACTKG_POSTGRES_REQUIRED=1: standard Bundle PostgreSQL assertions did not run',
        );
      }
      return;
    }
    throw error;
  }
  assert.equal(exactCounts.releaseEntries, 841);
  const exactArtifactsBefore = await reconstructAggregateArtifacts(db, CURRENT_AGGREGATE_RELEASE_ID);
  const exactReceiptBefore = await db.actkgImportReceipt.findUniqueOrThrow({
    where: { releaseId: CURRENT_AGGREGATE_RELEASE_ID },
  });
  assert.equal(exactReceiptBefore.candidateState, 'CANDIDATE');
  assert.equal(exactReceiptBefore.bundleId, null);
  assert.equal(exactReceiptBefore.bundleDigest, null);
  const exactArtifactMeta = await db.actkgReleaseArtifact.findFirstOrThrow({
    where: { releaseId: CURRENT_AGGREGATE_RELEASE_ID },
  });
  assert.equal(exactArtifactMeta.role, null);
  assert.equal(exactArtifactMeta.contractVersion, null);

  // 2) v0.3 r2 through compatibility output — concurrent first content import
  // of a brand-new semantic Release must converge to one content writer and one
  // idempotent reader (or equivalent), with a single semantic row set.
  const validatedV03 = await buildValidatedV03();
  const concurrentFirst = await Promise.all([
    importValidatedActKGBundle(db, validatedV03),
    importValidatedActKGBundle(db, validatedV03),
  ]);
  const concurrentModes = concurrentFirst.map((result) => result.mode).sort();
  assert.deepEqual(concurrentModes, ['content', 'idempotent']);
  assert.ok(concurrentFirst.every((result) => (
    result.candidateState === ACCEPTED_CANDIDATE_STATE
    && result.bundleDigest === validatedV03.bundleIdentity.bundleDigest
    && result.releaseId === validatedV03.releaseIdentity.releaseId
  )));
  assert.equal(await db.actkgRelease.count({
    where: { id: validatedV03.releaseIdentity.releaseId },
  }), 1);
  assert.equal(await db.actkgBundleReceipt.count({
    where: {
      bundleContractVersion: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      bundleDigest: validatedV03.bundleIdentity.bundleDigest,
    },
  }), 1);
  assert.equal(await db.actkgImportReceipt.count({
    where: { releaseId: validatedV03.releaseIdentity.releaseId },
  }), 1);
  // Unique projection identities (runtime may also appear in preservedProjections).
  const expectedProjectionIdentityCount = new Set([
    validatedV03.selectedRuntimeProjection.identity.projectionId,
    ...validatedV03.preservedProjections.map((entry) => entry.identity.projectionId),
  ]).size;
  assert.equal(await db.actkgProjectionIdentity.count({
    where: { releaseId: validatedV03.releaseIdentity.releaseId },
  }), expectedProjectionIdentityCount);

  const first = concurrentFirst.find((result) => result.mode === 'content')!;
  assert.equal(first.candidateState, ACCEPTED_CANDIDATE_STATE);

  const second = await importValidatedActKGBundle(db, validatedV03);
  assert.equal(second.mode, 'idempotent');

  // Concurrent re-import of an already-accepted digest stays idempotent.
  const concurrent = await Promise.all([
    importValidatedActKGBundle(db, validatedV03),
    importValidatedActKGBundle(db, validatedV03),
  ]);
  assert.deepEqual(
    concurrent.map((result) => result.mode).sort(),
    ['idempotent', 'idempotent'],
  );
  assert.equal(await db.actkgBundleReceipt.count({
    where: {
      bundleContractVersion: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      bundleDigest: validatedV03.bundleIdentity.bundleDigest,
    },
  }), 1);

  const receipt = await db.actkgBundleReceipt.findUniqueOrThrow({
    where: {
      bundleContractVersion_bundleDigest: {
        bundleContractVersion: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
        bundleDigest: validatedV03.bundleIdentity.bundleDigest,
      },
    },
  });
  assert.equal(receipt.candidateState, ACCEPTED_CANDIDATE_STATE);
  assert.equal(receipt.artifactCount, validatedV03.rawArtifacts.length);
  const reconstructed = await reconstructBundleArtifacts(db, receipt.id);
  assert.equal(reconstructed.length, validatedV03.rawArtifacts.length);
  for (const artifact of reconstructed) {
    const original = validatedV03.rawArtifacts.find((row) => row.descriptor.path === artifact.relativePath);
    assert.ok(original);
    assert.equal(artifact.sha256, original.descriptor.sha256);
    assert.equal(artifact.bytes.equals(original.bytes), true);
  }
  // Reserved public package files round-trip byte-for-byte with descriptors.
  for (const reservedPath of ['bundle-manifest.json', 'SHA256SUMS'] as const) {
    const original = validatedV03.rawArtifacts.find((row) => row.descriptor.path === reservedPath);
    const persisted = reconstructed.find((row) => row.relativePath === reservedPath);
    assert.ok(original, `validated Bundle missing reserved ${reservedPath}`);
    assert.ok(persisted, `persisted packaging missing reserved ${reservedPath}`);
    assert.equal(persisted.sha256, original.descriptor.sha256);
    assert.equal(persisted.bytes.equals(original.bytes), true);
    assert.equal(persisted.role, original.descriptor.role);
    assert.equal(persisted.contractVersion, original.descriptor.contractVersion);
    assert.equal(persisted.byteLength, original.descriptor.byteLength);
  }
  assert.equal(
    validatedV03.rawArtifacts.find((row) => row.descriptor.path === 'bundle-manifest.json')?.descriptor.sha256,
    validatedV03.bundleIdentity.manifestRawSha256,
  );

  // Multi-projection identities are release-scoped (not packaging-owned).
  assert.equal(await db.actkgProjectionIdentity.count({
    where: { releaseId: validatedV03.releaseIdentity.releaseId, bundleReceiptId: null },
  }), expectedProjectionIdentityCount);

  const repository = new AuthoritativeKnowledgeRepository(
    db as unknown as AuthoritativeKnowledgeDatabase,
  );
  const standardRead = await repository.read({
    authorityState: 'candidate',
    releaseSetId: validatedV03.releaseSetIdentity.releaseSetId,
    releaseId: validatedV03.releaseIdentity.releaseId,
  });
  assert.equal(standardRead.status, 'available');
  if (standardRead.status === 'available') {
    assert.equal(standardRead.snapshot.historical, true);
    assert.equal(standardRead.snapshot.productionAuthoritative, false);
    assert.equal(standardRead.snapshot.release.protocol, STANDARD_PUBLIC_BUNDLE_PROTOCOL);
    assert.equal(standardRead.snapshot.bundleReceipt?.candidateState, ACCEPTED_CANDIDATE_STATE);
    assert.ok(standardRead.snapshot.bundleReceipt?.artifactCount === validatedV03.rawArtifacts.length);
  }

  // Exact path unchanged.
  const exactRead = await repository.read({
    authorityState: 'candidate',
    releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
    releaseId: CURRENT_AGGREGATE_RELEASE_ID,
  });
  assert.equal(exactRead.status, 'available');
  const exactArtifactsAfter = await reconstructAggregateArtifacts(db, CURRENT_AGGREGATE_RELEASE_ID);
  assert.equal(exactArtifactsAfter.length, exactArtifactsBefore.length);
  for (const [index, artifact] of exactArtifactsBefore.entries()) {
    assert.equal(exactArtifactsAfter[index]!.sha256, artifact.sha256);
    assert.equal(exactArtifactsAfter[index]!.bytes.equals(artifact.bytes), true);
  }

  // 3) Round-trip failure leaves no partial rows (descriptor mismatch after stage).
  const broken = structuredClone(validatedV03) as ValidatedActKGBundle;
  // structuredClone loses Buffers; rebuild from original then corrupt descriptor only.
  const brokenInput: ValidatedActKGBundle = {
    ...validatedV03,
    bundleIdentity: {
      ...validatedV03.bundleIdentity,
      bundleId: 'ctb:control-theory-engineering-v0.3:broken-rt',
      bundleRevision: 99,
      bundleDigest: sha256(Buffer.from(`broken-rt:${validatedV03.bundleIdentity.bundleDigest}`)),
    },
    rawArtifacts: validatedV03.rawArtifacts.map((artifact, index) => (
      index === 0
        ? {
            descriptor: {
              ...artifact.descriptor,
              // Internally inconsistent: declared hash/length disagree with bytes.
              byteLength: artifact.bytes.length + 7,
              sha256: 'f'.repeat(64),
            },
            bytes: Buffer.from(artifact.bytes),
          }
        : {
            descriptor: { ...artifact.descriptor },
            bytes: Buffer.from(artifact.bytes),
          }
    )),
  };
  const beforeBroken = {
    receipts: await db.actkgBundleReceipt.count(),
    releases: await db.actkgRelease.count(),
    entries: await db.actkgReleaseEntry.count(),
    artifacts: await db.actkgBundleArtifact.count(),
  };
  await assert.rejects(
    importValidatedActKGBundle(db, brokenInput),
    /round-trip|Artifact mismatch|fails its recorded hash/u,
  );
  assert.deepEqual({
    receipts: await db.actkgBundleReceipt.count(),
    releases: await db.actkgRelease.count(),
    entries: await db.actkgReleaseEntry.count(),
    artifacts: await db.actkgBundleArtifact.count(),
  }, beforeBroken);

  // 3b) Direct INSERT of ACCEPTED_CANDIDATE must fail closed (INSERT guard).
  // Lifecycle is STAGED insert → round-trip → sole STAGED→ACCEPTED UPDATE only.
  const beforeDirectAccepted = await db.actkgBundleReceipt.count();
  await assert.rejects(
    db.actkgBundleReceipt.create({
      data: {
        id: 'bundle-receipt:direct-accepted-forbidden',
        bundleId: 'ctb:direct-accepted-forbidden:r1',
        bundleRevision: 1,
        bundleDigest: sha256(Buffer.from('direct-accepted-forbidden')),
        bundleKind: 'aggregate',
        releaseStage: 'stable',
        bundleContractVersion: 'actkg-public-bundle/1',
        controlledPath: validatedV03.bundleIdentity.controlledPath,
        manifestRawSha256: 'a'.repeat(64),
        normalization: 'actkg-public-bundle-manifest/1',
        publicationTag: 'tag',
        sourceCommit: checkoutRevision,
        sourceTag: 'tag',
        releaseSetId: validatedV03.releaseSetIdentity.releaseSetId,
        releaseId: validatedV03.releaseIdentity.releaseId,
        releaseHash: validatedV03.releaseIdentity.releaseHash,
        sourceDatasetHash: validatedV03.releaseIdentity.sourceDatasetHash,
        schemaVersion: validatedV03.schemaIdentity.version,
        schemaRawSha256: validatedV03.schemaIdentity.rawSha256,
        lockVersion: validatedV03.releaseSetIdentity.lockVersion,
        lockPath: validatedV03.releaseSetIdentity.lockPath,
        lockRawSha256: validatedV03.releaseSetIdentity.lockRawSha256,
        captureRevision: checkoutRevision,
        candidateState: 'ACCEPTED_CANDIDATE',
        compatibilityCode: 'COMPATIBLE_CONTENT_UPDATE',
        runtimeProjectionId: validatedV03.selectedRuntimeProjection.identity.projectionId,
        runtimeProjectionProfile: validatedV03.selectedRuntimeProjection.identity.projectionProfile,
        runtimeProjectionDigest: validatedV03.selectedRuntimeProjection.identity.versionDigest,
        artifactCount: 0,
        statistics: {},
      },
    }),
    /INSERT requires candidateState=STAGED|ActKG Bundle receipt INSERT requires/u,
  );
  assert.equal(await db.actkgBundleReceipt.count(), beforeDirectAccepted);
  assert.equal(
    await db.actkgBundleReceipt.count({
      where: { id: 'bundle-receipt:direct-accepted-forbidden' },
    }),
    0,
  );

  // 4) Concurrent first import of a packaging revision converges to one receipt.
  const packagingBase: ValidatedActKGBundle = {
    ...validatedV03,
    bundleIdentity: {
      ...validatedV03.bundleIdentity,
      bundleId: 'ctb:control-theory-engineering-v0.3:r3',
      bundleRevision: 3,
      bundleDigest: sha256(Buffer.from(`packaging-r3:${validatedV03.bundleIdentity.bundleDigest}`)),
      publicationTag: `${validatedV03.bundleIdentity.publicationTag}-r3`,
    },
    compatibility: {
      code: 'COMPATIBLE_PACKAGING_REVISION',
      reasons: ['packaging revision concurrent import'],
      matchedIdentities: validatedV03.compatibility.matchedIdentities,
    },
    rawArtifacts: validatedV03.rawArtifacts.map((artifact) => ({
      descriptor: { ...artifact.descriptor },
      bytes: Buffer.from(artifact.bytes),
    })),
  };
  const semanticBefore = {
    entries: await db.actkgReleaseEntry.count({ where: { releaseId: validatedV03.releaseIdentity.releaseId } }),
    nodes: await db.actkgProjectionNode.count({ where: { releaseId: validatedV03.releaseIdentity.releaseId } }),
    links: await db.actkgProjectionLink.count({ where: { releaseId: validatedV03.releaseIdentity.releaseId } }),
  };
  const concurrentPackaging = await Promise.all([
    importValidatedActKGBundle(db, packagingBase),
    importValidatedActKGBundle(db, packagingBase),
  ]);
  const modes = concurrentPackaging.map((row) => row.mode).sort();
  assert.ok(modes.includes('packaging') || modes.every((mode) => mode === 'idempotent' || mode === 'packaging'));
  assert.equal(await db.actkgBundleReceipt.count({
    where: {
      bundleContractVersion: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      bundleDigest: packagingBase.bundleIdentity.bundleDigest,
    },
  }), 1);
  assert.deepEqual({
    entries: await db.actkgReleaseEntry.count({ where: { releaseId: validatedV03.releaseIdentity.releaseId } }),
    nodes: await db.actkgProjectionNode.count({ where: { releaseId: validatedV03.releaseIdentity.releaseId } }),
    links: await db.actkgProjectionLink.count({ where: { releaseId: validatedV03.releaseIdentity.releaseId } }),
  }, semanticBefore);

  // Latest packaging receipt diagnosis still available.
  const packagingRead = await repository.read({
    authorityState: 'candidate',
    releaseSetId: validatedV03.releaseSetIdentity.releaseSetId,
    releaseId: validatedV03.releaseIdentity.releaseId,
  });
  assert.equal(packagingRead.status, 'available');
  if (packagingRead.status === 'available') {
    assert.equal(
      packagingRead.snapshot.bundleReceipt?.bundleDigest,
      packagingBase.bundleIdentity.bundleDigest,
    );
    assert.equal(
      packagingRead.snapshot.bundleReceipt?.artifactCount,
      packagingBase.rawArtifacts.length,
    );
  }

  // 4b) Cross-bundleId packaging lineage: older A@rev10 then newer B@rev2.
  // Ranking by bundleRevision alone would incorrectly prefer A.
  const packagingA: ValidatedActKGBundle = {
    ...validatedV03,
    bundleIdentity: {
      ...validatedV03.bundleIdentity,
      bundleId: 'ctb:control-theory-engineering-v0.3:bundle-a',
      bundleRevision: 10,
      bundleDigest: sha256(Buffer.from(`packaging-a-r10:${validatedV03.bundleIdentity.bundleDigest}`)),
      publicationTag: `${validatedV03.bundleIdentity.publicationTag}-bundle-a`,
    },
    compatibility: {
      code: 'COMPATIBLE_PACKAGING_REVISION',
      reasons: ['older packaging lineage A rev10'],
      matchedIdentities: validatedV03.compatibility.matchedIdentities,
    },
    rawArtifacts: validatedV03.rawArtifacts.map((artifact) => ({
      descriptor: { ...artifact.descriptor },
      bytes: Buffer.from(artifact.bytes),
    })),
  };
  const packagingB: ValidatedActKGBundle = {
    ...validatedV03,
    bundleIdentity: {
      ...validatedV03.bundleIdentity,
      bundleId: 'ctb:control-theory-engineering-v0.3:bundle-b',
      bundleRevision: 2,
      bundleDigest: sha256(Buffer.from(`packaging-b-r2:${validatedV03.bundleIdentity.bundleDigest}`)),
      publicationTag: `${validatedV03.bundleIdentity.publicationTag}-bundle-b`,
    },
    compatibility: {
      code: 'COMPATIBLE_PACKAGING_REVISION',
      reasons: ['newer packaging lineage B rev2'],
      matchedIdentities: validatedV03.compatibility.matchedIdentities,
    },
    rawArtifacts: validatedV03.rawArtifacts.map((artifact) => ({
      descriptor: { ...artifact.descriptor },
      bytes: Buffer.from(artifact.bytes),
    })),
  };
  assert.ok(packagingA.bundleIdentity.bundleRevision > packagingB.bundleIdentity.bundleRevision);
  const importA = await importValidatedActKGBundle(db, packagingA);
  assert.equal(importA.mode, 'packaging');
  // No sleep: accept stamps strictly monotonic importedAt under the release lock
  // (max(now, previousAccepted+1ms)), so same-ms wall-clock cannot erase order.
  const importB = await importValidatedActKGBundle(db, packagingB);
  assert.equal(importB.mode, 'packaging');

  const receiptA = await db.actkgBundleReceipt.findUniqueOrThrow({
    where: {
      bundleContractVersion_bundleDigest: {
        bundleContractVersion: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
        bundleDigest: packagingA.bundleIdentity.bundleDigest,
      },
    },
  });
  const receiptB = await db.actkgBundleReceipt.findUniqueOrThrow({
    where: {
      bundleContractVersion_bundleDigest: {
        bundleContractVersion: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
        bundleDigest: packagingB.bundleIdentity.bundleDigest,
      },
    },
  });
  assert.equal(receiptA.candidateState, ACCEPTED_CANDIDATE_STATE);
  assert.equal(receiptB.candidateState, ACCEPTED_CANDIDATE_STATE);
  assert.ok(
    receiptB.importedAt.getTime() > receiptA.importedAt.getTime(),
    `expected B.importedAt > A.importedAt, got A=${receiptA.importedAt.toISOString()} B=${receiptB.importedAt.toISOString()}`,
  );

  const crossBundleRead = await repository.read({
    authorityState: 'candidate',
    releaseSetId: validatedV03.releaseSetIdentity.releaseSetId,
    releaseId: validatedV03.releaseIdentity.releaseId,
  });
  assert.equal(crossBundleRead.status, 'available');
  if (crossBundleRead.status === 'available') {
    assert.equal(
      crossBundleRead.snapshot.bundleReceipt?.bundleId,
      packagingB.bundleIdentity.bundleId,
    );
    assert.equal(crossBundleRead.snapshot.bundleReceipt?.bundleRevision, 2);
    assert.equal(
      crossBundleRead.snapshot.bundleReceipt?.bundleDigest,
      packagingB.bundleIdentity.bundleDigest,
    );
    assert.notEqual(
      crossBundleRead.snapshot.bundleReceipt?.bundleDigest,
      packagingA.bundleIdentity.bundleDigest,
    );
    assert.ok(
      (crossBundleRead.snapshot.bundleReceipt?.importedAt.getTime() ?? 0)
        > receiptA.importedAt.getTime(),
    );
    // CLI-style verification for the selected latest packaging must not use A.
    const latestReceiptId = crossBundleRead.snapshot.bundleReceipt!.id;
    const latestReconstructed = await reconstructBundleArtifacts(db, latestReceiptId);
    assert.equal(latestReconstructed.length, packagingB.rawArtifacts.length);
    for (const reservedPath of ['bundle-manifest.json', 'SHA256SUMS'] as const) {
      const original = packagingB.rawArtifacts.find((row) => row.descriptor.path === reservedPath)!;
      const persisted = latestReconstructed.find((row) => row.relativePath === reservedPath)!;
      assert.equal(persisted.bytes.equals(original.bytes), true);
    }
  }

  // 5) Synthetic v0.4 semantic update through the compatibility validator.
  let validatedV04: ValidatedActKGBundle;
  try {
    validatedV04 = await buildValidatedSemanticV04ThroughCompatibility();
  } catch (error) {
    // Clean-Git capture or closed-world integrity may reject synthetic content
    // when worktree is dirty. Do not forge success.
    console.error(JSON.stringify({
      ok: false,
      phase: 'compatibility-v0.4',
      error: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = 1;
    throw error;
  }

  const semanticResult = await importValidatedActKGBundle(db, validatedV04);
  assert.equal(semanticResult.mode, 'content');
  assert.equal(semanticResult.releaseId, validatedV04.releaseIdentity.releaseId);
  assert.notEqual(semanticResult.releaseSetId, CURRENT_AGGREGATE_RELEASE_SET_ID);
  assert.notEqual(semanticResult.releaseSetId, validatedV03.releaseSetIdentity.releaseSetId);

  assert.deepEqual(await repository.read({ authorityState: 'active' }), {
    status: 'unavailable',
    selector: { authorityState: 'active' },
    reason: 'active-pointer-unavailable',
    diagnostics: [],
  });
  assert.deepEqual(await repository.read({ authorityState: 'legacy' }), {
    status: 'unavailable',
    selector: { authorityState: 'legacy' },
    reason: 'legacy-outside-repository',
    diagnostics: [],
  });

  console.log(JSON.stringify({
    ok: true,
    isolationMode: isolated.mode,
    schema: schemaName,
    exactReleaseId: CURRENT_AGGREGATE_RELEASE_ID,
    standardReleaseId: validatedV03.releaseIdentity.releaseId,
    packagingBundleDigest: packagingBase.bundleIdentity.bundleDigest,
    semanticReleaseId: validatedV04.releaseIdentity.releaseId,
    exactArtifactCount: exactArtifactsAfter.length,
    standardArtifactCount: reconstructed.length,
  }));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db) await db.$disconnect().catch(() => undefined);
    if (admin) {
      try {
        await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } catch {
        // best-effort cleanup
      }
      try {
        await admin.query(`DROP DATABASE IF EXISTS "${schemaName}" WITH (FORCE)`);
      } catch {
        // best-effort cleanup when isolation used CREATE DATABASE
      }
      await admin.end().catch(() => undefined);
    }
    if (fixtureDir) {
      await rm(fixtureDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
