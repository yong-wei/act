import { readFileSync } from 'node:fs';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';

import { canonicalJson, sha256 } from './authoritative-release';
import {
  ARTIFACT_CONTRACTS,
  CONTRACT_SCHEMA_RAW_HASHES,
  CTKG_SCHEMA_RAW_SHA256,
  CTKG_SCHEMA_VERSION,
  FORBIDDEN_PUBLIC_FIELD_TOKENS,
  FORBIDDEN_PUBLIC_GLOBAL_TOKENS,
  MANIFEST_NORMALIZATION,
  PUBLIC_BUNDLE_CONTRACT_VERSION,
  RELEASE_SET_LOCK_V3,
  REQUIRED_AGGREGATE_PROJECTION_PROFILES,
  RUNTIME_PROJECTION_PROFILES,
  findArtifactContract,
  isBundleContractSupported,
  isSchemaIdentitySupported,
  matchedRegistryIdentities,
  normalizeProjectionProfile,
} from './bundle-compatibility-registry';
import type {
  ArtifactDescriptor,
  CompatibilityAssessment,
  CompatibilityCode,
  CrosswalkRow,
  JsonObject,
  ProjectionIdentity,
  ProjectionLinkMetadataRow,
  RecomputedStatistics,
  ReleaseSetLockV3,
  ReleaseSetLockV3Component,
  ValidatedActKGBundle,
  ValidatedComponentReference,
  ValidatedRawArtifact,
} from './public-bundle-types';

const SHA256 = /^[a-f0-9]{64}$/u;
const MANIFEST_NAME = 'bundle-manifest.json';
const SHA256SUMS_NAME = 'SHA256SUMS';
const RESERVED_FILES = new Set([MANIFEST_NAME, SHA256SUMS_NAME]);
const DEFAULT_CONTRACT_SCHEMA_DIR = path.join(
  process.cwd(),
  'scripts/actkg-release/schemas/public-bundle',
);

export class PublicBundleRejection extends Error {
  readonly assessment: CompatibilityAssessment;

  constructor(assessment: CompatibilityAssessment) {
    super(`ActKG public Bundle rejected (${assessment.code}): ${assessment.reasons.join('; ')}`);
    this.name = 'PublicBundleRejection';
    this.assessment = assessment;
  }
}

export const DEFAULT_PUBLIC_BUNDLE_LOCK_PATH =
  'course-content/authoring/knowledge/releases/release-set.lock.v3.control-theory-engineering-v0.3-r2.json';

function reject(
  code: CompatibilityCode,
  reasons: string | string[],
  matchedIdentities = matchedRegistryIdentities(),
): never {
  throw new PublicBundleRejection({
    code,
    reasons: Array.isArray(reasons) ? reasons : [reasons],
    matchedIdentities,
  });
}

function integrity(reason: string): never {
  reject('INTEGRITY_REJECTED', reason);
}

function adapterRequired(reason: string): never {
  reject('ADAPTER_UPDATE_REQUIRED', reason);
}

function schemaReview(reason: string): never {
  reject('SCHEMA_REVIEW_REQUIRED', reason);
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) integrity(`${label} must be an object`);
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) integrity(`${label} must be a non-empty string`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) integrity(`${label} must be an integer`);
  return value;
}

function hash(value: unknown, label: string): string {
  const resolved = string(value, label);
  if (!SHA256.test(resolved)) integrity(`${label} must be a SHA-256 hex digest`);
  return resolved;
}

function records(value: unknown, label: string): JsonObject[] {
  if (!Array.isArray(value)) integrity(`${label} must be an array`);
  return value.map((item, index) => object(item, `${label}[${index}]`));
}

function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) integrity(`${label} must be an array`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
}

function assertSafeRelativePath(relative: string, label: string): string {
  if (!relative) integrity(`${label} is empty`);
  if (relative.startsWith('/') || relative.includes('\\') || relative.includes('//')) {
    integrity(`${label} is not a confined POSIX relative path`);
  }
  const parts = relative.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    integrity(`${label} escapes the controlled Bundle`);
  }
  return relative;
}

function caseFold(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US');
}

function parseSha256Sums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  const lines = text.split(/\r?\n/u).filter((line) => line.length > 0);
  for (const [index, line] of lines.entries()) {
    if (line.length < 67 || line.slice(64, 66) !== '  ') {
      integrity(`SHA256SUMS line ${index + 1} is malformed`);
    }
    const digest = line.slice(0, 64);
    const relative = line.slice(66);
    if (!SHA256.test(digest)) integrity(`SHA256SUMS line ${index + 1} has an invalid digest`);
    assertSafeRelativePath(relative, `SHA256SUMS path ${relative}`);
    if (sums.has(relative)) integrity(`SHA256SUMS repeats path ${relative}`);
    sums.set(relative, digest);
  }
  const ordered = [...sums.keys()];
  if (canonicalJson(ordered) !== canonicalJson([...ordered].sort())) {
    integrity('SHA256SUMS paths are not sorted');
  }
  return sums;
}

function recordCount(bytes: Buffer, relativePath: string): number | null {
  if (!relativePath.endsWith('.jsonl')) return null;
  const text = bytes.toString('utf8');
  if (!text) return 0;
  return text.split(/\r?\n/u).filter((line) => line.length > 0).length;
}

function loadJson(bytes: Buffer, label: string): JsonObject {
  return object(JSON.parse(bytes.toString('utf8')), label);
}

function loadJsonl(bytes: Buffer, label: string): JsonObject[] {
  const rows: JsonObject[] = [];
  for (const [index, line] of bytes.toString('utf8').split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    rows.push(object(JSON.parse(line), `${label}[${index}]`));
  }
  return rows;
}

function schemaFailure(label: string, errors: ErrorObject[] | null | undefined): never {
  const detail = errors?.map((error) => `${error.instancePath || '/'} ${error.message ?? error.keyword}`).join('; ');
  integrity(`${label} violates the contract schema${detail ? `: ${detail}` : ''}`);
}

async function listRegularFiles(directory: string): Promise<string[]> {
  const names = await readdir(directory);
  const files: string[] = [];
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const full = path.join(directory, name);
    const linkInfo = await lstat(full);
    if (linkInfo.isSymbolicLink()) integrity(`Bundle contains symbolic link ${name}`);
    if (linkInfo.isFile()) files.push(name);
    else if (linkInfo.isDirectory()) integrity(`Bundle contains unexpected directory ${name}`);
    else integrity(`Bundle contains non-regular entry ${name}`);
  }
  return files.sort();
}

async function readExactFile(directory: string, relative: string): Promise<Buffer> {
  assertSafeRelativePath(relative, relative);
  const full = path.resolve(directory, ...relative.split('/'));
  const rootResolved = await realpath(directory).catch(() => path.resolve(directory));
  const linkInfo = await lstat(full).catch(() => {
    integrity(`Artifact path ${relative} is missing`);
  });
  if (linkInfo.isSymbolicLink()) integrity(`Artifact path ${relative} is a symbolic link`);
  if (!linkInfo.isFile()) integrity(`Artifact path ${relative} is not a regular file`);
  const fileResolved = await realpath(full).catch(() => {
    integrity(`Artifact path ${relative} is missing`);
  });
  if (!fileResolved.startsWith(`${rootResolved}${path.sep}`) && fileResolved !== rootResolved) {
    integrity(`Artifact path ${relative} escapes the controlled Bundle`);
  }
  return readFile(full);
}

function compileContractValidators(schemaDir: string): {
  manifest: ValidateFunction;
  componentManifest: ValidateFunction;
  metadataRow: ValidateFunction;
  crosswalkRow: ValidateFunction;
  validationReport: ValidateFunction;
} {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const load = (name: keyof typeof CONTRACT_SCHEMA_RAW_HASHES): JsonObject => {
    const bytes = readFileSync(path.join(schemaDir, name));
    if (sha256(bytes) !== CONTRACT_SCHEMA_RAW_HASHES[name]) {
      integrity(`contract schema ${name} raw hash drift`);
    }
    return object(JSON.parse(bytes.toString('utf8')), name);
  };
  // Keep on-disk schema bytes pinned, but allow unknown optional Artifact roles
  // at validation time so COMPATIBLE_OPTIONAL_EXTENSION remains expressible.
  const manifestSchema = load('bundle-manifest.schema.json');
  const artifactDef = object(
    object(manifestSchema.$defs, 'bundle-manifest.$defs').artifact,
    'bundle-manifest.$defs.artifact',
  );
  const artifactProperties = object(artifactDef.properties, 'artifact.properties');
  artifactProperties.role = { type: 'string', minLength: 1 };
  return {
    manifest: ajv.compile(manifestSchema),
    componentManifest: ajv.compile(load('component-manifest.schema.json')),
    metadataRow: ajv.compile(load('projection-link-metadata-row.schema.json')),
    crosswalkRow: ajv.compile(load('rag-crosswalk-row.schema.json')),
    validationReport: ajv.compile(load('validation-report.schema.json')),
  };
}

function compileCtkgValidators(schema: JsonObject): {
  release: ValidateFunction;
  projection: ValidateFunction;
} {
  const defs = object(schema.$defs, 'ctkg.schema.json.$defs');
  for (const name of ['Release', 'ReleaseEntry', 'GraphProjection', 'ProjectedNode', 'ProjectedLink']) {
    if (!defs[name]) integrity(`pinned CTKG Schema does not define ${name}`);
  }
  const ajv = new Ajv({ allErrors: true, strict: true, validateFormats: false });
  return {
    release: ajv.compile({ $defs: defs, $ref: '#/$defs/Release' }),
    projection: ajv.compile({ $defs: defs, $ref: '#/$defs/GraphProjection' }),
  };
}

function parseLockComponent(component: JsonObject, index: number): ReleaseSetLockV3Component {
  const releaseId = string(component.release_id, `lock.components[${index}].release_id`);
  const controlledPath = string(component.controlled_path, `lock.components[${index}].controlled_path`);
  // Backward compatible: omitted reference_kind means legacy_exact.
  const referenceKind = component.reference_kind === undefined
    ? 'legacy_exact'
    : string(component.reference_kind, `lock.components[${index}].reference_kind`);

  if (referenceKind === 'legacy_exact') {
    return {
      reference_kind: 'legacy_exact',
      release_id: releaseId,
      controlled_path: controlledPath,
      release_json_name: string(
        component.release_json_name,
        `lock.components[${index}].release_json_name`,
      ),
      release_raw_sha256: hash(
        component.release_raw_sha256,
        `lock.components[${index}].release_raw_sha256`,
      ),
    };
  }

  if (referenceKind === 'standard_bundle') {
    return {
      reference_kind: 'standard_bundle',
      release_id: releaseId,
      controlled_path: controlledPath,
      bundle_id: string(component.bundle_id, `lock.components[${index}].bundle_id`),
      bundle_digest: hash(component.bundle_digest, `lock.components[${index}].bundle_digest`),
      manifest_raw_sha256: hash(
        component.manifest_raw_sha256,
        `lock.components[${index}].manifest_raw_sha256`,
      ),
    };
  }

  integrity(`unsupported lock component reference_kind: ${referenceKind}`);
}

function parseLock(lock: JsonObject): ReleaseSetLockV3 {
  if (lock.lock_version !== RELEASE_SET_LOCK_V3) integrity('unsupported ReleaseSet lock version');
  const bundle = object(lock.bundle, 'lock.bundle');
  const release = object(lock.release, 'lock.release');
  const compatibility = object(lock.compatibility, 'lock.compatibility');
  const sourceRevision = object(lock.source_revision, 'lock.source_revision');
  const components = records(lock.components, 'lock.components').map((component, index) => (
    parseLockComponent(component, index)
  ));
  return {
    lock_version: RELEASE_SET_LOCK_V3,
    release_set_id: string(lock.release_set_id, 'lock.release_set_id'),
    bundle: {
      controlled_path: string(bundle.controlled_path, 'lock.bundle.controlled_path'),
      bundle_id: string(bundle.bundle_id, 'lock.bundle.bundle_id'),
      bundle_revision: integer(bundle.bundle_revision, 'lock.bundle.bundle_revision'),
      bundle_digest: hash(bundle.bundle_digest, 'lock.bundle.bundle_digest'),
      manifest_raw_sha256: hash(bundle.manifest_raw_sha256, 'lock.bundle.manifest_raw_sha256'),
    },
    release: {
      release_id: string(release.release_id, 'lock.release.release_id'),
      release_version: string(release.release_version, 'lock.release.release_version'),
      release_hash: hash(release.release_hash, 'lock.release.release_hash'),
      source_dataset_hash: hash(release.source_dataset_hash, 'lock.release.source_dataset_hash'),
    },
    compatibility: {
      bundle_contract_version: string(
        compatibility.bundle_contract_version,
        'lock.compatibility.bundle_contract_version',
      ),
      schema_version: string(compatibility.schema_version, 'lock.compatibility.schema_version'),
      schema_sha256: hash(compatibility.schema_sha256, 'lock.compatibility.schema_sha256'),
    },
    source_revision: {
      commit: string(sourceRevision.commit, 'lock.source_revision.commit'),
      tag: string(sourceRevision.tag, 'lock.source_revision.tag'),
    },
    components,
  };
}

function computeBundleDigest(manifest: JsonObject): string {
  const body = structuredClone(manifest);
  delete body.bundle_digest;
  return sha256(canonicalJson(body));
}

function scanPrivacy(relativePath: string, bytes: Buffer): string[] {
  const text = bytes.toString('utf8');
  const findings: string[] = [];
  for (const token of FORBIDDEN_PUBLIC_GLOBAL_TOKENS) {
    if (text.includes(token)) findings.push(`${relativePath}:${token}`);
  }
  if (relativePath !== 'ctkg.schema.json') {
    for (const token of FORBIDDEN_PUBLIC_FIELD_TOKENS) {
      if (text.includes(token)) findings.push(`${relativePath}:${token}`);
    }
  }
  return findings;
}

function metadataRows(rows: JsonObject[]): ProjectionLinkMetadataRow[] {
  return rows.map((row, index) => {
    const evidence = row.evidence_refs;
    if (!Array.isArray(evidence)) integrity(`metadata[${index}].evidence_refs must be an array`);
    return {
      relationId: string(row.relation_id, `metadata[${index}].relation_id`),
      releaseTier: string(row.release_tier, `metadata[${index}].release_tier`),
      sourceRelease: string(row.source_release, `metadata[${index}].source_release`),
      sourceReleaseHash: hash(row.source_release_hash, `metadata[${index}].source_release_hash`),
      evidenceRefs: evidence.map((item, evidenceIndex) => (
        string(item, `metadata[${index}].evidence_refs[${evidenceIndex}]`)
      )),
      sourceComponentRelease: typeof row.source_component_release === 'string'
        ? row.source_component_release
        : undefined,
      targetComponentRelease: typeof row.target_component_release === 'string'
        ? row.target_component_release
        : undefined,
      relationComponentRelease: typeof row.relation_component_release === 'string'
        ? row.relation_component_release
        : undefined,
      payload: row,
    };
  });
}

function projectionIdentity(
  artifact: ArtifactDescriptor,
  payload: JsonObject,
  profile: string,
): ProjectionIdentity {
  return {
    projectionId: string(payload.id, `${artifact.path}.id`),
    profile,
    projectionProfile: string(payload.projection_profile, `${artifact.path}.projection_profile`),
    versionDigest: hash(payload.version_digest, `${artifact.path}.version_digest`),
    sourceRelease: string(payload.source_release, `${artifact.path}.source_release`),
    sourceReleaseHash: hash(payload.source_release_hash, `${artifact.path}.source_release_hash`),
    sourceDatasetHash: hash(payload.source_dataset_hash, `${artifact.path}.source_dataset_hash`),
    nodeCount: records(payload.nodes ?? [], `${artifact.path}.nodes`).length,
    linkCount: records(payload.links ?? [], `${artifact.path}.links`).length,
    artifactPath: artifact.path,
    artifactSha256: artifact.sha256,
  };
}

function classifyCompatibility(options: {
  unknownOptional: ArtifactDescriptor[];
  lock: ReleaseSetLockV3;
  manifest: JsonObject;
}): CompatibilityAssessment {
  const matchedIdentities = matchedRegistryIdentities();
  matchedIdentities.push(
    {
      kind: 'bundle',
      id: string(options.manifest.bundle_id, 'manifest.bundle_id'),
      version: String(options.manifest.bundle_revision),
      sha256: hash(options.manifest.bundle_digest, 'manifest.bundle_digest'),
    },
    {
      kind: 'release',
      id: options.lock.release.release_id,
      sha256: options.lock.release.release_hash,
    },
  );

  if (options.unknownOptional.length > 0) {
    return {
      code: 'COMPATIBLE_OPTIONAL_EXTENSION',
      reasons: options.unknownOptional.map(
        (artifact) => `unknown optional artifact ${artifact.role}@${artifact.contractVersion} at ${artifact.path}`,
      ),
      matchedIdentities,
    };
  }

  const previous = object(options.manifest.previous_bundle ?? {}, 'manifest.previous_bundle');
  const previousKind = typeof previous.kind === 'string' ? previous.kind : '';
  if (
    previousKind === 'legacy_exact'
    || (
      typeof previous.bundle_id === 'string'
      && previous.bundle_id !== options.manifest.bundle_id
      && hash(options.manifest.release && object(options.manifest.release, 'manifest.release').release_hash, 'release_hash')
        === options.lock.release.release_hash
    )
  ) {
    // packaging revision of the same semantic release
    if (
      string(object(options.manifest.release, 'manifest.release').release_id, 'release_id')
        === options.lock.release.release_id
      && hash(object(options.manifest.release, 'manifest.release').release_hash, 'release_hash')
        === options.lock.release.release_hash
      && integer(options.manifest.bundle_revision, 'bundle_revision') !== 1
    ) {
      return {
        code: 'COMPATIBLE_PACKAGING_REVISION',
        reasons: [
          'bundle revision differs while release identity and semantic hashes remain stable',
        ],
        matchedIdentities,
      };
    }
  }

  return {
    code: 'COMPATIBLE_CONTENT_UPDATE',
    reasons: [
      'registered bundle, schema, and required artifact contracts admit the current content package',
    ],
    matchedIdentities,
  };
}

export async function loadAndValidatePublicBundleV1(options: {
  root?: string;
  lockPath?: string;
  bundlePath?: string;
  allowCandidateBundle?: boolean;
  contractSchemaDir?: string;
} = {}): Promise<ValidatedActKGBundle> {
  const root = path.resolve(options.root ?? process.cwd());
  const lockPath = options.lockPath ?? DEFAULT_PUBLIC_BUNDLE_LOCK_PATH;
  const lockBytes = await readFile(path.join(root, lockPath));
  const lockRawSha256 = sha256(lockBytes);
  const lock = parseLock(object(JSON.parse(lockBytes.toString('utf8')), 'ReleaseSet lock v3'));

  if (!isBundleContractSupported(lock.compatibility.bundle_contract_version)) {
    adapterRequired(`unsupported lock bundle contract ${lock.compatibility.bundle_contract_version}`);
  }
  if (!isSchemaIdentitySupported(lock.compatibility.schema_version, lock.compatibility.schema_sha256)) {
    schemaReview(
      `lock Schema identity ${lock.compatibility.schema_version}/${lock.compatibility.schema_sha256} is not registered`,
    );
  }

  const controlledPath = lock.bundle.controlled_path;
  const requested = path.resolve(root, options.bundlePath ?? controlledPath);
  const expected = path.resolve(root, controlledPath);
  if (await realpath(requested).catch(() => requested) !== await realpath(expected).catch(() => expected)) {
    integrity('requested package path is not the controlled locked path');
  }
  const bundleDir = await realpath(expected).catch(() => {
    integrity(`controlled Bundle path ${controlledPath} is missing`);
  });

  const contractValidators = compileContractValidators(options.contractSchemaDir ?? DEFAULT_CONTRACT_SCHEMA_DIR);

  const onDisk = await listRegularFiles(bundleDir);
  if (!onDisk.includes(MANIFEST_NAME)) integrity('standard Bundle is missing bundle-manifest.json');
  if (!onDisk.includes(SHA256SUMS_NAME)) integrity('standard Bundle is missing SHA256SUMS');

  const manifestBytes = await readExactFile(bundleDir, MANIFEST_NAME);
  const manifestRawSha256 = sha256(manifestBytes);
  if (manifestRawSha256 !== lock.bundle.manifest_raw_sha256) {
    integrity('Manifest raw SHA-256 does not match the ReleaseSet lock');
  }
  const manifest = loadJson(manifestBytes, MANIFEST_NAME);
  if (!contractValidators.manifest(manifest)) {
    schemaFailure('bundle-manifest.json', contractValidators.manifest.errors);
  }

  if (manifest.bundle_contract_version !== PUBLIC_BUNDLE_CONTRACT_VERSION) {
    adapterRequired(`unsupported bundle_contract_version ${String(manifest.bundle_contract_version)}`);
  }
  if (manifest.normalization !== MANIFEST_NORMALIZATION) {
    adapterRequired(`unsupported normalization ${String(manifest.normalization)}`);
  }
  if (manifest.bundle_kind !== 'aggregate') {
    integrity('production candidate intake requires bundle_kind=aggregate');
  }
  if (manifest.release_stage === 'candidate' && !options.allowCandidateBundle) {
    integrity('candidate Bundle requires an explicit allowCandidateBundle flag');
  }
  if (manifest.release_stage !== 'stable' && manifest.release_stage !== 'candidate') {
    integrity('release_stage is invalid');
  }

  const claimedDigest = hash(manifest.bundle_digest, 'manifest.bundle_digest');
  const actualDigest = computeBundleDigest(manifest);
  if (claimedDigest !== actualDigest) integrity('bundle_digest mismatch');
  if (claimedDigest !== lock.bundle.bundle_digest) integrity('bundle_digest does not match the ReleaseSet lock');
  if (string(manifest.bundle_id, 'manifest.bundle_id') !== lock.bundle.bundle_id) {
    integrity('bundle_id does not match the ReleaseSet lock');
  }
  if (integer(manifest.bundle_revision, 'manifest.bundle_revision') !== lock.bundle.bundle_revision) {
    integrity('bundle_revision does not match the ReleaseSet lock');
  }

  const schemaIdentity = object(manifest.schema, 'manifest.schema');
  const schemaVersion = string(schemaIdentity.version, 'manifest.schema.version');
  const schemaSha = hash(schemaIdentity.sha256, 'manifest.schema.sha256');
  if (!isSchemaIdentitySupported(schemaVersion, schemaSha)) {
    schemaReview(`Schema identity ${schemaVersion}/${schemaSha} is not registered`);
  }

  const releaseIdentity = object(manifest.release, 'manifest.release');
  if (
    string(releaseIdentity.release_id, 'manifest.release.release_id') !== lock.release.release_id
    || string(releaseIdentity.release_version, 'manifest.release.release_version') !== lock.release.release_version
    || hash(releaseIdentity.release_hash, 'manifest.release.release_hash') !== lock.release.release_hash
    || hash(releaseIdentity.source_dataset_hash, 'manifest.release.source_dataset_hash')
      !== lock.release.source_dataset_hash
  ) {
    integrity('Manifest release identity does not match the ReleaseSet lock');
  }

  const sourceRevision = object(manifest.source_revision, 'manifest.source_revision');
  if (
    string(sourceRevision.commit, 'manifest.source_revision.commit') !== lock.source_revision.commit
    || string(sourceRevision.tag, 'manifest.source_revision.tag') !== lock.source_revision.tag
  ) {
    integrity('Manifest source revision does not match the ReleaseSet lock');
  }

  const artifactRows = records(manifest.artifacts, 'manifest.artifacts');
  const declaredPaths: string[] = [];
  const caseFolded = new Map<string, string>();
  const descriptors: ArtifactDescriptor[] = [];
  const unknownOptional: ArtifactDescriptor[] = [];

  for (const [index, row] of artifactRows.entries()) {
    const relativePath = assertSafeRelativePath(string(row.path, `artifacts[${index}].path`), `artifacts[${index}].path`);
    const folded = caseFold(relativePath);
    if (caseFolded.has(folded)) {
      integrity(`Artifact paths collide after case folding: ${caseFolded.get(folded)} and ${relativePath}`);
    }
    caseFolded.set(folded, relativePath);
    if (declaredPaths.includes(relativePath)) integrity(`duplicate Artifact path ${relativePath}`);
    declaredPaths.push(relativePath);

    const role = string(row.role, `artifacts[${index}].role`);
    const contractVersion = string(row.contract_version, `artifacts[${index}].contract_version`);
    const required = row.required === true;
    const registration = findArtifactContract(role, contractVersion);
    if (!registration && required) {
      adapterRequired(`unknown required Artifact role/contract ${role}@${contractVersion}`);
    }
    if (!registration && !required) {
      // unknown optional — preserve raw, disable semantics
    }
    const profile = typeof row.profile === 'string' ? row.profile : undefined;
    const profiles = Array.isArray(row.profiles)
      ? row.profiles.map((item, profileIndex) => string(item, `artifacts[${index}].profiles[${profileIndex}]`))
      : undefined;
    if (role === 'projection') {
      if (!profile) integrity(`projection artifact ${relativePath} is missing profile`);
    }

    const descriptor: ArtifactDescriptor = {
      role,
      profile,
      profiles,
      contractVersion,
      required,
      path: relativePath,
      mediaType: string(row.media_type, `artifacts[${index}].media_type`),
      sha256: hash(row.sha256, `artifacts[${index}].sha256`),
      byteLength: integer(row.byte_length, `artifacts[${index}].byte_length`),
      recordCount: row.record_count === null || row.record_count === undefined
        ? null
        : integer(row.record_count, `artifacts[${index}].record_count`),
      known: Boolean(registration),
      semanticsEnabled: Boolean(registration?.enableSemantics),
    };
    if (!registration) unknownOptional.push(descriptor);
    descriptors.push(descriptor);
  }

  // Enforce registry requiredForAggregate: each required role+contract must exist
  // and declare required:true. Projection/metadata profile closure is checked later.
  for (const registration of ARTIFACT_CONTRACTS) {
    if (!registration.requiredForAggregate) continue;
    const matches = descriptors.filter(
      (descriptor) => (
        descriptor.role === registration.role
        && descriptor.contractVersion === registration.contractVersion
      ),
    );
    if (matches.length === 0) {
      integrity(
        `required aggregate Artifact missing: ${registration.role}@${registration.contractVersion}`,
      );
    }
    for (const match of matches) {
      if (!match.required) {
        integrity(
          `required aggregate Artifact must declare required:true: ${registration.role}@${registration.contractVersion} at ${match.path}`,
        );
      }
    }
  }

  const expectedFiles = new Set([...declaredPaths, MANIFEST_NAME, SHA256SUMS_NAME]);
  const actualFiles = new Set(onDisk);
  if (canonicalJson([...expectedFiles].sort()) !== canonicalJson([...actualFiles].sort())) {
    integrity('Bundle file set does not equal Manifest artifacts plus reserved files');
  }

  const sumsBytes = await readExactFile(bundleDir, SHA256SUMS_NAME);
  const sums = parseSha256Sums(sumsBytes.toString('utf8'));
  const sumPaths = [...sums.keys()];
  if (canonicalJson(sumPaths) !== canonicalJson([...actualFiles].filter((name) => name !== SHA256SUMS_NAME).sort())) {
    integrity('SHA256SUMS file set does not close over the Bundle');
  }

  const privacyFindings: string[] = [];
  privacyFindings.push(...scanPrivacy(MANIFEST_NAME, manifestBytes));
  privacyFindings.push(...scanPrivacy(SHA256SUMS_NAME, sumsBytes));

  const rawArtifacts: ValidatedRawArtifact[] = [];
  for (const descriptor of descriptors) {
    const bytes = await readExactFile(bundleDir, descriptor.path);
    if (sha256(bytes) !== descriptor.sha256) integrity(`Artifact SHA mismatch: ${descriptor.path}`);
    if (bytes.byteLength !== descriptor.byteLength) integrity(`Artifact byte length mismatch: ${descriptor.path}`);
    const actualRecords = recordCount(bytes, descriptor.path);
    if (actualRecords !== descriptor.recordCount) {
      integrity(`Artifact record count mismatch: ${descriptor.path}`);
    }
    const sumDigest = sums.get(descriptor.path);
    if (!sumDigest || sumDigest !== descriptor.sha256) {
      integrity(`SHA256SUMS mismatch: ${descriptor.path}`);
    }
    privacyFindings.push(...scanPrivacy(descriptor.path, bytes));
    rawArtifacts.push({ descriptor, bytes });
  }
  if (sha256(manifestBytes) !== sums.get(MANIFEST_NAME)) integrity('SHA256SUMS mismatch: bundle-manifest.json');
  if (privacyFindings.length > 0) {
    integrity(`public privacy boundary violated: ${privacyFindings.join(', ')}`);
  }

  const byRole = new Map<string, ValidatedRawArtifact[]>();
  for (const artifact of rawArtifacts) {
    const list = byRole.get(artifact.descriptor.role) ?? [];
    list.push(artifact);
    byRole.set(artifact.descriptor.role, list);
  }

  const releaseArtifacts = byRole.get('release') ?? [];
  if (releaseArtifacts.length !== 1) integrity('Bundle must contain exactly one release Artifact');
  const schemaArtifacts = byRole.get('ctkg_schema') ?? [];
  if (schemaArtifacts.length !== 1) integrity('Bundle must contain exactly one ctkg_schema Artifact');
  if (schemaArtifacts[0]!.descriptor.sha256 !== schemaSha || schemaSha !== CTKG_SCHEMA_RAW_SHA256) {
    integrity('CTKG Schema identity mismatch');
  }
  const schema = loadJson(schemaArtifacts[0]!.bytes, schemaArtifacts[0]!.descriptor.path);
  if (string(schema.version, 'schema.version') !== CTKG_SCHEMA_VERSION) {
    schemaReview(`Schema version ${String(schema.version)} is not registered`);
  }
  const ctkgValidators = compileCtkgValidators(schema);

  const release = loadJson(releaseArtifacts[0]!.bytes, releaseArtifacts[0]!.descriptor.path);
  if (!ctkgValidators.release(release)) schemaFailure('Release', ctkgValidators.release.errors);
  if (
    string(release.id, 'release.id') !== lock.release.release_id
    || string(release.release_version, 'release.release_version') !== lock.release.release_version
    || hash(release.release_hash, 'release.release_hash') !== lock.release.release_hash
    || hash(release.source_dataset_hash, 'release.source_dataset_hash') !== lock.release.source_dataset_hash
  ) {
    integrity('Manifest and Release identities differ');
  }
  const normalizedRelease = structuredClone(release);
  delete normalizedRelease.release_hash;
  if (sha256(canonicalJson(normalizedRelease)) !== lock.release.release_hash) {
    integrity('canonical Release hash drift');
  }

  const entries = records(release.entries, 'release.entries');
  const includedEntities = stringList(release.included_entities, 'release.included_entities');
  if (new Set(includedEntities).size !== includedEntities.length) {
    integrity('release.included_entities repeats an entity');
  }
  const entryEntityIds = new Set<string>();
  const entryTierByEntity = new Map<string, string>();
  const relationEntryIds = new Set<string>();
  for (const [index, releaseEntry] of entries.entries()) {
    const entity = string(releaseEntry.entity, `entries[${index}].entity`);
    if (entryEntityIds.has(entity)) integrity(`release entries repeat entity ${entity}`);
    entryEntityIds.add(entity);
    entryTierByEntity.set(entity, string(releaseEntry.release_tier, `entries[${index}].release_tier`));
    if (releaseEntry.entity_role === 'relation') relationEntryIds.add(entity);
  }
  if (entryEntityIds.size !== includedEntities.length || !includedEntities.every((entity) => entryEntityIds.has(entity))) {
    integrity('release entries and included_entities diverge');
  }

  const componentArtifacts = byRole.get('component_manifest') ?? [];
  if (componentArtifacts.length !== 1) integrity('Bundle must contain one component_manifest Artifact');
  const componentManifest = loadJson(componentArtifacts[0]!.bytes, componentArtifacts[0]!.descriptor.path);
  if (!contractValidators.componentManifest(componentManifest)) {
    schemaFailure('component-manifest', contractValidators.componentManifest.errors);
  }
  const manifestComponents = records(manifest.components, 'manifest.components');
  const fileComponents = records(componentManifest.components, 'component-manifest.components');
  const releaseComponentIds = new Set(stringList(release.component_releases, 'release.component_releases'));
  const manifestComponentIds = new Set(
    manifestComponents.map((component, index) => string(component.release_id, `manifest.components[${index}].release_id`)),
  );
  const fileComponentIds = new Set(
    fileComponents.map((component, index) => string(component.release_id, `component-manifest.components[${index}].release_id`)),
  );
  if (
    canonicalJson([...releaseComponentIds].sort())
      !== canonicalJson([...manifestComponentIds].sort())
    || canonicalJson([...manifestComponentIds].sort())
      !== canonicalJson([...fileComponentIds].sort())
  ) {
    integrity('component identity sets differ across Release, Manifest, and component-releases.json');
  }
  if (manifestComponents.some((component) => !component.release_id)) {
    integrity('component identity is incomplete');
  }

  const lockComponentsById = new Map(lock.components.map((component) => [component.release_id, component]));
  if (canonicalJson([...lockComponentsById.keys()].sort()) !== canonicalJson([...manifestComponentIds].sort())) {
    integrity('ReleaseSet lock component set does not match the Bundle component set');
  }

  const fileById = new Map(
    fileComponents.map((component) => [string(component.release_id, 'component.release_id'), component]),
  );
  const validatedComponents: ValidatedComponentReference[] = [];
  for (const component of manifestComponents) {
    const releaseId = string(component.release_id, 'component.release_id');
    const releaseVersion = string(component.release_version, 'component.release_version');
    const releaseHash = hash(component.release_hash, 'component.release_hash');
    const componentRole = string(component.component_role, 'component.component_role');
    const referenceKind = string(component.reference_kind, 'component.reference_kind');
    const fileComponent = fileById.get(releaseId);
    if (!fileComponent) integrity(`component ${releaseId} missing from component-releases.json`);
    if (
      string(fileComponent.release_version, 'file component.release_version') !== releaseVersion
      || hash(fileComponent.release_hash, 'file component.release_hash') !== releaseHash
      || string(fileComponent.component_role, 'file component.component_role') !== componentRole
    ) {
      integrity(`component identity mismatch: ${releaseId}`);
    }
    const locked = lockComponentsById.get(releaseId);
    if (!locked) integrity(`component ${releaseId} is missing from the ReleaseSet lock`);

    if (referenceKind === 'legacy_exact') {
      if (locked.reference_kind === 'standard_bundle') {
        integrity(`component ${releaseId} reference_kind disagrees with the ReleaseSet lock`);
      }
      const releaseRawSha256 = hash(component.release_raw_sha256, 'component.release_raw_sha256');
      if (locked.release_raw_sha256 !== releaseRawSha256) {
        integrity(`component ${releaseId} release_raw_sha256 does not match the lock`);
      }
      const componentFile = path.join(root, locked.controlled_path, locked.release_json_name);
      const componentBytes = await readFile(componentFile).catch(() => {
        integrity(`component ${releaseId} controlled package is missing`);
      });
      if (sha256(componentBytes) !== releaseRawSha256) {
        integrity(`legacy component raw hash mismatch: ${releaseId}`);
      }
      // Component package content must agree with declared identity (not just inventory lists).
      // Compatible with root-locus envelope packages and CTKG 0.2 Release components.
      const packageRelease = loadJson(componentBytes, `component package ${releaseId}`);
      if (string(packageRelease.release_version, `component package ${releaseId}.release_version`) !== releaseVersion) {
        integrity(`component package release_version disagrees with declaration: ${releaseId}`);
      }
      if (hash(packageRelease.release_hash, `component package ${releaseId}.release_hash`) !== releaseHash) {
        integrity(`component package release_hash disagrees with declaration: ${releaseId}`);
      }
      if (typeof packageRelease.id === 'string' && packageRelease.id !== releaseId) {
        integrity(`component package id disagrees with declaration: ${releaseId}`);
      }
      const normalizedComponent = structuredClone(packageRelease);
      delete normalizedComponent.release_hash;
      if (sha256(canonicalJson(normalizedComponent)) !== releaseHash) {
        integrity(`component package canonical release_hash drift: ${releaseId}`);
      }
      const sourceRevisionValue = component.source_revision && typeof component.source_revision === 'object'
        ? object(component.source_revision, 'component.source_revision')
        : null;
      validatedComponents.push({
        releaseId,
        releaseVersion,
        releaseHash,
        componentRole,
        referenceKind: 'legacy_exact',
        controlledPath: locked.controlled_path,
        releaseJsonName: locked.release_json_name,
        releaseRawSha256,
        sourceCommit: sourceRevisionValue
          ? string(sourceRevisionValue.commit, 'component.source_revision.commit')
          : undefined,
      });
      continue;
    }

    if (referenceKind === 'standard_bundle') {
      if (locked.reference_kind !== 'standard_bundle') {
        integrity(`component ${releaseId} reference_kind disagrees with the ReleaseSet lock`);
      }
      const bundleId = string(component.bundle_id, 'component.bundle_id');
      const bundleDigest = hash(component.bundle_digest, 'component.bundle_digest');
      const manifestSha256 = hash(component.manifest_sha256, 'component.manifest_sha256');
      if (locked.bundle_id !== bundleId) {
        integrity(`standard_bundle component ${releaseId} bundle_id does not match the lock`);
      }
      if (locked.bundle_digest !== bundleDigest) {
        integrity(`standard_bundle component ${releaseId} bundle_digest does not match the lock`);
      }
      if (locked.manifest_raw_sha256 !== manifestSha256) {
        integrity(`standard_bundle component ${releaseId} manifest_sha256 does not match the lock`);
      }

      // Read only the controlled component Manifest. Do not recursively import,
      // write database state, or enable runtime semantics for nested packages.
      const componentManifestRelative = MANIFEST_NAME;
      const componentManifestFile = path.join(root, locked.controlled_path, componentManifestRelative);
      const componentManifestBytes = await readFile(componentManifestFile).catch(() => {
        integrity(`standard_bundle component ${releaseId} controlled Manifest is missing`);
      });
      if (sha256(componentManifestBytes) !== manifestSha256) {
        integrity(`standard_bundle component ${releaseId} Manifest raw hash mismatch`);
      }
      const componentManifest = loadJson(
        componentManifestBytes,
        `standard_bundle component ${releaseId} Manifest`,
      );
      if (!contractValidators.manifest(componentManifest)) {
        schemaFailure(
          `standard_bundle component ${releaseId} Manifest`,
          contractValidators.manifest.errors,
        );
      }
      if (string(componentManifest.bundle_id, `component ${releaseId}.bundle_id`) !== bundleId) {
        integrity(`standard_bundle component ${releaseId} Manifest bundle_id disagrees`);
      }
      const claimedComponentDigest = hash(
        componentManifest.bundle_digest,
        `component ${releaseId}.bundle_digest`,
      );
      const actualComponentDigest = computeBundleDigest(componentManifest);
      if (claimedComponentDigest !== actualComponentDigest) {
        integrity(`standard_bundle component ${releaseId} canonical bundle_digest mismatch`);
      }
      if (claimedComponentDigest !== bundleDigest) {
        integrity(`standard_bundle component ${releaseId} bundle_digest disagrees with declaration`);
      }
      const componentRelease = object(componentManifest.release, `component ${releaseId}.release`);
      if (
        string(componentRelease.release_id, `component ${releaseId}.release_id`) !== releaseId
        || string(componentRelease.release_version, `component ${releaseId}.release_version`) !== releaseVersion
        || hash(componentRelease.release_hash, `component ${releaseId}.release_hash`) !== releaseHash
      ) {
        integrity(
          `standard_bundle component ${releaseId} release identity disagrees with Manifest declaration`,
        );
      }

      validatedComponents.push({
        releaseId,
        releaseVersion,
        releaseHash,
        componentRole,
        referenceKind: 'standard_bundle',
        controlledPath: locked.controlled_path,
        bundleId,
        bundleDigest,
        manifestSha256,
      });
      continue;
    }

    integrity(`unsupported component reference_kind: ${referenceKind}`);
  }

  const projectionArtifacts = byRole.get('projection') ?? [];
  if (projectionArtifacts.length === 0) integrity('Bundle is missing projection Artifacts');
  const projections: Array<{ artifact: ValidatedRawArtifact; payload: JsonObject; profile: string }> = [];
  const profileSeen = new Map<string, string>();
  for (const artifact of projectionArtifacts) {
    const rawProfile = string(artifact.descriptor.profile, `${artifact.descriptor.path}.profile`);
    const profile = normalizeProjectionProfile(rawProfile);
    if (profileSeen.has(profile)) {
      integrity(`duplicate projection profile ${profile}`);
    }
    profileSeen.set(profile, artifact.descriptor.path);
    const payload = loadJson(artifact.bytes, artifact.descriptor.path);
    if (!ctkgValidators.projection(payload)) {
      schemaFailure(`projection ${artifact.descriptor.path}`, ctkgValidators.projection.errors);
    }
    if (
      string(payload.source_release, `${artifact.descriptor.path}.source_release`) !== lock.release.release_id
      || hash(payload.source_release_hash, `${artifact.descriptor.path}.source_release_hash`)
        !== lock.release.release_hash
      || hash(payload.source_dataset_hash, `${artifact.descriptor.path}.source_dataset_hash`)
        !== lock.release.source_dataset_hash
    ) {
      integrity(`projection identity drifts from Bundle/Release: ${artifact.descriptor.path}`);
    }
    projections.push({ artifact, payload, profile });
  }

  const runtimeProjections = projections.filter((entry) => RUNTIME_PROJECTION_PROFILES.has(entry.profile) || entry.profile === 'runtime');
  // After alias normalization, runtime is exactly 'runtime'
  const runtime = projections.filter((entry) => entry.profile === 'runtime');
  if (runtime.length !== 1) integrity('Bundle must select exactly one registered runtime projection profile');
  for (const requiredProfile of REQUIRED_AGGREGATE_PROJECTION_PROFILES) {
    if (!projections.some((entry) => entry.profile === requiredProfile)) {
      integrity(`aggregate Bundle is missing required projection profile: ${requiredProfile}`);
    }
  }
  void runtimeProjections;

  const preserved = projections.map((entry) => ({
    identity: projectionIdentity(entry.artifact.descriptor, entry.payload, entry.profile),
    payload: entry.payload,
  }));
  const selectedRuntime = preserved.find((entry) => entry.identity.profile === 'runtime')!;

  // Validate each projection membership/endpoints independently.
  const relationSets: Array<Set<string>> = [];
  for (const entry of projections) {
    const nodes = records(entry.payload.nodes ?? [], `${entry.artifact.descriptor.path}.nodes`);
    const links = records(entry.payload.links ?? [], `${entry.artifact.descriptor.path}.links`);
    const nodeIds = new Set<string>();
    for (const [index, node] of nodes.entries()) {
      const nodeId = string(node.id, `nodes[${index}].id`);
      if (nodeIds.has(nodeId)) integrity(`projection repeats node ${nodeId}`);
      nodeIds.add(nodeId);
      const entityId = string(node.entity_id, `nodes[${index}].entity_id`);
      if (!entryEntityIds.has(entityId)) integrity(`projection node ${nodeId} is outside release membership`);
      if (entryTierByEntity.get(entityId) !== node.release_tier) {
        integrity(`projection node ${nodeId} release tier diverges from its Release entry`);
      }
    }
    const relationIds = new Set<string>();
    for (const [index, link] of links.entries()) {
      const relationId = string(link.relation_id, `links[${index}].relation_id`);
      if (relationIds.has(relationId)) integrity(`projection repeats relation ${relationId}`);
      relationIds.add(relationId);
      if (!relationEntryIds.has(relationId)) {
        integrity(`projection relation ${relationId} is outside release membership`);
      }
      const sourceId = string(link.source_id, `links[${index}].source_id`);
      const targetId = string(link.target_id, `links[${index}].target_id`);
      if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
        integrity(`projection link has a missing endpoint`);
      }
    }
    relationSets.push(relationIds);
  }

  const metadataArtifacts = byRole.get('projection_link_metadata') ?? [];
  if (metadataArtifacts.length === 0) integrity('Bundle is missing projection_link_metadata');
  const allLinkMetadata: ValidatedActKGBundle['allLinkMetadata'] = [];
  const runtimeRelationIds = new Set(
    records(selectedRuntime.payload.links ?? [], 'runtime.links').map((link, index) => (
      string(link.relation_id, `runtime.links[${index}].relation_id`)
    )),
  );

  for (const artifact of metadataArtifacts) {
    const profiles = (artifact.descriptor.profiles ?? (artifact.descriptor.profile ? [artifact.descriptor.profile] : []))
      .map((profile) => normalizeProjectionProfile(profile));
    if (profiles.length === 0) integrity(`metadata ${artifact.descriptor.path} declares no profiles`);
    const rows = loadJsonl(artifact.bytes, artifact.descriptor.path);
    for (const [index, row] of rows.entries()) {
      if (!contractValidators.metadataRow(row)) {
        schemaFailure(`metadata[${index}]`, contractValidators.metadataRow.errors);
      }
    }
    const parsed = metadataRows(rows);
    const relationIds = parsed.map((row) => row.relationId);
    if (new Set(relationIds).size !== relationIds.length) {
      integrity(`duplicate projection metadata relation_id in ${artifact.descriptor.path}`);
    }

    // Determine the relation set that this metadata must close over.
    const coveredProfiles = projections.filter((entry) => profiles.includes(entry.profile));
    if (coveredProfiles.length !== profiles.length) {
      integrity(`metadata ${artifact.descriptor.path} covers unknown projection profiles`);
    }
    const coveredRelationSets = coveredProfiles.map((entry) => {
      const links = records(entry.payload.links ?? [], `${entry.artifact.descriptor.path}.links`);
      return new Set(links.map((link, index) => string(link.relation_id, `links[${index}].relation_id`)));
    });
    const first = coveredRelationSets[0]!;
    if (coveredRelationSets.some((set) => canonicalJson([...set].sort()) !== canonicalJson([...first].sort()))) {
      integrity('shared metadata requires identical relation sets across covered projections');
    }
    if (canonicalJson([...relationIds].sort()) !== canonicalJson([...first].sort())) {
      integrity(`projection metadata is not one-to-one closed over projected relations: ${artifact.descriptor.path}`);
    }
    for (const row of parsed) {
      if (row.sourceRelease !== lock.release.release_id || row.sourceReleaseHash !== lock.release.release_hash) {
        integrity(`metadata row ${row.relationId} source release identity drifts`);
      }
    }
    allLinkMetadata.push({ profiles, path: artifact.descriptor.path, rows: parsed });
  }

  // For every preserved Projection profile, exactly one metadata Artifact must
  // cover it, with relation rows already closed one-to-one above.
  const metadataCoverageByProfile = new Map<string, string[]>();
  for (const entry of allLinkMetadata) {
    for (const profile of entry.profiles) {
      const covering = metadataCoverageByProfile.get(profile) ?? [];
      covering.push(entry.path);
      metadataCoverageByProfile.set(profile, covering);
    }
  }
  for (const projection of preserved) {
    const profile = projection.identity.profile;
    const covering = metadataCoverageByProfile.get(profile) ?? [];
    if (covering.length === 0) {
      integrity(`projection profile ${profile} lacks link metadata coverage`);
    }
    if (covering.length > 1) {
      integrity(
        `projection profile ${profile} has duplicate link metadata coverage: ${covering.join(', ')}`,
      );
    }
  }
  for (const requiredProfile of REQUIRED_AGGREGATE_PROJECTION_PROFILES) {
    const covering = metadataCoverageByProfile.get(requiredProfile) ?? [];
    if (covering.length !== 1) {
      integrity(
        covering.length === 0
          ? `required aggregate projection profile ${requiredProfile} lacks link metadata coverage`
          : `required aggregate projection profile ${requiredProfile} has duplicate link metadata coverage`,
      );
    }
  }

  const runtimeMetadata = allLinkMetadata
    .filter((entry) => entry.profiles.includes('runtime'))
    .flatMap((entry) => entry.rows);
  if (runtimeMetadata.length === 0) integrity('runtime projection lacks link metadata coverage');
  const runtimeMetadataIds = new Set(runtimeMetadata.map((row) => row.relationId));
  if (
    runtimeMetadataIds.size !== runtimeMetadata.length
    || canonicalJson([...runtimeMetadataIds].sort()) !== canonicalJson([...runtimeRelationIds].sort())
  ) {
    integrity('runtime link metadata is not one-to-one closed');
  }

  const crosswalkArtifacts = byRole.get('rag_crosswalk') ?? [];
  if (crosswalkArtifacts.length !== 1) integrity('Bundle must contain exactly one rag_crosswalk Artifact');
  const crosswalkRows = loadJsonl(crosswalkArtifacts[0]!.bytes, crosswalkArtifacts[0]!.descriptor.path);
  const crosswalk: CrosswalkRow[] = [];
  const triples = new Set<string>();
  for (const [index, row] of crosswalkRows.entries()) {
    if (!contractValidators.crosswalkRow(row)) {
      schemaFailure(`crosswalk[${index}]`, contractValidators.crosswalkRow.errors);
    }
    const keys = Object.keys(row).sort();
    if (canonicalJson(keys) !== canonicalJson(['citation_target_id', 'published_entity_id', 'retrieval_chunk_id'])) {
      integrity(`crosswalk[${index}] must carry exactly the three pinned fields`);
    }
    const publishedEntityId = string(row.published_entity_id, `crosswalk[${index}].published_entity_id`);
    const retrievalChunkId = string(row.retrieval_chunk_id, `crosswalk[${index}].retrieval_chunk_id`);
    const citationTargetId = string(row.citation_target_id, `crosswalk[${index}].citation_target_id`);
    const triple = `${publishedEntityId}\u001f${retrievalChunkId}\u001f${citationTargetId}`;
    if (triples.has(triple)) integrity(`crosswalk[${index}] repeats a crosswalk triple`);
    triples.add(triple);
    if (!entryEntityIds.has(publishedEntityId)) {
      integrity(`crosswalk[${index}] published entity is outside release membership`);
    }
    // retrieval/citation identifiers remain opaque and are not resolved inside the Bundle.
    crosswalk.push({ publishedEntityId, retrievalChunkId, citationTargetId });
  }

  const reportArtifacts = byRole.get('validation_report') ?? [];
  if (reportArtifacts.length !== 1) integrity('Bundle must contain one validation_report Artifact');
  const report = loadJson(reportArtifacts[0]!.bytes, reportArtifacts[0]!.descriptor.path);
  if (!contractValidators.validationReport(report)) {
    schemaFailure('validation-report', contractValidators.validationReport.errors);
  }
  if (string(report.bundle_id, 'validation-report.bundle_id') !== lock.bundle.bundle_id) {
    integrity('Validation Report identity mismatch');
  }
  const reportRelease = object(report.release, 'validation-report.release');
  if (canonicalJson(reportRelease) !== canonicalJson(releaseIdentity)) {
    integrity('Validation Report release identity mismatch');
  }
  const reportSourceRevision = object(report.source_revision, 'validation-report.source_revision');
  if (
    string(reportSourceRevision.commit, 'validation-report.source_revision.commit')
      !== lock.source_revision.commit
    || string(reportSourceRevision.tag, 'validation-report.source_revision.tag')
      !== lock.source_revision.tag
    || string(reportSourceRevision.commit, 'validation-report.source_revision.commit')
      !== string(sourceRevision.commit, 'manifest.source_revision.commit')
    || string(reportSourceRevision.tag, 'validation-report.source_revision.tag')
      !== string(sourceRevision.tag, 'manifest.source_revision.tag')
  ) {
    integrity('Validation Report source_revision does not match Manifest/Lock');
  }
  if (string(report.result, 'validation-report.result') !== 'PASS') {
    integrity('Validation Report result is not PASS');
  }
  // Pinned machine schema allows additional gate names; only require that every
  // appearing gate is non-FAIL (PASS or NOT_APPLICABLE).
  const gates = object(report.gates, 'validation-report.gates');
  for (const [gateName, gateStatus] of Object.entries(gates)) {
    if (gateStatus !== 'PASS' && gateStatus !== 'NOT_APPLICABLE') {
      integrity(`Validation Report gate ${gateName} is ${String(gateStatus)}`);
    }
  }
  // Top-level PASS cannot paper over nested FAIL checks in evidence sections.
  for (const sectionName of [
    'projection_validation',
    'privacy_validation',
    'reproducibility_validation',
  ] as const) {
    const checks = records(report[sectionName], `validation-report.${sectionName}`);
    for (const [index, check] of checks.entries()) {
      const checkName = string(check.check, `validation-report.${sectionName}[${index}].check`);
      const checkResult = string(check.result, `validation-report.${sectionName}[${index}].result`);
      if (checkResult === 'FAIL') {
        integrity(
          `Validation Report ${sectionName} check ${checkName} is FAIL while top-level result is PASS`,
        );
      }
    }
  }
  const reportedArtifacts = records(report.artifact_validation, 'validation-report.artifact_validation');
  const reportedByPath = new Map(
    reportedArtifacts.map((row, index) => [
      string(row.path, `validation-report.artifact_validation[${index}].path`),
      row,
    ]),
  );
  const expectedReportPaths = new Set(
    descriptors
      .filter((descriptor) => descriptor.role !== 'validation_report')
      .map((descriptor) => descriptor.path),
  );
  if (canonicalJson([...reportedByPath.keys()].sort()) !== canonicalJson([...expectedReportPaths].sort())) {
    integrity('Validation Report artifact_validation path set does not close over Manifest artifacts');
  }
  for (const descriptor of descriptors) {
    if (descriptor.role === 'validation_report') continue;
    const reported = reportedByPath.get(descriptor.path)!;
    if (
      hash(reported.sha256, `validation-report ${descriptor.path}.sha256`) !== descriptor.sha256
      || integer(reported.byte_length, `validation-report ${descriptor.path}.byte_length`) !== descriptor.byteLength
      || (
        reported.record_count === null || reported.record_count === undefined
          ? null
          : integer(reported.record_count, `validation-report ${descriptor.path}.record_count`)
      ) !== descriptor.recordCount
      || string(reported.result, `validation-report ${descriptor.path}.result`) !== 'PASS'
    ) {
      integrity(`Validation Report artifact evidence mismatch: ${descriptor.path}`);
    }
  }
  const reportedComponents = records(report.component_validation, 'validation-report.component_validation');
  const reportedComponentsById = new Map(
    reportedComponents.map((row, index) => [
      string(row.release_id, `validation-report.component_validation[${index}].release_id`),
      row,
    ]),
  );
  if (
    canonicalJson([...reportedComponentsById.keys()].sort())
      !== canonicalJson([...manifestComponentIds].sort())
  ) {
    integrity('Validation Report component_validation set does not close over Bundle components');
  }
  for (const component of validatedComponents) {
    const reported = reportedComponentsById.get(component.releaseId)!;
    const expectedRawHash = component.referenceKind === 'standard_bundle'
      ? component.manifestSha256
      : component.releaseRawSha256;
    if (!expectedRawHash) {
      integrity(`component ${component.releaseId} is missing raw hash identity for report closure`);
    }
    if (
      string(reported.reference_kind, `validation-report component ${component.releaseId}.reference_kind`)
        !== component.referenceKind
      || hash(reported.release_raw_sha256, `validation-report component ${component.releaseId}.release_raw_sha256`)
        !== expectedRawHash
      || string(reported.result, `validation-report component ${component.releaseId}.result`) !== 'PASS'
    ) {
      integrity(`Validation Report component evidence mismatch: ${component.releaseId}`);
    }
  }

  const statistics: RecomputedStatistics = {
    releaseEntries: entries.length,
    knowledgeNodes: selectedRuntime.identity.nodeCount,
    publishedRelations: selectedRuntime.identity.linkCount,
    projectionNodes: selectedRuntime.identity.nodeCount,
    projectionLinks: selectedRuntime.identity.linkCount,
    ragCrosswalkRows: crosswalk.length,
    componentCount: validatedComponents.length,
    relationTypeCount: new Set(
      projections.flatMap((entry) => (
        records(entry.payload.links ?? [], 'links').map((link, index) => (
          string(link.relation_type, `links[${index}].relation_type`)
        ))
      )),
    ).size,
  };
  const declaredStats = object(manifest.statistics, 'manifest.statistics');
  const expectedDeclared: Record<string, number> = {
    release_entries: statistics.releaseEntries,
    knowledge_nodes: statistics.knowledgeNodes,
    published_relations: statistics.publishedRelations,
    projection_nodes: statistics.projectionNodes,
    projection_links: statistics.projectionLinks,
    rag_crosswalk_rows: statistics.ragCrosswalkRows,
    component_count: statistics.componentCount,
    relation_type_count: statistics.relationTypeCount,
  };
  for (const [key, value] of Object.entries(expectedDeclared)) {
    if (declaredStats[key] !== value) integrity(`published statistics ${key} do not match recalculation`);
  }
  const reportStats = object(report.statistics, 'validation-report.statistics');
  for (const [key, value] of Object.entries(expectedDeclared)) {
    if (reportStats[key] !== value) integrity(`validation-report statistics ${key} do not match recalculation`);
  }

  // Ensure reserved file names were not also declared as artifacts.
  for (const relative of declaredPaths) {
    if (RESERVED_FILES.has(relative)) integrity(`reserved file ${relative} must not be declared as an Artifact`);
  }

  void relationSets;

  const compatibility = classifyCompatibility({
    unknownOptional,
    lock,
    manifest,
  });

  return {
    bundleIdentity: {
      bundleId: lock.bundle.bundle_id,
      bundleRevision: lock.bundle.bundle_revision,
      bundleDigest: lock.bundle.bundle_digest,
      bundleKind: 'aggregate',
      releaseStage: manifest.release_stage as 'candidate' | 'stable',
      bundleContractVersion: PUBLIC_BUNDLE_CONTRACT_VERSION,
      controlledPath,
      manifestRawSha256,
      normalization: MANIFEST_NORMALIZATION,
      publicationTag: string(object(manifest.publication, 'manifest.publication').tag, 'publication.tag'),
      sourceCommit: lock.source_revision.commit,
      sourceTag: lock.source_revision.tag,
    },
    releaseIdentity: {
      releaseId: lock.release.release_id,
      releaseVersion: lock.release.release_version,
      releaseHash: lock.release.release_hash,
      sourceDatasetHash: lock.release.source_dataset_hash,
    },
    releaseSetIdentity: {
      releaseSetId: lock.release_set_id,
      lockVersion: RELEASE_SET_LOCK_V3,
      lockPath,
      lockRawSha256,
    },
    schemaIdentity: {
      version: CTKG_SCHEMA_VERSION,
      rawSha256: CTKG_SCHEMA_RAW_SHA256,
    },
    selectedRuntimeProjection: selectedRuntime,
    preservedProjections: preserved,
    runtimeLinkMetadata: runtimeMetadata,
    allLinkMetadata,
    crosswalk,
    components: validatedComponents,
    rawArtifacts,
    release,
    schema,
    statistics,
    compatibility,
    unknownOptionalArtifacts: unknownOptional,
  };
}
