import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from './authoritative-release';
import {
  CTKG_SCHEMA_VERSION,
  isSchemaIdentitySupported,
} from './bundle-compatibility-registry';
import {
  validateAggregateManifestIntegrity,
  type AggregateIntegrityArtifact,
} from './public-bundle-aggregate-integrity';

const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const LEGACY_ROOT_CLOSURE_CONTRACT = 'actkg-legacy-predecessor-root-closure/1';
const LEGACY_ROOT_CLOSURE_ALGORITHM = 'sha256sums-legacy-exact-root/1';
const LEGACY_ROOT_CLOSURE_AUTHORITY_PROTOCOL = 'ctkg-m1k-v1d-predecessor-closure/1';
const LEGACY_ROOT_CLOSURE_GATES = [
  'BUNDLE_ID_BINDING_GATE',
  'CONSUMER_PREDECESSOR_BINDING_GATE',
  'LEGACY_LAYOUT_GATE',
  'MEMBER_CHECKSUM_GATE',
  'SHA256SUMS_RAW_BINDING_GATE',
] as const;
const ADMISSION_BRIDGE_CONTRACT = 'actkg-admission-bridge-release-diff/1';

type JsonObject = Record<string, unknown>;

export interface PreviousBundle {
  bundle_id: string;
  kind: string;
  sha256sums_sha256: string;
}

/**
 * Identity of the ACT-owned accepted endpoint used as the comparison base.
 * The exact #1125 endpoint has no standard Bundle identity, so additional
 * evidence fields are intentionally preserved as opaque stable JSON values.
 */
export interface LatestStableAggregateAdmittedEndpoint extends JsonObject {
  releaseSetId: string;
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  sourceDatasetHash: string;
  [key: string]: unknown;
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

export interface AdmissionBridgeReleaseDiffBinding {
  path: string;
  contractVersion: string;
  bridgeId: string;
  artifactHash: string;
  releaseDiffDigest: string;
  admittedEndpointExternalAnchor: {
    repository: string;
    commit: string;
    introducedCommit: string;
    path: string;
    sha256: string;
  };
  baseReleaseId: string;
  baseReleaseVersion: string;
  baseReleaseHash: string;
  targetReleaseId: string;
  targetReleaseVersion: string;
  targetReleaseHash: string;
  targetBundleId: string;
  targetBundleDigest: string;
  targetManifestSha256: string;
  targetProjectionId: string;
  targetProjectionDigest: string;
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
  admissionBridgeReleaseDiff?: AdmissionBridgeReleaseDiffBinding;
  /** ACT-owned accepted comparison base; absent only on historical receipts. */
  admittedEndpoint?: LatestStableAggregateAdmittedEndpoint;
  /**
   * Observation metadata for this resolver invocation. This remains optional
   * so receipts created before the field was introduced stay readable.
   */
  resolvedAt?: string;
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

function parseAdmittedEndpoint(
  value: unknown,
  label = 'admitted endpoint',
): LatestStableAggregateAdmittedEndpoint {
  const row = object(value, label);
  const endpoint = structuredClone(row) as LatestStableAggregateAdmittedEndpoint;
  endpoint.releaseSetId = string(row.releaseSetId, `${label}.releaseSetId`);
  endpoint.releaseId = string(row.releaseId, `${label}.releaseId`);
  endpoint.releaseVersion = string(row.releaseVersion, `${label}.releaseVersion`);
  endpoint.releaseHash = hash(row.releaseHash, `${label}.releaseHash`);
  endpoint.sourceDatasetHash = hash(row.sourceDatasetHash, `${label}.sourceDatasetHash`);
  if (row.candidateState !== undefined && row.candidateState !== 'CANDIDATE' && row.candidateState !== 'ACCEPTED_CANDIDATE') {
    fail(`${label}.candidateState is not an accepted ACT candidate state`);
  }
  return endpoint;
}

export async function loadLatestStableAggregateAdmittedEndpoint(
  filePath: string,
): Promise<LatestStableAggregateAdmittedEndpoint> {
  const bytes = await readFile(filePath);
  const raw = object(JSON.parse(bytes.toString('utf8')), filePath);
  const value = raw.admittedEndpoint && typeof raw.admittedEndpoint === 'object'
    ? raw.admittedEndpoint
    : raw;
  return parseAdmittedEndpoint(value, filePath);
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

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail(`${label} must be a non-negative integer`);
  }
  return value;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function bundleMemberPath(value: unknown, label: string): string {
  const relative = string(value, label);
  if (
    path.posix.isAbsolute(relative)
    || path.posix.normalize(relative) !== relative
    || relative.includes('\\')
    || relative.includes('\u0000')
    || relative.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    fail(`${label} must be a normalized confined POSIX path`);
  }
  return relative;
}

function caseFold(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US');
}

function artifactRecordCount(bytes: Buffer, mediaType: string): number | null {
  if (mediaType !== 'application/x-ndjson' && mediaType !== 'application/ndjson') return null;
  return bytes.toString('utf8').split(/\r?\n/u).filter((line) => line.length > 0).length;
}

async function listRegularFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (current: string, relative: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const child = path.join(current, entry.name);
      if (entry.isSymbolicLink()) fail(`Bundle contains symlink ${childRelative}`);
      if (entry.isDirectory()) await walk(child, childRelative);
      else if (entry.isFile()) files.push(childRelative);
      else fail(`Bundle contains non-regular entry ${childRelative}`);
    }
  };
  await walk(directory, '');
  return files.sort();
}

async function discoverPredecessorRootClosurePath(root: string): Promise<string> {
  const matches: string[] = [];
  const walk = async (current: string, relative: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(child, childRelative);
      } else if (entry.isFile() && /predecessor[-_].*closure\.json$/u.test(entry.name)) {
        matches.push(childRelative);
      }
    }
  };
  await walk(root, '');
  if (matches.length !== 1) {
    fail(`predecessor root closure input is ambiguous or missing (${matches.length} matches)`);
  }
  return matches[0]!;
}

async function validateAdmissionBridgeReleaseDiff(input: {
  actkgRoot: string;
  actRepoRoot: string;
  mainRef: string;
  bridgePath: string;
  admittedEndpoint: LatestStableAggregateAdmittedEndpoint;
  firstCandidate: Candidate;
}): Promise<AdmissionBridgeReleaseDiffBinding> {
  const bridgeRelativePath = normalizedRelativePath(
    input.bridgePath,
    'admission bridge path',
  );
  const bridgePath = containedPath(
    input.actkgRoot,
    bridgeRelativePath,
    'admission bridge path',
  );
  const bridgeBytes = await readFile(bridgePath).catch(() => null);
  if (!bridgeBytes) fail(`admission bridge is missing: ${bridgeRelativePath}`);
  let capturedBytes: Buffer;
  try {
    capturedBytes = gitBytes(input.actkgRoot, [
      'show',
      `${input.mainRef}:${bridgeRelativePath}`,
    ]);
  } catch {
    fail(`admission bridge ${bridgeRelativePath} is missing from ${input.mainRef}`);
  }
  if (!capturedBytes.equals(bridgeBytes)) {
    fail(`admission bridge ${bridgeRelativePath} bytes drift from ${input.mainRef}`);
  }

  const raw = object(JSON.parse(bridgeBytes.toString('utf8')), bridgePath);
  const contractVersion = string(raw.contract_version, 'admission bridge contract_version');
  if (contractVersion !== ADMISSION_BRIDGE_CONTRACT) {
    fail('admission bridge contract_version is unsupported');
  }
  if (raw.status !== 'PASS') fail('admission bridge status is not PASS');
  const gates = object(raw.gates, 'admission bridge gates');
  if (Object.keys(gates).length === 0 || Object.entries(gates).some(([, value]) => value !== 'PASS')) {
    fail('admission bridge contains a non-PASS gate');
  }
  const scope = object(raw.scope, 'admission bridge scope');
  if (
    scope.mutates_release_packages !== false
    || scope.extends_bundle_chain !== false
    || scope.productionAuthoritative !== false
  ) {
    fail('admission bridge scope exceeds bundle-external evidence');
  }
  const artifactHash = hash(raw.artifact_hash, 'admission bridge artifact_hash');
  const body = { ...raw };
  delete body.artifact_hash;
  if (sha256(canonicalJson(body)) !== artifactHash) {
    fail('admission bridge artifact_hash mismatch');
  }
  const releaseDiff = object(raw.release_diff, 'admission bridge release_diff');
  const releaseDiffDigest = hash(
    raw.release_diff_digest,
    'admission bridge release_diff_digest',
  );
  if (sha256(canonicalJson(releaseDiff)) !== releaseDiffDigest) {
    fail('admission bridge release_diff_digest mismatch');
  }

  const bridgeEndpoint = parseAdmittedEndpoint(
    raw.admitted_endpoint,
    'admission bridge admitted_endpoint',
  );
  if (!equivalentJson(bridgeEndpoint, input.admittedEndpoint)) {
    fail('admission bridge admitted endpoint differs from ACT exact endpoint');
  }
  const baseRelease = object(releaseDiff.base_release, 'admission bridge base_release');
  if (
    baseRelease.release_id !== bridgeEndpoint.releaseId
    || baseRelease.release_version !== bridgeEndpoint.releaseVersion
    || baseRelease.release_hash !== bridgeEndpoint.releaseHash
  ) {
    fail('admission bridge base_release differs from ACT exact endpoint');
  }

  const target = object(raw.target, 'admission bridge target');
  const targetRelease = object(releaseDiff.target_release, 'admission bridge target_release');
  const candidate = input.firstCandidate;
  if (
    target.bundle_id !== candidate.manifest.bundle_id
    || target.bundle_digest !== candidate.manifest.bundle_digest
    || target.release_id !== candidate.manifest.release.release_id
    || target.release_version !== candidate.manifest.release.release_version
    || target.release_hash !== candidate.manifest.release.release_hash
    || target.source_dataset_hash !== candidate.manifest.release.source_dataset_hash
    || targetRelease.release_id !== candidate.manifest.release.release_id
    || targetRelease.release_version !== candidate.manifest.release.release_version
    || targetRelease.release_hash !== candidate.manifest.release.release_hash
  ) {
    fail('admission bridge target differs from the dynamic first candidate');
  }
  const targetManifest = object(target.manifest, 'admission bridge target manifest');
  if (targetManifest.sha256 !== candidate.manifestSha256) {
    fail('admission bridge target Manifest digest mismatch');
  }
  const targetProjection = object(target.projection, 'admission bridge target projection');
  const projectionPath = string(targetProjection.path, 'admission bridge target projection path');
  const projectionSha256 = hash(targetProjection.sha256, 'admission bridge target projection sha256');
  const artifacts = Array.isArray(candidate.manifestRaw.artifacts)
    ? candidate.manifestRaw.artifacts
    : [];
  const projectionArtifact = artifacts
    .map((value, index) => object(value, `first candidate artifact ${index}`))
    .find((value) => value.path === path.posix.basename(projectionPath));
  if (!projectionArtifact || projectionArtifact.sha256 !== projectionSha256) {
    fail('admission bridge target Projection artifact mismatch');
  }
  const candidateProjectionPath = path.join(
    candidate.bundleDir,
    path.posix.basename(projectionPath),
  );
  const candidateProjection = object(
    JSON.parse(await readFile(candidateProjectionPath, 'utf8')),
    'dynamic first candidate target Projection',
  );
  if (
    candidateProjection.id !== targetProjection.id
    || candidateProjection.version_digest !== targetProjection.version_digest
    || candidateProjection.source_release !== targetProjection.source_release
    || candidateProjection.source_release_hash !== targetProjection.source_release_hash
    || candidateProjection.source_dataset_hash !== targetProjection.source_dataset_hash
  ) {
    fail('admission bridge target Projection identity differs from the dynamic first candidate');
  }

  const anchor = object(
    raw.admitted_endpoint_external_anchor,
    'admission bridge external anchor',
  );
  if (
    anchor.consumer_must_verify_blob !== true
    || anchor.blob_verification_status !== 'DELEGATED_TO_ACT_CONSUMER'
  ) {
    fail('admission bridge external anchor is not delegated to ACT');
  }
  const anchorRepository = string(anchor.repository, 'admission bridge anchor repository');
  const actualRepository = git(input.actRepoRoot, ['remote', 'get-url', 'origin']);
  if (actualRepository.toLowerCase() !== anchorRepository.toLowerCase()) {
    fail('admission bridge anchor repository differs from ACT origin');
  }
  const anchorCommit = string(anchor.commit, 'admission bridge anchor commit');
  const introducedCommit = string(
    anchor.introduced_commit,
    'admission bridge anchor introduced_commit',
  );
  if (!COMMIT.test(anchorCommit) || !COMMIT.test(introducedCommit)) {
    fail('admission bridge anchor commit is not a full Git commit');
  }
  const anchorPath = normalizedRelativePath(
    anchor.path,
    'admission bridge anchor path',
  );
  const anchorSha256 = hash(anchor.sha256, 'admission bridge anchor sha256');
  let anchorBytes: Buffer;
  let introducedBytes: Buffer;
  try {
    anchorBytes = gitBytes(input.actRepoRoot, ['show', `${anchorCommit}:${anchorPath}`]);
    introducedBytes = gitBytes(input.actRepoRoot, [
      'show',
      `${introducedCommit}:${anchorPath}`,
    ]);
    git(input.actRepoRoot, [
      'merge-base',
      '--is-ancestor',
      introducedCommit,
      anchorCommit,
    ]);
  } catch {
    fail('admission bridge anchor blob is unavailable from the declared ACT commit');
  }
  if (
    sha256(anchorBytes) !== anchorSha256
    || sha256(introducedBytes) !== anchorSha256
    || !introducedBytes.equals(anchorBytes)
  ) {
    fail('admission bridge anchor blob SHA-256 mismatch');
  }
  const anchorEndpoint = parseAdmittedEndpoint(
    JSON.parse(anchorBytes.toString('utf8')),
    'admission bridge anchor blob',
  );
  if (!equivalentJson(anchorEndpoint, bridgeEndpoint)) {
    fail('admission bridge anchor blob differs from the embedded endpoint');
  }

  return {
    path: bridgeRelativePath,
    contractVersion,
    bridgeId: string(raw.bridge_id, 'admission bridge bridge_id'),
    artifactHash,
    releaseDiffDigest,
    admittedEndpointExternalAnchor: {
      repository: anchorRepository,
      commit: anchorCommit,
      introducedCommit,
      path: anchorPath,
      sha256: anchorSha256,
    },
    baseReleaseId: string(baseRelease.release_id, 'admission bridge base release_id'),
    baseReleaseVersion: string(baseRelease.release_version, 'admission bridge base release_version'),
    baseReleaseHash: hash(baseRelease.release_hash, 'admission bridge base release_hash'),
    targetReleaseId: string(targetRelease.release_id, 'admission bridge target release_id'),
    targetReleaseVersion: string(targetRelease.release_version, 'admission bridge target release_version'),
    targetReleaseHash: hash(targetRelease.release_hash, 'admission bridge target release_hash'),
    targetBundleId: string(target.bundle_id, 'admission bridge target bundle_id'),
    targetBundleDigest: hash(target.bundle_digest, 'admission bridge target bundle_digest'),
    targetManifestSha256: hash(targetManifest.sha256, 'admission bridge target manifest sha256'),
    targetProjectionId: string(targetProjection.id, 'admission bridge target projection id'),
    targetProjectionDigest: hash(
      targetProjection.version_digest,
      'admission bridge target projection version_digest',
    ),
  };
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
  const folded = new Map<string, string>();
  for (const [index, line] of value.trimEnd().split('\n').entries()) {
    const match = /^([0-9a-f]{64}) {2}(.+)$/u.exec(line);
    if (!match) fail(`${label}:${index + 1} is not a canonical SHA256SUMS row`);
    const memberPath = bundleMemberPath(match[2], `${label}:${index + 1} path`);
    const foldedPath = caseFold(memberPath);
    if (result.has(memberPath) || folded.has(foldedPath)) fail(`${label} repeats or collides at ${memberPath}`);
    result.set(memberPath, match[1]);
    folded.set(foldedPath, memberPath);
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

  if (
    manifest.schema.version !== CTKG_SCHEMA_VERSION
    || !isSchemaIdentitySupported(manifest.schema.version, manifest.schema.sha256)
  ) {
    fail(
      `${manifest.bundle_id} uses an unregistered Schema identity `
      + `${manifest.schema.version}/${manifest.schema.sha256}`,
    );
  }
  const sumsPath = path.join(bundleDir, 'SHA256SUMS');
  const sumsBytes = await readFile(sumsPath);
  const sums = parseSums(sumsBytes.toString('utf8'), sumsPath);
  const files = (await listRegularFiles(bundleDir)).filter((name) => name !== 'SHA256SUMS');
  if (!Array.isArray(manifestRaw.artifacts)) {
    fail(`${manifest.bundle_id} Manifest artifacts must be an array`);
  }
  const artifactPaths = new Set<string>();
  const foldedArtifacts = new Map<string, string>();
  const artifactInputs: AggregateIntegrityArtifact[] = [];
  for (const [index, value] of manifestRaw.artifacts.entries()) {
    const artifact = object(value, `${manifest.bundle_id}.artifacts[${index}]`);
    const artifactPath = bundleMemberPath(
      artifact.path,
      `${manifest.bundle_id}.artifacts[${index}].path`,
    );
    const foldedPath = caseFold(artifactPath);
    if (
      artifactPath === 'bundle-manifest.json'
      || artifactPath === 'SHA256SUMS'
      || artifactPaths.has(artifactPath)
      || foldedArtifacts.has(foldedPath)
    ) {
      fail(`${manifest.bundle_id} Artifact path is reserved, duplicated, or case-fold colliding: ${artifactPath}`);
    }
    artifactPaths.add(artifactPath);
    foldedArtifacts.set(foldedPath, artifactPath);
    const bytes = await readFile(path.join(bundleDir, ...artifactPath.split('/')));
    const declaredHash = hash(artifact.sha256, `${manifest.bundle_id}.artifacts[${index}].sha256`);
    if (sha256(bytes) !== declaredHash || sums.get(artifactPath) !== declaredHash) {
      fail(`${manifest.bundle_id} Artifact hash drift: ${artifactPath}`);
    }
    if (bytes.byteLength !== nonNegativeInteger(
      artifact.byte_length,
      `${manifest.bundle_id}.artifacts[${index}].byte_length`,
    )) {
      fail(`${manifest.bundle_id} Artifact byte length drift: ${artifactPath}`);
    }
    const mediaType = string(artifact.media_type, `${manifest.bundle_id}.artifacts[${index}].media_type`);
    const recordCount = artifact.record_count === null
      ? null
      : nonNegativeInteger(artifact.record_count, `${manifest.bundle_id}.artifacts[${index}].record_count`);
    if (artifactRecordCount(bytes, mediaType) !== recordCount) {
      fail(`${manifest.bundle_id} Artifact record count drift: ${artifactPath}`);
    }
    artifactInputs.push({
      descriptor: {
        role: string(artifact.role, `${manifest.bundle_id}.artifacts[${index}].role`),
        contractVersion: string(
          artifact.contract_version,
          `${manifest.bundle_id}.artifacts[${index}].contract_version`,
        ),
        required: artifact.required === true,
        path: artifactPath,
        mediaType,
        sha256: declaredHash,
        byteLength: bytes.byteLength,
        recordCount,
      },
      bytes,
    });
  }
  try {
    validateAggregateManifestIntegrity({
      manifest: manifestRaw,
      manifestBytes,
      artifacts: artifactInputs,
      expectedRelease: manifest.release,
      requireStable: true,
    });
  } catch (error) {
    fail(`${manifest.bundle_id} ${error instanceof Error ? error.message : String(error)}`);
  }
  const manifestClosedFiles = ['bundle-manifest.json', ...artifactPaths].sort();
  if (canonicalJson(files) !== canonicalJson(manifestClosedFiles)) {
    fail(`${manifest.bundle_id} file set does not close over Manifest artifacts`);
  }
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
  if (closure.reference_kind !== 'legacy_exact') {
    fail('legacy root closure reference_kind is not legacy_exact');
  }
  if (!input.candidate.manifest.previous_bundle) {
    fail('chain head has no previous_bundle to close');
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
  predecessorRootClosurePath?: string;
  admittedEndpoint?: LatestStableAggregateAdmittedEndpoint;
  admittedEndpointPath?: string;
  admissionBridgeReleaseDiffPath?: string;
  actRepoRoot?: string;
}): Promise<LatestStableAggregateResolution> {
  const actkgRoot = path.resolve(options.actkgRoot);
  const releasesRoot = path.resolve(
    actkgRoot,
    options.releasesPath ?? 'releases',
  );
  const mainRef = options.mainRef ?? 'origin/main';
  const admittedEndpoint = options.admittedEndpointPath
    ? await loadLatestStableAggregateAdmittedEndpoint(path.resolve(options.admittedEndpointPath))
    : options.admittedEndpoint
      ? parseAdmittedEndpoint(options.admittedEndpoint)
      : undefined;
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
      closurePath: options.predecessorRootClosurePath
        ?? options.legacyRootClosurePath
        ?? await discoverPredecessorRootClosurePath(actkgRoot),
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

  const admissionBridgeReleaseDiff = options.admissionBridgeReleaseDiffPath
    ? admittedEndpoint
      ? await validateAdmissionBridgeReleaseDiff({
          actkgRoot,
          actRepoRoot: path.resolve(options.actRepoRoot ?? process.cwd()),
          mainRef,
          bridgePath: options.admissionBridgeReleaseDiffPath,
          admittedEndpoint,
          firstCandidate: chain[0]!,
        })
      : fail('admission bridge requires the ACT admitted endpoint')
    : undefined;

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
    const stableTagMembers = git(actkgRoot, [
      'ls-tree',
      '-r',
      '--name-only',
      candidate.manifest.publication.tag,
      '--',
      candidateBundlePath,
    ]).split('\n').filter(Boolean).map((member) => {
      const prefix = `${candidateBundlePath}/`;
      if (!member.startsWith(prefix)) {
        fail(`stable tag ${candidate.manifest.publication.tag} returned an out-of-package member ${member}`);
      }
      return member.slice(prefix.length);
    }).sort();
    const expectedStableTagMembers = [...candidate.bundleFiles, 'SHA256SUMS'].sort();
    if (canonicalJson(stableTagMembers) !== canonicalJson(expectedStableTagMembers)) {
      fail(`stable tag ${candidate.manifest.publication.tag} Bundle member set drift`);
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
    ...(admissionBridgeReleaseDiff ? { admissionBridgeReleaseDiff } : {}),
    ...(admittedEndpoint ? { admittedEndpoint } : {}),
  };
  // `resolvedAt` records when this observation completed. It is deliberately
  // kept outside `body` so the digest remains deterministic across reruns.
  const resolvedAt = new Date().toISOString();
  const binding: LatestStableAggregateBinding = {
    ...body,
    resolvedAt,
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
  predecessorRootClosurePath?: string;
  admittedEndpoint?: LatestStableAggregateAdmittedEndpoint;
  admittedEndpointPath?: string;
  admissionBridgeReleaseDiffPath?: string;
  actRepoRoot?: string;
}): Promise<LatestStableAggregateBinding> {
  const { binding } = await resolveLatestStableAggregateWithCandidates(options);
  return binding;
}
