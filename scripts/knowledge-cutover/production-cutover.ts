#!/usr/bin/env tsx

/**
 * Operator-side production data-plane activation for one already verified
 * versioned knowledge package. It is intentionally run in the target image:
 * the normal image build remains immutable while this tool uses its tested
 * first-activation coordinator and store implementations.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import {
  emptyTeachingSelectorFingerprint,
} from '../../src/lib/authoritative-knowledge/authority-snapshot';
import {
  activateAuthoritySnapshot,
  atomicWriteFile as atomicWriteAuthorityFile,
  loadStagedAuthoritySnapshot,
  resolveActiveAuthoritySnapshot,
  resolveAuthorityStorePaths,
} from '../../src/lib/authoritative-knowledge/authority-store';
import {
  resolveEngineeringGraphAuthority,
} from '../../src/lib/authoritative-knowledge/engineering-authority-consumers';
import {
  loadAuthorityDomainCatalogRuntime,
  resolveAuthorityDomainCatalogPaths,
} from '../../src/lib/authority-domain-catalog';
import {
  AUTHORITY_SHARD_CURRENT_CONTRACT,
  AUTHORITY_SHARD_ENVELOPE_CONTRACT,
  AUTHORITY_SHARD_SET_CONTRACT,
  buildAuthorityDomainShards,
  createTeachingOverlay,
  loadActiveShardContext,
  loadOptionalDomainTeachingProjection,
  readCurrentShardPointer,
  resolveAuthorityDomainShardPaths,
  shardDigest,
  shardSha256,
  shardSetDir,
  type AuthorityShardCurrentPointer,
  type AuthorityShardEnvelope,
  type AuthorityShardSetManifest,
} from '../../src/lib/authority-domain-shards';
import {
  executeFirstActivation,
  readFirstActivationJournal,
  recoverInterruptedFirstActivation,
  rollbackCommittedFirstActivation,
  type FirstActivationStep,
  type FirstActivationJournal,
} from '../../src/lib/knowledge-cutover/first-activation';
import {
  activatePrerequisitePublication,
  loadPrerequisitePublication,
  resolvePrerequisiteStorePaths,
} from '../../src/lib/teaching-projection/prerequisites';
import {
  activateTeachingProjection,
  loadStagedTeachingProjection,
  resolveActiveTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from '../../src/lib/teaching-projection/store';
import {
  activateConsumerActivation,
  loadStagedConsumerActivation,
  resolveActiveConsumerActivation,
  resolveConsumerActivation,
  resolveConsumerActivationStorePaths,
} from '../../src/lib/versioned-knowledge-activation';

const PLAN_CONTRACT = 'act-production-knowledge-cutover-plan/v1';
const RECEIPT_CONTRACT = 'act-production-knowledge-cutover-receipt/v1';
const MARKER_CONTRACT = 'act-production-knowledge-cutover-current/v1';
const OPERATOR_BUNDLE_CONTRACT = 'act-knowledge-cutover-operator-bundle/v1';
const SHA256 = /^[a-f0-9]{64}$/u;
const OCI_DIGEST = /^sha256:[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const IDENTITY_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const CONSUMERS = [
  'engineering-graph',
  'engineering-rag',
  'course-runtime',
  'konling',
  'teaching-resource-rag',
  'learning-path',
] as const;

type Component =
  | 'authority'
  | 'projection'
  | 'prerequisite'
  | 'authority-domain-shards'
  | 'consumer-activation';

interface FileDigest {
  path: string;
  sha256: string;
  size: number;
  group: 'authority' | 'runtime';
}

interface OperatorBundleFileDigest {
  path: string;
  sha256: string;
  size: number;
}

interface OperatorBundleManifest {
  contract: typeof OPERATOR_BUNDLE_CONTRACT;
  builderVersion: string;
  captureRevision: string;
  files: readonly OperatorBundleFileDigest[];
  bundleSha256: string;
}

interface OperatorBundleSeal extends OperatorBundleManifest {
  manifestSha256: string;
  archiveSha256: string;
}

interface PointerTarget {
  component: Component;
  path: string;
  id: string;
  hash: string;
  sourcePointerSha256: string;
}

interface ProductionCutoverPlan {
  contract: typeof PLAN_CONTRACT;
  transactionId: string;
  createdAt: string;
  source: {
    releaseTag: string;
    imageRevision: string;
    imageTag: string;
    imageConfigDigest: string;
    imageTarSha256: string;
    captureRevision: string;
    toolSha256: string;
    deploymentScriptSha256: string;
    cleanupEngineSha256: string;
  };
  operatorBundle: OperatorBundleSeal;
  authority: {
    snapshotId: string;
    snapshotHash: string;
    releaseId: string;
    releaseSetId: string;
    releaseHash: string;
  };
  projection: {
    projectionId: string;
    projectionHash: string;
  };
  prerequisite: {
    publicationId: string;
    publicationHash: string;
  };
  activation: {
    activationId: string;
    activationHash: string;
    readyConsumerIds: readonly string[];
  };
  authorityDomainShards: AuthorityShardCurrentPointer;
  pointers: readonly PointerTarget[];
  files: readonly FileDigest[];
  localFirstActivationReportSha256: string;
  planHash: string;
}

function fail(message: string): never {
  throw new Error(`production knowledge cutover: ${message}`);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  fail('plan contains an unsupported value');
}

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (!value || value.startsWith('--')) fail(`${name} is required`);
  return value;
}

function relativePath(value: string): string {
  const normalized = value.split(path.sep).join('/');
  if (
    normalized.length === 0
    || normalized.startsWith('/')
    || normalized.startsWith('../')
    || normalized.includes('/../')
    || normalized.includes('\\')
  ) fail(`unsafe relative path: ${value}`);
  return normalized;
}

function under(root: string, relative: string): string {
  const target = path.resolve(root, ...relativePath(relative).split('/'));
  const result = path.relative(root, target);
  if (result === '' || result.startsWith('..') || path.isAbsolute(result)) {
    fail(`path escapes root: ${relative}`);
  }
  return target;
}

function readJson<T>(filePath: string): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    fail(`cannot read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function hashFile(filePath: string): string {
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`expected regular file: ${filePath}`);
  return sha256(readFileSync(filePath));
}

function operatorBundleDigestBody(bundle: Pick<OperatorBundleManifest, 'contract' | 'builderVersion' | 'captureRevision' | 'files'>) {
  return {
    contract: bundle.contract,
    builderVersion: bundle.builderVersion,
    captureRevision: bundle.captureRevision,
    files: [...bundle.files],
  };
}

function assertOperatorBundleManifest(bundle: OperatorBundleManifest): void {
  assert(bundle.contract === OPERATOR_BUNDLE_CONTRACT, 'operator bundle contract mismatch');
  assert(TOKEN.test(bundle.builderVersion), 'operator bundle builder version is invalid');
  assert(COMMIT.test(bundle.captureRevision), 'operator bundle capture revision is invalid');
  assert(SHA256.test(bundle.bundleSha256), 'operator bundle digest is invalid');
  assert(bundle.files.length > 0, 'operator bundle contains no files');
  assert(new Set(bundle.files.map((file) => file.path)).size === bundle.files.length, 'operator bundle file paths are not unique');
  for (const file of bundle.files) {
    relativePath(file.path);
    assert(SHA256.test(file.sha256) && Number.isSafeInteger(file.size) && file.size >= 0, `invalid operator bundle file digest: ${file.path}`);
  }
  assert(
    sha256(canonicalJson(operatorBundleDigestBody(bundle))) === bundle.bundleSha256,
    'operator bundle digest mismatch',
  );
}

function collectOperatorBundleFiles(root: string): OperatorBundleFileDigest[] {
  const stat = lstatSync(root);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), 'operator bundle root must be a regular directory');
  const files: OperatorBundleFileDigest[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const full = path.join(directory, entry.name);
      const relative = path.relative(root, full).split(path.sep).join('/');
      if (entry.isSymbolicLink()) fail(`operator bundle symlink is forbidden: ${relative}`);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) {
        const stat = lstatSync(full);
        files.push({ path: relative, sha256: sha256(readFileSync(full)), size: stat.size });
      } else fail(`operator bundle contains unsupported entry: ${relative}`);
    }
  };
  visit(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function assertOperatorBundle(
  root: string,
  plan: ProductionCutoverPlan,
  bundleRoot: string,
  manifestPath: string,
): void {
  const manifestStat = lstatSync(manifestPath);
  assert(manifestStat.isFile() && !manifestStat.isSymbolicLink(), 'operator bundle manifest must be a regular file');
  assert(hashFile(manifestPath) === plan.operatorBundle.manifestSha256, 'operator bundle manifest hash mismatch');
  const manifest = readJson<OperatorBundleManifest>(manifestPath);
  assertOperatorBundleManifest(manifest);
  assert(manifest.captureRevision === plan.operatorBundle.captureRevision && manifest.captureRevision === plan.source.captureRevision, 'operator bundle capture revision mismatch');
  assert(manifest.bundleSha256 === plan.operatorBundle.bundleSha256, 'operator bundle identity mismatch');
  assert(manifest.files.length === plan.operatorBundle.files.length, 'operator bundle plan file count mismatch');
  const planFiles = new Map(plan.operatorBundle.files.map((file) => [file.path, file]));
  for (const file of manifest.files) {
    const planned = planFiles.get(file.path);
    assert(planned && planned.sha256 === file.sha256 && planned.size === file.size, `operator bundle plan digest mismatch: ${file.path}`);
  }
  const actualFiles = collectOperatorBundleFiles(bundleRoot);
  assert(actualFiles.length === manifest.files.length, 'operator bundle file set differs from manifest');
  for (const file of actualFiles) {
    const expected = planFiles.get(file.path);
    assert(expected && expected.sha256 === file.sha256 && expected.size === file.size, `operator bundle file digest mismatch: ${file.path}`);
  }
  assert(
    actualFiles.some((file) => file.path === 'scripts/knowledge-cutover/production-cutover.ts' && file.sha256 === plan.source.toolSha256),
    'operator bundle production-cutover.ts does not match the sealed tool digest',
  );
  // `root` is intentionally accepted as an explicit argument so callers can
  // keep all bundle paths outside the activation data root.  Touching it here
  // makes that separation visible to the type/runtime contract without
  // reading any host source fallback.
  assert(path.isAbsolute(root), 'operator bundle activation root must be absolute');
}

function collectFiles(root: string, relative: string, group: FileDigest['group']): FileDigest[] {
  const directory = under(root, relative);
  const results: FileDigest[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const full = path.join(dir, entry.name);
      const nested = path.relative(root, full).split(path.sep).join('/');
      if (entry.isSymbolicLink()) fail(`symlink is forbidden in sealed artifacts: ${nested}`);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) {
        const stat = lstatSync(full);
        results.push({ path: nested, sha256: sha256(readFileSync(full)), size: stat.size, group });
      } else fail(`unsupported sealed artifact entry: ${nested}`);
    }
  };
  if (!existsSync(directory)) fail(`artifact directory is missing: ${relative}`);
  visit(directory);
  return results;
}

function pointerExists(filePath: string): boolean {
  try {
    lstatSync(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function planBody(plan: ProductionCutoverPlan): Omit<ProductionCutoverPlan, 'planHash'> {
  const { planHash: _planHash, ...body } = plan;
  return body;
}

function assertPlan(plan: ProductionCutoverPlan): void {
  assert(plan.contract === PLAN_CONTRACT, 'plan contract mismatch');
  assert(TOKEN.test(plan.transactionId), 'plan transaction id is invalid');
  assert(TOKEN.test(plan.source.releaseTag), 'plan release tag is invalid');
  assert(COMMIT.test(plan.source.imageRevision), 'plan image revision is invalid');
  assert(COMMIT.test(plan.source.captureRevision), 'plan capture revision is invalid');
  assert(TOKEN.test(plan.source.imageTag.replaceAll(':', '-').replaceAll('/', '-')), 'plan image tag is invalid');
  assert(OCI_DIGEST.test(plan.source.imageConfigDigest), 'plan image config digest is invalid');
  assert(SHA256.test(plan.source.imageTarSha256), 'plan image tar hash is invalid');
  assert(SHA256.test(plan.source.toolSha256), 'plan tool hash is invalid');
  assert(SHA256.test(plan.source.deploymentScriptSha256), 'plan deployment script hash is invalid');
  assert(SHA256.test(plan.source.cleanupEngineSha256), 'plan cleanup engine hash is invalid');
  assert(SHA256.test(plan.localFirstActivationReportSha256), 'plan first-activation report hash is invalid');
  assertOperatorBundleManifest(plan.operatorBundle);
  assert(SHA256.test(plan.operatorBundle.manifestSha256), 'plan operator bundle manifest hash is invalid');
  assert(SHA256.test(plan.operatorBundle.archiveSha256), 'plan operator bundle archive hash is invalid');
  assert(plan.operatorBundle.captureRevision === plan.source.captureRevision, 'plan operator bundle capture revision mismatch');
  assert(SHA256.test(plan.planHash), 'plan hash is invalid');
  assert(sha256(canonicalJson(planBody(plan))) === plan.planHash, 'plan hash mismatch');
  assert(plan.pointers.length === 5, 'plan must define exactly five pointers');
  assert(new Set(plan.pointers.map((pointer) => pointer.component)).size === 5, 'plan pointer components are not unique');
  assert(new Set(plan.pointers.map((pointer) => pointer.path)).size === 5, 'plan pointer paths are not unique');
  assert(
    plan.pointers.map((pointer) => pointer.component).join(',')
      === 'authority,projection,prerequisite,authority-domain-shards,consumer-activation',
    'plan pointer order is invalid',
  );
  for (const pointer of plan.pointers) {
    relativePath(pointer.path);
    assert(IDENTITY_TOKEN.test(pointer.id) && SHA256.test(pointer.hash), `invalid pointer target: ${pointer.component}`);
  }
  assert(IDENTITY_TOKEN.test(plan.authority.snapshotId) && SHA256.test(plan.authority.snapshotHash), 'invalid Authority snapshot identity');
  assert(IDENTITY_TOKEN.test(plan.authority.releaseId) && IDENTITY_TOKEN.test(plan.authority.releaseSetId) && SHA256.test(plan.authority.releaseHash), 'invalid Authority release identity');
  assert(IDENTITY_TOKEN.test(plan.projection.projectionId) && SHA256.test(plan.projection.projectionHash), 'invalid Teaching Projection identity');
  assert(IDENTITY_TOKEN.test(plan.prerequisite.publicationId) && SHA256.test(plan.prerequisite.publicationHash), 'invalid prerequisite publication identity');
  assert(IDENTITY_TOKEN.test(plan.activation.activationId) && SHA256.test(plan.activation.activationHash), 'invalid consumer activation identity');
  assert(plan.authorityDomainShards.contract === AUTHORITY_SHARD_CURRENT_CONTRACT, 'invalid Authority domain shard pointer contract');
  assert(IDENTITY_TOKEN.test(plan.authorityDomainShards.shardSetId) && SHA256.test(plan.authorityDomainShards.shardSetHash), 'invalid Authority domain shard set identity');
  assert(plan.authorityDomainShards.snapshotId === plan.authority.snapshotId && plan.authorityDomainShards.snapshotHash === plan.authority.snapshotHash, 'Authority domain shard snapshot identity mismatch');
  assert(plan.authorityDomainShards.releaseId === plan.authority.releaseId, 'Authority domain shard release identity mismatch');
  assert(IDENTITY_TOKEN.test(plan.authorityDomainShards.catalogId) && SHA256.test(plan.authorityDomainShards.catalogHash), 'invalid Authority domain shard catalog identity');
  assert(
    (plan.authorityDomainShards.teachingProjectionId === null && plan.authorityDomainShards.teachingProjectionHash === null)
      || (IDENTITY_TOKEN.test(plan.authorityDomainShards.teachingProjectionId) && SHA256.test(plan.authorityDomainShards.teachingProjectionHash)),
    'invalid Authority domain shard Teaching identity',
  );
  assert(typeof plan.authorityDomainShards.activatedAt === 'string' && plan.authorityDomainShards.activatedAt.length > 0, 'invalid Authority domain shard activation time');
  const shardPointer = plan.pointers.find((pointer) => pointer.component === 'authority-domain-shards');
  assert(shardPointer?.id === plan.authorityDomainShards.shardSetId && shardPointer.hash === plan.authorityDomainShards.shardSetHash, 'Authority domain shard pointer target mismatch');
  assert(plan.files.length > 0, 'plan has no sealed files');
  assert(new Set(plan.files.map((file) => file.path)).size === plan.files.length, 'plan file paths are not unique');
  for (const file of plan.files) {
    relativePath(file.path);
    assert(SHA256.test(file.sha256) && Number.isSafeInteger(file.size) && file.size >= 0, `invalid file digest: ${file.path}`);
  }
  assert(plan.activation.readyConsumerIds.length === CONSUMERS.length, 'plan does not include six ready consumers');
  assert([...plan.activation.readyConsumerIds].sort().join(',') === [...CONSUMERS].sort().join(','), 'plan ready consumers differ');
}

function componentPointer(plan: ProductionCutoverPlan, component: Component): PointerTarget {
  const pointer = plan.pointers.find((entry) => entry.component === component);
  if (!pointer) fail(`plan is missing ${component} pointer`);
  return pointer;
}

const AUTHORITY_SHARD_RUNTIME_RELATIVE =
  'course-content/runtime/knowledge/authority-domain-shards';
const AUTHORITY_SHARD_CATALOG_RUNTIME_RELATIVE =
  'course-content/runtime/knowledge/authority-domain-catalog';

function collectFilesIfPresent(
  root: string,
  relative: string,
  group: FileDigest['group'],
): FileDigest[] {
  return existsSync(under(root, relative))
    ? collectFiles(root, relative, group)
    : [];
}

function buildAuthorityDomainShardSet(input: {
  root: string;
  authority: ReturnType<typeof loadStagedAuthoritySnapshot>;
  catalog: ReturnType<typeof loadAuthorityDomainCatalogRuntime>;
  activationId: string;
  activationHash: string;
  activatedAt: string;
}): ReturnType<typeof buildAuthorityDomainShards> {
  const teachingResolution = loadOptionalDomainTeachingProjection({
    repoRoot: input.root,
    authority: {
      releaseId: input.authority.manifest.releaseId,
      releaseSetId: input.authority.manifest.releaseSetId,
      snapshotId: input.authority.snapshotId,
      snapshotHash: input.authority.snapshotHash,
    },
  });
  const teachingPointer = teachingResolution.pointer;
  const envelope: AuthorityShardEnvelope = {
    contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
    authority: {
      snapshotId: input.authority.snapshotId,
      snapshotHash: input.authority.snapshotHash,
      releaseId: input.authority.manifest.releaseId,
      releaseSetId: input.authority.manifest.releaseSetId,
      activationId: input.activationId,
      activationHash: input.activationHash,
      projectionId: null,
      projectionHash: null,
    },
    catalog: {
      catalogId: input.catalog.catalogId,
      catalogHash: input.catalog.catalogHash,
      catalogVersion: input.catalog.catalogVersion,
    },
    teaching: teachingPointer
      ? {
          status: teachingResolution.artifacts ? 'available' : 'unavailable',
          projectionId: teachingPointer.projectionId,
          projectionHash: teachingPointer.projectionHash,
          teachingCacheFamily: teachingPointer.teachingCacheFamily,
        }
      : {
          status: 'unavailable',
          projectionId: null,
          projectionHash: null,
          teachingCacheFamily: null,
        },
    match: {
      authority: true,
      catalog: true,
      teaching: teachingPointer ? Boolean(teachingResolution.artifacts) : null,
    },
  };
  return buildAuthorityDomainShards({
    envelope,
    catalog: input.catalog,
    engineering: input.authority.engineering,
    teaching: createTeachingOverlay(teachingPointer, {
      artifacts: teachingResolution.artifacts,
      forceUnavailable: Boolean(teachingPointer && !teachingResolution.artifacts),
    }),
    activatedAt: input.activatedAt,
  });
}

function materializeShardFiles(
  root: string,
  materialized: ReturnType<typeof buildAuthorityDomainShards>,
): void {
  const paths = resolveAuthorityDomainShardPaths(root);
  const target = shardSetDir(paths, materialized.manifest.shardSetId);
  const writeAndVerify = (directory: string): void => {
    for (const [relative, value] of Object.entries(materialized.files)) {
      const filePath = path.join(directory, relative);
      const raw = `${JSON.stringify(value, null, 2)}\n`;
      writeJsonAtomic(filePath, value);
      assert(hashFile(filePath) === shardSha256(raw), `Authority domain shard artifact write mismatch: ${relative}`);
    }
  };
  if (pointerExists(target)) {
    const targetStat = lstatSync(target);
    assert(targetStat.isDirectory() && !targetStat.isSymbolicLink(), 'Authority domain shard set directory must be a regular directory');
    for (const [relative, value] of Object.entries(materialized.files)) {
      const filePath = path.join(target, relative);
      const raw = `${JSON.stringify(value, null, 2)}\n`;
      assert(pointerExists(filePath) && hashFile(filePath) === shardSha256(raw), `Authority domain shard artifact drift: ${relative}`);
    }
    return;
  }
  const staging = `${target}.staging-${process.pid}`;
  assert(!pointerExists(staging), 'Authority domain shard staging directory already exists');
  writeAndVerify(staging);
  renameSync(staging, target);
}

function sealedShardFiles(
  materialized: ReturnType<typeof buildAuthorityDomainShards>,
): FileDigest[] {
  const prefix = `${AUTHORITY_SHARD_RUNTIME_RELATIVE}/sets/${materialized.manifest.shardSetId}`;
  return Object.entries(materialized.files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([relative, value]) => {
      const raw = `${JSON.stringify(value, null, 2)}\n`;
      return {
        path: `${prefix}/${relative}`,
        sha256: shardSha256(raw),
        size: Buffer.byteLength(raw, 'utf8'),
        group: 'runtime' as const,
      };
    });
}

function shardSetPrefix(plan: ProductionCutoverPlan): string {
  return `${AUTHORITY_SHARD_RUNTIME_RELATIVE}/sets/${plan.authorityDomainShards.shardSetId}/`;
}

function assertSealedShardSet(
  root: string,
  plan: ProductionCutoverPlan,
  options: { allowAbsent?: boolean } = {},
): void {
  const pointer = plan.authorityDomainShards;
  const prefix = shardSetPrefix(plan);
  const setPath = under(root, prefix.slice(0, -1));
  if (!pointerExists(setPath)) {
    assert(options.allowAbsent, 'Authority domain shard set is missing');
    return;
  }
  const planFiles = new Map(
    plan.files
      .filter((file) => file.path.startsWith(prefix))
      .map((file) => [file.path.slice(prefix.length), file]),
  );
  assert(planFiles.size > 0, 'plan has no sealed Authority domain shard files');
  const manifest = readJson<AuthorityShardSetManifest>(
    under(root, `${prefix}manifest.json`),
  );
  assert(manifest.contract === AUTHORITY_SHARD_SET_CONTRACT, 'Authority domain shard manifest contract mismatch');
  assert(manifest.shardSetId === pointer.shardSetId && manifest.shardSetHash === pointer.shardSetHash, 'Authority domain shard manifest identity mismatch');
  assert(manifest.envelope.authority.snapshotId === plan.authority.snapshotId && manifest.envelope.authority.snapshotHash === plan.authority.snapshotHash, 'Authority domain shard manifest snapshot mismatch');
  assert(manifest.envelope.authority.releaseId === plan.authority.releaseId, 'Authority domain shard manifest release mismatch');
  assert(manifest.envelope.catalog.catalogId === pointer.catalogId && manifest.envelope.catalog.catalogHash === pointer.catalogHash, 'Authority domain shard manifest catalog mismatch');
  assert(manifest.envelope.teaching.projectionId === pointer.teachingProjectionId && manifest.envelope.teaching.projectionHash === pointer.teachingProjectionHash, 'Authority domain shard manifest Teaching identity mismatch');
  assert(
    manifest.shardSetHash === shardDigest({ envelope: manifest.envelope, files: manifest.files })
      && manifest.shardSetId === `ads-${manifest.shardSetHash}`,
    'Authority domain shard manifest seal mismatch',
  );
  for (const [relative, digest] of Object.entries(manifest.files)) {
    const file = planFiles.get(relative);
    assert(file && file.sha256 === digest, `Authority domain shard file is not sealed in plan: ${relative}`);
    const full = under(root, `${prefix}${relative}`);
    assert(pointerExists(full), `Authority domain shard file is missing: ${relative}`);
    assert(hashFile(full) === digest, `Authority domain shard file hash mismatch: ${relative}`);
  }
  assert(planFiles.size === Object.keys(manifest.files).length + 1, 'plan Authority domain shard file set differs from manifest');
  const actualFiles = collectFiles(root, prefix.slice(0, -1), 'runtime')
    .map((file) => file.path.slice(prefix.length))
    .sort();
  const expectedFiles = ['manifest.json', ...Object.keys(manifest.files)].sort();
  assert(actualFiles.join('\n') === expectedFiles.join('\n'), 'Authority domain shard file set differs from manifest');
}

function buildPlannedAuthorityDomainShardSet(
  root: string,
  plan: ProductionCutoverPlan,
): ReturnType<typeof buildAuthorityDomainShards> {
  const authority = loadStagedAuthoritySnapshot(
    resolveAuthorityStorePaths(under(root, 'course-content/authoring/knowledge/authority')),
    plan.authority.snapshotId,
  );
  assert(authority.snapshotHash === plan.authority.snapshotHash, 'staged Authority snapshot hash mismatch for domain shards');
  const catalog = loadAuthorityDomainCatalogRuntime(
    resolveAuthorityDomainCatalogPaths(root),
    {
      snapshotId: plan.authority.snapshotId,
      snapshotHash: plan.authority.snapshotHash,
      releaseId: plan.authority.releaseId,
      releaseSetId: plan.authority.releaseSetId,
    },
  );
  const materialized = buildAuthorityDomainShardSet({
    root,
    authority,
    catalog,
    activationId: plan.activation.activationId,
    activationHash: plan.activation.activationHash,
    activatedAt: plan.authorityDomainShards.activatedAt,
  });
  assert(materialized.manifest.shardSetId === plan.authorityDomainShards.shardSetId && materialized.manifest.shardSetHash === plan.authorityDomainShards.shardSetHash, 'planned Authority domain shard identity changed');
  assert(materialized.pointer.catalogId === plan.authorityDomainShards.catalogId && materialized.pointer.catalogHash === plan.authorityDomainShards.catalogHash, 'planned Authority domain shard catalog changed');
  assert(materialized.pointer.teachingProjectionId === plan.authorityDomainShards.teachingProjectionId && materialized.pointer.teachingProjectionHash === plan.authorityDomainShards.teachingProjectionHash, 'planned Authority domain shard Teaching identity changed');
  return materialized;
}

function buildPlan(): ProductionCutoverPlan {
  const root = path.resolve(option('--repo-root'));
  const output = path.resolve(option('--output'));
  const transactionId = option('--transaction-id');
  const releaseTag = option('--release-tag');
  const imageRevision = option('--image-revision');
  const imageTag = option('--image-tag');
  const imageConfigDigest = option('--image-config-digest');
  const imageTarSha256 = option('--image-tar-sha256');
  const deploymentScript = path.resolve(option('--deployment-script'));
  const cleanupEngine = path.resolve(option('--cleanup-engine'));
  const operatorBundleManifestPath = path.resolve(option('--operator-bundle-manifest'));
  const operatorBundleArchivePath = path.resolve(option('--operator-bundle-archive'));
  if (!COMMIT.test(imageRevision)) fail('image revision must be one lowercase Git commit');
  if (!OCI_DIGEST.test(imageConfigDigest)) fail('image config digest must be one sha256 OCI digest');
  if (!SHA256.test(imageTarSha256)) fail('image tar hash must be one sha256 digest');
  const authorityPointerPath = 'course-content/authoring/knowledge/authority/current.json';
  const projectionPointerPath = 'course-content/runtime/knowledge/projection/current.json';
  const prerequisitePointerPath = 'course-content/runtime/knowledge/prerequisites/current.json';
  const shardPointerPath = `${AUTHORITY_SHARD_RUNTIME_RELATIVE}/current.json`;
  const consumerPointerPath = 'course-content/runtime/knowledge/consumer-activation/current.json';
  const authorityPointer = readJson<Record<string, string>>(under(root, authorityPointerPath));
  const projectionPointer = readJson<Record<string, string>>(under(root, projectionPointerPath));
  const prerequisitePointer = readJson<Record<string, string>>(under(root, prerequisitePointerPath));
  const consumerPointer = readJson<Record<string, string>>(under(root, consumerPointerPath));
  const authorityManifestPath = `course-content/authoring/knowledge/authority/releases/${authorityPointer.snapshotId}/manifest.json`;
  const authorityManifest = readJson<Record<string, string>>(under(root, authorityManifestPath));
  const projectionManifestPath = `course-content/runtime/knowledge/projection/releases/${projectionPointer.projectionId}/projection-manifest.json`;
  const projectionManifest = readJson<Record<string, string>>(under(root, projectionManifestPath));
  const prerequisiteManifestPath = `course-content/runtime/knowledge/prerequisites/releases/${prerequisitePointer.publicationId}/publication-manifest.json`;
  const prerequisiteManifest = readJson<Record<string, string>>(under(root, prerequisiteManifestPath));
  const activationPath = `course-content/runtime/knowledge/consumer-activation/releases/${consumerPointer.activationId}/activation.json`;
  const activation = readJson<Record<string, unknown>>(under(root, activationPath));
  const stagedAuthority = loadStagedAuthoritySnapshot(
    resolveAuthorityStorePaths(under(root, 'course-content/authoring/knowledge/authority')),
    authorityPointer.snapshotId,
  );
  const catalog = loadAuthorityDomainCatalogRuntime(
    resolveAuthorityDomainCatalogPaths(root),
    {
      snapshotId: authorityPointer.snapshotId,
      snapshotHash: authorityPointer.snapshotHash,
      releaseId: authorityManifest.releaseId!,
      releaseSetId: authorityManifest.releaseSetId!,
    },
  );
  const consumers = Array.isArray(activation.consumers) ? activation.consumers as Array<Record<string, unknown>> : [];
  const ready = consumers.filter((row) => row.status === 'READY');
  const captureRevisions = new Set(ready.map((row) => (row.combination as Record<string, unknown> | null)?.captureRevision).filter((value): value is string => typeof value === 'string'));
  assert(captureRevisions.size === 1, 'ready consumers do not share one capture revision');
  const captureRevision = [...captureRevisions][0]!;
  const operatorBundleManifest = readJson<OperatorBundleManifest>(operatorBundleManifestPath);
  assertOperatorBundleManifest(operatorBundleManifest);
  assert(operatorBundleManifest.captureRevision === captureRevision, 'operator bundle capture revision does not match staged activation');
  assert(authorityPointer.snapshotId === authorityManifest.snapshotId && authorityPointer.snapshotHash === authorityManifest.snapshotHash, 'authority pointer does not match manifest');
  assert(projectionPointer.projectionId === projectionManifest.projectionId && projectionPointer.projectionHash === projectionManifest.projectionHash, 'projection pointer does not match manifest');
  assert(prerequisitePointer.publicationId === prerequisiteManifest.publicationId && prerequisitePointer.publicationHash === prerequisiteManifest.publicationHash, 'prerequisite pointer does not match manifest');
  assert(consumerPointer.activationId === activation.activationId && consumerPointer.activationHash === activation.activationHash, 'consumer pointer does not match activation');
  assert(authorityManifest.releaseId === projectionManifest.authorityReleaseId && authorityManifest.releaseId === prerequisiteManifest.authorityReleaseId, 'Authority release is not closed across projection artifacts');
  assert(ready.length === CONSUMERS.length && ready.every((row) => CONSUMERS.includes(String(row.consumerId) as typeof CONSUMERS[number])), 'activation does not declare six READY consumers');
  for (const row of ready) {
    const combination = row.combination as Record<string, unknown>;
    assert(combination?.authoritySnapshotId === authorityManifest.snapshotId, `consumer snapshot mismatch: ${String(row.consumerId)}`);
    assert(combination?.authoritySnapshotHash === authorityManifest.snapshotHash, `consumer snapshot hash mismatch: ${String(row.consumerId)}`);
    assert(combination?.authorityReleaseId === authorityManifest.releaseId, `consumer release mismatch: ${String(row.consumerId)}`);
    if (row.consumerId === 'engineering-graph' || row.consumerId === 'engineering-rag') {
      assert(combination?.projectionId === null && combination?.projectionHash === null, `engineering consumer unexpectedly requires a projection: ${String(row.consumerId)}`);
    } else {
      assert(combination?.projectionId === projectionManifest.projectionId, `consumer projection mismatch: ${String(row.consumerId)}`);
      assert(combination?.projectionHash === projectionManifest.projectionHash, `consumer projection hash mismatch: ${String(row.consumerId)}`);
    }
  }
  const shardActivatedAt = new Date().toISOString();
  const materializedShards = buildAuthorityDomainShardSet({
    root,
    authority: stagedAuthority,
    catalog,
    activationId: String(activation.activationId),
    activationHash: String(activation.activationHash),
    activatedAt: shardActivatedAt,
  });
  const authorityRoot = 'course-content/authoring/knowledge/authority';
  const files = [
    ...collectFiles(root, authorityRoot, 'authority').filter((file) => file.path !== authorityPointerPath),
    ...collectFiles(root, `course-content/runtime/knowledge/projection/releases/${projectionPointer.projectionId}`, 'runtime'),
    ...collectFiles(root, `course-content/runtime/knowledge/prerequisites/releases/${prerequisitePointer.publicationId}`, 'runtime'),
    ...collectFiles(root, `course-content/runtime/knowledge/consumer-activation/releases/${consumerPointer.activationId}`, 'runtime'),
    ...sealedShardFiles(materializedShards),
    ...collectFiles(root, AUTHORITY_SHARD_CATALOG_RUNTIME_RELATIVE, 'runtime'),
    ...collectFilesIfPresent(root, 'course-content/runtime/knowledge/teaching-projection/domain-fragments', 'runtime'),
    (() => {
      const relative = `course-content/runtime/knowledge/consumer-activation/activations/${consumerPointer.activationReceiptId}.json`;
      const full = under(root, relative);
      return [{ path: relative, sha256: hashFile(full), size: lstatSync(full).size, group: 'runtime' as const }];
    })(),
  ].flat().sort((left, right) => left.path.localeCompare(right.path));
  const operatorBundle: OperatorBundleSeal = {
    ...operatorBundleManifest,
    manifestSha256: hashFile(operatorBundleManifestPath),
    archiveSha256: hashFile(operatorBundleArchivePath),
  };
  const reportPath = 'artifacts/actkg-cutover-preparation/1a56317aa44e46322be0b0d1ac73948c03c5c2c0/activation/first-activation-report.json';
  const body = {
    contract: PLAN_CONTRACT,
    transactionId,
    createdAt: new Date().toISOString(),
    source: {
      releaseTag,
      imageRevision,
      imageTag,
      imageConfigDigest,
      imageTarSha256,
      captureRevision,
      toolSha256: hashFile(path.resolve(process.argv[1]!)),
      deploymentScriptSha256: hashFile(deploymentScript),
      cleanupEngineSha256: hashFile(cleanupEngine),
    },
    operatorBundle,
    authority: {
      snapshotId: authorityManifest.snapshotId!,
      snapshotHash: authorityManifest.snapshotHash!,
      releaseId: authorityManifest.releaseId!,
      releaseSetId: authorityManifest.releaseSetId!,
      releaseHash: authorityManifest.releaseHash!,
    },
    projection: { projectionId: projectionManifest.projectionId!, projectionHash: projectionManifest.projectionHash! },
    prerequisite: { publicationId: prerequisiteManifest.publicationId!, publicationHash: prerequisiteManifest.publicationHash! },
    activation: { activationId: String(activation.activationId), activationHash: String(activation.activationHash), readyConsumerIds: [...CONSUMERS] },
    authorityDomainShards: materializedShards.pointer,
    pointers: [
      { component: 'authority' as const, path: authorityPointerPath, id: authorityManifest.snapshotId!, hash: authorityManifest.snapshotHash!, sourcePointerSha256: hashFile(under(root, authorityPointerPath)) },
      { component: 'projection' as const, path: projectionPointerPath, id: projectionManifest.projectionId!, hash: projectionManifest.projectionHash!, sourcePointerSha256: hashFile(under(root, projectionPointerPath)) },
      { component: 'prerequisite' as const, path: prerequisitePointerPath, id: prerequisiteManifest.publicationId!, hash: prerequisiteManifest.publicationHash!, sourcePointerSha256: hashFile(under(root, prerequisitePointerPath)) },
      { component: 'authority-domain-shards' as const, path: shardPointerPath, id: materializedShards.pointer.shardSetId, hash: materializedShards.pointer.shardSetHash, sourcePointerSha256: sha256(`${JSON.stringify(materializedShards.pointer, null, 2)}\n`) },
      { component: 'consumer-activation' as const, path: consumerPointerPath, id: String(activation.activationId), hash: String(activation.activationHash), sourcePointerSha256: hashFile(under(root, consumerPointerPath)) },
    ],
    files,
    localFirstActivationReportSha256: hashFile(under(root, reportPath)),
  };
  const plan: ProductionCutoverPlan = { ...body, planHash: sha256(canonicalJson(body)) };
  assertPlan(plan);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ transactionId, planHash: plan.planHash, fileCount: plan.files.length }, null, 2)}\n`);
  return plan;
}

function readPlan(): ProductionCutoverPlan {
  const plan = readJson<ProductionCutoverPlan>(path.resolve(option('--plan')));
  assertPlan(plan);
  const actualToolHash = hashFile(path.resolve(process.argv[1]!));
  assert(actualToolHash === plan.source.toolSha256, 'operator tool hash does not match sealed plan');
  assert(process.env.APP_REVISION === plan.source.imageRevision, 'container image revision does not match sealed plan');
  return plan;
}

function optionalOption(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} is required when the bundle option is present`);
  return value;
}

function verifyRuntimeOperatorBundle(plan: ProductionCutoverPlan): void {
  const bundleRoot = optionalOption('--bundle-root');
  const manifestPath = optionalOption('--bundle-manifest');
  if (!bundleRoot && !manifestPath) return;
  assert(bundleRoot && manifestPath, 'operator bundle root and manifest must be supplied together');
  assertOperatorBundle(path.resolve(option('--root')), plan, path.resolve(bundleRoot), path.resolve(manifestPath));
}

function pathsFor(root: string) {
  return {
    authority: resolveAuthorityStorePaths(under(root, 'course-content/authoring/knowledge/authority')),
    projection: resolveTeachingProjectionStorePaths(under(root, 'course-content/runtime/knowledge/projection')),
    prerequisite: resolvePrerequisiteStorePaths(under(root, 'course-content/runtime/knowledge/prerequisites')),
    consumer: resolveConsumerActivationStorePaths(under(root, 'course-content/runtime/knowledge/consumer-activation')),
    shards: resolveAuthorityDomainShardPaths(root),
    transactionDir: under(root, 'course-content/runtime/knowledge/production-cutover-transactions'),
  };
}

function assertSealedFiles(
  root: string,
  plan: ProductionCutoverPlan,
  options: {
    allowCommittedReceipts?: boolean;
    allowAbsentShardSet?: boolean;
  } = {},
): void {
  for (const file of plan.files) {
    const full = under(root, file.path);
    if (
      options.allowAbsentShardSet
      && file.path.startsWith(shardSetPrefix(plan))
      && !pointerExists(full)
    ) continue;
    assert(pointerExists(full), `sealed artifact is missing: ${file.path}`);
    assert(hashFile(full) === file.sha256, `sealed artifact hash mismatch: ${file.path}`);
    assert(lstatSync(full).size === file.size, `sealed artifact size mismatch: ${file.path}`);
  }
  const authorityExpected = new Set(plan.files.filter((file) => file.group === 'authority').map((file) => file.path));
  const authorityRoot = 'course-content/authoring/knowledge/authority';
  for (const actual of collectFiles(root, authorityRoot, 'authority')) {
    if (actual.path === componentPointer(plan, 'authority').path) continue;
    if (
      options.allowCommittedReceipts
      && actual.path === `${authorityRoot}/activations/${plan.transactionId}-authority.json`
    ) continue;
    assert(authorityExpected.has(actual.path), `Authority store contains an unexpected artifact: ${actual.path}`);
  }
}

function assertStagedArtifacts(
  root: string,
  plan: ProductionCutoverPlan,
  options: {
    allowCommittedReceipts?: boolean;
    allowAbsentShardSet?: boolean;
  } = {},
): ReturnType<typeof pathsFor> {
  const paths = pathsFor(root);
  assertSealedFiles(root, plan, options);
  assertSealedShardSet(root, plan, { allowAbsent: options.allowAbsentShardSet });
  const authority = loadStagedAuthoritySnapshot(paths.authority, plan.authority.snapshotId);
  assert(authority.snapshotHash === plan.authority.snapshotHash && authority.manifest.releaseId === plan.authority.releaseId && authority.manifest.releaseSetId === plan.authority.releaseSetId, 'staged Authority identity mismatch');
  const projection = loadStagedTeachingProjection(paths.projection, plan.projection.projectionId);
  assert(projection.projectionHash === plan.projection.projectionHash && projection.artifacts.manifest.authorityReleaseId === plan.authority.releaseId, 'staged projection identity mismatch');
  const prerequisite = loadPrerequisitePublication(paths.prerequisite, plan.prerequisite.publicationId);
  assert(prerequisite.manifest.publicationHash === plan.prerequisite.publicationHash && prerequisite.manifest.authorityReleaseId === plan.authority.releaseId && prerequisite.gate.passed, 'staged prerequisite identity mismatch');
  const activation = loadStagedConsumerActivation(paths.consumer, plan.activation.activationId);
  assert(activation.activationHash === plan.activation.activationHash, 'staged consumer activation hash mismatch');
  assert([...activation.manifest.impact.readyConsumerIds].sort().join(',') === [...CONSUMERS].sort().join(','), 'staged activation does not make all six consumers READY');
  return paths;
}

function assertPointersAbsent(root: string, plan: ProductionCutoverPlan): void {
  for (const pointer of plan.pointers) {
    assert(!pointerExists(under(root, pointer.path)), `first activation requires absent pointer: ${pointer.component}`);
  }
}

function markerPath(paths: ReturnType<typeof pathsFor>): string {
  return path.join(paths.transactionDir, 'current.json');
}

function receiptPath(paths: ReturnType<typeof pathsFor>, transactionId: string): string {
  return path.join(paths.transactionDir, `${transactionId}.json`);
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  atomicWriteAuthorityFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertActive(root: string, plan: ProductionCutoverPlan): Record<string, unknown> {
  const paths = pathsFor(root);
  const authority = resolveActiveAuthoritySnapshot(paths.authority);
  assert(authority.status === 'available' && authority.pointer.snapshotId === plan.authority.snapshotId && authority.pointer.snapshotHash === plan.authority.snapshotHash, 'active Authority post-read mismatch');
  const projection = resolveActiveTeachingProjection(paths.projection);
  assert(projection.status === 'available' && projection.staged?.projectionId === plan.projection.projectionId && projection.staged.projectionHash === plan.projection.projectionHash, 'active projection post-read mismatch');
  const consumer = resolveActiveConsumerActivation(paths.consumer);
  assert(consumer.status === 'available' && consumer.pointer?.activationId === plan.activation.activationId && consumer.pointer.activationHash === plan.activation.activationHash, 'active consumer post-read mismatch');
  for (const consumerId of CONSUMERS) {
    const resolved = resolveConsumerActivation(paths.consumer, consumerId);
    assert(resolved.status === 'ready' && resolved.combination?.authoritySnapshotId === plan.authority.snapshotId, `active consumer is not READY: ${consumerId}`);
    if (consumerId !== 'engineering-graph' && consumerId !== 'engineering-rag') {
      assert(resolved.combination?.projectionId === plan.projection.projectionId, `active teaching consumer projection mismatch: ${consumerId}`);
    }
  }
  const prerequisitePointer = readJson<Record<string, string>>(
    under(root, componentPointer(plan, 'prerequisite').path),
  );
  assert(prerequisitePointer.publicationId === plan.prerequisite.publicationId && prerequisitePointer.publicationHash === plan.prerequisite.publicationHash, 'active prerequisite post-read mismatch');
  const activeShardPointer = readCurrentShardPointer(paths.shards);
  assert(
    activeShardPointer.shardSetId === plan.authorityDomainShards.shardSetId
      && activeShardPointer.shardSetHash === plan.authorityDomainShards.shardSetHash
      && activeShardPointer.snapshotId === plan.authorityDomainShards.snapshotId
      && activeShardPointer.snapshotHash === plan.authorityDomainShards.snapshotHash
      && activeShardPointer.releaseId === plan.authorityDomainShards.releaseId
      && activeShardPointer.catalogId === plan.authorityDomainShards.catalogId
      && activeShardPointer.catalogHash === plan.authorityDomainShards.catalogHash
      && activeShardPointer.teachingProjectionId === plan.authorityDomainShards.teachingProjectionId
      && activeShardPointer.teachingProjectionHash === plan.authorityDomainShards.teachingProjectionHash,
    'active Authority domain shard pointer mismatch',
  );
  const shardContext = loadActiveShardContext({ repoRoot: root });
  assert(
    shardContext.manifest.shardSetId === plan.authorityDomainShards.shardSetId
      && shardContext.manifest.shardSetHash === plan.authorityDomainShards.shardSetHash,
    'active Authority domain shard post-read mismatch',
  );
  assert(process.env.ACT_AUTHORITY_STORE_ROOT === paths.authority.root, 'read-only graph query must use the mounted Authority store');
  assert(process.env.ACT_CONSUMER_ACTIVATION_ROOT === paths.consumer.root, 'read-only graph query must use the mounted consumer activation store');
  const graphQuery = resolveEngineeringGraphAuthority(paths.authority);
  assert(
    graphQuery.status === 'ready'
      && graphQuery.snapshotId === plan.authority.snapshotId
      && graphQuery.releaseId === plan.authority.releaseId
      && graphQuery.activationMode === 'use-combination',
    'read-only Engineering Graph query did not resolve the selected activation combination',
  );
  return {
    authorityReleaseId: authority.snapshot.manifest.releaseId,
    authoritySnapshotId: authority.snapshot.snapshotId,
    authorityObjectCount: authority.snapshot.manifest.objectCount,
    authorityRelationCount: authority.snapshot.manifest.relationCount,
    engineeringGraphActivationMode: graphQuery.activationMode,
    projectionId: projection.staged.projectionId,
    shardSetId: shardContext.manifest.shardSetId,
    activationId: consumer.pointer.activationId,
    readyConsumerIds: [...CONSUMERS],
  };
}

function activationSteps(root: string, plan: ProductionCutoverPlan): FirstActivationStep[] {
  const paths = pathsFor(root);
  const activatedAt = new Date().toISOString();
  const receiptBase = `${plan.transactionId}`;
  return [
    {
      component: 'authority',
      pointerPath: under(root, componentPointer(plan, 'authority').path),
      target: { component: 'authority', id: plan.authority.snapshotId, hash: plan.authority.snapshotHash },
      activate: () => {
        const result = activateAuthoritySnapshot(paths.authority, {
          snapshotId: plan.authority.snapshotId,
          teachingSelectors: emptyTeachingSelectorFingerprint(),
          activatedAt,
          activationReceiptId: `${receiptBase}-authority`,
        });
        assert(result.status === 'activated', `Authority activation failed: ${result.receipt.reasons.join(';')}`);
      },
    },
    {
      component: 'projection',
      pointerPath: under(root, componentPointer(plan, 'projection').path),
      target: { component: 'projection', id: plan.projection.projectionId, hash: plan.projection.projectionHash },
      activate: () => {
        const result = activateTeachingProjection(paths.projection, { projectionId: plan.projection.projectionId, activatedAt });
        assert(result.status === 'activated', `Teaching Projection activation failed: ${result.reasons.join(';')}`);
      },
    },
    {
      component: 'prerequisite',
      pointerPath: under(root, componentPointer(plan, 'prerequisite').path),
      target: { component: 'prerequisite', id: plan.prerequisite.publicationId, hash: plan.prerequisite.publicationHash },
      activate: () => { activatePrerequisitePublication(paths.prerequisite, plan.prerequisite.publicationId, { activatedAt }); },
    },
    {
      component: 'authority-domain-shards',
      pointerPath: under(root, componentPointer(plan, 'authority-domain-shards').path),
      target: { component: 'authority-domain-shards', id: plan.authorityDomainShards.shardSetId, hash: plan.authorityDomainShards.shardSetHash },
      activate: () => {
        const materialized = buildPlannedAuthorityDomainShardSet(root, plan);
        materializeShardFiles(root, materialized);
        assertSealedShardSet(root, plan);
        writeJsonAtomic(paths.shards.currentPath, plan.authorityDomainShards);
      },
    },
    {
      component: 'consumer-activation',
      pointerPath: under(root, componentPointer(plan, 'consumer-activation').path),
      target: { component: 'consumer-activation', id: plan.activation.activationId, hash: plan.activation.activationHash },
      activate: () => {
        const result = activateConsumerActivation(paths.consumer, {
          activationId: plan.activation.activationId,
          activatedAt,
          activationReceiptId: `${receiptBase}-consumers`,
        });
        assert(result.status === 'activated', `consumer activation failed: ${result.receipt.reasons.join(';')}`);
      },
    },
  ];
}

function assertReceiptBinding(receipt: Record<string, string>, plan: ProductionCutoverPlan): void {
  assert(
    receipt.contract === RECEIPT_CONTRACT
      && receipt.transactionId === plan.transactionId
      && receipt.planHash === plan.planHash
      && receipt.imageRevision === plan.source.imageRevision
      && receipt.imageConfigDigest === plan.source.imageConfigDigest
      && receipt.imageTarSha256 === plan.source.imageTarSha256
      && receipt.captureRevision === plan.source.captureRevision,
    'production cutover receipt mismatch',
  );
}

function assertCommittedReceipt(receipt: Record<string, string>, plan: ProductionCutoverPlan): void {
  assertReceiptBinding(receipt, plan);
  assert(receipt.status === 'COMMITTED', 'production cutover receipt is not committed');
}

function assertRecoverableReceipt(receipt: Record<string, string>, plan: ProductionCutoverPlan): void {
  assertReceiptBinding(receipt, plan);
  assert(
    receipt.status === 'PREPARED' || receipt.status === 'POINTERS_VERIFIED',
    'production cutover receipt is not recoverable',
  );
}

function assertJournalMatchesPlan(
  root: string,
  plan: ProductionCutoverPlan,
  journal: FirstActivationJournal,
): void {
  assert(journal.transactionId === plan.transactionId, 'first-activation journal transaction mismatch');
  assert(journal.steps.length === plan.pointers.length, 'first-activation journal component count mismatch');
  for (const [index, pointer] of plan.pointers.entries()) {
    const step = journal.steps[index];
    assert(
      step
        && step.component === pointer.component
        && step.pointer.kind === 'repo-relative'
        && step.pointer.path === pointer.path
        && step.target.component === pointer.component
        && step.target.id === pointer.id
        && step.target.hash === pointer.hash,
      `first-activation journal identity mismatch: ${pointer.component}`,
    );
  }
  assert(
    journal.steps.every((step) => under(root, step.pointer.path) === under(root, componentPointer(plan, step.component).path)),
    'first-activation journal pointer path mismatch',
  );
}

function assertCommittedMarker(marker: Record<string, string>, plan: ProductionCutoverPlan): void {
  assert(
    marker.contract === MARKER_CONTRACT
      && marker.transactionId === plan.transactionId
      && marker.planHash === plan.planHash
      && marker.imageRevision === plan.source.imageRevision
      && marker.imageConfigDigest === plan.source.imageConfigDigest
      && marker.imageTarSha256 === plan.source.imageTarSha256
      && marker.captureRevision === plan.source.captureRevision
      && marker.status === 'COMMITTED',
    'production cutover marker mismatch',
  );
}

function runActivate(): void {
  const root = path.resolve(option('--root'));
  const plan = readPlan();
  verifyRuntimeOperatorBundle(plan);
  const paths = assertStagedArtifacts(root, plan, { allowAbsentShardSet: true });
  assertPointersAbsent(root, plan);
  mkdirSync(paths.transactionDir, { recursive: true });
  const journalPath = path.join(paths.consumer.root, 'first-activation-transactions', `${plan.transactionId}.json`);
  const lockPath = path.join(paths.consumer.root, '.production-first-activation.lock');
  const receipt = {
    contract: RECEIPT_CONTRACT,
    transactionId: plan.transactionId,
    planHash: plan.planHash,
    imageRevision: plan.source.imageRevision,
    imageConfigDigest: plan.source.imageConfigDigest,
    imageTarSha256: plan.source.imageTarSha256,
    captureRevision: plan.source.captureRevision,
    status: 'PREPARED',
    preparedAt: new Date().toISOString(),
  };
  writeJsonAtomic(receiptPath(paths, plan.transactionId), receipt);
  let committed = false;
  try {
    const journal = executeFirstActivation({
      repoRoot: root,
      journalPath,
      lockPath,
      transactionId: plan.transactionId,
      steps: activationSteps(root, plan),
      beforeActivate: (component) => {
        if (component !== 'authority') return;
        const materialized = buildPlannedAuthorityDomainShardSet(root, plan);
        materializeShardFiles(root, materialized);
        assertSealedShardSet(root, plan);
      },
      postCommit: () => {
        const verification = assertActive(root, plan);
        writeJsonAtomic(receiptPath(paths, plan.transactionId), { ...receipt, status: 'POINTERS_VERIFIED', verification, verifiedAt: new Date().toISOString() });
      },
    });
    committed = journal.status === 'COMMITTED';
    assert(committed, 'first-activation journal did not commit');
    const verification = assertActive(root, plan);
    writeJsonAtomic(receiptPath(paths, plan.transactionId), {
      ...receipt,
      status: 'COMMITTED',
      journalPath: path.relative(root, journalPath).split(path.sep).join('/'),
      journalHash: journal.journalHash,
      verification,
      committedAt: new Date().toISOString(),
    });
    writeJsonAtomic(markerPath(paths), {
      contract: MARKER_CONTRACT,
      transactionId: plan.transactionId,
      planHash: plan.planHash,
      imageRevision: plan.source.imageRevision,
      imageConfigDigest: plan.source.imageConfigDigest,
      imageTarSha256: plan.source.imageTarSha256,
      captureRevision: plan.source.captureRevision,
      status: 'COMMITTED',
      committedAt: new Date().toISOString(),
    });
    process.stdout.write(`${JSON.stringify({ status: 'COMMITTED', transactionId: plan.transactionId, planHash: plan.planHash, verification }, null, 2)}\n`);
  } catch (error) {
    if (committed && existsSync(journalPath)) {
      try { rollbackCommittedFirstActivation({ repoRoot: root, journalPath, lockPath }); } catch { /* preserve drift evidence */ }
    }
    throw error;
  }
}

function runVerify(): void {
  const root = path.resolve(option('--root'));
  const plan = readPlan();
  verifyRuntimeOperatorBundle(plan);
  assertStagedArtifacts(root, plan, { allowCommittedReceipts: true });
  const verification = assertActive(root, plan);
  const paths = pathsFor(root);
  const marker = readJson<Record<string, string>>(markerPath(paths));
  assertCommittedMarker(marker, plan);
  const receipt = readJson<Record<string, string>>(receiptPath(paths, plan.transactionId));
  assertCommittedReceipt(receipt, plan);
  process.stdout.write(`${JSON.stringify({ status: 'VERIFIED', transactionId: plan.transactionId, verification }, null, 2)}\n`);
}

function runRollback(): void {
  const root = path.resolve(option('--root'));
  const plan = readPlan();
  verifyRuntimeOperatorBundle(plan);
  const paths = pathsFor(root);
  const receipt = readJson<Record<string, string>>(receiptPath(paths, plan.transactionId));
  assertCommittedReceipt(receipt, plan);
  const marker = readJson<Record<string, string>>(markerPath(paths));
  assertCommittedMarker(marker, plan);
  const journalPath = path.join(paths.consumer.root, 'first-activation-transactions', `${plan.transactionId}.json`);
  const lockPath = path.join(paths.consumer.root, '.production-first-activation.lock');
  assertJournalMatchesPlan(root, plan, readFirstActivationJournal(journalPath));
  const journal = rollbackCommittedFirstActivation({ repoRoot: root, journalPath, lockPath });
  rmSync(markerPath(paths));
  writeJsonAtomic(path.join(paths.transactionDir, `${plan.transactionId}.rollback.json`), {
    contract: RECEIPT_CONTRACT,
    transactionId: plan.transactionId,
    planHash: plan.planHash,
    status: 'ROLLED_BACK',
    journalHash: journal.journalHash,
    rolledBackAt: new Date().toISOString(),
  });
  process.stdout.write(`${JSON.stringify({ status: 'ROLLED_BACK', transactionId: plan.transactionId, journalHash: journal.journalHash }, null, 2)}\n`);
}

function runRecover(): void {
  const root = path.resolve(option('--root'));
  const plan = readPlan();
  verifyRuntimeOperatorBundle(plan);
  const paths = pathsFor(root);
  const journalPath = path.join(paths.consumer.root, 'first-activation-transactions', `${plan.transactionId}.json`);
  const lockPath = path.join(paths.consumer.root, '.production-first-activation.lock');
  const receiptFile = receiptPath(paths, plan.transactionId);
  const receipt = readJson<Record<string, string>>(receiptFile);
  assertRecoverableReceipt(receipt, plan);
  const before = readFirstActivationJournal(journalPath);
  assertJournalMatchesPlan(root, plan, before);
  assert(before.status !== 'COMMITTED', 'committed production activation requires explicit rollback');
  const journal = recoverInterruptedFirstActivation({ repoRoot: root, journalPath, lockPath });
  writeJsonAtomic(path.join(paths.transactionDir, `${plan.transactionId}.recovery.json`), {
    contract: RECEIPT_CONTRACT,
    transactionId: plan.transactionId,
    planHash: plan.planHash,
    status: journal.status,
    journalHash: journal.journalHash,
    recoveredAt: new Date().toISOString(),
  });
  process.stdout.write(`${JSON.stringify({ status: journal.status, transactionId: plan.transactionId, journalHash: journal.journalHash }, null, 2)}\n`);
}

const command = process.argv[2];
try {
  switch (command) {
    case 'plan': buildPlan(); break;
    case 'verify-bundle': {
      const plan = readPlan();
      verifyRuntimeOperatorBundle(plan);
      process.stdout.write(JSON.stringify({ status: 'BUNDLE_VERIFIED', bundleSha256: plan.operatorBundle.bundleSha256 }, null, 2) + '\n');
      break;
    }
    case 'activate': runActivate(); break;
    case 'verify': runVerify(); break;
    case 'rollback': runRollback(); break;
    case 'recover': runRecover(); break;
    default: fail('expected one of: plan, verify-bundle, activate, verify, rollback, recover');
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
