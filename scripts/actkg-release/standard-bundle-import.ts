/**
 * Standard ActKG public Bundle candidate importer.
 *
 * Persistence boundary: accepts only a storage-independent
 * `ValidatedActKGBundle` whose `bundleIdentity.releaseStage` is `stable`.
 * Compatibility inspection may produce candidate-stage objects (for example via
 * an explicit allow-candidate flag), but this importer MUST reject them before
 * any database write. It must not rediscover files, parse Manifests, or fall
 * back to the frozen #1125 exact adapter.
 *
 * Lifecycle inside one Serializable transaction:
 *   stage (STAGED receipt + artifacts + semantic rows)
 *   → full round-trip reconstruction
 *   → single STAGED→ACCEPTED_CANDIDATE transition
 *   → semantic import receipt (content import only)
 */
import { createHash } from 'node:crypto';

import type { Prisma, PrismaClient } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';

import type {
  ProjectionIdentity,
  ProjectionLinkMetadataRow,
  ValidatedActKGBundle,
  ValidatedComponentReference,
  ValidatedRawArtifact,
} from './public-bundle-types';

export const STANDARD_PUBLIC_BUNDLE_PROTOCOL = 'actkg-public-bundle/1';
export const STANDARD_PUBLIC_BUNDLE_AUTHORITY = 'ActKG';
export const STAGED_CANDIDATE_STATE = 'STAGED';
export const ACCEPTED_CANDIDATE_STATE = 'ACCEPTED_CANDIDATE';

const MAX_IMPORT_ATTEMPTS = 8;

export interface StandardBundleImportCounts {
  mode: 'content' | 'packaging' | 'idempotent';
  releaseEntries: number;
  projectionNodes: number;
  projectionLinks: number;
  upstreamRagReferences: number;
  components: number;
  projectionIdentities: number;
  linkMetadataRows: number;
  bundleArtifacts: number;
  bundleId: string;
  bundleRevision: number;
  bundleDigest: string;
  releaseSetId: string;
  releaseId: string;
  candidateState: typeof ACCEPTED_CANDIDATE_STATE;
}

type JsonObject = Record<string, unknown>;
type Tx = PrismaClient | Prisma.TransactionClient;

interface CanonicalLinkMetadata {
  relationId: string;
  releaseTier: string;
  sourceRelease: string;
  sourceReleaseHash: string;
  evidenceRefs: string[];
  sourceComponentRelease?: string;
  targetComponentRelease?: string;
  relationComponentRelease?: string;
  profiles: string[];
  payload: JsonObject;
}

function fail(message: string): never {
  throw new Error(`ActKG standard Bundle import rejected: ${message}`);
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return Object.fromEntries(
      Object.keys(value as JsonObject)
        .sort()
        .map((key) => [key, sortJson((value as JsonObject)[key])]),
    );
  }
  return value;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) fail(`${label} must be an object`);
  return value;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function numberField(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be a finite number`);
  return value;
}

function booleanField(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean`);
  return value;
}

function equalJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

/**
 * Persistence input boundary. Rejects raw directories / Manifests and accepts
 * only a previously validated `ValidatedActKGBundle` shape.
 */
export function assertValidatedActKGBundleInput(input: unknown): ValidatedActKGBundle {
  if (typeof input === 'string' || input instanceof Buffer) {
    fail('persistence stage rejects raw directory paths or bytes; provide ValidatedActKGBundle');
  }
  if (!isObject(input)) fail('persistence stage requires a ValidatedActKGBundle object');

  const captureRevision = stringField(input.captureRevision, 'captureRevision');
  const bundleIdentity = asObject(input.bundleIdentity, 'bundleIdentity');
  const releaseIdentity = asObject(input.releaseIdentity, 'releaseIdentity');
  const releaseSetIdentity = asObject(input.releaseSetIdentity, 'releaseSetIdentity');
  const schemaIdentity = asObject(input.schemaIdentity, 'schemaIdentity');
  const selectedRuntimeProjection = asObject(input.selectedRuntimeProjection, 'selectedRuntimeProjection');
  const selectedIdentity = asObject(selectedRuntimeProjection.identity, 'selectedRuntimeProjection.identity');
  const selectedPayload = asObject(selectedRuntimeProjection.payload, 'selectedRuntimeProjection.payload');
  const preservedProjections = asArray(input.preservedProjections, 'preservedProjections').map((row, index) => {
    const entry = asObject(row, `preservedProjections[${index}]`);
    return {
      identity: asObject(entry.identity, `preservedProjections[${index}].identity`) as unknown as ProjectionIdentity,
      payload: asObject(entry.payload, `preservedProjections[${index}].payload`),
    };
  });
  const rawArtifacts = asArray(input.rawArtifacts, 'rawArtifacts').map((row, index) => {
    const entry = asObject(row, `rawArtifacts[${index}]`);
    const descriptor = asObject(entry.descriptor, `rawArtifacts[${index}].descriptor`);
    const bytes = entry.bytes;
    if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
      fail(`rawArtifacts[${index}].bytes must be a Buffer`);
    }
    return {
      descriptor: {
        role: stringField(descriptor.role, `rawArtifacts[${index}].role`),
        profile: typeof descriptor.profile === 'string' ? descriptor.profile : undefined,
        profiles: Array.isArray(descriptor.profiles)
          ? descriptor.profiles.map((value, profileIndex) => (
            stringField(value, `rawArtifacts[${index}].profiles[${profileIndex}]`)
          ))
          : undefined,
        contractVersion: stringField(descriptor.contractVersion, `rawArtifacts[${index}].contractVersion`),
        required: booleanField(descriptor.required, `rawArtifacts[${index}].required`),
        path: stringField(descriptor.path, `rawArtifacts[${index}].path`),
        mediaType: stringField(descriptor.mediaType, `rawArtifacts[${index}].mediaType`),
        sha256: stringField(descriptor.sha256, `rawArtifacts[${index}].sha256`),
        byteLength: numberField(descriptor.byteLength, `rawArtifacts[${index}].byteLength`),
        recordCount: descriptor.recordCount === null || descriptor.recordCount === undefined
          ? null
          : numberField(descriptor.recordCount, `rawArtifacts[${index}].recordCount`),
        known: booleanField(descriptor.known, `rawArtifacts[${index}].known`),
        semanticsEnabled: booleanField(descriptor.semanticsEnabled, `rawArtifacts[${index}].semanticsEnabled`),
      },
      bytes: Buffer.from(bytes),
    } satisfies ValidatedRawArtifact;
  });

  if (rawArtifacts.length === 0) fail('ValidatedActKGBundle carries no public Artifacts');

  const components = asArray(input.components, 'components') as ValidatedComponentReference[];
  const crosswalk = asArray(input.crosswalk, 'crosswalk').map((row, index) => {
    const entry = asObject(row, `crosswalk[${index}]`);
    return {
      publishedEntityId: stringField(entry.publishedEntityId, `crosswalk[${index}].publishedEntityId`),
      retrievalChunkId: stringField(entry.retrievalChunkId, `crosswalk[${index}].retrievalChunkId`),
      citationTargetId: stringField(entry.citationTargetId, `crosswalk[${index}].citationTargetId`),
    };
  });
  const runtimeLinkMetadata = asArray(input.runtimeLinkMetadata, 'runtimeLinkMetadata');
  const allLinkMetadata = asArray(input.allLinkMetadata, 'allLinkMetadata');
  const statistics = asObject(input.statistics, 'statistics');
  const compatibility = asObject(input.compatibility, 'compatibility');
  const release = asObject(input.release, 'release');
  const schema = asObject(input.schema, 'schema');

  return {
    captureRevision,
    bundleIdentity: {
      bundleId: stringField(bundleIdentity.bundleId, 'bundleIdentity.bundleId'),
      bundleRevision: numberField(bundleIdentity.bundleRevision, 'bundleIdentity.bundleRevision'),
      bundleDigest: stringField(bundleIdentity.bundleDigest, 'bundleIdentity.bundleDigest'),
      bundleKind: stringField(bundleIdentity.bundleKind, 'bundleIdentity.bundleKind') as 'module' | 'integration' | 'aggregate',
      releaseStage: stringField(bundleIdentity.releaseStage, 'bundleIdentity.releaseStage') as 'candidate' | 'stable',
      bundleContractVersion: stringField(bundleIdentity.bundleContractVersion, 'bundleIdentity.bundleContractVersion'),
      controlledPath: stringField(bundleIdentity.controlledPath, 'bundleIdentity.controlledPath'),
      manifestRawSha256: stringField(bundleIdentity.manifestRawSha256, 'bundleIdentity.manifestRawSha256'),
      normalization: stringField(bundleIdentity.normalization, 'bundleIdentity.normalization'),
      publicationTag: stringField(bundleIdentity.publicationTag, 'bundleIdentity.publicationTag'),
      sourceCommit: stringField(bundleIdentity.sourceCommit, 'bundleIdentity.sourceCommit'),
      sourceTag: stringField(bundleIdentity.sourceTag, 'bundleIdentity.sourceTag'),
    },
    releaseIdentity: {
      releaseId: stringField(releaseIdentity.releaseId, 'releaseIdentity.releaseId'),
      releaseVersion: stringField(releaseIdentity.releaseVersion, 'releaseIdentity.releaseVersion'),
      releaseHash: stringField(releaseIdentity.releaseHash, 'releaseIdentity.releaseHash'),
      sourceDatasetHash: stringField(releaseIdentity.sourceDatasetHash, 'releaseIdentity.sourceDatasetHash'),
    },
    releaseSetIdentity: {
      releaseSetId: stringField(releaseSetIdentity.releaseSetId, 'releaseSetIdentity.releaseSetId'),
      lockVersion: stringField(releaseSetIdentity.lockVersion, 'releaseSetIdentity.lockVersion') as 'actkg-release-set-lock/v3',
      lockPath: stringField(releaseSetIdentity.lockPath, 'releaseSetIdentity.lockPath'),
      lockRawSha256: stringField(releaseSetIdentity.lockRawSha256, 'releaseSetIdentity.lockRawSha256'),
    },
    schemaIdentity: {
      version: stringField(schemaIdentity.version, 'schemaIdentity.version'),
      rawSha256: stringField(schemaIdentity.rawSha256, 'schemaIdentity.rawSha256'),
    },
    selectedRuntimeProjection: {
      identity: selectedIdentity as unknown as ProjectionIdentity,
      payload: selectedPayload,
    },
    preservedProjections,
    runtimeLinkMetadata: runtimeLinkMetadata as ValidatedActKGBundle['runtimeLinkMetadata'],
    allLinkMetadata: allLinkMetadata as ValidatedActKGBundle['allLinkMetadata'],
    crosswalk,
    components,
    rawArtifacts,
    release,
    schema,
    statistics: statistics as ValidatedActKGBundle['statistics'],
    compatibility: {
      code: stringField(compatibility.code, 'compatibility.code') as ValidatedActKGBundle['compatibility']['code'],
      reasons: asArray(compatibility.reasons, 'compatibility.reasons').map((reason, index) => (
        stringField(reason, `compatibility.reasons[${index}]`)
      )),
      matchedIdentities: asArray(compatibility.matchedIdentities, 'compatibility.matchedIdentities') as ValidatedActKGBundle['compatibility']['matchedIdentities'],
    },
    unknownOptionalArtifacts: asArray(
      input.unknownOptionalArtifacts,
      'unknownOptionalArtifacts',
    ) as ValidatedActKGBundle['unknownOptionalArtifacts'],
  };
}

function artifactByRole(validated: ValidatedActKGBundle, role: string): ValidatedRawArtifact {
  const match = validated.rawArtifacts.find((artifact) => artifact.descriptor.role === role);
  if (!match) fail(`validated Bundle is missing required Artifact role ${role}`);
  return match;
}

function normalizeProfileLabel(profile: string): string {
  const lower = profile.toLowerCase();
  if (lower.includes('runtime') || lower.includes(':act-') || lower.endsWith(':act-v2') || lower === 'runtime') {
    return 'runtime';
  }
  if (lower.includes('domain') || lower === 'domain') return 'domain';
  if (lower.includes('review') || lower === 'review') return 'review';
  return profile;
}

function releaseEntries(validated: ValidatedActKGBundle): JsonObject[] {
  return asArray(validated.release.entries, 'release.entries').map((entry, index) => (
    asObject(entry, `release.entries[${index}]`)
  ));
}

function projectionNodes(payload: JsonObject): JsonObject[] {
  return asArray(payload.nodes, 'projection.nodes').map((node, index) => (
    asObject(node, `projection.nodes[${index}]`)
  ));
}

function projectionLinks(payload: JsonObject): JsonObject[] {
  return asArray(payload.links, 'projection.links').map((link, index) => (
    asObject(link, `projection.links[${index}]`)
  ));
}

/**
 * Collapse allLinkMetadata groups into a unique relationId set.
 * Duplicate relationIds must be canonically identical; profiles are merged.
 */
export function canonicalizeAllLinkMetadata(
  validated: ValidatedActKGBundle,
): CanonicalLinkMetadata[] {
  const byRelation = new Map<string, CanonicalLinkMetadata>();
  for (const group of validated.allLinkMetadata) {
    const profiles = [...group.profiles].map(String).sort();
    for (const row of group.rows) {
      const evidenceRefs = [...row.evidenceRefs].map(String).sort();
      const next: CanonicalLinkMetadata = {
        relationId: row.relationId,
        releaseTier: row.releaseTier,
        sourceRelease: row.sourceRelease,
        sourceReleaseHash: row.sourceReleaseHash,
        evidenceRefs,
        sourceComponentRelease: row.sourceComponentRelease,
        targetComponentRelease: row.targetComponentRelease,
        relationComponentRelease: row.relationComponentRelease,
        profiles,
        payload: row.payload,
      };
      const existing = byRelation.get(row.relationId);
      if (!existing) {
        byRelation.set(row.relationId, next);
        continue;
      }
      const existingWithoutProfiles = { ...existing, profiles: [] as string[] };
      const nextWithoutProfiles = { ...next, profiles: [] as string[] };
      if (!equalJson(existingWithoutProfiles, nextWithoutProfiles)) {
        fail(`Link Metadata relationId ${row.relationId} has conflicting canonical content across profile groups`);
      }
      existing.profiles = [...new Set([...existing.profiles, ...profiles])].sort();
    }
  }
  return [...byRelation.values()].sort((left, right) => left.relationId.localeCompare(right.relationId));
}

/**
 * Unique Projection identities to persist. The compatibility layer may list the
 * selected runtime Projection again under preservedProjections; persist one row
 * per projectionId with isRuntime=true for the selected runtime.
 */
export function uniqueProjectionIdentityRows(
  validated: ValidatedActKGBundle,
): Array<{ identity: ProjectionIdentity; isRuntime: boolean }> {
  const byId = new Map<string, { identity: ProjectionIdentity; isRuntime: boolean }>();
  for (const entry of validated.preservedProjections) {
    byId.set(entry.identity.projectionId, {
      identity: entry.identity,
      isRuntime: false,
    });
  }
  // Selected runtime wins the isRuntime flag when it also appears in preserved.
  byId.set(validated.selectedRuntimeProjection.identity.projectionId, {
    identity: validated.selectedRuntimeProjection.identity,
    isRuntime: true,
  });
  return [...byId.values()];
}

function countsOf(validated: ValidatedActKGBundle, linkMetadataRows: number): Omit<
  StandardBundleImportCounts,
  'mode' | 'bundleId' | 'bundleRevision' | 'bundleDigest' | 'releaseSetId' | 'releaseId' | 'candidateState'
> {
  const runtimeNodes = projectionNodes(validated.selectedRuntimeProjection.payload);
  const runtimeLinks = projectionLinks(validated.selectedRuntimeProjection.payload);
  return {
    releaseEntries: releaseEntries(validated).length,
    projectionNodes: runtimeNodes.length,
    projectionLinks: runtimeLinks.length,
    upstreamRagReferences: validated.crosswalk.length,
    components: validated.components.length,
    projectionIdentities: uniqueProjectionIdentityRows(validated).length,
    linkMetadataRows,
    bundleArtifacts: validated.rawArtifacts.length,
  };
}

function receiptIdFor(validated: ValidatedActKGBundle): string {
  return `bundle-receipt:${validated.bundleIdentity.bundleDigest}`;
}

function importReceiptIdFor(releaseId: string): string {
  return `receipt:${releaseId}`;
}

function componentProtocol(component: ValidatedComponentReference): string {
  return component.referenceKind === 'standard_bundle'
    ? 'standard_bundle'
    : 'legacy_exact';
}

function isRetryableConflict(error: unknown): boolean {
  if (error instanceof PrismaNamespace.PrismaClientKnownRequestError) {
    return error.code === 'P2002' || error.code === 'P2034' || error.code === 'P2028';
  }
  const message = error instanceof Error ? error.message : String(error);
  return /could not serialize|write conflict|deadlock|unique constraint|P2002|P2034/iu.test(message);
}

/**
 * Derive a stable pair of signed int32 keys for pg_advisory_xact_lock(int, int).
 * Exported for unit tests; runtime locking uses Postgres hashtext on bound params.
 */
export function advisoryLockKeys(namespace: string, identity: string): readonly [number, number] {
  const digest = createHash('sha256')
    .update('actkg-standard-import\0')
    .update(namespace)
    .update('\0')
    .update(identity)
    .digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)] as const;
}

/**
 * Serialize concurrent imports that share a Release and/or Bundle identity.
 *
 * Lock order is fixed (release → bundle) to avoid deadlocks when one worker
 * imports content while another imports a packaging revision of the same Release.
 * pg_advisory_xact_lock is held until transaction end (commit or rollback).
 *
 * Must be acquired BEFORE reading existingRelease / staging semantic rows so
 * concurrent first-content imports cannot both observe "release missing".
 *
 * Uses Postgres hashtext() over bound text parameters so the lock token is
 * computed server-side and never requires client int binding edge cases.
 */
async function acquireImportLocks(tx: Tx, validated: ValidatedActKGBundle): Promise<void> {
  const releaseToken = `actkg-standard-import:release:${validated.releaseIdentity.releaseId}`;
  const bundleToken = `actkg-standard-import:bundle:${validated.bundleIdentity.bundleDigest}`;
  // Bound text parameters only — no string concatenation into SQL.
  // hashtext returns int4; cast void advisory result for Prisma deserialization.
  await tx.$queryRaw`
    SELECT (pg_advisory_xact_lock(hashtext(${releaseToken})) IS NULL) AS "acquired"
  `;
  await tx.$queryRaw`
    SELECT (pg_advisory_xact_lock(hashtext(${bundleToken})) IS NULL) AS "acquired"
  `;
}

function resultShape(
  validated: ValidatedActKGBundle,
  mode: StandardBundleImportCounts['mode'],
  linkMetadataRows: number,
): StandardBundleImportCounts {
  return {
    mode,
    ...countsOf(validated, linkMetadataRows),
    bundleId: validated.bundleIdentity.bundleId,
    bundleRevision: validated.bundleIdentity.bundleRevision,
    bundleDigest: validated.bundleIdentity.bundleDigest,
    releaseSetId: validated.releaseSetIdentity.releaseSetId,
    releaseId: validated.releaseIdentity.releaseId,
    candidateState: ACCEPTED_CANDIDATE_STATE,
  };
}

async function assertExistingSemanticMatches(
  tx: Tx,
  validated: ValidatedActKGBundle,
  linkMetadataRows: number,
): Promise<void> {
  const releaseId = validated.releaseIdentity.releaseId;
  const release = await tx.actkgRelease.findUnique({ where: { id: releaseId } });
  if (!release) fail(`semantic Release ${releaseId} is missing during packaging revision`);
  if (release.releaseSetId !== validated.releaseSetIdentity.releaseSetId) {
    fail('ReleaseSet identity conflicts with the existing semantic Release');
  }
  if (release.releaseHash !== validated.releaseIdentity.releaseHash) {
    fail('reused Release identity carries a different release hash');
  }
  if (release.sourceDatasetHash !== validated.releaseIdentity.sourceDatasetHash) {
    fail('reused Release identity carries a different source dataset hash');
  }
  if (release.protocol !== STANDARD_PUBLIC_BUNDLE_PROTOCOL) {
    fail('existing Release is not a standard public Bundle candidate');
  }
  if (release.projectionDigest !== validated.selectedRuntimeProjection.identity.versionDigest) {
    fail('reused Release runtime Projection digest conflicts');
  }
  if (release.schemaRawHash !== validated.schemaIdentity.rawSha256) {
    fail('reused Release Schema hash conflicts');
  }

  const expected = countsOf(validated, linkMetadataRows);
  const actual = {
    releaseEntries: await tx.actkgReleaseEntry.count({ where: { releaseId } }),
    projectionNodes: await tx.actkgProjectionNode.count({ where: { releaseId } }),
    projectionLinks: await tx.actkgProjectionLink.count({ where: { releaseId } }),
    upstreamRagReferences: await tx.actkgUpstreamRagReference.count({ where: { releaseId } }),
    components: await tx.actkgReleaseComponent.count({ where: { releaseId } }),
    projectionIdentities: await tx.actkgProjectionIdentity.count({ where: { releaseId } }),
    linkMetadataRows: await tx.actkgProjectionLinkMetadata.count({ where: { releaseId } }),
  };
  for (const key of Object.keys(actual) as Array<keyof typeof actual>) {
    if (actual[key] !== expected[key]) {
      fail(`packaging revision semantic count mismatch on ${key}: expected ${expected[key]}, actual ${actual[key]}`);
    }
  }

  const identities = await tx.actkgProjectionIdentity.findMany({
    where: { releaseId },
    orderBy: { ordinal: 'asc' },
  });
  const expectedIdentities = uniqueProjectionIdentityRows(validated);
  if (identities.length !== expectedIdentities.length) {
    fail('packaging revision Projection identity count mismatch');
  }
  for (const expected of expectedIdentities) {
    const row = identities.find((identity) => identity.projectionId === expected.identity.projectionId);
    if (!row || row.versionDigest !== expected.identity.versionDigest) {
      fail(`packaging revision Projection identity digest conflict for ${expected.identity.projectionId}`);
    }
  }
}

async function assertIdempotentBundleMatches(
  tx: Tx,
  validated: ValidatedActKGBundle,
  linkMetadataRows: number,
): Promise<StandardBundleImportCounts> {
  const existing = await tx.actkgBundleReceipt.findUnique({
    where: { bundleDigest: validated.bundleIdentity.bundleDigest },
  });
  if (!existing) fail('idempotent lookup missed an existing Bundle receipt');
  if (existing.candidateState !== ACCEPTED_CANDIDATE_STATE) {
    fail('existing Bundle receipt is not ACCEPTED_CANDIDATE');
  }
  if (
    existing.bundleId !== validated.bundleIdentity.bundleId
    || existing.bundleRevision !== validated.bundleIdentity.bundleRevision
    || existing.releaseId !== validated.releaseIdentity.releaseId
    || existing.releaseSetId !== validated.releaseSetIdentity.releaseSetId
    || existing.releaseHash !== validated.releaseIdentity.releaseHash
    || existing.artifactCount !== validated.rawArtifacts.length
  ) {
    fail('identical Bundle digest already exists with conflicting identity');
  }

  const reconstructed = await reconstructBundleArtifacts(tx, existing.id);
  if (reconstructed.length !== validated.rawArtifacts.length) {
    fail('idempotent Bundle Artifact count mismatch');
  }
  const expected = new Map(validated.rawArtifacts.map((artifact) => [artifact.descriptor.path, artifact]));
  for (const artifact of reconstructed) {
    const original = expected.get(artifact.relativePath);
    if (
      !original
      || artifact.sha256 !== original.descriptor.sha256
      || !artifact.bytes.equals(original.bytes)
      || artifact.role !== original.descriptor.role
      || artifact.contractVersion !== original.descriptor.contractVersion
      || artifact.byteLength !== original.descriptor.byteLength
      || artifact.required !== original.descriptor.required
    ) {
      fail(`idempotent Bundle Artifact mismatch for ${artifact.relativePath}`);
    }
  }

  return resultShape(validated, 'idempotent', linkMetadataRows);
}

async function stageReleaseSet(tx: Tx, validated: ValidatedActKGBundle): Promise<void> {
  const releaseSetId = validated.releaseSetIdentity.releaseSetId;
  const existing = await tx.actkgReleaseSet.findUnique({ where: { id: releaseSetId } });
  if (existing) {
    if (
      existing.controlledPath !== validated.bundleIdentity.controlledPath
      || existing.lockVersion !== validated.releaseSetIdentity.lockVersion
      || existing.candidateState !== 'CANDIDATE'
    ) {
      fail('ReleaseSet identity conflicts with the locked standard candidate');
    }
    return;
  }
  await tx.actkgReleaseSet.create({
    data: {
      id: releaseSetId,
      controlledPath: validated.bundleIdentity.controlledPath,
      lockVersion: validated.releaseSetIdentity.lockVersion,
      candidateState: 'CANDIDATE',
    },
  });
}

async function stageSemanticRelease(tx: Tx, validated: ValidatedActKGBundle): Promise<void> {
  const releaseId = validated.releaseIdentity.releaseId;
  const releaseArtifact = artifactByRole(validated, 'release');
  const notesArtifact = artifactByRole(validated, 'release_notes');
  const runtime = validated.selectedRuntimeProjection;
  const entries = releaseEntries(validated);
  const nodes = projectionNodes(runtime.payload);
  const links = projectionLinks(runtime.payload);

  await tx.actkgRelease.create({
    data: {
      id: releaseId,
      releaseSetId: validated.releaseSetIdentity.releaseSetId,
      releaseVersion: validated.releaseIdentity.releaseVersion,
      releaseStatus: 'RELEASED',
      protocol: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      authority: STANDARD_PUBLIC_BUNDLE_AUTHORITY,
      scope: validated.releaseIdentity.releaseVersion.replace(/-v[\d.]+$/u, '') || validated.releaseIdentity.releaseVersion,
      contractHash: validated.schemaIdentity.rawSha256,
      releaseHash: validated.releaseIdentity.releaseHash,
      schemaRawHash: validated.schemaIdentity.rawSha256,
      releaseRawHash: releaseArtifact.descriptor.sha256,
      notesRawHash: notesArtifact.descriptor.sha256,
      captureRevision: validated.captureRevision,
      lockRawHash: validated.releaseSetIdentity.lockRawSha256,
      schemaVersion: validated.schemaIdentity.version,
      upstreamReleaseId: validated.releaseIdentity.releaseId,
      projectionId: runtime.identity.projectionId,
      projectionDigest: runtime.identity.versionDigest,
      sourceDatasetHash: validated.releaseIdentity.sourceDatasetHash,
      upstreamPublicationCommit: validated.bundleIdentity.sourceCommit,
      upstreamClosedCommit: null,
    },
  });

  await tx.actkgReleaseComponent.createMany({
    data: validated.components.map((component, ordinal) => ({
      releaseId,
      ordinal,
      componentReleaseId: component.releaseId,
      releaseVersion: component.releaseVersion,
      protocol: componentProtocol(component),
      controlledPath: component.controlledPath,
      releaseHash: component.releaseHash,
      releaseRawSha256: component.releaseRawSha256 ?? null,
      sha256sumsSha256: null,
      referenceKind: component.referenceKind,
      componentRole: component.componentRole,
      componentBundleId: component.bundleId ?? null,
      componentBundleDigest: component.bundleDigest ?? null,
      componentManifestSha256: component.manifestSha256 ?? null,
      payload: json(component),
    })),
  });

  await tx.actkgReleaseEntry.createMany({
    data: entries.map((entry, ordinal) => ({
      releaseId,
      entityId: stringField(entry.entity, `release.entries[${ordinal}].entity`),
      ordinal,
      releaseTier: stringField(entry.release_tier, `release.entries[${ordinal}].release_tier`),
      entityRole: stringField(entry.entity_role, `release.entries[${ordinal}].entity_role`),
      inclusionReason: stringField(entry.inclusion_reason, `release.entries[${ordinal}].inclusion_reason`),
      payload: json(entry),
    })),
  });

  await tx.actkgProjectionNode.createMany({
    data: nodes.map((node, ordinal) => ({
      releaseId,
      nodeId: stringField(node.id, `projection.nodes[${ordinal}].id`),
      ordinal,
      entityId: stringField(node.entity_id, `projection.nodes[${ordinal}].entity_id`),
      entityType: stringField(node.entity_type, `projection.nodes[${ordinal}].entity_type`),
      displayName: stringField(node.display_name, `projection.nodes[${ordinal}].display_name`),
      releaseTier: stringField(node.release_tier, `projection.nodes[${ordinal}].release_tier`),
      reviewStatus: stringField(node.review_status, `projection.nodes[${ordinal}].review_status`),
      publicationStatus: stringField(node.publication_status, `projection.nodes[${ordinal}].publication_status`),
      semanticName: typeof node.semantic_name === 'string' ? node.semantic_name : null,
      sourceCoverageCount: numberField(node.source_coverage_count, `projection.nodes[${ordinal}].source_coverage_count`),
      candidate: node.candidate === true,
      payload: json(node),
    })),
  });

  await tx.actkgProjectionLink.createMany({
    data: links.map((link, ordinal) => ({
      releaseId,
      linkId: stringField(link.id, `projection.links[${ordinal}].id`),
      ordinal,
      relationId: stringField(link.relation_id, `projection.links[${ordinal}].relation_id`),
      sourceId: stringField(link.source_id, `projection.links[${ordinal}].source_id`),
      targetId: stringField(link.target_id, `projection.links[${ordinal}].target_id`),
      relationType: stringField(link.relation_type, `projection.links[${ordinal}].relation_type`),
      relationFamily: stringField(link.relation_family, `projection.links[${ordinal}].relation_family`),
      direction: stringField(link.direction, `projection.links[${ordinal}].direction`),
      evidenceState: stringField(link.evidence_state, `projection.links[${ordinal}].evidence_state`),
      payload: json(link),
    })),
  });

  if (validated.crosswalk.length > 0) {
    await tx.actkgUpstreamRagReference.createMany({
      data: validated.crosswalk.map((row, ordinal) => ({
        releaseId,
        ordinal,
        publishedEntityId: row.publishedEntityId,
        retrievalChunkId: row.retrievalChunkId,
        citationTargetId: row.citationTargetId,
      })),
    });
  }
}

async function stageProjectionIdentitiesAndMetadata(
  tx: Tx,
  validated: ValidatedActKGBundle,
  linkMetadata: CanonicalLinkMetadata[],
): Promise<void> {
  const releaseId = validated.releaseIdentity.releaseId;
  // Projection identities are semantic release facts, not packaging ownership.
  // bundleReceiptId stays null so packaging revisions do not rebind them.
  // Deduplicate projectionId — runtime may also appear in preservedProjections.
  const projectionRows = uniqueProjectionIdentityRows(validated);
  await tx.actkgProjectionIdentity.createMany({
    data: projectionRows.map((row, ordinal) => ({
      releaseId,
      projectionId: row.identity.projectionId,
      ordinal,
      profile: normalizeProfileLabel(row.identity.profile || row.identity.projectionProfile),
      projectionProfile: row.identity.projectionProfile,
      versionDigest: row.identity.versionDigest,
      sourceRelease: row.identity.sourceRelease,
      sourceReleaseHash: row.identity.sourceReleaseHash,
      sourceDatasetHash: row.identity.sourceDatasetHash,
      nodeCount: row.identity.nodeCount,
      linkCount: row.identity.linkCount,
      artifactPath: row.identity.artifactPath,
      artifactSha256: row.identity.artifactSha256,
      isRuntime: row.isRuntime,
      bundleReceiptId: null,
    })),
  });

  if (linkMetadata.length > 0) {
    await tx.actkgProjectionLinkMetadata.createMany({
      data: linkMetadata.map((row, ordinal) => ({
        releaseId,
        relationId: row.relationId,
        ordinal,
        releaseTier: row.releaseTier,
        sourceRelease: row.sourceRelease,
        sourceReleaseHash: row.sourceReleaseHash,
        evidenceRefs: json(row.evidenceRefs),
        sourceComponentRelease: row.sourceComponentRelease ?? null,
        targetComponentRelease: row.targetComponentRelease ?? null,
        relationComponentRelease: row.relationComponentRelease ?? null,
        profiles: json(row.profiles),
        payload: json(row.payload),
        bundleReceiptId: null,
      })),
    });
  }
}

async function stageBundleReceiptAndArtifacts(
  tx: Tx,
  validated: ValidatedActKGBundle,
): Promise<string> {
  const id = receiptIdFor(validated);
  const conflictRevision = await tx.actkgBundleReceipt.findUnique({
    where: {
      bundleId_bundleRevision: {
        bundleId: validated.bundleIdentity.bundleId,
        bundleRevision: validated.bundleIdentity.bundleRevision,
      },
    },
  });
  if (conflictRevision && conflictRevision.bundleDigest !== validated.bundleIdentity.bundleDigest) {
    fail('reused Bundle identity carries a different digest');
  }
  if (conflictRevision?.candidateState === ACCEPTED_CANDIDATE_STATE) {
    fail('reused Bundle identity already accepted with a different digest path');
  }

  await tx.actkgBundleReceipt.create({
    data: {
      id,
      bundleId: validated.bundleIdentity.bundleId,
      bundleRevision: validated.bundleIdentity.bundleRevision,
      bundleDigest: validated.bundleIdentity.bundleDigest,
      bundleKind: validated.bundleIdentity.bundleKind,
      releaseStage: validated.bundleIdentity.releaseStage,
      bundleContractVersion: validated.bundleIdentity.bundleContractVersion,
      controlledPath: validated.bundleIdentity.controlledPath,
      manifestRawSha256: validated.bundleIdentity.manifestRawSha256,
      normalization: validated.bundleIdentity.normalization,
      publicationTag: validated.bundleIdentity.publicationTag,
      sourceCommit: validated.bundleIdentity.sourceCommit,
      sourceTag: validated.bundleIdentity.sourceTag,
      releaseSetId: validated.releaseSetIdentity.releaseSetId,
      releaseId: validated.releaseIdentity.releaseId,
      releaseHash: validated.releaseIdentity.releaseHash,
      sourceDatasetHash: validated.releaseIdentity.sourceDatasetHash,
      schemaVersion: validated.schemaIdentity.version,
      schemaRawSha256: validated.schemaIdentity.rawSha256,
      lockVersion: validated.releaseSetIdentity.lockVersion,
      lockPath: validated.releaseSetIdentity.lockPath,
      lockRawSha256: validated.releaseSetIdentity.lockRawSha256,
      captureRevision: validated.captureRevision,
      candidateState: STAGED_CANDIDATE_STATE,
      compatibilityCode: validated.compatibility.code,
      runtimeProjectionId: validated.selectedRuntimeProjection.identity.projectionId,
      runtimeProjectionProfile: validated.selectedRuntimeProjection.identity.projectionProfile,
      runtimeProjectionDigest: validated.selectedRuntimeProjection.identity.versionDigest,
      artifactCount: validated.rawArtifacts.length,
      statistics: json(validated.statistics),
    },
  });

  await tx.actkgBundleArtifact.createMany({
    data: validated.rawArtifacts.map((artifact, ordinal) => ({
      bundleReceiptId: id,
      relativePath: artifact.descriptor.path,
      ordinal,
      mediaType: artifact.descriptor.mediaType,
      sha256: artifact.descriptor.sha256,
      byteLength: artifact.descriptor.byteLength,
      bytes: artifact.bytes,
      role: artifact.descriptor.role,
      profile: artifact.descriptor.profile ?? null,
      profiles: artifact.descriptor.profiles ? json(artifact.descriptor.profiles) : undefined,
      contractVersion: artifact.descriptor.contractVersion,
      required: artifact.descriptor.required,
      recordCount: artifact.descriptor.recordCount,
    })),
  });

  return id;
}

/**
 * Next acceptance timestamp for packaging evidence of one Release.
 *
 * Must be strictly greater than any already-ACCEPTED receipt for that Release so
 * `importedAt desc` proves real acceptance order. Wall-clock alone can collide at
 * the same millisecond under concurrent or sequential-fast imports; under the
 * release advisory lock we serialize accepts and advance by at least +1ms.
 */
export function nextStrictAcceptanceTimestamp(
  previousAcceptedImportedAt: Date | null | undefined,
  now: Date = new Date(),
): Date {
  if (!previousAcceptedImportedAt) return now;
  const previousMs = previousAcceptedImportedAt.getTime();
  if (!Number.isFinite(previousMs)) {
    fail('previous ACCEPTED_CANDIDATE importedAt is not a finite timestamp');
  }
  return new Date(Math.max(now.getTime(), previousMs + 1));
}

async function acceptBundleReceipt(
  tx: Tx,
  bundleReceiptId: string,
  releaseId: string,
  now: Date = new Date(),
): Promise<void> {
  // Under acquireImportLocks(release) + Serializable: read max ACCEPTED importedAt
  // for this Release and stamp a strictly greater acceptance time.
  const latestAccepted = await tx.actkgBundleReceipt.findFirst({
    where: {
      releaseId,
      candidateState: ACCEPTED_CANDIDATE_STATE,
    },
    orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
    select: { importedAt: true },
  });
  const importedAt = nextStrictAcceptanceTimestamp(latestAccepted?.importedAt, now);

  const updated = await tx.actkgBundleReceipt.updateMany({
    where: {
      id: bundleReceiptId,
      candidateState: STAGED_CANDIDATE_STATE,
    },
    data: {
      candidateState: ACCEPTED_CANDIDATE_STATE,
      importedAt,
    },
  });
  if (updated.count !== 1) {
    fail('STAGED→ACCEPTED_CANDIDATE transition failed');
  }
}

async function stageImportReceipt(
  tx: Tx,
  validated: ValidatedActKGBundle,
  counts: ReturnType<typeof countsOf>,
): Promise<void> {
  const releaseId = validated.releaseIdentity.releaseId;
  const existing = await tx.actkgImportReceipt.findUnique({ where: { releaseId } });
  if (existing) {
    // Semantic import receipt is written once. Packaging revisions must not
    // rebind its packaging-specific fields or artifact count.
    if (
      existing.releaseSetId !== validated.releaseSetIdentity.releaseSetId
      || existing.releaseId !== releaseId
      || existing.candidateState !== ACCEPTED_CANDIDATE_STATE
      || existing.projectionDigest !== validated.selectedRuntimeProjection.identity.versionDigest
      || existing.releaseEntryCount !== counts.releaseEntries
      || existing.projectionNodeCount !== counts.projectionNodes
      || existing.projectionLinkCount !== counts.projectionLinks
      || existing.upstreamRagReferenceCount !== counts.upstreamRagReferences
      || existing.componentCount !== counts.components
    ) {
      fail('existing import receipt conflicts with the validated Bundle');
    }
    return;
  }

  await tx.actkgImportReceipt.create({
    data: {
      id: importReceiptIdFor(releaseId),
      releaseSetId: validated.releaseSetIdentity.releaseSetId,
      releaseId,
      sourceRun: null,
      sourceImplementationCommit: null,
      captureRevision: validated.captureRevision,
      lockRawHash: validated.releaseSetIdentity.lockRawSha256,
      ctkgDatasetAvailability: 'UNAVAILABLE',
      revisionRegistryAvailability: 'UNAVAILABLE',
      objectCount: 0,
      sourceMappingCount: 0,
      goldRelationCount: 0,
      silverRelationCount: 0,
      sourceObjectCount: 0,
      evidenceSegmentCount: 0,
      candidateState: ACCEPTED_CANDIDATE_STATE,
      schemaVersion: validated.schemaIdentity.version,
      upstreamReleaseId: validated.releaseIdentity.releaseId,
      projectionId: validated.selectedRuntimeProjection.identity.projectionId,
      projectionDigest: validated.selectedRuntimeProjection.identity.versionDigest,
      sourceDatasetHash: validated.releaseIdentity.sourceDatasetHash,
      upstreamPublicationCommit: validated.bundleIdentity.sourceCommit,
      upstreamClosedCommit: null,
      releaseEntryCount: counts.releaseEntries,
      projectionNodeCount: counts.projectionNodes,
      projectionLinkCount: counts.projectionLinks,
      upstreamRagReferenceCount: counts.upstreamRagReferences,
      // Semantic receipt records packaging-independent semantic component count.
      // Packaging Artifact counts live on ActkgBundleReceipt.artifactCount.
      artifactCount: null,
      componentCount: counts.components,
      bundleContractVersion: validated.bundleIdentity.bundleContractVersion,
      bundleId: null,
      bundleRevision: null,
      bundleDigest: null,
      bundleKind: validated.bundleIdentity.bundleKind,
      releaseStage: validated.bundleIdentity.releaseStage,
      manifestRawSha256: null,
      schemaContractVersion: validated.schemaIdentity.version,
    },
  });
}

export interface ReconstructedBundleArtifact {
  relativePath: string;
  mediaType: string;
  sha256: string;
  bytes: Buffer;
  role: string;
  profile: string | null;
  contractVersion: string;
  required: boolean;
  recordCount: number | null;
  byteLength: number;
}

export async function reconstructBundleArtifacts(
  db: Tx,
  bundleReceiptId: string,
): Promise<ReconstructedBundleArtifact[]> {
  const artifacts = await db.actkgBundleArtifact.findMany({
    where: { bundleReceiptId },
    orderBy: { ordinal: 'asc' },
  });
  if (artifacts.length === 0) fail(`Bundle receipt ${bundleReceiptId} carries no public Artifacts`);
  return artifacts.map((row) => {
    const bytes = Buffer.from(row.bytes);
    if (bytes.length !== row.byteLength || sha256(bytes) !== row.sha256) {
      fail(`persisted Bundle Artifact ${row.relativePath} fails its recorded hash`);
    }
    return {
      relativePath: row.relativePath,
      mediaType: row.mediaType,
      sha256: row.sha256,
      bytes,
      role: row.role,
      profile: row.profile,
      contractVersion: row.contractVersion,
      required: row.required,
      recordCount: row.recordCount,
      byteLength: row.byteLength,
    };
  });
}

async function roundTripVerify(
  tx: Tx,
  validated: ValidatedActKGBundle,
  bundleReceiptId: string,
  linkMetadata: CanonicalLinkMetadata[],
): Promise<void> {
  const releaseId = validated.releaseIdentity.releaseId;
  const reconstructed = await reconstructBundleArtifacts(tx, bundleReceiptId);
  const expectedArtifacts = new Map(
    validated.rawArtifacts.map((artifact) => [artifact.descriptor.path, artifact]),
  );
  if (reconstructed.length !== expectedArtifacts.size) {
    fail('round-trip Artifact count mismatch');
  }
  for (const artifact of reconstructed) {
    const original = expectedArtifacts.get(artifact.relativePath);
    if (
      !original
      || artifact.sha256 !== original.descriptor.sha256
      || artifact.byteLength !== original.descriptor.byteLength
      || !artifact.bytes.equals(original.bytes)
      || artifact.role !== original.descriptor.role
      || artifact.profile !== (original.descriptor.profile ?? null)
      || artifact.contractVersion !== original.descriptor.contractVersion
      || artifact.required !== original.descriptor.required
      || artifact.recordCount !== original.descriptor.recordCount
      || artifact.mediaType !== original.descriptor.mediaType
      || sha256(artifact.bytes) !== original.descriptor.sha256
    ) {
      fail(`round-trip Artifact mismatch for ${artifact.relativePath}`);
    }
  }

  const expected = countsOf(validated, linkMetadata.length);
  const actual = {
    releaseEntries: await tx.actkgReleaseEntry.count({ where: { releaseId } }),
    projectionNodes: await tx.actkgProjectionNode.count({ where: { releaseId } }),
    projectionLinks: await tx.actkgProjectionLink.count({ where: { releaseId } }),
    upstreamRagReferences: await tx.actkgUpstreamRagReference.count({ where: { releaseId } }),
    components: await tx.actkgReleaseComponent.count({ where: { releaseId } }),
    projectionIdentities: await tx.actkgProjectionIdentity.count({ where: { releaseId } }),
    linkMetadataRows: await tx.actkgProjectionLinkMetadata.count({ where: { releaseId } }),
    bundleArtifacts: reconstructed.length,
  };
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (actual[key] !== expected[key]) {
      fail(`round-trip count mismatch on ${key}: expected ${expected[key]}, actual ${actual[key]}`);
    }
  }

  // Release entries (full payload + identity).
  const persistedEntries = await tx.actkgReleaseEntry.findMany({
    where: { releaseId },
    orderBy: { ordinal: 'asc' },
  });
  const expectedEntries = releaseEntries(validated);
  if (persistedEntries.length !== expectedEntries.length) fail('round-trip release entry count mismatch');
  for (const [index, entry] of expectedEntries.entries()) {
    const persisted = persistedEntries[index]!;
    if (
      persisted.entityId !== stringField(entry.entity, 'entity')
      || persisted.releaseTier !== stringField(entry.release_tier, 'release_tier')
      || persisted.entityRole !== stringField(entry.entity_role, 'entity_role')
      || persisted.inclusionReason !== stringField(entry.inclusion_reason, 'inclusion_reason')
      || !equalJson(persisted.payload, entry)
    ) {
      fail(`round-trip release entry mismatch at ordinal ${index}`);
    }
  }

  // Components.
  const persistedComponents = await tx.actkgReleaseComponent.findMany({
    where: { releaseId },
    orderBy: { ordinal: 'asc' },
  });
  if (persistedComponents.length !== validated.components.length) fail('round-trip component count mismatch');
  for (const [index, component] of validated.components.entries()) {
    const persisted = persistedComponents[index]!;
    if (
      persisted.componentReleaseId !== component.releaseId
      || persisted.releaseVersion !== component.releaseVersion
      || persisted.releaseHash !== component.releaseHash
      || persisted.controlledPath !== component.controlledPath
      || persisted.referenceKind !== component.referenceKind
      || persisted.componentRole !== component.componentRole
      || !equalJson(persisted.payload, component)
    ) {
      fail(`round-trip component mismatch at ordinal ${index}`);
    }
  }

  // Projection identities (unique runtime + preserved).
  const persistedIdentities = await tx.actkgProjectionIdentity.findMany({
    where: { releaseId },
    orderBy: { ordinal: 'asc' },
  });
  const expectedIdentities = uniqueProjectionIdentityRows(validated);
  if (persistedIdentities.length !== expectedIdentities.length) {
    fail('round-trip Projection identity count mismatch');
  }
  for (const expectedIdentity of expectedIdentities) {
    const identity = expectedIdentity.identity;
    const persisted = persistedIdentities.find((row) => row.projectionId === identity.projectionId);
    if (!persisted) {
      fail(`round-trip missing Projection identity ${identity.projectionId}`);
    }
    if (
      persisted.projectionProfile !== identity.projectionProfile
      || persisted.versionDigest !== identity.versionDigest
      || persisted.sourceRelease !== identity.sourceRelease
      || persisted.sourceReleaseHash !== identity.sourceReleaseHash
      || persisted.sourceDatasetHash !== identity.sourceDatasetHash
      || persisted.nodeCount !== identity.nodeCount
      || persisted.linkCount !== identity.linkCount
      || persisted.artifactPath !== identity.artifactPath
      || persisted.artifactSha256 !== identity.artifactSha256
      || persisted.isRuntime !== expectedIdentity.isRuntime
      || normalizeProfileLabel(persisted.profile) !== normalizeProfileLabel(identity.profile || identity.projectionProfile)
    ) {
      fail(`round-trip Projection identity mismatch for ${identity.projectionId}`);
    }
  }

  // Runtime projection nodes/links with full canonical payloads.
  const runtimeNodes = await tx.actkgProjectionNode.findMany({
    where: { releaseId },
    orderBy: { ordinal: 'asc' },
  });
  const expectedNodes = projectionNodes(validated.selectedRuntimeProjection.payload);
  if (runtimeNodes.length !== expectedNodes.length) fail('round-trip runtime node count mismatch');
  for (const [index, node] of expectedNodes.entries()) {
    const persisted = runtimeNodes[index]!;
    if (
      persisted.nodeId !== stringField(node.id, 'node.id')
      || persisted.entityId !== stringField(node.entity_id, 'node.entity_id')
      || persisted.entityType !== stringField(node.entity_type, 'node.entity_type')
      || persisted.displayName !== stringField(node.display_name, 'node.display_name')
      || persisted.releaseTier !== stringField(node.release_tier, 'node.release_tier')
      || !equalJson(persisted.payload, node)
    ) {
      fail(`round-trip runtime node payload mismatch at ordinal ${index}`);
    }
  }

  const runtimeLinks = await tx.actkgProjectionLink.findMany({
    where: { releaseId },
    orderBy: { ordinal: 'asc' },
  });
  const expectedLinks = projectionLinks(validated.selectedRuntimeProjection.payload);
  if (runtimeLinks.length !== expectedLinks.length) fail('round-trip runtime link count mismatch');
  for (const [index, link] of expectedLinks.entries()) {
    const persisted = runtimeLinks[index]!;
    if (
      persisted.linkId !== stringField(link.id, 'link.id')
      || persisted.relationId !== stringField(link.relation_id, 'link.relation_id')
      || persisted.sourceId !== stringField(link.source_id, 'link.source_id')
      || persisted.targetId !== stringField(link.target_id, 'link.target_id')
      || persisted.relationType !== stringField(link.relation_type, 'link.relation_type')
      || persisted.relationFamily !== stringField(link.relation_family, 'link.relation_family')
      || persisted.direction !== stringField(link.direction, 'link.direction')
      || persisted.evidenceState !== stringField(link.evidence_state, 'link.evidence_state')
      || !equalJson(persisted.payload, link)
    ) {
      fail(`round-trip runtime link payload mismatch at ordinal ${index}`);
    }
  }

  // Link Metadata full unique set.
  const persistedMetadata = await tx.actkgProjectionLinkMetadata.findMany({
    where: { releaseId },
    orderBy: { ordinal: 'asc' },
  });
  if (persistedMetadata.length !== linkMetadata.length) {
    fail('round-trip Link Metadata count mismatch');
  }
  for (const [index, expectedRow] of linkMetadata.entries()) {
    const persisted = persistedMetadata[index]!;
    if (
      persisted.relationId !== expectedRow.relationId
      || persisted.releaseTier !== expectedRow.releaseTier
      || persisted.sourceRelease !== expectedRow.sourceRelease
      || persisted.sourceReleaseHash !== expectedRow.sourceReleaseHash
      || !equalJson(persisted.evidenceRefs, expectedRow.evidenceRefs)
      || !equalJson(persisted.profiles, expectedRow.profiles)
      || !equalJson(persisted.payload, expectedRow.payload)
      || (persisted.sourceComponentRelease ?? undefined) !== expectedRow.sourceComponentRelease
      || (persisted.targetComponentRelease ?? undefined) !== expectedRow.targetComponentRelease
      || (persisted.relationComponentRelease ?? undefined) !== expectedRow.relationComponentRelease
    ) {
      fail(`round-trip Link Metadata mismatch at ordinal ${index}`);
    }
  }

  // Crosswalk.
  const persistedCrosswalk = await tx.actkgUpstreamRagReference.findMany({
    where: { releaseId },
    orderBy: { ordinal: 'asc' },
  });
  if (persistedCrosswalk.length !== validated.crosswalk.length) {
    fail('round-trip Crosswalk count mismatch');
  }
  for (const [index, row] of validated.crosswalk.entries()) {
    const persisted = persistedCrosswalk[index]!;
    if (
      persisted.publishedEntityId !== row.publishedEntityId
      || persisted.retrievalChunkId !== row.retrievalChunkId
      || persisted.citationTargetId !== row.citationTargetId
    ) {
      fail(`round-trip Crosswalk mismatch at ordinal ${index}`);
    }
  }

  // Statistics + staged receipt identity/digests (still STAGED before accept).
  const receipt = await tx.actkgBundleReceipt.findUnique({ where: { id: bundleReceiptId } });
  if (!receipt || receipt.candidateState !== STAGED_CANDIDATE_STATE) {
    fail('round-trip requires a STAGED Bundle receipt before acceptance');
  }
  if (receipt.runtimeProjectionDigest !== validated.selectedRuntimeProjection.identity.versionDigest) {
    fail('round-trip runtime Projection digest mismatch on Bundle receipt');
  }
  if (receipt.bundleDigest !== validated.bundleIdentity.bundleDigest) {
    fail('round-trip Bundle digest mismatch');
  }
  if (receipt.artifactCount !== validated.rawArtifacts.length) {
    fail('round-trip Bundle receipt artifactCount mismatch');
  }
  if (!equalJson(receipt.statistics, validated.statistics)) {
    fail('round-trip statistics mismatch');
  }
  if (receipt.schemaRawSha256 !== validated.schemaIdentity.rawSha256) {
    fail('round-trip Schema hash mismatch');
  }
  if (receipt.manifestRawSha256 !== validated.bundleIdentity.manifestRawSha256) {
    fail('round-trip Manifest hash mismatch');
  }
  if (receipt.releaseHash !== validated.releaseIdentity.releaseHash) {
    fail('round-trip Release hash mismatch');
  }
  if (receipt.sourceDatasetHash !== validated.releaseIdentity.sourceDatasetHash) {
    fail('round-trip source dataset hash mismatch');
  }
}

async function importOnce(
  db: PrismaClient,
  validated: ValidatedActKGBundle,
): Promise<StandardBundleImportCounts> {
  const linkMetadata = canonicalizeAllLinkMetadata(validated);
  const expectedCounts = countsOf(validated, linkMetadata.length);

  return db.$transaction(async (tx) => {
    // Cross-transaction serialization for concurrent first content imports.
    // Without this, Serializable snapshots still allow both workers to observe
    // "no Release yet" and race on ActkgProjectionIdentity uniqueness.
    await acquireImportLocks(tx, validated);

    const existingDigest = await tx.actkgBundleReceipt.findUnique({
      where: { bundleDigest: validated.bundleIdentity.bundleDigest },
    });
    if (existingDigest) {
      if (existingDigest.candidateState === ACCEPTED_CANDIDATE_STATE) {
        return assertIdempotentBundleMatches(tx, validated, linkMetadata.length);
      }
      // Holder of the lock should never leave a durable STAGED row; treat as
      // transient only if a crashed connection left incomplete state.
      fail('Bundle digest is currently staged by a concurrent import');
    }

    const revisionConflict = await tx.actkgBundleReceipt.findUnique({
      where: {
        bundleId_bundleRevision: {
          bundleId: validated.bundleIdentity.bundleId,
          bundleRevision: validated.bundleIdentity.bundleRevision,
        },
      },
    });
    if (revisionConflict) {
      if (
        revisionConflict.bundleDigest === validated.bundleIdentity.bundleDigest
        && revisionConflict.candidateState === ACCEPTED_CANDIDATE_STATE
      ) {
        return assertIdempotentBundleMatches(tx, validated, linkMetadata.length);
      }
      fail('reused Bundle identity carries a different digest');
    }

    // Re-read after lock so a concurrent winner's committed Release is visible.
    const existingRelease = await tx.actkgRelease.findUnique({
      where: { id: validated.releaseIdentity.releaseId },
    });

    let mode: StandardBundleImportCounts['mode'];
    if (existingRelease) {
      if (
        existingRelease.releaseHash !== validated.releaseIdentity.releaseHash
        || existingRelease.sourceDatasetHash !== validated.releaseIdentity.sourceDatasetHash
      ) {
        fail('reused Release identity carries different semantic digests');
      }
      await assertExistingSemanticMatches(tx, validated, linkMetadata.length);
      mode = 'packaging';
    } else {
      const versionConflict = await tx.actkgRelease.findUnique({
        where: { releaseVersion: validated.releaseIdentity.releaseVersion },
      });
      if (versionConflict) {
        fail('releaseVersion already exists with a different Release identity');
      }
      const hashConflict = await tx.actkgRelease.findUnique({
        where: { releaseHash: validated.releaseIdentity.releaseHash },
      });
      if (hashConflict) {
        fail('releaseHash already exists with a different Release identity');
      }
      await stageReleaseSet(tx, validated);
      await stageSemanticRelease(tx, validated);
      mode = 'content';
    }

    // Stage packaging receipt as STAGED, then artifacts under STAGED parent.
    const bundleReceiptId = await stageBundleReceiptAndArtifacts(tx, validated);
    if (mode === 'content') {
      await stageProjectionIdentitiesAndMetadata(tx, validated, linkMetadata);
    }

    // Full reconstruction before the sole STAGED→ACCEPTED transition.
    await roundTripVerify(tx, validated, bundleReceiptId, linkMetadata);
    await acceptBundleReceipt(tx, bundleReceiptId, validated.releaseIdentity.releaseId);
    await stageImportReceipt(tx, validated, expectedCounts);

    return resultShape(validated, mode, linkMetadata.length);
  }, { isolationLevel: 'Serializable' });
}

/**
 * Import a validated standard Bundle as an explicit non-production candidate.
 * Does not move default candidate / active / Legacy selectors.
 * Concurrent first imports are retried and converge on one accepted receipt.
 */
export async function importValidatedActKGBundle(
  db: PrismaClient,
  input: unknown,
): Promise<StandardBundleImportCounts> {
  const validated = assertValidatedActKGBundleInput(input);
  if (validated.bundleIdentity.bundleContractVersion !== STANDARD_PUBLIC_BUNDLE_PROTOCOL) {
    fail(`unsupported bundle contract ${validated.bundleIdentity.bundleContractVersion}`);
  }
  if (validated.bundleIdentity.bundleKind !== 'aggregate') {
    fail('only aggregate Bundles may be imported as candidates');
  }
  // Stable-only write gate: a candidate-stage ValidatedActKGBundle may exist for
  // compatibility inspection, but persistence must fail closed before any DB I/O.
  if (validated.bundleIdentity.releaseStage !== 'stable') {
    fail(
      'only stable public Bundles may be persisted; '
      + `candidate-stage or unknown releaseStage '${validated.bundleIdentity.releaseStage}' is rejected before write`,
    );
  }
  if (!validated.compatibility.code.startsWith('COMPATIBLE_')) {
    fail(`compatibility assessment ${validated.compatibility.code} is not importable`);
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_IMPORT_ATTEMPTS; attempt += 1) {
    try {
      // Fast path: accepted digest already present outside a write transaction.
      const accepted = await db.actkgBundleReceipt.findUnique({
        where: { bundleDigest: validated.bundleIdentity.bundleDigest },
      });
      if (accepted?.candidateState === ACCEPTED_CANDIDATE_STATE) {
        return db.$transaction(async (tx) => (
          assertIdempotentBundleMatches(
            tx,
            validated,
            canonicalizeAllLinkMetadata(validated).length,
          )
        ), { isolationLevel: 'RepeatableRead' });
      }
      return await importOnce(db, validated);
    } catch (error) {
      lastError = error;
      if (!isRetryableConflict(error) && !(
        error instanceof Error
        && /currently staged by a concurrent import/u.test(error.message)
      )) {
        throw error;
      }
      // After a conflict, prefer reading an accepted winner before retrying write.
      const accepted = await db.actkgBundleReceipt.findUnique({
        where: { bundleDigest: validated.bundleIdentity.bundleDigest },
      });
      if (accepted?.candidateState === ACCEPTED_CANDIDATE_STATE) {
        return db.$transaction(async (tx) => (
          assertIdempotentBundleMatches(
            tx,
            validated,
            canonicalizeAllLinkMetadata(validated).length,
          )
        ), { isolationLevel: 'RepeatableRead' });
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('ActKG standard Bundle import rejected: concurrent import retries exhausted');
}
