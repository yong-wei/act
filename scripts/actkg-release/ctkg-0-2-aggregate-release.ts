import { spawnSync } from 'node:child_process';
import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

import type { Prisma, PrismaClient } from '@prisma/client';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';

import { canonicalJson, sha256 } from './authoritative-release';
import { CTKG_0_2_RELATION_SEMANTIC_CONTRACT } from '../../src/lib/authoritative-knowledge/contracts';

// Exact CTKG 0.2 aggregate bundle adapter. It admits only the locked
// `control-theory-engineering-v0.2` public Engineering Release bundle as the
// sole current ReleaseSet member, verifies the declared component lineage
// without importing components as peers, and persists every public artifact
// losslessly. It does not run ActKG code, does not import or reconstruct the
// private CTKGDataset, and does not claim compatibility with any other Schema
// version.

export const AGGREGATE_RELEASE_SET_LOCK_PATH =
  'course-content/authoring/knowledge/releases/release-set.lock.json';
export const AGGREGATE_RELEASE_SET_ID = 'actkg-authoritative-candidate-v2';
export const AGGREGATE_RELEASE_ID = 'control-theory-engineering-v0.2';
export const AGGREGATE_PROTOCOL = 'ctkg-0.2-aggregate-engineering-release-v1';
export const AGGREGATE_AUTHORITY = 'ActKG';
export const AGGREGATE_SCOPE = 'control-theory-engineering';
export const CTKG_0_2_SCHEMA_VERSION = '0.2.0';
export const CTKG_0_2_UPSTREAM_PUBLICATION_COMMIT = '7ab6041201f3c23963a8ddb2685256a5418ad532';
export const CTKG_0_2_UPSTREAM_CLOSED_COMMIT = 'f5f442e99324af731e0b5226a22b0973e838621b';
export const CTKG_0_2_SCHEMA_RAW_SHA256 = '3598f0c89f1f32ff1812e823454a17502873ccb5e9577656e6485a7e030233de';

const EXPECTED_LOCK_VERSION = 'actkg-release-set-lock/v2';
const EXPECTED_NORMALIZATION = 'canonical-json/rfc8785-subset-v1';
const VENDORED_SCHEMA_NAME = 'ctkg.schema.json';
const SHA256SUMS_NAME = 'SHA256SUMS';
const COMPONENT_MANIFEST_NAME = 'component-releases.json';
const COMPONENT_PROTOCOL_0_1_ENVELOPE = 'ctkg-m1c-v14p-root-locus-engineering-release-v1';
const COMPONENT_PROTOCOL_0_2_RELEASE = 'ctkg-0.2-release';
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;

type JsonObject = Record<string, unknown>;

export interface AggregateLockArtifact {
  path: string;
  media_type: string;
  sha256: string;
}

export interface AggregateLockComponent {
  release_id: string;
  release_version: string;
  protocol: string;
  controlled_path: string;
  release_json_name: string;
  release_hash: string;
  release_json_raw_sha256: string;
  sha256sums_raw_sha256: string;
}

export interface AggregateLockEntry {
  release_id: string;
  release_version: string;
  upstream_release_id: string;
  controlled_path: string;
  release_hash: string;
  source_dataset_hash: string;
  projection_id: string;
  projection_digest: string;
  artifacts: AggregateLockArtifact[];
  components: AggregateLockComponent[];
}

export interface AggregateReleaseSetLock {
  lock_version: typeof EXPECTED_LOCK_VERSION;
  release_set_id: string;
  upstream: {
    publication_commit: string;
    closed_commit: string;
  };
  consumer_contract: {
    schema_version: string;
    schema_raw_sha256: string;
    schema_controlled_path: string;
    normalization: string;
  };
  releases: AggregateLockEntry[];
}

export interface AggregateLineageClaims {
  ctkgDatasetHash?: string | null;
  ctkgDatasetPublicationIdentity?: string | null;
  ctkgDatasetResolvableLocation?: string | null;
  revisionRegistryVersion?: string | null;
  revisionRegistryHash?: string | null;
}

export interface ValidatedArtifact {
  relativePath: string;
  mediaType: string;
  sha256: string;
  bytes: Buffer;
}

export interface ValidatedComponent {
  componentReleaseId: string;
  releaseVersion: string;
  protocol: string;
  controlledPath: string;
  releaseHash: string;
  releaseRawSha256: string;
  sha256sumsSha256: string;
  payload: JsonObject;
}

export interface CrosswalkRow {
  publishedEntityId: string;
  retrievalChunkId: string;
  citationTargetId: string;
}

export interface ValidatedAggregateRelease {
  lock: AggregateReleaseSetLock;
  entry: AggregateLockEntry;
  schema: JsonObject;
  release: JsonObject;
  normalizedReleaseWithoutHash: JsonObject;
  projection: JsonObject;
  entries: JsonObject[];
  nodes: JsonObject[];
  links: JsonObject[];
  crosswalk: CrosswalkRow[];
  artifacts: ValidatedArtifact[];
  components: ValidatedComponent[];
  captureRevision: string;
  lockRawHash: string;
}

export interface AggregateImportCounts {
  releaseEntries: number;
  projectionNodes: number;
  projectionLinks: number;
  upstreamRagReferences: number;
  artifacts: number;
  components: number;
}

function fail(message: string): never {
  throw new Error(`ActKG aggregate Release rejected: ${message}`);
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function hash(value: unknown, label: string): string {
  const resolved = string(value, label);
  if (!SHA256.test(resolved)) fail(`${label} must be a SHA-256 hex digest`);
  return resolved;
}

function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
}

function records(value: unknown, label: string): JsonObject[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((item, index) => object(item, `${label}[${index}]`));
}

function assertRawHash(bytes: Buffer, expected: string, label: string): void {
  if (!SHA256.test(expected) || sha256(bytes) !== expected) fail(`${label} raw-byte hash drift`);
}

function resolveCaptureRevision(root: string): string {
  const status = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (status.status !== 0) fail('ACT capture Git status could not be verified');
  if (status.stdout.trim()) fail('ACT capture requires one clean Git HEAD');
  const tracked = spawnSync('git', [
    'ls-files',
    '--error-unmatch',
    AGGREGATE_RELEASE_SET_LOCK_PATH,
    'course-content/authoring/knowledge/releases/control-theory-engineering-v0.2',
    'course-content/authoring/knowledge/releases/system-modeling-engineering-v0.1',
    'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1',
    'scripts/actkg-release/ctkg-0-2-aggregate-release.ts',
    'scripts/db/import-authoritative-actkg-release.ts',
  ], { cwd: root, encoding: 'utf8' });
  if (tracked.status !== 0) fail('ACT capture inputs and importer must belong to the same Git HEAD');
  const revision = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const value = revision.stdout.trim();
  if (revision.status !== 0 || !COMMIT.test(value)) fail('ACT capture Git revision is unavailable');
  return value;
}

function parseSha256Sums(text: string, label: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    const match = /^([a-f0-9]{64}) {2}(\S+)$/u.exec(line);
    if (!match) fail(`${label} line ${index + 1} is malformed`);
    const [, digest, name] = match;
    if (name!.includes('/') || name!.includes('\\')) fail(`${label} entry ${name} is not a package-local file`);
    if (sums.has(name!)) fail(`${label} repeats ${name}`);
    sums.set(name!, digest!);
  }
  if (sums.size === 0) fail(`${label} must list at least one artifact`);
  return sums;
}

function compileSchemaValidators(schema: JsonObject): {
  release: ValidateFunction;
  projection: ValidateFunction;
} {
  const defs = object(schema.$defs, 'ctkg.schema.json.$defs');
  for (const name of ['Release', 'ReleaseEntry', 'GraphProjection', 'ProjectedNode', 'ProjectedLink']) {
    if (!defs[name]) fail(`pinned CTKG 0.2 Schema does not define ${name}`);
  }
  const ajv = new Ajv({ allErrors: true, strict: true, validateFormats: false });
  return {
    release: ajv.compile({ $defs: defs, $ref: '#/$defs/Release' }),
    projection: ajv.compile({ $defs: defs, $ref: '#/$defs/GraphProjection' }),
  };
}

function schemaFailure(label: string, errors: ErrorObject[] | null | undefined): never {
  const detail = errors?.map((error) => `${error.instancePath || '/'} ${error.message ?? error.keyword}`).join('; ');
  fail(`${label} violates the pinned CTKG 0.2 Schema${detail ? `: ${detail}` : ''}`);
}

function schemaVocabulary(schema: JsonObject): { relationFamilies: Set<string> } {
  const defs = object(schema.$defs, 'ctkg.schema.json.$defs');
  const relationFamily = object(defs.RelationFamily, 'Schema RelationFamily');
  if (!Array.isArray(relationFamily.enum)) fail('Schema relation family vocabulary is unavailable');
  return {
    relationFamilies: new Set(relationFamily.enum.map((value, index) => (
      string(value, `Schema relation family vocabulary[${index}]`)
    ))),
  };
}

function assertNoFabricatedLineage(claims: AggregateLineageClaims | undefined): void {
  if (!claims) return;
  const unavailable = [
    claims.ctkgDatasetHash,
    claims.ctkgDatasetPublicationIdentity,
    claims.ctkgDatasetResolvableLocation,
    claims.revisionRegistryVersion,
    claims.revisionRegistryHash,
  ];
  if (unavailable.some((value) => value !== undefined && value !== null)) {
    fail('aggregate package does not carry CTKGDataset or RevisionProposalRegistry lineage');
  }
}

function validateLock(lock: AggregateReleaseSetLock, releaseId: string): AggregateLockEntry {
  if (lock.lock_version !== EXPECTED_LOCK_VERSION || !Array.isArray(lock.releases)) {
    fail('unsupported aggregate ReleaseSet lock');
  }
  // Exact pinned-identity admission gates. Coordinated lock and artifact-hash
  // edits cannot reroute the importer onto another ReleaseSet, member,
  // lineage, or Schema snapshot.
  if (lock.release_set_id !== AGGREGATE_RELEASE_SET_ID) {
    fail('aggregate ReleaseSet id is not the pinned CTKG 0.2 candidate ReleaseSet');
  }
  if (lock.upstream?.publication_commit !== CTKG_0_2_UPSTREAM_PUBLICATION_COMMIT) {
    fail('aggregate lock upstream publication commit is not the pinned reviewed commit');
  }
  if (lock.upstream?.closed_commit !== CTKG_0_2_UPSTREAM_CLOSED_COMMIT) {
    fail('aggregate lock upstream closed commit is not the pinned closing commit');
  }
  const contract = object(lock.consumer_contract, 'aggregate lock consumer_contract');
  if (contract.schema_version !== CTKG_0_2_SCHEMA_VERSION) fail('aggregate lock Schema version is not adapted');
  if (contract.schema_raw_sha256 !== CTKG_0_2_SCHEMA_RAW_SHA256) {
    fail('aggregate lock Schema hash is not the pinned CTKG 0.2.0 Schema snapshot');
  }
  if (contract.normalization !== EXPECTED_NORMALIZATION) fail('aggregate lock normalization is not adapted');
  string(contract.schema_controlled_path, 'aggregate lock Schema path');
  if (lock.releases.length !== 1) fail('aggregate ReleaseSet lock must contain exactly one current member');
  const entry = lock.releases[0]!;
  if (entry.release_id !== AGGREGATE_RELEASE_ID) {
    fail(`aggregate member ${entry.release_id} is not the pinned CTKG 0.2 Release`);
  }
  if (releaseId !== entry.release_id) fail(`release ${releaseId} is not the locked aggregate member`);
  for (const component of entry.components) {
    if (component.release_id === entry.release_id) fail('aggregate member cannot be its own component');
  }
  if (!Array.isArray(entry.artifacts) || entry.artifacts.length === 0) fail('aggregate lock artifacts are missing');
  const artifactPaths = new Set<string>();
  for (const [index, artifact] of entry.artifacts.entries()) {
    const relativePath = string(artifact.path, `lock artifacts[${index}].path`);
    if (relativePath.includes('/') || relativePath.includes('\\')) {
      fail(`lock artifact ${relativePath} is not package-local`);
    }
    if (artifactPaths.has(relativePath)) fail(`lock repeats artifact ${relativePath}`);
    artifactPaths.add(relativePath);
    string(artifact.media_type, `lock artifact ${relativePath} media_type`);
    hash(artifact.sha256, `lock artifact ${relativePath} sha256`);
  }
  hash(entry.release_hash, 'lock release_hash');
  hash(entry.source_dataset_hash, 'lock source_dataset_hash');
  hash(entry.projection_digest, 'lock projection_digest');
  string(entry.projection_id, 'lock projection_id');
  string(entry.upstream_release_id, 'lock upstream_release_id');
  string(entry.controlled_path, 'lock controlled_path');
  return entry;
}

async function readLockedArtifacts(
  root: string,
  directory: string,
  entry: AggregateLockEntry,
): Promise<ValidatedArtifact[]> {
  const onDisk = (await readdir(directory)).filter((name) => !name.startsWith('.'));
  const locked = new Set(entry.artifacts.map((artifact) => artifact.path));
  for (const name of onDisk) {
    if (!locked.has(name)) fail(`package directory carries unlocked file ${name}`);
  }
  const artifacts: ValidatedArtifact[] = [];
  for (const [ordinal, artifact] of entry.artifacts.entries()) {
    const bytes = await readFile(path.join(directory, artifact.path)).catch(() => {
      fail(`locked artifact ${artifact.path} is missing from the package directory`);
    });
    assertRawHash(bytes, artifact.sha256, `artifact ${artifact.path}`);
    artifacts.push({
      relativePath: artifact.path,
      mediaType: artifact.media_type,
      sha256: artifact.sha256,
      bytes,
    });
    void ordinal;
  }
  return artifacts;
}

function artifactBytes(artifacts: ValidatedArtifact[], relativePath: string): Buffer {
  const artifact = artifacts.find((candidate) => candidate.relativePath === relativePath);
  if (!artifact) fail(`locked package does not carry ${relativePath}`);
  return artifact.bytes;
}

function parseJsonArtifact(artifacts: ValidatedArtifact[], relativePath: string): JsonObject {
  return object(JSON.parse(artifactBytes(artifacts, relativePath).toString('utf8')), relativePath);
}

function assertCanonicalReleaseHash(release: JsonObject, expected: string, label: string): void {
  const normalized = structuredClone(release);
  delete normalized.release_hash;
  if (sha256(canonicalJson(normalized)) !== expected) fail(`${label} canonical Release hash drift`);
}

async function validateComponent(
  root: string,
  component: AggregateLockComponent,
  manifestEntry: JsonObject,
  sourceDatasetHash: string,
  validators: { release: ValidateFunction; projection: ValidateFunction },
): Promise<ValidatedComponent> {
  string(component.controlled_path, `component ${component.release_id} controlled_path`);
  const controlledDirectory = path.join(root, component.controlled_path);
  const directory = await realpath(controlledDirectory).catch(() => {
    fail(`component ${component.release_id} controlled directory is missing`);
  });
  if (directory !== await realpath(path.resolve(root, component.controlled_path))) {
    fail(`component ${component.release_id} path is not the controlled locked path`);
  }
  const releaseBytes = await readFile(path.join(directory, component.release_json_name)).catch(() => {
    fail(`component ${component.release_id} Release JSON is missing`);
  });
  assertRawHash(releaseBytes, component.release_json_raw_sha256, `component ${component.release_id} Release JSON`);
  const sumsBytes = await readFile(path.join(directory, SHA256SUMS_NAME)).catch(() => {
    fail(`component ${component.release_id} SHA256SUMS is missing`);
  });
  assertRawHash(sumsBytes, component.sha256sums_raw_sha256, `component ${component.release_id} SHA256SUMS`);
  const sums = parseSha256Sums(sumsBytes.toString('utf8'), `component ${component.release_id} SHA256SUMS`);
  if (!sums.has(component.release_json_name)) {
    fail(`component ${component.release_id} SHA256SUMS does not list its Release JSON`);
  }
  for (const [name, digest] of sums) {
    const bytes = await readFile(path.join(directory, name)).catch(() => {
      fail(`component ${component.release_id} artifact ${name} is missing`);
    });
    assertRawHash(bytes, digest, `component ${component.release_id} artifact ${name}`);
  }

  const release = object(JSON.parse(releaseBytes.toString('utf8')), `component ${component.release_id} Release`);
  if (release.release_version !== component.release_version) {
    fail(`component ${component.release_id} release_version does not match the locked lineage`);
  }
  if (release.release_hash !== component.release_hash) {
    fail(`component ${component.release_id} release_hash does not match the locked lineage`);
  }
  assertCanonicalReleaseHash(release, component.release_hash, `component ${component.release_id}`);

  if (component.protocol === COMPONENT_PROTOCOL_0_1_ENVELOPE) {
    if (release.protocol !== COMPONENT_PROTOCOL_0_1_ENVELOPE) {
      fail(`component ${component.release_id} protocol does not match the locked lineage`);
    }
    if (release.release_status !== 'RELEASED') fail(`component ${component.release_id} is not RELEASED`);
  } else if (component.protocol === COMPONENT_PROTOCOL_0_2_RELEASE) {
    if (!validators.release(release)) {
      schemaFailure(`component ${component.release_id} Release`, validators.release.errors);
    }
    if (release.id !== component.release_id) fail(`component ${component.release_id} id does not match the locked lineage`);
    if (release.schema_version !== CTKG_0_2_SCHEMA_VERSION) {
      fail(`component ${component.release_id} carries an unadapted Schema version`);
    }
    if (release.lifecycle_status !== 'accepted' || release.publication_status !== 'published') {
      fail(`component ${component.release_id} is not an accepted published release`);
    }
    if (release.source_dataset_hash !== sourceDatasetHash) {
      fail(`component ${component.release_id} source dataset does not match the aggregate release`);
    }
    const projectionName = `${component.release_version}.projection.json`;
    if (!sums.has(projectionName)) fail(`component ${component.release_id} SHA256SUMS does not list its projection`);
    const projection = object(JSON.parse(
      (await readFile(path.join(directory, projectionName))).toString('utf8'),
    ), `component ${component.release_id} projection`);
    if (!validators.projection(projection)) {
      schemaFailure(`component ${component.release_id} projection`, validators.projection.errors);
    }
    if (projection.source_release !== component.release_id) {
      fail(`component ${component.release_id} projection does not close over its source release`);
    }
    if (projection.source_release_hash !== component.release_hash) {
      fail(`component ${component.release_id} projection source hash does not match the locked lineage`);
    }
    if (projection.source_dataset_hash !== sourceDatasetHash) {
      fail(`component ${component.release_id} projection source dataset does not match the aggregate release`);
    }
    hash(projection.version_digest, `component ${component.release_id} projection digest`);
    if (sums.has('provenance-stubs.json')) {
      const provenance = object(JSON.parse(
        (await readFile(path.join(directory, 'provenance-stubs.json'))).toString('utf8'),
      ), `component ${component.release_id} provenance stubs`);
      if (provenance.release_id !== component.release_id) {
        fail(`component ${component.release_id} provenance stubs do not match the locked lineage`);
      }
      if (provenance.source_dataset_hash !== sourceDatasetHash) {
        fail(`component ${component.release_id} provenance source dataset does not match the aggregate release`);
      }
    }
  } else {
    fail(`component ${component.release_id} protocol is not adapted by the current importer`);
  }

  return {
    componentReleaseId: component.release_id,
    releaseVersion: component.release_version,
    protocol: component.protocol,
    controlledPath: component.controlled_path,
    releaseHash: component.release_hash,
    releaseRawSha256: component.release_json_raw_sha256,
    sha256sumsSha256: component.sha256sums_raw_sha256,
    payload: {
      declared_by_lock: component as unknown as JsonObject,
      declared_by_manifest: manifestEntry,
    },
  };
}

export async function loadAndValidateAggregateRelease(options: {
  root?: string;
  releasePath?: string;
  releaseId?: string;
  lineageClaims?: AggregateLineageClaims;
  captureRevision?: string;
} = {}): Promise<ValidatedAggregateRelease> {
  const root = path.resolve(options.root ?? process.cwd());
  const lockBytes = await readFile(path.join(root, AGGREGATE_RELEASE_SET_LOCK_PATH));
  const lock = object(
    JSON.parse(lockBytes.toString('utf8')),
    'aggregate ReleaseSet lock',
  ) as unknown as AggregateReleaseSetLock;
  const releaseId = options.releaseId ?? AGGREGATE_RELEASE_ID;
  const entry = validateLock(lock, releaseId);
  const captureRevision = options.captureRevision ?? resolveCaptureRevision(root);
  if (!COMMIT.test(captureRevision)) fail('ACT capture Git revision is invalid');
  const lockRawHash = sha256(lockBytes);

  const controlledDirectory = path.join(root, entry.controlled_path);
  const requestedDirectory = path.resolve(root, options.releasePath ?? entry.controlled_path);
  if (await realpath(requestedDirectory) !== await realpath(controlledDirectory)) {
    fail('requested package path is not the controlled locked path');
  }

  const artifacts = await readLockedArtifacts(root, requestedDirectory, entry);
  const contract = lock.consumer_contract;
  if (contract.schema_controlled_path !== `${entry.controlled_path}/${VENDORED_SCHEMA_NAME}`) {
    fail('aggregate lock Schema path does not match the locked package');
  }
  const schemaArtifact = artifacts.find((candidate) => candidate.relativePath === VENDORED_SCHEMA_NAME);
  if (!schemaArtifact) fail('locked package does not carry the vendored CTKG 0.2 Schema');
  if (schemaArtifact.sha256 !== contract.schema_raw_sha256) {
    fail('vendored CTKG 0.2 Schema does not match the pinned consumer contract');
  }
  const schema = object(JSON.parse(schemaArtifact.bytes.toString('utf8')), 'CTKG 0.2 Schema');
  if (schema.version !== CTKG_0_2_SCHEMA_VERSION) fail('vendored Schema version is not adapted');
  const vocabulary = schemaVocabulary(schema);
  const validators = compileSchemaValidators(schema);

  const sumsText = artifactBytes(artifacts, SHA256SUMS_NAME).toString('utf8');
  const sums = parseSha256Sums(sumsText, `aggregate ${SHA256SUMS_NAME}`);
  const upstreamArtifacts = new Set(sums.keys());
  const expectedUpstream = new Set(
    artifacts
      .map((artifact) => artifact.relativePath)
      .filter((name) => name !== SHA256SUMS_NAME && name !== VENDORED_SCHEMA_NAME),
  );
  if (canonicalJson([...upstreamArtifacts].sort()) !== canonicalJson([...expectedUpstream].sort())) {
    fail('aggregate SHA256SUMS does not close over the upstream public artifacts');
  }
  for (const [name, digest] of sums) {
    assertRawHash(artifactBytes(artifacts, name), digest, `aggregate SHA256SUMS entry ${name}`);
  }

  const releaseName = `${entry.release_version}.release.json`;
  const release = parseJsonArtifact(artifacts, releaseName);
  if (!validators.release(release)) schemaFailure('aggregate Release', validators.release.errors);
  if (release.schema_version !== CTKG_0_2_SCHEMA_VERSION) fail('aggregate Release carries an unadapted Schema version');
  if (release.id !== entry.upstream_release_id) fail('aggregate Release id does not match lock');
  if (release.release_version !== entry.release_version) fail('aggregate Release version does not match lock');
  if (release.lifecycle_status !== 'accepted') fail('aggregate Release lifecycle_status must be accepted');
  if (release.publication_status !== 'published') fail('aggregate Release publication_status must be published');
  string(release.released_at, 'aggregate Release released_at');
  string(release.validation_report_uri, 'aggregate Release validation_report_uri');
  if (release.source_dataset_hash !== entry.source_dataset_hash) {
    fail('aggregate Release source dataset hash does not match lock');
  }
  if (release.release_hash !== entry.release_hash) fail('aggregate Release hash does not match lock');
  assertCanonicalReleaseHash(release, entry.release_hash, 'aggregate Release');
  const normalizedReleaseWithoutHash = structuredClone(release);
  delete normalizedReleaseWithoutHash.release_hash;

  const declaredComponentIds = stringList(release.component_releases, 'aggregate Release component_releases');
  const entries = records(release.entries, 'aggregate Release entries');
  const includedEntities = stringList(release.included_entities, 'aggregate Release included_entities');
  if (new Set(includedEntities).size !== includedEntities.length) {
    fail('aggregate Release included_entities repeats an entity');
  }
  const entryEntityIds = new Set<string>();
  const entryTierByEntity = new Map<string, string>();
  const relationEntryIds = new Set<string>();
  for (const [index, releaseEntry] of entries.entries()) {
    const entity = string(releaseEntry.entity, `entries[${index}].entity`);
    if (entryEntityIds.has(entity)) fail(`aggregate Release entries repeat entity ${entity}`);
    entryEntityIds.add(entity);
    entryTierByEntity.set(entity, string(releaseEntry.release_tier, `entries[${index}].release_tier`));
    if (releaseEntry.entity_role === 'relation') relationEntryIds.add(entity);
  }
  if (entryEntityIds.size !== includedEntities.length || !includedEntities.every((entity) => entryEntityIds.has(entity))) {
    fail('aggregate Release entries and included_entities diverge');
  }

  const manifest = parseJsonArtifact(artifacts, COMPONENT_MANIFEST_NAME);
  const manifestComponents = records(manifest.components, 'component manifest components');
  const manifestIds = manifestComponents.map((component, index) => (
    string(component.release_id, `component manifest components[${index}].release_id`)
  ));
  if (canonicalJson(manifestIds) !== canonicalJson(declaredComponentIds)) {
    fail('component manifest does not match the aggregate Release component_releases');
  }
  const lockComponentIds = entry.components.map((component) => component.release_id);
  if (canonicalJson([...lockComponentIds].sort()) !== canonicalJson([...manifestIds].sort())) {
    fail('aggregate lock component lineage does not match the component manifest');
  }
  const components: ValidatedComponent[] = [];
  for (const lockComponent of entry.components) {
    const manifestEntry = manifestComponents.find((candidate) => candidate.release_id === lockComponent.release_id)!;
    if (manifestEntry.release_version !== lockComponent.release_version
      || manifestEntry.release_hash !== lockComponent.release_hash) {
      fail(`component ${lockComponent.release_id} manifest identity does not match the locked lineage`);
    }
    components.push(await validateComponent(
      root,
      lockComponent,
      manifestEntry,
      entry.source_dataset_hash,
      validators,
    ));
  }

  const projectionName = `${entry.release_version}.projection.json`;
  const projection = parseJsonArtifact(artifacts, projectionName);
  if (!validators.projection(projection)) schemaFailure('aggregate projection', validators.projection.errors);
  if (projection.schema_version !== CTKG_0_2_SCHEMA_VERSION) fail('aggregate projection carries an unadapted Schema version');
  if (projection.id !== entry.projection_id) fail('aggregate projection id does not match lock');
  if (projection.version_digest !== entry.projection_digest) fail('aggregate projection digest does not match lock');
  if (projection.source_release !== release.id) fail('aggregate projection does not close over its source release');
  if (projection.source_release_hash !== release.release_hash) fail('aggregate projection source hash does not match the Release');
  if (projection.source_dataset_hash !== release.source_dataset_hash) {
    fail('aggregate projection source dataset does not match the Release');
  }
  if (projection.lifecycle_status !== 'accepted') fail('aggregate projection lifecycle_status must be accepted');
  string(projection.projection_profile, 'aggregate projection projection_profile');
  const nodes = records(projection.nodes ?? [], 'aggregate projection nodes');
  const links = records(projection.links ?? [], 'aggregate projection links');
  const nodeIds = new Set<string>();
  for (const [index, node] of nodes.entries()) {
    const nodeId = string(node.id, `projection nodes[${index}].id`);
    if (nodeIds.has(nodeId)) fail(`projection repeats node ${nodeId}`);
    nodeIds.add(nodeId);
    const entityId = string(node.entity_id, `projection nodes[${index}].entity_id`);
    if (!entryEntityIds.has(entityId)) fail(`projection node ${nodeId} is outside aggregate membership`);
    if (entryTierByEntity.get(entityId) !== node.release_tier) {
      fail(`projection node ${nodeId} release tier diverges from its Release entry`);
    }
  }
  const linkIds = new Set<string>();
  const linkRelationIds = new Set<string>();
  for (const [index, link] of links.entries()) {
    const linkId = string(link.id, `projection links[${index}].id`);
    if (linkIds.has(linkId)) fail(`projection repeats link ${linkId}`);
    linkIds.add(linkId);
    const relationId = string(link.relation_id, `projection links[${index}].relation_id`);
    if (linkRelationIds.has(relationId)) fail(`projection repeats relation ${relationId}`);
    linkRelationIds.add(relationId);
    if (!relationEntryIds.has(relationId)) fail(`projection link ${linkId} references a relation outside aggregate membership`);
    const sourceId = string(link.source_id, `projection links[${index}].source_id`);
    const targetId = string(link.target_id, `projection links[${index}].target_id`);
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
      fail(`projection link ${linkId} has a missing endpoint`);
    }
    if (sourceId === targetId) fail(`projection link ${linkId} cannot reference itself`);
    const relationFamily = string(link.relation_family, `projection links[${index}].relation_family`);
    if (!vocabulary.relationFamilies.has(relationFamily)) {
      fail(`projection link ${linkId} relation family ${relationFamily} is outside the pinned Schema vocabulary`);
    }
    const relationType = string(link.relation_type, `projection links[${index}].relation_type`);
    const direction = string(link.direction, `projection links[${index}].direction`);
    const pinned: { direction: string; relationFamily: string } | undefined =
      CTKG_0_2_RELATION_SEMANTIC_CONTRACT[relationType as keyof typeof CTKG_0_2_RELATION_SEMANTIC_CONTRACT];
    if (!pinned || pinned.direction !== direction || pinned.relationFamily !== relationFamily) {
      fail(`projection link ${linkId} predicate combination ${relationType}/${direction}/${relationFamily} is outside the pinned CTKG 0.2 contract`);
    }
  }

  const crosswalkName = `${entry.release_version}.rag-crosswalk.jsonl`;
  const crosswalk: CrosswalkRow[] = [];
  const crosswalkTriples = new Set<string>();
  const crosswalkLines = artifactBytes(artifacts, crosswalkName).toString('utf8').split(/\r?\n/u);
  for (const [index, line] of crosswalkLines.entries()) {
    if (!line.trim()) continue;
    const row = object(JSON.parse(line), `crosswalk[${index}]`);
    const keys = Object.keys(row).sort();
    if (canonicalJson(keys) !== canonicalJson(['citation_target_id', 'published_entity_id', 'retrieval_chunk_id'])) {
      fail(`crosswalk[${index}] must carry exactly the three pinned fields`);
    }
    const publishedEntityId = string(row.published_entity_id, `crosswalk[${index}].published_entity_id`);
    const retrievalChunkId = string(row.retrieval_chunk_id, `crosswalk[${index}].retrieval_chunk_id`);
    const citationTargetId = string(row.citation_target_id, `crosswalk[${index}].citation_target_id`);
    const triple = `${publishedEntityId}${retrievalChunkId}${citationTargetId}`;
    if (crosswalkTriples.has(triple)) fail(`crosswalk[${index}] repeats a crosswalk triple`);
    crosswalkTriples.add(triple);
    if (!entryEntityIds.has(publishedEntityId)) {
      fail(`crosswalk[${index}] published entity ${publishedEntityId} is outside aggregate membership`);
    }
    crosswalk.push({ publishedEntityId, retrievalChunkId, citationTargetId });
  }
  if (crosswalk.length === 0) fail('aggregate crosswalk must not be empty');

  assertNoFabricatedLineage(options.lineageClaims);
  return {
    lock,
    entry,
    schema,
    release,
    normalizedReleaseWithoutHash,
    projection,
    entries,
    nodes,
    links,
    crosswalk,
    artifacts,
    components,
    captureRevision,
    lockRawHash,
  };
}

function counts(validated: ValidatedAggregateRelease): AggregateImportCounts {
  return {
    releaseEntries: validated.entries.length,
    projectionNodes: validated.nodes.length,
    projectionLinks: validated.links.length,
    upstreamRagReferences: validated.crosswalk.length,
    artifacts: validated.artifacts.length,
    components: validated.components.length,
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

async function assertExistingReleaseMatches(
  tx: Prisma.TransactionClient,
  validated: ValidatedAggregateRelease,
  result: AggregateImportCounts,
): Promise<void> {
  const releaseId = validated.entry.release_id;
  const existing = await tx.actkgRelease.findUnique({
    where: { id: releaseId },
    include: {
      releaseSet: true,
      receipt: true,
      artifacts: { orderBy: { ordinal: 'asc' } },
      components: { orderBy: { ordinal: 'asc' } },
      entries: { orderBy: { ordinal: 'asc' } },
      projectionNodes: { orderBy: { ordinal: 'asc' } },
      projectionLinks: { orderBy: { ordinal: 'asc' } },
      upstreamRagReferences: { orderBy: { ordinal: 'asc' } },
    },
  });
  if (!existing) fail(`aggregate release identity ${releaseId} is missing during import`);
  const receipt = existing.receipt;
  const drifted = (
    existing.releaseSetId !== validated.lock.release_set_id
    || existing.releaseSet.id !== validated.lock.release_set_id
    || existing.releaseSet.controlledPath !== validated.entry.controlled_path
    || existing.releaseSet.lockVersion !== validated.lock.lock_version
    || existing.releaseSet.candidateState !== 'CANDIDATE'
    || existing.releaseVersion !== validated.entry.release_version
    || existing.protocol !== AGGREGATE_PROTOCOL
    || existing.authority !== AGGREGATE_AUTHORITY
    || existing.scope !== AGGREGATE_SCOPE
    || existing.contractHash !== validated.lock.consumer_contract.schema_raw_sha256
    || existing.releaseHash !== validated.entry.release_hash
    || existing.schemaRawHash !== validated.lock.consumer_contract.schema_raw_sha256
    || existing.releaseRawHash !== sha256(artifactBytes(validated.artifacts, `${validated.entry.release_version}.release.json`))
    || existing.notesRawHash !== sha256(artifactBytes(validated.artifacts, 'RELEASE-NOTES.md'))
    || existing.schemaVersion !== CTKG_0_2_SCHEMA_VERSION
    || existing.upstreamReleaseId !== validated.entry.upstream_release_id
    || existing.projectionId !== validated.entry.projection_id
    || existing.projectionDigest !== validated.entry.projection_digest
    || existing.sourceDatasetHash !== validated.entry.source_dataset_hash
    || existing.upstreamPublicationCommit !== validated.lock.upstream.publication_commit
    || existing.upstreamClosedCommit !== validated.lock.upstream.closed_commit
    || existing.captureRevision !== validated.captureRevision
    || existing.lockRawHash !== validated.lockRawHash
    || !sameJson(
      existing.artifacts.map((row) => ({
        relativePath: row.relativePath,
        mediaType: row.mediaType,
        sha256: row.sha256,
        bytes: Buffer.from(row.bytes).toString('base64'),
      })),
      validated.artifacts.map((artifact) => ({
        relativePath: artifact.relativePath,
        mediaType: artifact.mediaType,
        sha256: artifact.sha256,
        bytes: artifact.bytes.toString('base64'),
      })),
    )
    || existing.artifacts.some((row, ordinal) => (
      row.ordinal !== ordinal
      || row.byteLength !== row.bytes.length
      || sha256(Buffer.from(row.bytes)) !== row.sha256
    ))
    || !sameJson(existing.components.map((row) => row.payload), validated.components.map((row) => row.payload))
    || existing.components.some((row, ordinal) => {
      const component = validated.components[ordinal]!;
      return row.ordinal !== ordinal
        || row.componentReleaseId !== component.componentReleaseId
        || row.releaseVersion !== component.releaseVersion
        || row.protocol !== component.protocol
        || row.controlledPath !== component.controlledPath
        || row.releaseHash !== component.releaseHash
        || row.releaseRawSha256 !== component.releaseRawSha256
        || row.sha256sumsSha256 !== component.sha256sumsSha256;
    })
    || !sameJson(existing.entries.map((row) => row.payload), validated.entries)
    || existing.entries.some((row, ordinal) => {
      const entry = validated.entries[ordinal]!;
      return row.ordinal !== ordinal
        || row.entityId !== entry.entity
        || row.releaseTier !== entry.release_tier
        || row.entityRole !== entry.entity_role
        || row.inclusionReason !== entry.inclusion_reason;
    })
    || !sameJson(existing.projectionNodes.map((row) => row.payload), validated.nodes)
    || existing.projectionNodes.some((row, ordinal) => {
      const node = validated.nodes[ordinal]!;
      return row.ordinal !== ordinal
        || row.nodeId !== node.id
        || row.entityId !== node.entity_id
        || row.entityType !== node.entity_type
        || row.displayName !== node.display_name
        || row.releaseTier !== node.release_tier
        || row.reviewStatus !== node.review_status
        || row.publicationStatus !== node.publication_status
        || row.semanticName !== (typeof node.semantic_name === 'string' ? node.semantic_name : null)
        || row.sourceCoverageCount !== node.source_coverage_count
        || row.candidate !== node.candidate;
    })
    || !sameJson(existing.projectionLinks.map((row) => row.payload), validated.links)
    || existing.projectionLinks.some((row, ordinal) => {
      const link = validated.links[ordinal]!;
      return row.ordinal !== ordinal
        || row.linkId !== link.id
        || row.relationId !== link.relation_id
        || row.sourceId !== link.source_id
        || row.targetId !== link.target_id
        || row.relationType !== link.relation_type
        || row.relationFamily !== link.relation_family
        || row.direction !== link.direction
        || row.evidenceState !== link.evidence_state;
    })
    || !sameJson(
      existing.upstreamRagReferences.map((row) => ({
        publishedEntityId: row.publishedEntityId,
        retrievalChunkId: row.retrievalChunkId,
        citationTargetId: row.citationTargetId,
      })),
      validated.crosswalk,
    )
    || existing.upstreamRagReferences.some((row, ordinal) => row.ordinal !== ordinal)
    || !receipt
    || receipt.releaseSetId !== validated.lock.release_set_id
    || receipt.sourceRun !== null
    || receipt.sourceImplementationCommit !== null
    || receipt.captureRevision !== validated.captureRevision
    || receipt.lockRawHash !== validated.lockRawHash
    || receipt.ctkgDatasetAvailability !== 'UNAVAILABLE'
    || receipt.ctkgDatasetHash !== null
    || receipt.ctkgDatasetPublicationIdentity !== null
    || receipt.ctkgDatasetResolvableLocation !== null
    || receipt.revisionRegistryAvailability !== 'UNAVAILABLE'
    || receipt.revisionRegistryVersion !== null
    || receipt.revisionRegistryHash !== null
    || receipt.objectCount !== 0
    || receipt.sourceMappingCount !== 0
    || receipt.goldRelationCount !== 0
    || receipt.silverRelationCount !== 0
    || receipt.sourceObjectCount !== 0
    || receipt.evidenceSegmentCount !== 0
    || receipt.schemaVersion !== CTKG_0_2_SCHEMA_VERSION
    || receipt.upstreamReleaseId !== validated.entry.upstream_release_id
    || receipt.projectionId !== validated.entry.projection_id
    || receipt.projectionDigest !== validated.entry.projection_digest
    || receipt.sourceDatasetHash !== validated.entry.source_dataset_hash
    || receipt.upstreamPublicationCommit !== validated.lock.upstream.publication_commit
    || receipt.upstreamClosedCommit !== validated.lock.upstream.closed_commit
    || receipt.releaseEntryCount !== result.releaseEntries
    || receipt.projectionNodeCount !== result.projectionNodes
    || receipt.projectionLinkCount !== result.projectionLinks
    || receipt.upstreamRagReferenceCount !== result.upstreamRagReferences
    || receipt.artifactCount !== result.artifacts
    || receipt.componentCount !== result.components
    || receipt.candidateState !== 'CANDIDATE'
  );
  if (drifted) fail(`release identity ${releaseId} already exists with different authoritative content`);
}

export async function importValidatedAggregateRelease(
  db: PrismaClient,
  validated: ValidatedAggregateRelease,
): Promise<AggregateImportCounts> {
  const result = counts(validated);
  const releaseId = validated.entry.release_id;
  await db.$transaction(async (tx) => {
    const existing = await tx.actkgRelease.findUnique({ where: { id: releaseId }, select: { id: true } });
    if (existing) {
      await assertExistingReleaseMatches(tx, validated, result);
      return;
    }

    const releaseSet = await tx.actkgReleaseSet.findUnique({ where: { id: validated.lock.release_set_id } });
    if (releaseSet && (
      releaseSet.controlledPath !== validated.entry.controlled_path
      || releaseSet.lockVersion !== validated.lock.lock_version
      || releaseSet.candidateState !== 'CANDIDATE'
    )) fail('ReleaseSet identity conflicts with the locked candidate');
    if (!releaseSet) {
      await tx.actkgReleaseSet.create({
        data: {
          id: validated.lock.release_set_id,
          controlledPath: validated.entry.controlled_path,
          lockVersion: validated.lock.lock_version,
        },
      });
    }
    await tx.actkgRelease.create({
      data: {
        id: releaseId,
        releaseSetId: validated.lock.release_set_id,
        releaseVersion: validated.entry.release_version,
        releaseStatus: 'RELEASED',
        protocol: AGGREGATE_PROTOCOL,
        authority: AGGREGATE_AUTHORITY,
        scope: AGGREGATE_SCOPE,
        contractHash: validated.lock.consumer_contract.schema_raw_sha256,
        releaseHash: validated.entry.release_hash,
        schemaRawHash: validated.lock.consumer_contract.schema_raw_sha256,
        releaseRawHash: sha256(artifactBytes(validated.artifacts, `${validated.entry.release_version}.release.json`)),
        notesRawHash: sha256(artifactBytes(validated.artifacts, 'RELEASE-NOTES.md')),
        captureRevision: validated.captureRevision,
        lockRawHash: validated.lockRawHash,
        schemaVersion: CTKG_0_2_SCHEMA_VERSION,
        upstreamReleaseId: validated.entry.upstream_release_id,
        projectionId: validated.entry.projection_id,
        projectionDigest: validated.entry.projection_digest,
        sourceDatasetHash: validated.entry.source_dataset_hash,
        upstreamPublicationCommit: validated.lock.upstream.publication_commit,
        upstreamClosedCommit: validated.lock.upstream.closed_commit,
      },
    });
    await tx.actkgReleaseArtifact.createMany({
      data: validated.artifacts.map((artifact, ordinal) => ({
        releaseId,
        relativePath: artifact.relativePath,
        ordinal,
        mediaType: artifact.mediaType,
        sha256: artifact.sha256,
        byteLength: artifact.bytes.length,
        bytes: artifact.bytes,
      })),
    });
    await tx.actkgReleaseComponent.createMany({
      data: validated.components.map((component, ordinal) => ({
        releaseId,
        ordinal,
        componentReleaseId: component.componentReleaseId,
        releaseVersion: component.releaseVersion,
        protocol: component.protocol,
        controlledPath: component.controlledPath,
        releaseHash: component.releaseHash,
        releaseRawSha256: component.releaseRawSha256,
        sha256sumsSha256: component.sha256sumsSha256,
        payload: json(component.payload),
      })),
    });
    await tx.actkgReleaseEntry.createMany({
      data: validated.entries.map((entry, ordinal) => ({
        releaseId,
        entityId: string(entry.entity, 'release entry entity'),
        ordinal,
        releaseTier: string(entry.release_tier, 'release entry release_tier'),
        entityRole: string(entry.entity_role, 'release entry entity_role'),
        inclusionReason: string(entry.inclusion_reason, 'release entry inclusion_reason'),
        payload: json(entry),
      })),
    });
    await tx.actkgProjectionNode.createMany({
      data: validated.nodes.map((node, ordinal) => ({
        releaseId,
        nodeId: string(node.id, 'projection node id'),
        ordinal,
        entityId: string(node.entity_id, 'projection node entity_id'),
        entityType: string(node.entity_type, 'projection node entity_type'),
        displayName: string(node.display_name, 'projection node display_name'),
        releaseTier: string(node.release_tier, 'projection node release_tier'),
        reviewStatus: string(node.review_status, 'projection node review_status'),
        publicationStatus: string(node.publication_status, 'projection node publication_status'),
        semanticName: typeof node.semantic_name === 'string' ? node.semantic_name : null,
        sourceCoverageCount: Number(node.source_coverage_count),
        candidate: node.candidate === true,
        payload: json(node),
      })),
    });
    await tx.actkgProjectionLink.createMany({
      data: validated.links.map((link, ordinal) => ({
        releaseId,
        linkId: string(link.id, 'projection link id'),
        ordinal,
        relationId: string(link.relation_id, 'projection link relation_id'),
        sourceId: string(link.source_id, 'projection link source_id'),
        targetId: string(link.target_id, 'projection link target_id'),
        relationType: string(link.relation_type, 'projection link relation_type'),
        relationFamily: string(link.relation_family, 'projection link relation_family'),
        direction: string(link.direction, 'projection link direction'),
        evidenceState: string(link.evidence_state, 'projection link evidence_state'),
        payload: json(link),
      })),
    });
    await tx.actkgUpstreamRagReference.createMany({
      data: validated.crosswalk.map((row, ordinal) => ({
        releaseId,
        ordinal,
        publishedEntityId: row.publishedEntityId,
        retrievalChunkId: row.retrievalChunkId,
        citationTargetId: row.citationTargetId,
      })),
    });
    await tx.actkgImportReceipt.create({
      data: {
        id: `receipt:${releaseId}`,
        releaseSetId: validated.lock.release_set_id,
        releaseId,
        sourceRun: null,
        sourceImplementationCommit: null,
        captureRevision: validated.captureRevision,
        lockRawHash: validated.lockRawHash,
        ctkgDatasetAvailability: 'UNAVAILABLE',
        revisionRegistryAvailability: 'UNAVAILABLE',
        objectCount: 0,
        sourceMappingCount: 0,
        goldRelationCount: 0,
        silverRelationCount: 0,
        sourceObjectCount: 0,
        evidenceSegmentCount: 0,
        schemaVersion: CTKG_0_2_SCHEMA_VERSION,
        upstreamReleaseId: validated.entry.upstream_release_id,
        projectionId: validated.entry.projection_id,
        projectionDigest: validated.entry.projection_digest,
        sourceDatasetHash: validated.entry.source_dataset_hash,
        upstreamPublicationCommit: validated.lock.upstream.publication_commit,
        upstreamClosedCommit: validated.lock.upstream.closed_commit,
        releaseEntryCount: result.releaseEntries,
        projectionNodeCount: result.projectionNodes,
        projectionLinkCount: result.projectionLinks,
        upstreamRagReferenceCount: result.upstreamRagReferences,
        artifactCount: result.artifacts,
        componentCount: result.components,
      },
    });
  }, { isolationLevel: 'Serializable' });
  return result;
}

export interface ReconstructedAggregateArtifact {
  relativePath: string;
  mediaType: string;
  sha256: string;
  bytes: Buffer;
}

export async function reconstructAggregateArtifacts(
  db: PrismaClient,
  releaseId: string,
): Promise<ReconstructedAggregateArtifact[]> {
  const artifacts = await db.actkgReleaseArtifact.findMany({
    where: { releaseId },
    orderBy: { ordinal: 'asc' },
  });
  if (artifacts.length === 0) fail(`persisted aggregate release ${releaseId} carries no public artifacts`);
  return artifacts.map((row) => {
    const bytes = Buffer.from(row.bytes);
    if (bytes.length !== row.byteLength || sha256(bytes) !== row.sha256) {
      fail(`persisted aggregate artifact ${row.relativePath} fails its recorded hash`);
    }
    return {
      relativePath: row.relativePath,
      mediaType: row.mediaType,
      sha256: row.sha256,
      bytes,
    };
  });
}
