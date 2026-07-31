import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from './authoritative-release';

const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const LEGACY_ROOT_CLOSURE_CONTRACT = 'actkg-legacy-predecessor-root-closure/1';
const LEGACY_ROOT_CLOSURE_ALGORITHM = 'sha256sums-legacy-exact-root/1';
const LEGACY_ROOT_CLOSURE_AUTHORITY_PROTOCOL = 'ctkg-m1k-v1d-predecessor-closure/1';
const LEGACY_ROOT_BUNDLE_ID = 'ctb:control-theory-engineering-v0.3:r1';
const LEGACY_ROOT_RELEASE_VERSION = 'control-theory-engineering-v0.3';
const LEGACY_CHAIN_HEAD_BUNDLE_ID = 'ctb:control-theory-engineering-v0.3:r2';
const DEFAULT_LEGACY_ROOT_CLOSURE_PATH =
  'docs/coordination/m1j/v0.3-r1-predecessor-closure.json';
const LEGACY_ROOT_CLOSURE_GATES = [
  'BUNDLE_ID_BINDING_GATE',
  'CONSUMER_PREDECESSOR_BINDING_GATE',
  'LEGACY_LAYOUT_GATE',
  'MEMBER_CHECKSUM_GATE',
  'SHA256SUMS_RAW_BINDING_GATE',
] as const;

type JsonObject = Record<string, unknown>;

export interface PreviousBundle {
  bundle_id: string;
  kind: string;
  sha256sums_sha256: string;
}

interface StableAggregateManifest {
  bundle_contract_version: string;
  bundle_digest: string;
  bundle_id: string;
  bundle_kind: 'aggregate';
  bundle_revision: number;
  publication: { tag: string };
  previous_bundle: PreviousBundle | null;
  release: {
    release_hash: string;
    release_id: string;
    release_version: string;
    source_dataset_hash: string;
  };
  release_stage: 'stable';
  schema: { sha256: string; version: string };
  source_revision: { commit: string; tag: string };
  statistics: JsonObject;
}

interface Candidate {
  bundleDir: string;
  bundleFiles: string[];
  manifest: StableAggregateManifest;
  manifestRaw: JsonObject;
  manifestSha256: string;
  sha256sumsSha256: string;
  sha256sumsBytes: Buffer;
  validationReportSha256: string;
}

interface LegacyRootClosure {
  algorithm_version: string;
  artifact_hash: string;
  authority_implementation: string;
  authority_protocol: string;
  bundle_id: string;
  bundle_path: string;
  consumer_binding: {
    consumer_bundle_id: string;
    field: string;
    manifest_path: string;
    manifest_sha256: string;
    value: PreviousBundle;
  };
  contract_version: string;
  gates: JsonObject;
  member_checksum_count: number;
  reference_kind: string;
  release_version: string;
  sha256sums_path: string;
  sha256sums_raw_sha256: string;
  status: string;
}

interface PredecessorRootClosureBinding {
  path: string;
  artifactHash: string;
  bundleId: string;
  sha256sumsSha256: string;
  protocol: string;
  algorithm: string;
  authorityProtocol: string;
}

export interface LatestStableAggregateBinding extends JsonObject {
  protocol: 'act-latest-stable-aggregate-binding/1';
  selectionPolicy: 'LATEST_STABLE_AGGREGATE';
  actkgMainCommit: string;
  sourceCommit: string;
  sourceTag: string;
  packagingCommit: string;
  stableTag: string;
  releaseId: string;
  releaseVersion: string;
  bundleRevision: number;
  releaseHash: string;
  sourceDatasetHash: string;
  bundleId: string;
  bundleDigest: string;
  manifestSha256: string;
  sha256sumsSha256: string;
  validationReportSha256: string;
  schemaVersion: string;
  schemaSha256: string;
  predecessorBundleId: string | null;
  candidateChain: string[];
  candidateChainEndpoints: string[];
  statistics: JsonObject;
  bundlePath: string;
  predecessorRootClosure: PredecessorRootClosureBinding | null;
  resolutionDigest: string;
}

/**
 * A stable Aggregate candidate after all resolver integrity, lineage, Git tag,
 * and predecessor-closure checks have passed.  The raw Manifest is retained so
 * downstream intake can consume its declared component references without
 * reimplementing candidate discovery.
 */
export interface LatestStableAggregateCandidate extends JsonObject {
  bundleId: string;
  bundlePath: string;
  bundleFiles: string[];
  bundleRevision: number;
  bundleDigest: string;
  manifest: JsonObject;
  manifestSha256: string;
  sha256sumsSha256: string;
  validationReportSha256: string;
  bundleContractVersion: string;
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  sourceDatasetHash: string;
  schemaVersion: string;
  schemaSha256: string;
  sourceCommit: string;
  sourceTag: string;
  packagingCommit: string;
  stableTag: string;
  predecessorBundleId: string | null;
  previousBundle: PreviousBundle | null;
}

export interface LatestStableAggregateResolution {
  binding: LatestStableAggregateBinding;
  activeCandidates: LatestStableAggregateCandidate[];
}

function fail(message: string): never {
  throw new Error(`Latest stable Aggregate resolution failed: ${message}`);
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function hash(value: unknown, label: string): string {
  const result = string(value, label);
  if (!SHA256.test(result)) fail(`${label} must be a lowercase SHA-256`);
  return result;
}

function positiveInteger(value: unknown, label: string): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 1
  ) {
    fail(`${label} must be a positive integer`);
  }
  return value;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitBytes(root: string, args: string[]): Buffer {
  return execFileSync('git', ['-C', root, ...args], {
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function normalizedRelativePath(value: unknown, label: string): string {
  const relative = string(value, label).replaceAll('\\', '/');
  if (path.posix.isAbsolute(relative)) fail(`${label} must be repository-relative`);
  const normalized = path.posix.normalize(relative);
  if (normalized === '..' || normalized.startsWith('../')) {
    fail(`${label} escapes the ActKG repository`);
  }
  return normalized;
}

function containedPath(root: string, relative: string, label: string): string {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, relative);
  if (
    absolute !== absoluteRoot
    && !absolute.startsWith(`${absoluteRoot}${path.sep}`)
  ) {
    fail(`${label} escapes the ActKG repository`);
  }
  return absolute;
}

function relativePath(root: string, absolute: string, label: string): string {
  const relative = path.relative(root, absolute);
  if (
    !relative
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)
  ) {
    fail(`${label} is outside the ActKG repository`);
  }
  return relative.split(path.sep).join('/');
}

function equivalentJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function parseManifest(value: unknown, label: string): StableAggregateManifest | null {
  const row = object(value, label);
  if (row.bundle_kind !== 'aggregate' || row.release_stage !== 'stable') return null;
  const release = object(row.release, `${label}.release`);
  const source = object(row.source_revision, `${label}.source_revision`);
  const publication = object(row.publication, `${label}.publication`);
  const schema = object(row.schema, `${label}.schema`);
  const previous = row.previous_bundle === null || row.previous_bundle === undefined
    ? null
    : object(row.previous_bundle, `${label}.previous_bundle`);
  return {
    bundle_contract_version: string(
      row.bundle_contract_version,
      `${label}.bundle_contract_version`,
    ),
    bundle_digest: hash(row.bundle_digest, `${label}.bundle_digest`),
    bundle_id: string(row.bundle_id, `${label}.bundle_id`),
    bundle_kind: 'aggregate',
    bundle_revision: positiveInteger(row.bundle_revision, `${label}.bundle_revision`),
    publication: { tag: string(publication.tag, `${label}.publication.tag`) },
    previous_bundle: previous
      ? {
          bundle_id: string(previous.bundle_id, `${label}.previous_bundle.bundle_id`),
          kind: string(previous.kind, `${label}.previous_bundle.kind`),
          sha256sums_sha256: hash(
            previous.sha256sums_sha256,
            `${label}.previous_bundle.sha256sums_sha256`,
          ),
        }
      : null,
    release: {
      release_hash: hash(release.release_hash, `${label}.release.release_hash`),
      release_id: string(release.release_id, `${label}.release.release_id`),
      release_version: string(
        release.release_version,
        `${label}.release.release_version`,
      ),
      source_dataset_hash: hash(
        release.source_dataset_hash,
        `${label}.release.source_dataset_hash`,
      ),
    },
    release_stage: 'stable',
    schema: {
      sha256: hash(schema.sha256, `${label}.schema.sha256`),
      version: string(schema.version, `${label}.schema.version`),
    },
    source_revision: {
      commit: string(source.commit, `${label}.source_revision.commit`),
      tag: string(source.tag, `${label}.source_revision.tag`),
    },
    statistics: object(row.statistics, `${label}.statistics`),
  };
}

function parseSums(value: string, label: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const [index, line] of value.trimEnd().split('\n').entries()) {
    const match = /^([0-9a-f]{64}) {2}(.+)$/u.exec(line);
    if (!match) fail(`${label}:${index + 1} is not a canonical SHA256SUMS row`);
    if (result.has(match[2])) fail(`${label} repeats ${match[2]}`);
    result.set(match[2], match[1]);
  }
  return result;
}

async function loadCandidate(bundleDir: string): Promise<Candidate | null> {
  const manifestPath = path.join(bundleDir, 'bundle-manifest.json');
  const manifestBytes = await readFile(manifestPath).catch(() => null);
  if (!manifestBytes) return null;
  const manifestValue = JSON.parse(manifestBytes.toString('utf8'));
  const manifestRaw = object(manifestValue, manifestPath);
  const manifest = parseManifest(
    manifestValue,
    manifestPath,
  );
  if (!manifest) return null;

  const sumsPath = path.join(bundleDir, 'SHA256SUMS');
  const sumsBytes = await readFile(sumsPath);
  const sums = parseSums(sumsBytes.toString('utf8'), sumsPath);
  const files = (await readdir(bundleDir))
    .filter((name) => name !== 'SHA256SUMS')
    .sort();
  if (canonicalJson([...sums.keys()].sort()) !== canonicalJson(files)) {
    fail(`${manifest.bundle_id} SHA256SUMS does not close over the Bundle`);
  }
  for (const [name, expected] of sums) {
    const filePath = path.join(bundleDir, name);
    if (!(await stat(filePath)).isFile()) fail(`${filePath} is not a regular file`);
    if (sha256(await readFile(filePath)) !== expected) {
      fail(`${manifest.bundle_id} SHA256SUMS mismatch: ${name}`);
    }
  }
  const reportBytes = await readFile(path.join(bundleDir, 'validation-report.json'));
  const report = object(JSON.parse(reportBytes.toString('utf8')), 'validation-report');
  if (report.result !== 'PASS') fail(`${manifest.bundle_id} validation report is not PASS`);

  return {
    bundleDir,
    bundleFiles: files,
    manifest,
    manifestRaw,
    manifestSha256: sha256(manifestBytes),
    sha256sumsSha256: sha256(sumsBytes),
    sha256sumsBytes: sumsBytes,
    validationReportSha256: sha256(reportBytes),
  };
}

function parseLegacyRootClosure(value: unknown, label: string): LegacyRootClosure {
  const row = object(value, label);
  const consumer = object(row.consumer_binding, `${label}.consumer_binding`);
  const consumerValue = object(
    consumer.value,
    `${label}.consumer_binding.value`,
  );
  return {
    algorithm_version: string(
      row.algorithm_version,
      `${label}.algorithm_version`,
    ),
    artifact_hash: hash(row.artifact_hash, `${label}.artifact_hash`),
    authority_implementation: string(
      row.authority_implementation,
      `${label}.authority_implementation`,
    ),
    authority_protocol: string(
      row.authority_protocol,
      `${label}.authority_protocol`,
    ),
    bundle_id: string(row.bundle_id, `${label}.bundle_id`),
    bundle_path: string(row.bundle_path, `${label}.bundle_path`),
    consumer_binding: {
      consumer_bundle_id: string(
        consumer.consumer_bundle_id,
        `${label}.consumer_binding.consumer_bundle_id`,
      ),
      field: string(consumer.field, `${label}.consumer_binding.field`),
      manifest_path: string(
        consumer.manifest_path,
        `${label}.consumer_binding.manifest_path`,
      ),
      manifest_sha256: hash(
        consumer.manifest_sha256,
        `${label}.consumer_binding.manifest_sha256`,
      ),
      value: {
        bundle_id: string(
          consumerValue.bundle_id,
          `${label}.consumer_binding.value.bundle_id`,
        ),
        kind: string(
          consumerValue.kind,
          `${label}.consumer_binding.value.kind`,
        ),
        sha256sums_sha256: hash(
          consumerValue.sha256sums_sha256,
          `${label}.consumer_binding.value.sha256sums_sha256`,
        ),
      },
    },
    contract_version: string(
      row.contract_version,
      `${label}.contract_version`,
    ),
    gates: object(row.gates, `${label}.gates`),
    member_checksum_count: positiveInteger(
      row.member_checksum_count,
      `${label}.member_checksum_count`,
    ),
    reference_kind: string(row.reference_kind, `${label}.reference_kind`),
    release_version: string(
      row.release_version,
      `${label}.release_version`,
    ),
    sha256sums_path: string(
      row.sha256sums_path,
      `${label}.sha256sums_path`,
    ),
    sha256sums_raw_sha256: hash(
      row.sha256sums_raw_sha256,
      `${label}.sha256sums_raw_sha256`,
    ),
    status: string(row.status, `${label}.status`),
  };
}

function assertRealPathContained(
  root: string,
  target: string,
  label: string,
): void {
  if (
    target !== root
    && !target.startsWith(`${root}${path.sep}`)
  ) {
    fail(`${label} escapes the ActKG repository`);
  }
}

async function validateLegacyRootClosure(input: {
  actkgRoot: string;
  mainRef: string;
  candidate: Candidate;
  closurePath: string;
}): Promise<PredecessorRootClosureBinding> {
  const closureRelativePath = normalizedRelativePath(
    input.closurePath,
    'legacy root closure path',
  );
  const closurePath = containedPath(
    input.actkgRoot,
    closureRelativePath,
    'legacy root closure path',
  );
  const closureBytes = await readFile(closurePath).catch(() => null);
  if (!closureBytes) {
    fail(`legacy root closure is missing: ${closureRelativePath}`);
  }
  let mainRefClosure: Buffer;
  try {
    mainRefClosure = gitBytes(input.actkgRoot, [
      'show',
      `${input.mainRef}:${closureRelativePath}`,
    ]);
  } catch {
    fail(
      `legacy root closure ${closureRelativePath} is missing from ${input.mainRef}`,
    );
  }
  if (!mainRefClosure.equals(closureBytes)) {
    fail(`legacy root closure ${closureRelativePath} bytes drift from ${input.mainRef}`);
  }

  const rawClosure = object(
    JSON.parse(closureBytes.toString('utf8')),
    closurePath,
  );
  const closure = parseLegacyRootClosure(rawClosure, closurePath);
  const closureBody = { ...rawClosure } as JsonObject;
  delete closureBody.artifact_hash;
  if (sha256(canonicalJson(closureBody)) !== closure.artifact_hash) {
    fail('legacy root closure artifact_hash mismatch');
  }
  if (closure.contract_version !== LEGACY_ROOT_CLOSURE_CONTRACT) {
    fail('legacy root closure contract_version is unsupported');
  }
  if (closure.algorithm_version !== LEGACY_ROOT_CLOSURE_ALGORITHM) {
    fail('legacy root closure algorithm_version is unsupported');
  }
  if (closure.authority_protocol !== LEGACY_ROOT_CLOSURE_AUTHORITY_PROTOCOL) {
    fail('legacy root closure authority_protocol is unsupported');
  }
  if (closure.status !== 'PASS') fail('legacy root closure status is not PASS');
  for (const gate of LEGACY_ROOT_CLOSURE_GATES) {
    if (closure.gates[gate] !== 'PASS') {
      fail(`legacy root closure gate ${gate} is not PASS`);
    }
  }
  if (closure.bundle_id !== LEGACY_ROOT_BUNDLE_ID) {
    fail('legacy root closure bundle_id is not the v0.3 r1 root');
  }
  if (closure.release_version !== LEGACY_ROOT_RELEASE_VERSION) {
    fail('legacy root closure release_version is not v0.3');
  }
  if (closure.reference_kind !== 'legacy_exact') {
    fail('legacy root closure reference_kind is not legacy_exact');
  }
  if (input.candidate.manifest.bundle_id !== LEGACY_CHAIN_HEAD_BUNDLE_ID) {
    fail('only the v0.3 r2 chain head may use a legacy root closure');
  }
  if (!input.candidate.manifest.previous_bundle) {
    fail('v0.3 r2 chain head has no previous_bundle to close');
  }
  if (
    input.candidate.manifest.previous_bundle.bundle_id !== closure.bundle_id
    || input.candidate.manifest.previous_bundle.sha256sums_sha256
      !== closure.sha256sums_raw_sha256
  ) {
    fail('legacy root closure does not match the chain-head previous_bundle');
  }

  const bundleRelativePath = normalizedRelativePath(
    closure.bundle_path,
    'legacy root closure bundle_path',
  );
  const sumsRelativePath = normalizedRelativePath(
    closure.sha256sums_path,
    'legacy root closure sha256sums_path',
  );
  const bundlePath = containedPath(
    input.actkgRoot,
    bundleRelativePath,
    'legacy root closure bundle_path',
  );
  const sumsPath = containedPath(
    input.actkgRoot,
    sumsRelativePath,
    'legacy root closure sha256sums_path',
  );
  if (!sumsRelativePath.startsWith(`${bundleRelativePath}/`)) {
    fail('legacy root closure SHA256SUMS path is outside bundle_path');
  }
  if (path.posix.basename(sumsRelativePath) !== 'SHA256SUMS') {
    fail('legacy root closure sha256sums_path must name SHA256SUMS');
  }

  const repositoryRealPath = await realpath(input.actkgRoot);
  const bundleRealPath = await realpath(bundlePath).catch(() => null);
  if (!bundleRealPath) fail('legacy root closure bundle_path does not exist');
  assertRealPathContained(
    repositoryRealPath,
    bundleRealPath,
    'legacy root closure bundle_path',
  );
  const bundleStat = await stat(bundlePath).catch(() => null);
  if (!bundleStat?.isDirectory()) {
    fail('legacy root closure bundle_path is not a directory');
  }
  const sumsRealPath = await realpath(sumsPath).catch(() => null);
  if (!sumsRealPath) fail('legacy root closure SHA256SUMS does not exist');
  assertRealPathContained(
    bundleRealPath,
    sumsRealPath,
    'legacy root closure sha256sums_path',
  );
  const sumsStat = await stat(sumsPath).catch(() => null);
  if (!sumsStat?.isFile()) {
    fail('legacy root closure SHA256SUMS is not a regular file');
  }
  const sumsBytes = await readFile(sumsPath);
  if (sha256(sumsBytes) !== closure.sha256sums_raw_sha256) {
    fail('legacy root closure SHA256SUMS raw digest mismatch');
  }
  const sums = parseSums(sumsBytes.toString('utf8'), sumsPath);
  if (sums.size !== closure.member_checksum_count) {
    fail('legacy root closure member_checksum_count mismatch');
  }
  const entries = await readdir(bundlePath, { withFileTypes: true });
  const actualMembers = entries
    .filter((entry) => entry.isFile() && entry.name !== 'SHA256SUMS')
    .map((entry) => entry.name)
    .sort();
  const declaredMembers = [...sums.keys()].sort();
  if (canonicalJson(actualMembers) !== canonicalJson(declaredMembers)) {
    fail('legacy root closure member set differs from SHA256SUMS');
  }
  for (const [name, expected] of sums) {
    const memberPath = path.join(bundlePath, name);
    const memberStat = await stat(memberPath).catch(() => null);
    if (!memberStat?.isFile()) {
      fail(`legacy root closure member is not a regular file: ${name}`);
    }
    if (sha256(await readFile(memberPath)) !== expected) {
      fail(`legacy root closure member hash mismatch: ${name}`);
    }
  }

  const consumerManifestPath = relativePath(
    input.actkgRoot,
    path.join(input.candidate.bundleDir, 'bundle-manifest.json'),
    'legacy root closure consumer manifest',
  );
  const consumer = closure.consumer_binding;
  if (consumer.consumer_bundle_id !== input.candidate.manifest.bundle_id) {
    fail('legacy root closure consumer_bundle_id drift');
  }
  if (consumer.field !== 'previous_bundle') {
    fail('legacy root closure consumer field is not previous_bundle');
  }
  if (consumer.manifest_path !== consumerManifestPath) {
    fail('legacy root closure consumer manifest_path drift');
  }
  if (consumer.manifest_sha256 !== input.candidate.manifestSha256) {
    fail('legacy root closure consumer manifest_sha256 drift');
  }
  if (!equivalentJson(consumer.value, input.candidate.manifest.previous_bundle)) {
    fail('legacy root closure consumer previous_bundle value drift');
  }

  return {
    path: closureRelativePath,
    artifactHash: closure.artifact_hash,
    bundleId: closure.bundle_id,
    sha256sumsSha256: closure.sha256sums_raw_sha256,
    protocol: closure.contract_version,
    algorithm: closure.algorithm_version,
    authorityProtocol: closure.authority_protocol,
  };
}

export async function resolveLatestStableAggregateWithCandidates(options: {
  actkgRoot: string;
  releasesPath?: string;
  mainRef?: string;
  legacyRootClosurePath?: string;
}): Promise<LatestStableAggregateResolution> {
  const actkgRoot = path.resolve(options.actkgRoot);
  const releasesRoot = path.resolve(
    actkgRoot,
    options.releasesPath ?? 'releases',
  );
  const mainRef = options.mainRef ?? 'origin/main';
  const candidates = (
    await Promise.all(
      (await readdir(releasesRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => loadCandidate(path.join(releasesRoot, entry.name))),
    )
  ).filter((candidate): candidate is Candidate => candidate !== null);
  if (candidates.length === 0) fail('no stable aggregate Manifest exists');

  const allBundleIds = new Set<string>();
  for (const candidate of candidates) {
    if (allBundleIds.has(candidate.manifest.bundle_id)) {
      fail(`duplicate bundle_id ${candidate.manifest.bundle_id}`);
    }
    allBundleIds.add(candidate.manifest.bundle_id);
  }
  const byReleaseIdentity = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const identity = `${candidate.manifest.release.release_id}\u0000${candidate.manifest.release.release_version}`;
    const group = byReleaseIdentity.get(identity) ?? [];
    for (const prior of group) {
      if (
        prior.manifest.release.release_hash !== candidate.manifest.release.release_hash
        || prior.manifest.release.source_dataset_hash
          !== candidate.manifest.release.source_dataset_hash
      ) {
        fail(
          `${candidate.manifest.bundle_id} has inconsistent release identity for ${candidate.manifest.release.release_id}`,
        );
      }
      if (prior.manifest.bundle_revision === candidate.manifest.bundle_revision) {
        fail(
          `${candidate.manifest.release.release_id} repeats bundle revision ${candidate.manifest.bundle_revision}`,
        );
      }
    }
    group.push(candidate);
    byReleaseIdentity.set(identity, group);
  }
  const activeCandidates: Candidate[] = [];
  for (const group of byReleaseIdentity.values()) {
    const active = group.reduce((highest, candidate) => (
      candidate.manifest.bundle_revision > highest.manifest.bundle_revision
        ? candidate
        : highest
    ));
    activeCandidates.push(active);
  }

  const byId = new Map<string, Candidate>();
  for (const candidate of activeCandidates) {
    if (byId.has(candidate.manifest.bundle_id)) {
      fail(`duplicate bundle_id ${candidate.manifest.bundle_id}`);
    }
    byId.set(candidate.manifest.bundle_id, candidate);
  }
  const referenced = new Set<string>();
  const missingPredecessors: Candidate[] = [];
  for (const candidate of activeCandidates) {
    const previous = candidate.manifest.previous_bundle;
    if (!previous || !byId.has(previous.bundle_id)) {
      missingPredecessors.push(candidate);
      if (!previous) {
        fail(`${candidate.manifest.bundle_id} previous_bundle is missing`);
      }
      if (candidate.manifest.bundle_id !== LEGACY_CHAIN_HEAD_BUNDLE_ID) {
        fail(
          `${candidate.manifest.bundle_id} previous_bundle ${previous.bundle_id} is missing from the stable Aggregate candidate set`,
        );
      }
      continue;
    }
    referenced.add(previous.bundle_id);
    const predecessor = byId.get(previous.bundle_id)!;
    if (predecessor.sha256sumsSha256 !== previous.sha256sums_sha256) {
      fail(`${candidate.manifest.bundle_id} predecessor SHA256SUMS drift`);
    }
  }
  if (missingPredecessors.length > 1) {
    fail(
      `expected one explicitly closed predecessor root, found ${missingPredecessors.length}`,
    );
  }
  let predecessorRootClosure: PredecessorRootClosureBinding | null = null;
  if (missingPredecessors.length === 1) {
    predecessorRootClosure = await validateLegacyRootClosure({
      actkgRoot,
      mainRef,
      candidate: missingPredecessors[0]!,
      closurePath: options.legacyRootClosurePath ?? DEFAULT_LEGACY_ROOT_CLOSURE_PATH,
    });
  }
  const endpoints = candidates.filter(
    (candidate) => activeCandidates.includes(candidate)
      && !referenced.has(candidate.manifest.bundle_id),
  );
  if (endpoints.length !== 1) {
    fail(`expected one endpoint, found ${endpoints.length}`);
  }

  const chain: Candidate[] = [];
  const visited = new Set<string>();
  let current: Candidate | undefined = endpoints[0];
  while (current) {
    if (visited.has(current.manifest.bundle_id)) fail('previous_bundle cycle detected');
    visited.add(current.manifest.bundle_id);
    chain.unshift(current);
    const previousId: string | undefined =
      current.manifest.previous_bundle?.bundle_id;
    current = previousId ? byId.get(previousId) : undefined;
  }
  if (visited.size !== activeCandidates.length) {
    fail('stable Aggregate manifests do not form one closed chain');
  }

  const endpoint = endpoints[0];
  const manifest = endpoint.manifest;
  const actkgMainCommit = git(actkgRoot, ['rev-parse', `${mainRef}^{commit}`]);
  if (!COMMIT.test(actkgMainCommit)) fail('main commit is not a Git commit');

  const candidateBundlePaths = new Map<Candidate, string>();
  const candidateIdentities = new Map<
    Candidate,
    { sourceCommit: string; packagingCommit: string }
  >();
  for (const candidate of activeCandidates) {
    const candidateBundlePath = relativePath(
      actkgRoot,
      candidate.bundleDir,
      `${candidate.manifest.bundle_id} bundle path`,
    );
    candidateBundlePaths.set(candidate, candidateBundlePath);
    const sourceCommit = git(actkgRoot, [
      'rev-parse',
      `${candidate.manifest.source_revision.tag}^{commit}`,
    ]);
    const packagingCommit = git(actkgRoot, [
      'rev-parse',
      `${candidate.manifest.publication.tag}^{commit}`,
    ]);
    if (!COMMIT.test(sourceCommit)) {
      fail(`${candidate.manifest.bundle_id} source tag commit is not a Git commit`);
    }
    if (!COMMIT.test(packagingCommit)) {
      fail(`${candidate.manifest.bundle_id} stable tag commit is not a Git commit`);
    }
    if (sourceCommit !== candidate.manifest.source_revision.commit) {
      fail(`${candidate.manifest.bundle_id} source tag does not peel to Manifest source commit`);
    }
    candidateIdentities.set(candidate, { sourceCommit, packagingCommit });
    for (const commit of [sourceCommit, packagingCommit]) {
      try {
        git(actkgRoot, ['merge-base', '--is-ancestor', commit, actkgMainCommit]);
      } catch {
        fail(`${commit} is not an ancestor of ${mainRef}`);
      }
    }

    const stableTagSumsPath = `${candidateBundlePath}/SHA256SUMS`;
    let stableTagSums: Buffer;
    try {
      stableTagSums = gitBytes(actkgRoot, [
        'show',
        `${candidate.manifest.publication.tag}:${stableTagSumsPath}`,
      ]);
    } catch {
      fail(
        `stable tag ${candidate.manifest.publication.tag} is missing ${stableTagSumsPath}`,
      );
    }
    if (!stableTagSums.equals(candidate.sha256sumsBytes)) {
      fail(
        `stable tag ${candidate.manifest.publication.tag} SHA256SUMS bytes drift`,
      );
    }
    for (const name of candidate.bundleFiles) {
      const stableTagMemberPath = `${candidateBundlePath}/${name}`;
      let stableTagMember: Buffer;
      try {
        stableTagMember = gitBytes(actkgRoot, [
          'show',
          `${candidate.manifest.publication.tag}:${stableTagMemberPath}`,
        ]);
      } catch {
        fail(
          `stable tag ${candidate.manifest.publication.tag} is missing ${stableTagMemberPath}`,
        );
      }
      const currentMember = await readFile(path.join(candidate.bundleDir, name));
      if (!stableTagMember.equals(currentMember)) {
        fail(
          `stable tag ${candidate.manifest.publication.tag} Bundle member bytes drift: ${name}`,
        );
      }
    }
  }

  const sourceCommit = git(actkgRoot, [
    'rev-parse',
    `${manifest.source_revision.tag}^{commit}`,
  ]);
  const packagingCommit = git(actkgRoot, [
    'rev-parse',
    `${manifest.publication.tag}^{commit}`,
  ]);
  const bundleRelativePath = candidateBundlePaths.get(endpoint)!;
  const body = {
    protocol: 'act-latest-stable-aggregate-binding/1' as const,
    selectionPolicy: 'LATEST_STABLE_AGGREGATE' as const,
    actkgMainCommit,
    sourceCommit,
    sourceTag: manifest.source_revision.tag,
    packagingCommit,
    stableTag: manifest.publication.tag,
    releaseId: manifest.release.release_id,
    releaseVersion: manifest.release.release_version,
    bundleRevision: manifest.bundle_revision,
    releaseHash: manifest.release.release_hash,
    sourceDatasetHash: manifest.release.source_dataset_hash,
    bundleId: manifest.bundle_id,
    bundleDigest: manifest.bundle_digest,
    manifestSha256: endpoint.manifestSha256,
    sha256sumsSha256: endpoint.sha256sumsSha256,
    validationReportSha256: endpoint.validationReportSha256,
    schemaVersion: manifest.schema.version,
    schemaSha256: manifest.schema.sha256,
    predecessorBundleId: manifest.previous_bundle?.bundle_id ?? null,
    candidateChain: chain.map((candidate) => candidate.manifest.bundle_id),
    candidateChainEndpoints: [manifest.bundle_id],
    statistics: manifest.statistics,
    bundlePath: bundleRelativePath,
    predecessorRootClosure,
  };
  const binding: LatestStableAggregateBinding = {
    ...body,
    resolutionDigest: sha256(canonicalJson(body)),
  };
  const candidatesWithIdentities: LatestStableAggregateCandidate[] = chain.map((candidate) => {
    const identity = candidateIdentities.get(candidate);
    if (!identity) fail(`missing verified Git identity for ${candidate.manifest.bundle_id}`);
    return {
      bundleId: candidate.manifest.bundle_id,
      bundlePath: candidateBundlePaths.get(candidate)!,
      bundleFiles: [...candidate.bundleFiles],
      bundleRevision: candidate.manifest.bundle_revision,
      bundleDigest: candidate.manifest.bundle_digest,
      manifest: structuredClone(candidate.manifestRaw),
      manifestSha256: candidate.manifestSha256,
      sha256sumsSha256: candidate.sha256sumsSha256,
      validationReportSha256: candidate.validationReportSha256,
      bundleContractVersion: candidate.manifest.bundle_contract_version,
      releaseId: candidate.manifest.release.release_id,
      releaseVersion: candidate.manifest.release.release_version,
      releaseHash: candidate.manifest.release.release_hash,
      sourceDatasetHash: candidate.manifest.release.source_dataset_hash,
      schemaVersion: candidate.manifest.schema.version,
      schemaSha256: candidate.manifest.schema.sha256,
      sourceCommit: identity.sourceCommit,
      sourceTag: candidate.manifest.source_revision.tag,
      packagingCommit: identity.packagingCommit,
      stableTag: candidate.manifest.publication.tag,
      predecessorBundleId: candidate.manifest.previous_bundle?.bundle_id ?? null,
      previousBundle: candidate.manifest.previous_bundle,
    };
  });
  return { binding, activeCandidates: candidatesWithIdentities };
}

export async function resolveLatestStableAggregate(options: {
  actkgRoot: string;
  releasesPath?: string;
  mainRef?: string;
  legacyRootClosurePath?: string;
}): Promise<LatestStableAggregateBinding> {
  const { binding } = await resolveLatestStableAggregateWithCandidates(options);
  return binding;
}
