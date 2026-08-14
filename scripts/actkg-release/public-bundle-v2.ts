import { readFileSync } from 'node:fs';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';

import {
  computeCanonicalReleaseHash,
  computeProjectionVersionDigest,
  actkgCanonicalJson,
  actkgSha256,
} from './actkg-canonical-digests';
import { canonicalJson, sha256 } from './authoritative-release';
import {
  ARTIFACT_CONTRACTS_V2,
  PUBLIC_BUNDLE_V2_CONTRACT_VERSION,
  REQUIRED_V2_AGGREGATE_PROJECTION_PROFILES,
  REVIEWED_V0_18_V2_REGISTRY,
  V2_CONTRACT_SCHEMA_RAW_HASHES,
  V2_LABEL_INDEX_CONTRACT,
  V2_MAPPING_CONTRACT,
  V2_PROFILE_VERSION,
  findArtifactContractV2,
  freezePublicBundleV2Registry,
  isSchemaIdentityV2Supported,
  matchedV2RegistryIdentities,
  registeredAdmissionBinding,
  type PublicBundleV2Registry,
} from './bundle-compatibility-registry-v2';
import {
  PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS,
  resolveTrustedCaptureRevision,
} from './capture-revision';
import { PublicBundleRejection } from './public-bundle-v1';
import type {
  ArtifactDescriptor,
  CompatibilityAssessment,
  CompatibilityCode,
  CrosswalkRow,
  JsonObject,
  ProjectionIdentity,
  ProjectionLinkMetadataRow,
  RevisionIdentity,
  TypedMultilingualLabelV2,
  TypedProjectionProfileV2,
  ValidatedActKGBundleV2,
  ValidatedComponentReferenceV2,
  ValidatedRawArtifact,
} from './public-bundle-types';

const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const MANIFEST_NAME = 'bundle-manifest.json';
const SHA256SUMS_NAME = 'SHA256SUMS';
const RESERVED_FILES = new Set([MANIFEST_NAME, SHA256SUMS_NAME]);
export const RESERVED_BUNDLE_MANIFEST_ROLE_V2 = 'bundle_manifest';
export const RESERVED_SHA256SUMS_ROLE_V2 = 'sha256sums';
export const RESERVED_BUNDLE_MANIFEST_CONTRACT_V2 = 'actkg-public-bundle-manifest/2';
export const RESERVED_SHA256SUMS_CONTRACT_V2 = 'actkg-sha256sums/1';

const FORBIDDEN_PUBLIC_FIELD_TOKENS_V2 = [
  'raw_text',
  'exact_quote',
  'model_response',
  'full_response',
  'private_review_draft',
  'review_draft',
] as const;

const FORBIDDEN_PUBLIC_GLOBAL_TOKENS_V2 = [
  '/Users/',
  '/home/',
  'SILICONFLOW_API_KEY',
  'BEGIN PRIVATE KEY',
] as const;

const DEFAULT_V2_CONTRACT_SCHEMA_DIR = path.join(
  process.cwd(),
  'scripts/actkg-release/schemas/public-bundle-v2',
);

function reject(
  code: CompatibilityCode,
  reasons: string | string[],
  registry: PublicBundleV2Registry = REVIEWED_V0_18_V2_REGISTRY,
): never {
  throw new PublicBundleRejection({
    code,
    reasons: Array.isArray(reasons) ? reasons : [reasons],
    matchedIdentities: matchedV2RegistryIdentities(registry),
  });
}

function integrity(reason: string, registry?: PublicBundleV2Registry): never {
  reject('INTEGRITY_REJECTED', reason, registry);
}

function adapterRequired(reason: string, registry?: PublicBundleV2Registry): never {
  reject('ADAPTER_UPDATE_REQUIRED', reason, registry);
}

function schemaReview(reason: string, registry?: PublicBundleV2Registry): never {
  reject('SCHEMA_REVIEW_REQUIRED', reason, registry);
}

function object(value: unknown, label: string, registry?: PublicBundleV2Registry): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    integrity(`${label} must be an object`, registry);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string, registry?: PublicBundleV2Registry): string {
  if (typeof value !== 'string' || value.length === 0) {
    integrity(`${label} must be a non-empty string`, registry);
  }
  return value;
}

function integer(value: unknown, label: string, registry?: PublicBundleV2Registry): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    integrity(`${label} must be an integer`, registry);
  }
  return value;
}

function hash(value: unknown, label: string, registry?: PublicBundleV2Registry): string {
  const resolved = string(value, label, registry);
  if (!SHA256.test(resolved)) integrity(`${label} must be a SHA-256 hex digest`, registry);
  return resolved;
}

function records(value: unknown, label: string, registry?: PublicBundleV2Registry): JsonObject[] {
  if (!Array.isArray(value)) integrity(`${label} must be an array`, registry);
  return value.map((item, index) => object(item, `${label}[${index}]`, registry));
}

function stringList(value: unknown, label: string, registry?: PublicBundleV2Registry): string[] {
  if (!Array.isArray(value)) integrity(`${label} must be an array`, registry);
  return value.map((item, index) => string(item, `${label}[${index}]`, registry));
}

function assertSafeRelativePath(
  relative: string,
  label: string,
  registry?: PublicBundleV2Registry,
): string {
  if (!relative) integrity(`${label} is empty`, registry);
  if (relative.startsWith('/') || relative.includes('\\') || relative.includes('//')) {
    integrity(`${label} is not a confined POSIX relative path`, registry);
  }
  const parts = relative.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    integrity(`${label} escapes the controlled Bundle`, registry);
  }
  return relative;
}

async function resolveControlledBundleDirectory(
  directory: string,
  label: string,
  intakeRoot: string,
  registry?: PublicBundleV2Registry,
): Promise<string> {
  const leaf = await lstat(directory).catch(() => {
    integrity(`${label} is missing`, registry);
  });
  if (leaf.isSymbolicLink()) integrity(`${label} is a symbolic link`, registry);
  if (!leaf.isDirectory()) integrity(`${label} is not a directory`, registry);
  const rootResolved = await realpath(intakeRoot).catch(() => path.resolve(intakeRoot));
  const resolved = await realpath(directory).catch(() => {
    integrity(`${label} is inaccessible`, registry);
  });
  if (resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`)) {
    integrity(`${label} escapes the intake root`, registry);
  }
  return resolved;
}

function caseFold(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US');
}

function parseSha256Sums(
  text: string,
  registry?: PublicBundleV2Registry,
): Map<string, string> {
  const sums = new Map<string, string>();
  const lines = text.split(/\r?\n/u).filter((line) => line.length > 0);
  for (const [index, line] of lines.entries()) {
    if (line.length < 67 || line.slice(64, 66) !== '  ') {
      integrity(`SHA256SUMS line ${index + 1} is malformed`, registry);
    }
    const digest = line.slice(0, 64);
    const relative = line.slice(66);
    if (!SHA256.test(digest)) integrity(`SHA256SUMS line ${index + 1} has an invalid digest`, registry);
    assertSafeRelativePath(relative, `SHA256SUMS path ${relative}`, registry);
    if (sums.has(relative)) integrity(`SHA256SUMS repeats path ${relative}`, registry);
    sums.set(relative, digest);
  }
  const ordered = [...sums.keys()];
  if (canonicalJson(ordered) !== canonicalJson([...ordered].sort())) {
    integrity('SHA256SUMS paths are not sorted', registry);
  }
  return sums;
}

function isNdjsonMediaType(mediaType: string): boolean {
  return mediaType === 'application/x-ndjson' || mediaType === 'application/ndjson';
}

function recordCountForMediaType(bytes: Buffer, mediaType: string): number | null {
  if (!isNdjsonMediaType(mediaType)) return null;
  const text = bytes.toString('utf8');
  if (!text) return 0;
  return text.split(/\r?\n/u).filter((line) => line.length > 0).length;
}

const HTTP_OR_HTTPS_URL_V2 = /https?:\/\/[^\s"'`<>]+/giu;
const JSON_REFERENCE_KEYS_V2 = new Set(['$ref', '$recursiveRef', '$dynamicRef']);

function scanPublicTextForSecretLeaksV2(relativePath: string, text: string): string[] {
  const findings: string[] = [];
  for (const token of FORBIDDEN_PUBLIC_GLOBAL_TOKENS_V2) {
    if (text.includes(token)) findings.push(`${relativePath}:${token}`);
  }
  return findings;
}

function scrubHttpUrlsV2(text: string): string {
  return text.replace(HTTP_OR_HTTPS_URL_V2, ' ');
}

function detectAbsoluteFilesystemPathLeakV2(text: string): string | null {
  const scrubbed = scrubHttpUrlsV2(text);
  const fileUri = /(?:^|[^A-Za-z0-9_+.-])(file:\/\/(?:\/[^\s"'`<>]+|[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[^\s"'`<>]+)+))/iu
    .exec(scrubbed);
  if (fileUri?.[1]) return fileUri[1];
  const windowsDrive = /(?:^|[^A-Za-z0-9_])([A-Za-z]:[\\/][^\s"'`<>|]+)/u.exec(scrubbed);
  if (windowsDrive?.[1]) return windowsDrive[1];
  const unc = /(?:^|[^\\])(\\\\[A-Za-z0-9][A-Za-z0-9._-]*\\[A-Za-z0-9$][A-Za-z0-9._$-]*(?:\\[^\s"'`<>|\\/]+)*)/u
    .exec(scrubbed);
  if (unc?.[1]) return unc[1];
  const posixSegment = '[^\\s/"\'`<>|\\\\()={}\\[\\]（）［］｛｝〈〉《》]+';
  const posix = new RegExp(
    `(?:^|[^A-Za-z0-9_./])(/(?:${posixSegment})(?:/(?:${posixSegment}))+)`,
    'u',
  ).exec(scrubbed);
  return posix?.[1] ?? null;
}

function scanPublicTextForPrivacyLeaksV2(relativePath: string, text: string): string[] {
  const findings = scanPublicTextForSecretLeaksV2(relativePath, text);
  const pathLeak = detectAbsoluteFilesystemPathLeakV2(text);
  if (pathLeak) findings.push(`${relativePath}:absolute-path:${pathLeak}`);
  return findings;
}

function isPureJsonPointerOrUriReferenceV2(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (/^file:/iu.test(value) || /^[A-Za-z]:[\\/]/u.test(value) || /^\\\\[A-Za-z0-9]/u.test(value)) {
    return false;
  }
  if (value === '#' || value.startsWith('#/') || (value.startsWith('#') && !value.includes('://'))) {
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)) return true;
  }
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  return !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) && !value.startsWith('\\');
}

function scanDecodedJsonStringV2(
  relativePath: string,
  text: string,
  findings: string[],
  fieldKey: string | undefined,
): void {
  findings.push(...scanPublicTextForSecretLeaksV2(relativePath, text));
  if (fieldKey && JSON_REFERENCE_KEYS_V2.has(fieldKey) && isPureJsonPointerOrUriReferenceV2(text)) return;
  const pathLeak = detectAbsoluteFilesystemPathLeakV2(text);
  if (pathLeak) findings.push(`${relativePath}:absolute-path:${pathLeak}`);
}

function scanDecodedJsonValueV2(
  value: unknown,
  relativePath: string,
  findings: string[],
  skipFieldTokens: boolean,
  fieldKey?: string,
): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    scanDecodedJsonStringV2(relativePath, value, findings, fieldKey);
    return;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    for (const item of value) scanDecodedJsonValueV2(item, relativePath, findings, skipFieldTokens);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (!skipFieldTokens && FORBIDDEN_PUBLIC_FIELD_TOKENS_V2.includes(key as typeof FORBIDDEN_PUBLIC_FIELD_TOKENS_V2[number])) {
      findings.push(`${relativePath}:${key}`);
    }
    scanDecodedJsonValueV2(child, relativePath, findings, skipFieldTokens, key);
  }
}

function scanJsonTextForPrivacyLeaksV2(
  relativePath: string,
  text: string,
  options: { ndjson?: boolean; skipFieldTokens?: boolean } = {},
): string[] {
  const findings = scanPublicTextForSecretLeaksV2(relativePath, text);
  const scanValue = (parsed: unknown): void => {
    scanDecodedJsonValueV2(parsed, relativePath, findings, options.skipFieldTokens ?? false);
  };
  if (options.ndjson) {
    for (const [index, line] of text.split(/\r?\n/u).entries()) {
      if (!line.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error(`${relativePath}[${index}] is not valid NDJSON for privacy scanning`);
      }
      scanValue(parsed);
    }
    return findings;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${relativePath} is not valid JSON for privacy scanning`);
  }
  scanValue(parsed);
  return findings;
}

function loadJson(bytes: Buffer, label: string, registry?: PublicBundleV2Registry): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    integrity(`${label} is not valid JSON`, registry);
  }
  return object(parsed, label, registry);
}

function loadJsonl(bytes: Buffer, label: string, registry?: PublicBundleV2Registry): JsonObject[] {
  const rows: JsonObject[] = [];
  for (const [index, line] of bytes.toString('utf8').split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      integrity(`${label}[${index}] is not valid JSON`, registry);
    }
    rows.push(object(parsed, `${label}[${index}]`, registry));
  }
  return rows;
}

function schemaFailure(
  label: string,
  errors: ErrorObject[] | null | undefined,
  registry?: PublicBundleV2Registry,
): never {
  const detail = errors?.map((error) => `${error.instancePath || '/'} ${error.message ?? error.keyword}`).join('; ');
  integrity(`${label} violates the contract schema${detail ? `: ${detail}` : ''}`, registry);
}

async function listRegularFiles(
  directory: string,
  registry?: PublicBundleV2Registry,
): Promise<string[]> {
  const rootResolved = await realpath(directory).catch(() => path.resolve(directory));
  const files: string[] = [];

  async function walk(currentDir: string, relativePrefix: string): Promise<void> {
    const names = await readdir(currentDir);
    for (const name of names) {
      const relative = relativePrefix ? `${relativePrefix}/${name}` : name;
      assertSafeRelativePath(relative, relative, registry);
      const full = path.join(currentDir, name);
      const linkInfo = await lstat(full);
      if (linkInfo.isSymbolicLink()) integrity(`Bundle contains symbolic link ${relative}`, registry);
      if (linkInfo.isFile()) {
        files.push(relative);
        continue;
      }
      if (linkInfo.isDirectory()) {
        const dirResolved = await realpath(full).catch(() => {
          integrity(`Bundle directory ${relative} is inaccessible`, registry);
        });
        if (!dirResolved.startsWith(`${rootResolved}${path.sep}`) && dirResolved !== rootResolved) {
          integrity(`Bundle directory ${relative} escapes the controlled Bundle`, registry);
        }
        await walk(full, relative);
        continue;
      }
      integrity(`Bundle contains non-regular entry ${relative}`, registry);
    }
  }

  await walk(directory, '');
  return files.sort();
}

async function readExactFile(
  directory: string,
  relative: string,
  registry?: PublicBundleV2Registry,
): Promise<Buffer> {
  assertSafeRelativePath(relative, relative, registry);
  const full = path.resolve(directory, ...relative.split('/'));
  const rootResolved = await realpath(directory).catch(() => path.resolve(directory));
  const linkInfo = await lstat(full).catch(() => {
    integrity(`Artifact path ${relative} is missing`, registry);
  });
  if (linkInfo.isSymbolicLink()) integrity(`Artifact path ${relative} is a symbolic link`, registry);
  if (!linkInfo.isFile()) integrity(`Artifact path ${relative} is not a regular file`, registry);
  const fileResolved = await realpath(full).catch(() => {
    integrity(`Artifact path ${relative} is missing`, registry);
  });
  if (!fileResolved.startsWith(`${rootResolved}${path.sep}`) && fileResolved !== rootResolved) {
    integrity(`Artifact path ${relative} escapes the controlled Bundle`, registry);
  }
  return readFile(full);
}

function compileContractValidators(
  schemaDir: string,
  registry?: PublicBundleV2Registry,
): {
  manifest: ValidateFunction;
  componentManifest: ValidateFunction;
  metadataRow: ValidateFunction;
  crosswalkRow: ValidateFunction;
  labelRow: ValidateFunction;
  profiles: ValidateFunction;
  validationReport: ValidateFunction;
  releaseDiff: ValidateFunction;
} {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const load = (name: keyof typeof V2_CONTRACT_SCHEMA_RAW_HASHES): JsonObject => {
    const bytes = readFileSync(path.join(schemaDir, name));
    if (sha256(bytes) !== V2_CONTRACT_SCHEMA_RAW_HASHES[name]) {
      integrity(`contract schema ${name} raw hash drift`, registry);
    }
    return object(JSON.parse(bytes.toString('utf8')), name, registry);
  };
  const manifestSchema = load('bundle-manifest.schema.json');
  const artifactDef = object(
    object(manifestSchema.$defs, 'bundle-manifest.$defs', registry).artifact,
    'bundle-manifest.$defs.artifact',
    registry,
  );
  const artifactProperties = object(artifactDef.properties, 'artifact.properties', registry);
  artifactProperties.role = { type: 'string', minLength: 1 };
  return {
    manifest: ajv.compile(manifestSchema),
    componentManifest: ajv.compile(load('component-manifest.schema.json')),
    metadataRow: ajv.compile(load('projection-link-metadata-row.schema.json')),
    crosswalkRow: ajv.compile(load('rag-crosswalk-row.schema.json')),
    labelRow: ajv.compile(load('multilingual-label-index-row.schema.json')),
    profiles: ajv.compile(load('projection-profiles.schema.json')),
    validationReport: ajv.compile(load('validation-report.schema.json')),
    releaseDiff: ajv.compile(load('release-diff.schema.json')),
  };
}

function compileCtkgValidators(
  schema: JsonObject,
  registry?: PublicBundleV2Registry,
): {
  release: ValidateFunction;
  projection: ValidateFunction;
} {
  const defs = object(schema.$defs, 'ctkg.schema.json.$defs', registry);
  for (const name of ['Release', 'ReleaseEntry', 'GraphProjection', 'ProjectedNode', 'ProjectedLink']) {
    if (!defs[name]) integrity(`pinned CTKG Schema does not define ${name}`, registry);
  }
  const ajv = new Ajv({ allErrors: true, strict: true, validateFormats: false });
  return {
    release: ajv.compile({ $defs: defs, $ref: '#/$defs/Release' }),
    projection: ajv.compile({ $defs: defs, $ref: '#/$defs/GraphProjection' }),
  };
}

function computeBundleDigest(manifest: JsonObject): string {
  const body = structuredClone(manifest);
  delete body.bundle_digest;
  return sha256(canonicalJson(body));
}

function scanPrivacy(
  relativePath: string,
  bytes: Buffer,
  options: { mediaType?: string; skipFieldTokens?: boolean } = {},
): string[] {
  const text = bytes.toString('utf8');
  const skipFieldTokens = options.skipFieldTokens
    ?? (
      relativePath === 'ctkg.schema.json'
      || relativePath.endsWith('/ctkg.schema.json')
    );
  const mediaType = options.mediaType;
  try {
    if (mediaType === 'application/json' || mediaType === 'application/schema+json' || mediaType?.endsWith('+json')) {
      return scanJsonTextForPrivacyLeaksV2(relativePath, text, { skipFieldTokens });
    }
    if (mediaType && isNdjsonMediaType(mediaType)) {
      return scanJsonTextForPrivacyLeaksV2(relativePath, text, { ndjson: true, skipFieldTokens });
    }
    return scanPublicTextForPrivacyLeaksV2(relativePath, text);
  } catch (error) {
    integrity(
      `${relativePath} privacy scan failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function metadataRows(
  rows: JsonObject[],
  registry?: PublicBundleV2Registry,
): ProjectionLinkMetadataRow[] {
  return rows.map((row, index) => {
    const evidence = row.evidence_refs;
    if (!Array.isArray(evidence)) {
      integrity(`metadata[${index}].evidence_refs must be an array`, registry);
    }
    return {
      relationId: string(row.relation_id, `metadata[${index}].relation_id`, registry),
      releaseTier: string(row.release_tier, `metadata[${index}].release_tier`, registry),
      sourceRelease: string(row.source_release, `metadata[${index}].source_release`, registry),
      sourceReleaseHash: hash(row.source_release_hash, `metadata[${index}].source_release_hash`, registry),
      evidenceRefs: evidence.map((item, evidenceIndex) => (
        string(item, `metadata[${index}].evidence_refs[${evidenceIndex}]`, registry)
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
  registry?: PublicBundleV2Registry,
): ProjectionIdentity {
  return {
    projectionId: string(payload.id, `${artifact.path}.id`, registry),
    profile,
    projectionProfile: string(payload.projection_profile, `${artifact.path}.projection_profile`, registry),
    versionDigest: hash(payload.version_digest, `${artifact.path}.version_digest`, registry),
    sourceRelease: string(payload.source_release, `${artifact.path}.source_release`, registry),
    sourceReleaseHash: hash(payload.source_release_hash, `${artifact.path}.source_release_hash`, registry),
    sourceDatasetHash: hash(payload.source_dataset_hash, `${artifact.path}.source_dataset_hash`, registry),
    nodeCount: records(payload.nodes ?? [], `${artifact.path}.nodes`, registry).length,
    linkCount: records(payload.links ?? [], `${artifact.path}.links`, registry).length,
    artifactPath: artifact.path,
    artifactSha256: artifact.sha256,
  };
}

function profileKeyForKind(kind: string): 'act' | 'domain' | 'review' {
  if (kind === 'act_runtime_graph') return 'act';
  if (kind === 'domain_graph') return 'domain';
  if (kind === 'review_graph') return 'review';
  throw new Error(`unsupported projection profile kind ${kind}`);
}

function manifestRevision(
  manifest: JsonObject,
  key: 'source_revision',
  registry?: PublicBundleV2Registry,
): RevisionIdentity {
  const revision = object(manifest[key], `manifest.${key}`, registry);
  const commit = string(revision.commit, `manifest.${key}.commit`, registry);
  if (!COMMIT.test(commit)) {
    integrity(`manifest.${key}.commit must be a 40-character Git commit`, registry);
  }
  const tag = string(revision.tag, `manifest.${key}.tag`, registry);
  return { commit, tag };
}

export function assertPinnedV2ManifestIdentities(
  manifest: JsonObject,
  registry: PublicBundleV2Registry = REVIEWED_V0_18_V2_REGISTRY,
): void {
  if (Object.prototype.hasOwnProperty.call(manifest, 'publication_revision')) {
    integrity('Manifest publication_revision is not part of the upstream v0.18 contract', registry);
  }
  if (string(manifest.bundle_contract_version, 'manifest.bundle_contract_version', registry)
    !== registry.bundleContractVersion) {
    adapterRequired(
      `unsupported bundle_contract_version ${String(manifest.bundle_contract_version)}`,
      registry,
    );
  }
  if (string(manifest.bundle_id, 'manifest.bundle_id', registry) !== registry.bundleId) {
    adapterRequired(`bundle_id ${String(manifest.bundle_id)} is not the registered v0.18 publication`, registry);
  }
  if (integer(manifest.bundle_revision, 'manifest.bundle_revision', registry) !== registry.bundleRevision) {
    adapterRequired('bundle_revision is not the registered v0.18 publication', registry);
  }
  if (hash(manifest.bundle_digest, 'manifest.bundle_digest', registry) !== registry.bundleDigest) {
    adapterRequired('bundle_digest is not the registered v0.18 publication', registry);
  }
  const schemaIdentity = object(manifest.schema, 'manifest.schema', registry);
  const schemaVersion = string(schemaIdentity.version, 'manifest.schema.version', registry);
  const schemaSha = hash(schemaIdentity.sha256, 'manifest.schema.sha256', registry);
  if (!isSchemaIdentityV2Supported(schemaVersion, schemaSha)
    || schemaSha !== registry.schemaRawSha256
    || schemaVersion !== registry.schemaVersion) {
    schemaReview(`Schema identity ${schemaVersion}/${schemaSha} is not registered`, registry);
  }
  const releaseIdentity = object(manifest.release, 'manifest.release', registry);
  if (
    string(releaseIdentity.release_id, 'manifest.release.release_id', registry) !== registry.releaseId
    || string(releaseIdentity.release_version, 'manifest.release.release_version', registry)
      !== registry.releaseVersion
    || hash(releaseIdentity.release_hash, 'manifest.release.release_hash', registry) !== registry.releaseHash
    || hash(releaseIdentity.source_dataset_hash, 'manifest.release.source_dataset_hash', registry)
      !== registry.sourceDatasetHash
  ) {
    adapterRequired('Manifest release identity is not the registered v0.18 publication', registry);
  }
  const sourceRevision = manifestRevision(manifest, 'source_revision', registry);
  if (
    sourceRevision.commit !== registry.sourceCommit
    || sourceRevision.tag !== registry.sourceTag
  ) {
    adapterRequired('Manifest source_revision is not the registered v0.18 publication', registry);
  }
}

function rejectCallerControlledBindingFields(
  options: unknown,
  registry: PublicBundleV2Registry,
  allowRegistry = false,
): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    integrity('v2 loader options must be an object', registry);
  }
  const candidate = options as Record<string, unknown>;
  const forbiddenFields = allowRegistry
    ? ['admissionEvidence', 'proof']
    : ['admissionEvidence', 'proof', 'registry'];
  for (const field of forbiddenFields) {
    if (field in candidate) {
      integrity(`v2 loader rejects caller-controlled ${field}`, registry);
    }
  }
}

function buildReservedArtifacts(input: {
  manifestBytes: Buffer;
  sumsBytes: Buffer;
  manifestRawSha256: string;
}): ValidatedRawArtifact[] {
  return [
    {
      descriptor: {
        role: RESERVED_BUNDLE_MANIFEST_ROLE_V2,
        contractVersion: RESERVED_BUNDLE_MANIFEST_CONTRACT_V2,
        required: true,
        path: MANIFEST_NAME,
        mediaType: 'application/json',
        sha256: input.manifestRawSha256,
        byteLength: input.manifestBytes.byteLength,
        recordCount: null,
        known: true,
        semanticsEnabled: false,
      },
      bytes: input.manifestBytes,
    },
    {
      descriptor: {
        role: RESERVED_SHA256SUMS_ROLE_V2,
        contractVersion: RESERVED_SHA256SUMS_CONTRACT_V2,
        required: true,
        path: SHA256SUMS_NAME,
        mediaType: 'text/plain; charset=utf-8',
        sha256: sha256(input.sumsBytes),
        byteLength: input.sumsBytes.byteLength,
        recordCount: null,
        known: true,
        semanticsEnabled: false,
      },
      bytes: input.sumsBytes,
    },
  ];
}

/**
 * Production v2 loader. Always uses the pinned v0.18 registry.
 * Failed v2 validation is terminal; callers must not fall back to v1.
 */
export async function loadAndValidatePublicBundleV2(options: {
  root?: string;
  bundlePath: string;
  captureRevision?: string;
  gitRoot?: string;
  contractSchemaDir?: string;
}): Promise<ValidatedActKGBundleV2> {
  rejectCallerControlledBindingFields(options, REVIEWED_V0_18_V2_REGISTRY);
  return loadAndValidateRegisteredPublicBundleV2({
    ...options,
    registry: REVIEWED_V0_18_V2_REGISTRY,
  });
}

/**
 * Registry-parameterized implementation used by bounded adapter fixtures.
 * It is intentionally not re-exported by the public router. Production
 * loading must use the pinned wrapper; upstream tag admission is deliberately
 * separate and is never invoked from this loader.
 */
export async function loadAndValidateRegisteredPublicBundleV2(options: {
  root?: string;
  bundlePath: string;
  captureRevision?: string;
  gitRoot?: string;
  contractSchemaDir?: string;
  registry: PublicBundleV2Registry;
}): Promise<ValidatedActKGBundleV2> {
  const registry = freezePublicBundleV2Registry(options.registry);
  rejectCallerControlledBindingFields(options, registry, true);
  const root = path.resolve(options.root ?? process.cwd());
  const gitRoot = path.resolve(options.gitRoot ?? root);
  const controlledPath = options.bundlePath;

  const captureTrackedPaths: string[] = [...PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS];
  if (gitRoot === root) {
    captureTrackedPaths.push(controlledPath);
  }
  const captureRevision = resolveTrustedCaptureRevision({
    gitRoot,
    trackedPaths: captureTrackedPaths,
    expectedCaptureRevision: options.captureRevision,
    fail: (reason) => integrity(reason, registry),
  });

  const bundleDir = await resolveControlledBundleDirectory(
    path.resolve(root, controlledPath),
    `controlled Bundle path ${controlledPath}`,
    root,
    registry,
  );

  const contractValidators = compileContractValidators(
    options.contractSchemaDir ?? DEFAULT_V2_CONTRACT_SCHEMA_DIR,
    registry,
  );

  const onDisk = await listRegularFiles(bundleDir, registry);
  if (!onDisk.includes(MANIFEST_NAME)) integrity('standard Bundle is missing bundle-manifest.json', registry);
  if (!onDisk.includes(SHA256SUMS_NAME)) integrity('standard Bundle is missing SHA256SUMS', registry);

  const manifestBytes = await readExactFile(bundleDir, MANIFEST_NAME, registry);
  const manifestRawSha256 = sha256(manifestBytes);
  if (manifestRawSha256 !== registry.manifestRawSha256) {
    adapterRequired('Manifest raw SHA-256 is not the registered v0.18 publication', registry);
  }
  const manifest = loadJson(manifestBytes, MANIFEST_NAME, registry);
  if (!contractValidators.manifest(manifest)) {
    schemaFailure('bundle-manifest.json', contractValidators.manifest.errors, registry);
  }

  if (manifest.bundle_contract_version !== PUBLIC_BUNDLE_V2_CONTRACT_VERSION) {
    adapterRequired(
      `unsupported bundle_contract_version ${String(manifest.bundle_contract_version)}`,
      registry,
    );
  }
  if (manifest.bundle_kind !== 'aggregate') {
    integrity('production candidate intake requires bundle_kind=aggregate', registry);
  }
  if (manifest.release_stage !== 'stable' && manifest.release_stage !== 'candidate') {
    integrity('release_stage is invalid', registry);
  }

  const manifestSourceRevision = manifestRevision(manifest, 'source_revision', registry);

  const claimedDigest = hash(manifest.bundle_digest, 'manifest.bundle_digest', registry);
  if (claimedDigest !== computeBundleDigest(manifest)) {
    integrity('bundle_digest does not match canonical Manifest body', registry);
  }

  assertPinnedV2ManifestIdentities(manifest, registry);
  const artifactRows = records(manifest.artifacts, 'manifest.artifacts', registry);
  const declaredPaths: string[] = [];
  const caseFolded = new Map<string, string>();
  const descriptors: ArtifactDescriptor[] = [];
  const unknownOptional: ArtifactDescriptor[] = [];

  for (const [index, row] of artifactRows.entries()) {
    const relativePath = assertSafeRelativePath(
      string(row.path, `artifacts[${index}].path`, registry),
      `artifacts[${index}].path`,
      registry,
    );
    const folded = caseFold(relativePath);
    if (caseFolded.has(folded)) {
      integrity(
        `Artifact paths collide after case folding: ${caseFolded.get(folded)} and ${relativePath}`,
        registry,
      );
    }
    caseFolded.set(folded, relativePath);
    if (declaredPaths.includes(relativePath)) integrity(`duplicate Artifact path ${relativePath}`, registry);
    declaredPaths.push(relativePath);

    const role = string(row.role, `artifacts[${index}].role`, registry);
    const contractVersion = string(row.contract_version, `artifacts[${index}].contract_version`, registry);
    const required = row.required === true;
    const registration = findArtifactContractV2(role, contractVersion, registry);
    if (!registration && required) {
      adapterRequired(`unknown required Artifact role/contract ${role}@${contractVersion}`, registry);
    }
    const profile = typeof row.profile === 'string' ? row.profile : undefined;
    const profiles = Array.isArray(row.profiles)
      ? row.profiles.map((item, profileIndex) => (
        string(item, `artifacts[${index}].profiles[${profileIndex}]`, registry)
      ))
      : undefined;
    if (role === 'projection' && !profile) {
      integrity(`projection artifact ${relativePath} is missing profile`, registry);
    }
    const descriptor: ArtifactDescriptor = {
      role,
      profile,
      profiles,
      contractVersion,
      required,
      path: relativePath,
      mediaType: string(row.media_type, `artifacts[${index}].media_type`, registry),
      sha256: hash(row.sha256, `artifacts[${index}].sha256`, registry),
      byteLength: integer(row.byte_length, `artifacts[${index}].byte_length`, registry),
      recordCount: row.record_count === null || row.record_count === undefined
        ? null
        : integer(row.record_count, `artifacts[${index}].record_count`, registry),
      known: Boolean(registration),
      semanticsEnabled: Boolean(registration?.enableSemantics),
    };
    if (!registration) unknownOptional.push(descriptor);
    descriptors.push(descriptor);
  }

  const manifestComponentsEarly = records(manifest.components, 'manifest.components', registry);
  const componentPaths: string[] = [];
  for (const [index, component] of manifestComponentsEarly.entries()) {
    const componentPath = assertSafeRelativePath(
      string(component.component_path, `manifest.components[${index}].component_path`, registry),
      `manifest.components[${index}].component_path`,
      registry,
    );
    const folded = caseFold(componentPath);
    if (caseFolded.has(folded) || declaredPaths.includes(componentPath) || componentPaths.includes(componentPath)) {
      integrity(`component path collides with an Artifact or another component: ${componentPath}`, registry);
    }
    caseFolded.set(folded, componentPath);
    componentPaths.push(componentPath);
  }

  for (const requiredContract of registry.artifactContracts.filter((entry) => entry.requiredForAggregate)) {
    const present = descriptors.some(
      (descriptor) => (
        descriptor.role === requiredContract.role
        && descriptor.contractVersion === requiredContract.contractVersion
        && descriptor.required
      ),
    );
    if (!present) {
      adapterRequired(
        `required Artifact role/contract ${requiredContract.role}@${requiredContract.contractVersion} is missing`,
        registry,
      );
    }
  }

  const expectedFiles = new Set([...declaredPaths, ...componentPaths, MANIFEST_NAME, SHA256SUMS_NAME]);
  const actualFiles = new Set(onDisk);
  if (canonicalJson([...expectedFiles].sort()) !== canonicalJson([...actualFiles].sort())) {
    integrity('Bundle file set does not equal Manifest artifacts plus reserved files', registry);
  }

  const sumsBytes = await readExactFile(bundleDir, SHA256SUMS_NAME, registry);
  const sumsRawSha256 = sha256(sumsBytes);
  if (sumsRawSha256 !== registry.sha256sumsRawSha256) {
    adapterRequired('SHA256SUMS raw SHA-256 is not the registered v0.18 publication', registry);
  }
  const sums = parseSha256Sums(sumsBytes.toString('utf8'), registry);
  const sumPaths = [...sums.keys()];
  if (canonicalJson(sumPaths) !== canonicalJson([...actualFiles].filter((name) => name !== SHA256SUMS_NAME).sort())) {
    integrity('SHA256SUMS file set does not close over the Bundle', registry);
  }

  const privacyFindings: string[] = [];
  privacyFindings.push(...scanPrivacy(MANIFEST_NAME, manifestBytes, { mediaType: 'application/json' }));
  privacyFindings.push(...scanPrivacy(SHA256SUMS_NAME, sumsBytes));

  const declaredArtifacts: ValidatedRawArtifact[] = [];
  for (const descriptor of descriptors) {
    const bytes = await readExactFile(bundleDir, descriptor.path, registry);
    if (sha256(bytes) !== descriptor.sha256) integrity(`Artifact SHA mismatch: ${descriptor.path}`, registry);
    if (bytes.byteLength !== descriptor.byteLength) {
      integrity(`Artifact byte length mismatch: ${descriptor.path}`, registry);
    }
    const actualRecords = recordCountForMediaType(bytes, descriptor.mediaType);
    if (actualRecords !== descriptor.recordCount) {
      integrity(`Artifact record count mismatch: ${descriptor.path}`, registry);
    }
    const sumDigest = sums.get(descriptor.path);
    if (!sumDigest || sumDigest !== descriptor.sha256) {
      integrity(`SHA256SUMS mismatch: ${descriptor.path}`, registry);
    }
    privacyFindings.push(...scanPrivacy(descriptor.path, bytes, {
      mediaType: descriptor.mediaType,
      skipFieldTokens: descriptor.role === 'ctkg_schema',
    }));
    declaredArtifacts.push({ descriptor, bytes });
  }
  if (sha256(manifestBytes) !== sums.get(MANIFEST_NAME)) {
    integrity('SHA256SUMS mismatch: bundle-manifest.json', registry);
  }
  if (privacyFindings.length > 0) {
    integrity(`public privacy boundary violated: ${privacyFindings.join(', ')}`, registry);
  }

  for (const relative of declaredPaths) {
    if (RESERVED_FILES.has(relative)) {
      integrity(`reserved file ${relative} must not be declared as an Artifact`, registry);
    }
  }

  const rawArtifacts: ValidatedRawArtifact[] = [
    ...buildReservedArtifacts({ manifestBytes, sumsBytes, manifestRawSha256 }),
    ...declaredArtifacts,
  ];

  const byRole = new Map<string, ValidatedRawArtifact[]>();
  for (const artifact of declaredArtifacts) {
    const list = byRole.get(artifact.descriptor.role) ?? [];
    list.push(artifact);
    byRole.set(artifact.descriptor.role, list);
  }

  const releaseArtifacts = byRole.get('release') ?? [];
  if (releaseArtifacts.length !== 1) integrity('Bundle must contain exactly one release Artifact', registry);
  const schemaArtifacts = byRole.get('ctkg_schema') ?? [];
  if (schemaArtifacts.length !== 1) integrity('Bundle must contain exactly one ctkg_schema Artifact', registry);
  if (
    schemaArtifacts[0]!.descriptor.sha256 !== registry.schemaRawSha256
    || schemaArtifacts[0]!.descriptor.sha256 !== hash(
      object(manifest.schema, 'manifest.schema', registry).sha256,
      'manifest.schema.sha256',
      registry,
    )
  ) {
    integrity('CTKG Schema identity mismatch', registry);
  }
  const schema = loadJson(schemaArtifacts[0]!.bytes, schemaArtifacts[0]!.descriptor.path, registry);
  if (string(schema.version, 'schema.version', registry) !== registry.schemaVersion) {
    schemaReview(`Schema version ${String(schema.version)} is not registered`, registry);
  }
  const ctkgValidators = compileCtkgValidators(schema, registry);

  const release = loadJson(releaseArtifacts[0]!.bytes, releaseArtifacts[0]!.descriptor.path, registry);
  if (!ctkgValidators.release(release)) schemaFailure('Release', ctkgValidators.release.errors, registry);
  if (string(release.schema_version, 'release.schema_version', registry) !== registry.schemaVersion) {
    schemaReview(
      `Release schema_version ${String(release.schema_version)} is not the registered Schema identity`,
      registry,
    );
  }
  const recomputedReleaseHash = computeCanonicalReleaseHash(release);
  if (hash(release.release_hash, 'release.release_hash', registry) !== recomputedReleaseHash) {
    integrity('release Artifact release_hash does not match payload self-hash', registry);
  }
  if (
    string(release.id, 'release.id', registry) !== registry.releaseId
    || string(release.release_version, 'release.release_version', registry) !== registry.releaseVersion
    || hash(release.release_hash, 'release.release_hash', registry) !== registry.releaseHash
    || hash(release.source_dataset_hash, 'release.source_dataset_hash', registry) !== registry.sourceDatasetHash
  ) {
    integrity('Manifest and Release identities differ from the registered publication', registry);
  }

  const entries = records(release.entries, 'release.entries', registry);
  const includedEntities = stringList(release.included_entities, 'release.included_entities', registry);
  if (new Set(includedEntities).size !== includedEntities.length) {
    integrity('release.included_entities repeats an entity', registry);
  }
  const entryEntityIds = new Set<string>();
  const releaseKnowledgeEntityIds = new Set<string>();
  const entryTierByEntity = new Map<string, string>();
  const relationEntryIds = new Set<string>();
  let releaseNodes = 0;
  for (const [index, releaseEntry] of entries.entries()) {
    const entity = string(releaseEntry.entity, `entries[${index}].entity`, registry);
    if (entryEntityIds.has(entity)) integrity(`release entries repeat entity ${entity}`, registry);
    entryEntityIds.add(entity);
    entryTierByEntity.set(entity, string(releaseEntry.release_tier, `entries[${index}].release_tier`, registry));
    const role = string(releaseEntry.entity_role, `entries[${index}].entity_role`, registry);
    if (role === 'relation') relationEntryIds.add(entity);
    if (role === 'knowledge_object') {
      releaseNodes += 1;
      releaseKnowledgeEntityIds.add(entity);
    }
  }
  if (entryEntityIds.size !== includedEntities.length || !includedEntities.every((entity) => entryEntityIds.has(entity))) {
    integrity('release entries and included_entities diverge', registry);
  }

  const componentArtifacts = byRole.get('component_manifest') ?? [];
  if (componentArtifacts.length !== 1) integrity('Bundle must contain one component_manifest Artifact', registry);
  const componentManifest = loadJson(
    componentArtifacts[0]!.bytes,
    componentArtifacts[0]!.descriptor.path,
    registry,
  );
  if (!contractValidators.componentManifest(componentManifest)) {
    schemaFailure('component-manifest', contractValidators.componentManifest.errors, registry);
  }
  const manifestComponents = records(manifest.components, 'manifest.components', registry);
  const fileComponents = records(componentManifest.components, 'component-manifest.components', registry);
  const releaseComponentIds = new Set(stringList(release.component_releases, 'release.component_releases', registry));
  const manifestComponentIds = new Set(
    manifestComponents.map((component, index) => (
      string(component.release_id, `manifest.components[${index}].release_id`, registry)
    )),
  );
  const fileComponentIds = new Set(
    fileComponents.map((component, index) => (
      string(component.release_id, `component-manifest.components[${index}].release_id`, registry)
    )),
  );
  if (
    canonicalJson([...releaseComponentIds].sort()) !== canonicalJson([...manifestComponentIds].sort())
    || canonicalJson([...manifestComponentIds].sort()) !== canonicalJson([...fileComponentIds].sort())
  ) {
    integrity('component identity sets differ across Release, Manifest, and component-releases.json', registry);
  }

  const registeredComponentIds = new Set(registry.components.map((component) => component.releaseId));
  if (canonicalJson([...registeredComponentIds].sort()) !== canonicalJson([...manifestComponentIds].sort())) {
    adapterRequired('component closure is not the registered v0.18 publication', registry);
  }

  const fileById = new Map(
    fileComponents.map((component) => [
      string(component.release_id, 'component.release_id', registry),
      component,
    ]),
  );
  const registeredById = new Map(registry.components.map((component) => [component.releaseId, component]));
  const validatedComponents: ValidatedComponentReferenceV2[] = [];
  const componentRawArtifacts: ValidatedRawArtifact[] = [];
  for (const component of manifestComponents) {
    const releaseId = string(component.release_id, 'component.release_id', registry);
    const releaseVersion = string(component.release_version, 'component.release_version', registry);
    const releaseHash = hash(component.release_hash, 'component.release_hash', registry);
    const componentRole = string(component.component_role, 'component.component_role', registry);
    const componentPath = assertSafeRelativePath(
      string(component.component_path, 'component.component_path', registry),
      'component.component_path',
      registry,
    );
    const componentSha256 = hash(component.component_sha256, 'component.component_sha256', registry);
    const sourceReleaseHash = hash(component.source_release_hash, 'component.source_release_hash', registry);
    const sourceRevision = object(component.source_revision, 'component.source_revision', registry);
    const sourceCommit = string(sourceRevision.commit, 'component.source_revision.commit', registry);
    const fileComponent = fileById.get(releaseId);
    if (!fileComponent) integrity(`component-manifest is missing ${releaseId}`, registry);
    for (const key of [
      'release_version',
      'release_hash',
      'component_role',
      'component_path',
      'component_sha256',
      'source_release_hash',
      'source_revision',
    ] as const) {
      const componentValue = key === 'source_revision'
        ? canonicalJson(component[key])
        : component[key];
      const fileValue = key === 'source_revision'
        ? canonicalJson(fileComponent[key])
        : fileComponent[key];
      if (componentValue !== fileValue) {
        integrity(`component identity mismatch: ${releaseId}.${key}`, registry);
      }
    }
    const registered = registeredById.get(releaseId);
    if (
      !registered
      || registered.releaseVersion !== releaseVersion
      || registered.releaseHash !== releaseHash
      || registered.componentRole !== componentRole
    ) {
      adapterRequired(`component ${releaseId} is not the registered v0.18 publication`, registry);
    }
    const componentBytes = await readExactFile(bundleDir, componentPath, registry);
    if (sha256(componentBytes) !== componentSha256) {
      integrity(`component package SHA mismatch: ${releaseId}`, registry);
    }
    if (sums.get(componentPath) !== componentSha256) {
      integrity(`SHA256SUMS mismatch: ${componentPath}`, registry);
    }
    privacyFindings.push(...scanPrivacy(componentPath, componentBytes, {
      mediaType: 'application/json',
    }));
    componentRawArtifacts.push({
      descriptor: {
        role: 'component_release',
        contractVersion: 'ctkg-release/0.3',
        required: true,
        path: componentPath,
        mediaType: 'application/json',
        sha256: componentSha256,
        byteLength: componentBytes.byteLength,
        recordCount: null,
        known: true,
        semanticsEnabled: true,
      },
      bytes: componentBytes,
    });
    validatedComponents.push({
      releaseId,
      releaseVersion,
      releaseHash,
      componentRole,
      componentPath,
      componentSha256,
      sourceReleaseHash,
      sourceCommit,
      sourceTag: typeof sourceRevision.tag === 'string' ? sourceRevision.tag : undefined,
    });
  }
  if (privacyFindings.length > 0) {
    integrity(`public privacy boundary violated: ${privacyFindings.join(', ')}`, registry);
  }
  rawArtifacts.push(...componentRawArtifacts);
  const rawArtifactPaths = rawArtifacts.map((artifact) => artifact.descriptor.path);
  if (
    new Set(rawArtifactPaths).size !== rawArtifactPaths.length
    || canonicalJson([...rawArtifactPaths].sort()) !== canonicalJson([...actualFiles].sort())
  ) {
    integrity('Validated rawArtifacts do not close over the Bundle file set', registry);
  }

  const profileArtifacts = byRole.get('projection_profiles') ?? [];
  if (profileArtifacts.length !== 1) {
    integrity('Bundle must contain exactly one projection_profiles Artifact', registry);
  }
  const profileManifest = loadJson(
    profileArtifacts[0]!.bytes,
    profileArtifacts[0]!.descriptor.path,
    registry,
  );
  if (!contractValidators.profiles(profileManifest)) {
    schemaFailure('projection-profiles', contractValidators.profiles.errors, registry);
  }
  const profileRows = records(profileManifest.profiles, 'projection-profiles.profiles', registry);
  const declaredProfileHashes = object(profileManifest.profile_sha256, 'projection-profiles.profile_sha256', registry);
  const typedProfiles: TypedProjectionProfileV2[] = [];
  const profileById = new Map<string, TypedProjectionProfileV2>();
  for (const [index, row] of profileRows.entries()) {
    const profileId = string(row.id, `projection-profiles.profiles[${index}].id`, registry);
    if (profileById.has(profileId)) {
      integrity(`projection profile ${profileId} is repeated`, registry);
    }
    const projectionKind = string(
      row.projection_kind,
      `projection-profiles.profiles[${index}].projection_kind`,
      registry,
    );
    const mappingContract = string(
      row.mapping_contract_version,
      `projection-profiles.profiles[${index}].mapping_contract_version`,
      registry,
    );
    const profileVersion = string(
      row.profile_version,
      `projection-profiles.profiles[${index}].profile_version`,
      registry,
    );
    if (mappingContract !== V2_MAPPING_CONTRACT || profileVersion !== V2_PROFILE_VERSION) {
      adapterRequired(`projection profile ${profileId} is not the registered v3 contract`, registry);
    }
    const recomputedSha = actkgSha256(actkgCanonicalJson(row));
    const key = profileKeyForKind(projectionKind);
    const declaredSha = hash(declaredProfileHashes[key], `projection-profiles.profile_sha256.${key}`, registry);
    if (recomputedSha !== declaredSha) {
      integrity(`projection profile hash drift: ${profileId}`, registry);
    }
    const registeredProfile = registry.projectionProfiles.find((entry) => entry.profileId === profileId);
    if (
      !registeredProfile
      || registeredProfile.profileSha256 !== recomputedSha
      || registeredProfile.projectionKind !== projectionKind
    ) {
      adapterRequired(`projection profile ${profileId} is not the registered v0.18 runtime profile`, registry);
    }
    const typed: TypedProjectionProfileV2 = {
      key,
      manifestProfile: registeredProfile.manifestProfile,
      profileId,
      profileSha256: recomputedSha,
      projectionKind,
      profileVersion,
      mappingContractVersion: mappingContract,
      aggregationPolicy: string(
        row.aggregation_policy,
        `projection-profiles.profiles[${index}].aggregation_policy`,
        registry,
      ),
      payload: row,
    };
    typedProfiles.push(typed);
    profileById.set(profileId, typed);
  }
  if (typedProfiles.length !== registry.projectionProfiles.length) {
    adapterRequired('projection profile set is not the registered v0.18 profile set', registry);
  }
  for (const required of registry.projectionProfiles) {
    if (!profileById.has(required.profileId)) {
      adapterRequired(`required projection profile ${required.profileId} is missing`, registry);
    }
  }

  const projectionArtifacts = byRole.get('projection') ?? [];
  if (projectionArtifacts.length === 0) integrity('Bundle is missing projection Artifacts', registry);
  const projections: Array<{ artifact: ValidatedRawArtifact; payload: JsonObject; profile: string }> = [];
  const profileSeen = new Map<string, string>();
  for (const artifact of projectionArtifacts) {
    const profile = string(artifact.descriptor.profile, `${artifact.descriptor.path}.profile`, registry);
    if (profileSeen.has(profile)) integrity(`duplicate projection profile ${profile}`, registry);
    profileSeen.set(profile, artifact.descriptor.path);
    const payload = loadJson(artifact.bytes, artifact.descriptor.path, registry);
    if (!ctkgValidators.projection(payload)) {
      schemaFailure(`projection ${artifact.descriptor.path}`, ctkgValidators.projection.errors, registry);
    }
    if (string(payload.schema_version, `${artifact.descriptor.path}.schema_version`, registry)
      !== registry.schemaVersion) {
      schemaReview(
        `projection ${artifact.descriptor.path} schema_version is not the registered Schema identity`,
        registry,
      );
    }
    const payloadProfileId = string(
      payload.projection_profile,
      `${artifact.descriptor.path}.projection_profile`,
      registry,
    );
    const typedProfile = profileById.get(payloadProfileId);
    if (!typedProfile || typedProfile.manifestProfile !== profile) {
      integrity(
        `projection profile mismatch at ${artifact.descriptor.path}: Manifest profile ${profile} vs payload ${payloadProfileId}`,
        registry,
      );
    }
    if (
      string(payload.source_release, `${artifact.descriptor.path}.source_release`, registry) !== registry.releaseId
      || hash(payload.source_release_hash, `${artifact.descriptor.path}.source_release_hash`, registry)
        !== registry.releaseHash
      || hash(payload.source_dataset_hash, `${artifact.descriptor.path}.source_dataset_hash`, registry)
        !== registry.sourceDatasetHash
    ) {
      integrity(`projection identity drifts from Bundle/Release: ${artifact.descriptor.path}`, registry);
    }
    const declaredDigest = hash(
      payload.version_digest,
      `${artifact.descriptor.path}.version_digest`,
      registry,
    );
    const recomputedDigest = computeProjectionVersionDigest(payload, typedProfile.payload, profile);
    if (declaredDigest !== recomputedDigest) {
      integrity(`projection version_digest mismatch: ${artifact.descriptor.path}`, registry);
    }
    projections.push({ artifact, payload, profile });
  }
  const runtime = projections.filter((entry) => entry.profile === 'runtime');
  if (runtime.length !== 1) {
    integrity('Bundle must select exactly one registered runtime projection profile', registry);
  }
  for (const requiredProfile of REQUIRED_V2_AGGREGATE_PROJECTION_PROFILES) {
    if (!projections.some((entry) => entry.profile === requiredProfile)) {
      integrity(`aggregate Bundle is missing required projection profile: ${requiredProfile}`, registry);
    }
  }

  const preserved = projections.map((entry) => ({
    identity: projectionIdentity(entry.artifact.descriptor, entry.payload, entry.profile, registry),
    payload: entry.payload,
  }));
  const selectedRuntime = preserved.find((entry) => entry.identity.profile === 'runtime')!;
  const runtimeProfile = typedProfiles.find((profile) => profile.manifestProfile === 'runtime')!;
  if (selectedRuntime.identity.projectionProfile !== runtimeProfile.profileId) {
    integrity('runtime projection does not bind the registered v0.18 Projection v3 profile', registry);
  }
  const runtimeRelationIds = new Set(
    records(selectedRuntime.payload.links ?? [], 'runtime.links', registry).map((link, index) => (
      string(link.relation_id, `runtime.links[${index}].relation_id`, registry)
    )),
  );

  for (const entry of projections) {
    const nodes = records(entry.payload.nodes ?? [], `${entry.artifact.descriptor.path}.nodes`, registry);
    const links = records(entry.payload.links ?? [], `${entry.artifact.descriptor.path}.links`, registry);
    const hidden = records(
      entry.payload.hidden_entities ?? [],
      `${entry.artifact.descriptor.path}.hidden_entities`,
      registry,
    );
    const nodeIds = new Set<string>();
    const nodeEntityIds = new Set<string>();
    for (const [index, node] of nodes.entries()) {
      const nodeId = string(node.id, `nodes[${index}].id`, registry);
      if (nodeIds.has(nodeId)) integrity(`projection repeats node ${nodeId}`, registry);
      nodeIds.add(nodeId);
      const entityId = string(node.entity_id, `nodes[${index}].entity_id`, registry);
      nodeEntityIds.add(entityId);
      if (!entryEntityIds.has(entityId)) {
        integrity(`projection node ${nodeId} is outside release membership`, registry);
      }
      if (entryTierByEntity.get(entityId) !== node.release_tier) {
        integrity(`projection node ${nodeId} release tier diverges from its Release entry`, registry);
      }
    }
    const hiddenIds = new Set(
      hidden.map((row, index) => string(row.entity_id, `hidden_entities[${index}].entity_id`, registry)),
    );
    const projectedEntityIds = new Set([...nodeEntityIds, ...hiddenIds]);
    if (
      projectedEntityIds.size !== releaseKnowledgeEntityIds.size
      || [...releaseKnowledgeEntityIds].some((entityId) => !projectedEntityIds.has(entityId))
    ) {
      integrity(
        `projection ${entry.artifact.descriptor.path} does not close over Release knowledge-object membership`,
        registry,
      );
    }
    const relationIds = new Set<string>();
    for (const [index, link] of links.entries()) {
      const relationId = string(link.relation_id, `links[${index}].relation_id`, registry);
      if (relationIds.has(relationId)) integrity(`projection repeats relation ${relationId}`, registry);
      relationIds.add(relationId);
      if (!relationEntryIds.has(relationId)) {
        integrity(`projection relation ${relationId} is outside release membership`, registry);
      }
      const sourceId = string(link.source_id, `links[${index}].source_id`, registry);
      const targetId = string(link.target_id, `links[${index}].target_id`, registry);
      if (
        (!nodeIds.has(sourceId) && !hiddenIds.has(sourceId))
        || (!nodeIds.has(targetId) && !hiddenIds.has(targetId))
      ) {
        integrity(`projection link has a missing endpoint`, registry);
      }
    }
  }

  const metadataArtifacts = byRole.get('projection_link_metadata') ?? [];
  if (metadataArtifacts.length === 0) integrity('Bundle is missing projection_link_metadata', registry);
  const allLinkMetadata: ValidatedActKGBundleV2['allLinkMetadata'] = [];
  for (const artifact of metadataArtifacts) {
    const profiles = (artifact.descriptor.profiles ?? (artifact.descriptor.profile ? [artifact.descriptor.profile] : []));
    if (profiles.length === 0) integrity(`metadata ${artifact.descriptor.path} declares no profiles`, registry);
    const rows = loadJsonl(artifact.bytes, artifact.descriptor.path, registry);
    for (const [index, row] of rows.entries()) {
      if (!contractValidators.metadataRow(row)) {
        schemaFailure(`metadata[${index}]`, contractValidators.metadataRow.errors, registry);
      }
    }
    const parsed = metadataRows(rows, registry);
    const relationIds = parsed.map((row) => row.relationId);
    if (new Set(relationIds).size !== relationIds.length) {
      integrity(`duplicate projection metadata relation_id in ${artifact.descriptor.path}`, registry);
    }
    const coveredProfiles = projections.filter((entry) => profiles.includes(entry.profile));
    if (coveredProfiles.length !== profiles.length) {
      integrity(`metadata ${artifact.descriptor.path} covers unknown projection profiles`, registry);
    }
    const coveredRelationSets = coveredProfiles.map((entry) => {
      const links = records(entry.payload.links ?? [], `${entry.artifact.descriptor.path}.links`, registry);
      return new Set(links.map((link, index) => string(link.relation_id, `links[${index}].relation_id`, registry)));
    });
    const coveredRelationUnion = new Set(coveredRelationSets.flatMap((set) => [...set]));
    if (relationIds.some((relationId) => !coveredRelationUnion.has(relationId))) {
      integrity(
        `projection metadata contains a relation outside its covered projection profiles: ${artifact.descriptor.path}`,
        registry,
      );
    }
    if (coveredRelationSets.some((set) => [...set].some((relationId) => !relationIds.includes(relationId)))) {
      integrity(
        `projection metadata is missing a relation from one of its covered projection profiles: ${artifact.descriptor.path}`,
        registry,
      );
    }
    allLinkMetadata.push({ profiles, path: artifact.descriptor.path, rows: parsed });
  }
  const metadataCoverageByProfile = new Map<string, string[]>();
  for (const entry of allLinkMetadata) {
    for (const profile of entry.profiles) {
      const covering = metadataCoverageByProfile.get(profile) ?? [];
      covering.push(entry.path);
      metadataCoverageByProfile.set(profile, covering);
    }
  }
  for (const requiredProfile of REQUIRED_V2_AGGREGATE_PROJECTION_PROFILES) {
    const covering = metadataCoverageByProfile.get(requiredProfile) ?? [];
    if (covering.length !== 1) {
      integrity(
        covering.length === 0
          ? `required aggregate projection profile ${requiredProfile} lacks link metadata coverage`
          : `projection profile ${requiredProfile} has duplicate link metadata coverage`,
        registry,
      );
    }
  }
  const runtimeMetadata = allLinkMetadata
    .filter((entry) => entry.profiles.includes('runtime'))
    .flatMap((entry) => entry.rows)
    .filter((row) => runtimeRelationIds.has(row.relationId));
  if (runtimeMetadata.length === 0) integrity('runtime projection lacks link metadata coverage', registry);
  const runtimeMetadataIds = new Set(runtimeMetadata.map((row) => row.relationId));
  if (
    runtimeMetadataIds.size !== runtimeMetadata.length
    || canonicalJson([...runtimeMetadataIds].sort()) !== canonicalJson([...runtimeRelationIds].sort())
  ) {
    integrity('runtime link metadata is not one-to-one closed', registry);
  }

  const labelArtifacts = byRole.get('multilingual_label_index') ?? [];
  if (labelArtifacts.length !== 1) {
    integrity('Bundle must contain exactly one multilingual_label_index Artifact', registry);
  }
  if (labelArtifacts[0]!.descriptor.contractVersion !== V2_LABEL_INDEX_CONTRACT) {
    adapterRequired('multilingual label index contract is not registered', registry);
  }
  const labelRows = loadJsonl(labelArtifacts[0]!.bytes, labelArtifacts[0]!.descriptor.path, registry);
  const runtimeNodeByEntity = new Map(
    records(selectedRuntime.payload.nodes ?? [], 'runtime.nodes', registry).map((node, index) => {
      const entityId = string(node.entity_id, `runtime.nodes[${index}].entity_id`, registry);
      return [entityId, node] as const;
    }),
  );
  const multilingualLabels: TypedMultilingualLabelV2[] = [];
  const assertionIds = new Set<string>();
  for (const [index, row] of labelRows.entries()) {
    if (!contractValidators.labelRow(row)) {
      schemaFailure(`multilingual-label-index[${index}]`, contractValidators.labelRow.errors, registry);
    }
    const entityId = string(row.entity_id, `labels[${index}].entity_id`, registry);
    const language = string(row.language, `labels[${index}].language`, registry);
    const label = string(row.label, `labels[${index}].label`, registry);
    const labelType = string(row.label_type, `labels[${index}].label_type`, registry);
    const terminologyAssertionId = string(
      row.terminology_assertion_id,
      `labels[${index}].terminology_assertion_id`,
      registry,
    );
    const runtimeNode = runtimeNodeByEntity.get(entityId);
    if (!runtimeNode) {
      integrity(`label ${entityId} does not resolve to a runtime projection entity`, registry);
    }
    const declaredAssertions = runtimeNode.terminology_assertion_ids;
    if (!Array.isArray(declaredAssertions) || !declaredAssertions.includes(terminologyAssertionId)) {
      integrity(
        `label ${entityId} is not bound to its terminology assertion on the runtime node`,
        registry,
      );
    }
    if (assertionIds.has(terminologyAssertionId)) {
      integrity(`terminology assertion ${terminologyAssertionId} is repeated`, registry);
    }
    assertionIds.add(terminologyAssertionId);
    multilingualLabels.push({
      entityId,
      language,
      label,
      labelType,
      terminologyAssertionId,
      payload: row,
    });
  }

  const crosswalkArtifacts = byRole.get('rag_crosswalk') ?? [];
  if (crosswalkArtifacts.length !== 1) integrity('Bundle must contain one rag_crosswalk Artifact', registry);
  const crosswalkRows = loadJsonl(
    crosswalkArtifacts[0]!.bytes,
    crosswalkArtifacts[0]!.descriptor.path,
    registry,
  );
  const crosswalk: CrosswalkRow[] = [];
  for (const [index, row] of crosswalkRows.entries()) {
    if (!contractValidators.crosswalkRow(row)) {
      schemaFailure(`rag-crosswalk[${index}]`, contractValidators.crosswalkRow.errors, registry);
    }
    const publishedEntityId = string(row.published_entity_id, `crosswalk[${index}].published_entity_id`, registry);
    if (!runtimeNodeByEntity.has(publishedEntityId) && !entryEntityIds.has(publishedEntityId)) {
      integrity(`crosswalk row ${publishedEntityId} is outside release/runtime membership`, registry);
    }
    crosswalk.push({
      publishedEntityId,
      retrievalChunkId: string(row.retrieval_chunk_id, `crosswalk[${index}].retrieval_chunk_id`, registry),
      citationTargetId: string(row.citation_target_id, `crosswalk[${index}].citation_target_id`, registry),
    });
  }

  const reportArtifacts = byRole.get('validation_report') ?? [];
  if (reportArtifacts.length !== 1) integrity('Bundle must contain one validation_report Artifact', registry);
  const report = loadJson(reportArtifacts[0]!.bytes, reportArtifacts[0]!.descriptor.path, registry);
  if (!contractValidators.validationReport(report)) {
    schemaFailure('validation-report', contractValidators.validationReport.errors, registry);
  }
  if (string(report.result, 'validation-report.result', registry) !== 'PASS') {
    integrity('Validation Report result is not PASS', registry);
  }
  if (string(report.bundle_id, 'validation-report.bundle_id', registry) !== registry.bundleId) {
    integrity('Validation Report bundle_id disagrees with the registered publication', registry);
  }
  const reportRelease = object(report.release, 'validation-report.release', registry);
  if (
    string(reportRelease.release_id, 'validation-report.release.release_id', registry) !== registry.releaseId
    || string(reportRelease.release_version, 'validation-report.release.release_version', registry)
      !== registry.releaseVersion
    || hash(reportRelease.release_hash, 'validation-report.release.release_hash', registry) !== registry.releaseHash
    || hash(reportRelease.source_dataset_hash, 'validation-report.release.source_dataset_hash', registry)
      !== registry.sourceDatasetHash
  ) {
    integrity('Validation Report release identity disagrees with the registered publication', registry);
  }
  const reportSource = object(report.source_revision, 'validation-report.source_revision', registry);
  if (
    string(reportSource.commit, 'validation-report.source_revision.commit', registry) !== registry.sourceCommit
    || string(reportSource.tag, 'validation-report.source_revision.tag', registry) !== registry.sourceTag
  ) {
    integrity('Validation Report source_revision disagrees with the registered publication', registry);
  }
  const gates = object(report.gates, 'validation-report.gates', registry);
  for (const [gateName, gateStatus] of Object.entries(gates)) {
    if (gateStatus !== 'PASS' && gateStatus !== 'NOT_APPLICABLE') {
      integrity(`Validation Report gate ${gateName} is ${String(gateStatus)}`, registry);
    }
  }

  const diffArtifacts = byRole.get('release_diff') ?? [];
  for (const artifact of diffArtifacts) {
    const diff = loadJson(artifact.bytes, artifact.descriptor.path, registry);
    if (!contractValidators.releaseDiff(diff)) {
      schemaFailure('release-diff', contractValidators.releaseDiff.errors, registry);
    }
  }

  const statistics = {
    releaseEntries: entries.length,
    releaseNodes,
    knowledgeNodes: releaseNodes,
    publishedRelations: selectedRuntime.identity.linkCount,
    projectionNodes: selectedRuntime.identity.nodeCount,
    projectionLinks: selectedRuntime.identity.linkCount,
    ragCrosswalkRows: crosswalk.length,
    componentCount: validatedComponents.length,
    relationTypeCount: new Set(
      projections.flatMap((entry) => (
        records(entry.payload.links ?? [], 'links', registry).map((link, index) => (
          string(link.relation_type, `links[${index}].relation_type`, registry)
        ))
      )),
    ).size,
    terminologyAssertions: multilingualLabels.length,
  };
  if (
    statistics.releaseNodes !== registry.expectedCounts.releaseNodes
    || statistics.projectionNodes !== registry.expectedCounts.runtimeProjectionNodes
    || statistics.publishedRelations !== registry.expectedCounts.publishedRuntimeRelations
    || statistics.terminologyAssertions !== registry.expectedCounts.terminologyAssertions
  ) {
    integrity(
      'recomputed v2 counts do not match the registered publication '
      + `(releaseNodes=${statistics.releaseNodes}, runtimeNodes=${statistics.projectionNodes}, `
      + `relations=${statistics.publishedRelations}, terminology=${statistics.terminologyAssertions})`,
      registry,
    );
  }
  const reportStatistics = object(report.statistics, 'validation-report.statistics', registry);
  for (const [key, expected] of Object.entries({
    release_entries: statistics.releaseEntries,
    knowledge_nodes: statistics.knowledgeNodes,
    published_relations: statistics.publishedRelations,
    projection_nodes: statistics.projectionNodes,
    projection_links: statistics.projectionLinks,
    rag_crosswalk_rows: statistics.ragCrosswalkRows,
    component_count: statistics.componentCount,
    relation_type_count: statistics.relationTypeCount,
  })) {
    if (reportStatistics[key] !== expected) {
      integrity(`Validation Report statistic ${key} does not match recalculation`, registry);
    }
  }
  const declaredStats = object(manifest.statistics, 'manifest.statistics', registry);
  if (
    declaredStats.knowledge_nodes !== statistics.releaseNodes
    || declaredStats.published_relations !== statistics.publishedRelations
    || declaredStats.terminology_assertions !== statistics.terminologyAssertions
  ) {
    integrity('published v2 statistics do not match recalculation', registry);
  }

  const compatibility: CompatibilityAssessment = {
    code: 'COMPATIBLE_CONTENT_UPDATE',
    reasons: [
      'registered Bundle v2, Schema 0.3, and required Artifact contracts admit the pinned publication',
    ],
    matchedIdentities: matchedV2RegistryIdentities(registry),
  };
  if (unknownOptional.length > 0) {
    compatibility.code = 'COMPATIBLE_OPTIONAL_EXTENSION';
    compatibility.reasons = unknownOptional.map(
      (artifact) => `unknown optional artifact ${artifact.role}@${artifact.contractVersion} at ${artifact.path}`,
    );
  }

  return {
    protocol: 'actkg-public-bundle/2',
    captureRevision,
    graphRagRuntimeIntakeBlocked: true,
    bundleIdentity: {
      protocol: 'actkg-public-bundle/2',
      bundleId: registry.bundleId,
      bundleRevision: registry.bundleRevision,
      bundleDigest: registry.bundleDigest,
      bundleKind: 'aggregate',
      releaseStage: manifest.release_stage as 'candidate' | 'stable',
      bundleContractVersion: PUBLIC_BUNDLE_V2_CONTRACT_VERSION,
      controlledPath,
      manifestRawSha256,
      sha256sumsRawSha256: sumsRawSha256,
    },
    manifestSourceRevision,
    registeredAdmissionBinding: registeredAdmissionBinding(registry),
    releaseIdentity: {
      releaseId: registry.releaseId,
      releaseVersion: registry.releaseVersion,
      releaseHash: registry.releaseHash,
      sourceDatasetHash: registry.sourceDatasetHash,
    },
    schemaIdentity: {
      version: registry.schemaVersion,
      rawSha256: registry.schemaRawSha256,
    },
    selectedRuntimeProjection: selectedRuntime,
    preservedProjections: preserved,
    projectionProfiles: typedProfiles,
    multilingualLabels,
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

export { ARTIFACT_CONTRACTS_V2 };
