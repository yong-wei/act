/**
 * V2 candidate persistence adapter.
 *
 * This module is intentionally separate from standard-bundle-import.ts.  V2
 * carries typed profiles, terminology assertions, and registry admission
 * provenance that have no V1 meaning.  The adapter accepts only the validated
 * V2 result and never parses a directory or delegates to the V1 importer.
 */
import { Prisma, type PrismaClient } from '@prisma/client';

import { canonicalJson, sha256 } from './authoritative-release';
import type {
  ProjectionIdentity,
  ProjectionLinkMetadataRow,
  TypedMultilingualLabelV2,
  TypedProjectionProfileV2,
  ValidatedActKGBundleV2,
  ValidatedComponentReferenceV2,
  ValidatedRawArtifact,
} from './public-bundle-types';

export const PUBLIC_BUNDLE_V2_PROTOCOL = 'actkg-public-bundle/2' as const;
export const V2_CANDIDATE_STATE = 'ACCEPTED_CANDIDATE' as const;
export const V2_ADMISSION_LOCK_PROTOCOL = 'actkg-public-bundle-v2-admission/1' as const;

type JsonObject = Record<string, unknown>;
type Tx = PrismaClient | Prisma.TransactionClient;

export interface PublicBundleV2ImportCounts {
  mode: 'content' | 'idempotent';
  releaseSetId: string;
  releaseId: string;
  bundleId: string;
  bundleRevision: number;
  bundleDigest: string;
  releaseEntries: number;
  releaseNodes: number;
  runtimeProjectionNodes: number;
  runtimeProjectionLinks: number;
  preservedProjections: number;
  components: number;
  linkMetadataRows: number;
  profiles: number;
  multilingualLabels: number;
  rawArtifacts: number;
  candidateState: typeof V2_CANDIDATE_STATE;
}

function fail(message: string): never {
  throw new Error(`ActKG V2 Bundle import rejected: ${message}`);
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function object(value: unknown, label: string): JsonObject {
  if (!isObject(value)) fail(`${label} must be an object`);
  return value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function integerField(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`${label} must be a non-negative integer`);
  }
  return value;
}

function booleanField(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} must be a boolean`);
  return value;
}

function equalJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function normalizeProfile(profile: string): string {
  const lower = profile.toLowerCase();
  if (lower === 'runtime' || lower.includes('runtime') || lower.includes(':act-')) return 'runtime';
  if (lower === 'domain' || lower.includes('domain')) return 'domain';
  if (lower === 'review' || lower.includes('review')) return 'review';
  return profile;
}

function projectionNodes(payload: JsonObject): JsonObject[] {
  return array(payload.nodes, 'runtime projection.nodes').map((row, index) => (
    object(row, `runtime projection.nodes[${index}]`)
  ));
}

function projectionLinks(payload: JsonObject): JsonObject[] {
  return array(payload.links, 'runtime projection.links').map((row, index) => (
    object(row, `runtime projection.links[${index}]`)
  ));
}

function releaseEntries(bundle: ValidatedActKGBundleV2): JsonObject[] {
  return array(bundle.release.entries, 'release.entries').map((row, index) => (
    object(row, `release.entries[${index}]`)
  ));
}

function uniqueProjectionRows(bundle: ValidatedActKGBundleV2): Array<{
  identity: ProjectionIdentity;
  isRuntime: boolean;
}> {
  const rows = new Map<string, { identity: ProjectionIdentity; isRuntime: boolean }>();
  for (const row of bundle.preservedProjections) {
    rows.set(row.identity.projectionId, { identity: row.identity, isRuntime: false });
  }
  rows.set(bundle.selectedRuntimeProjection.identity.projectionId, {
    identity: bundle.selectedRuntimeProjection.identity,
    isRuntime: true,
  });
  return [...rows.values()].sort((left, right) => (
    left.identity.projectionId.localeCompare(right.identity.projectionId)
  ));
}

function canonicalMetadata(bundle: ValidatedActKGBundleV2): Array<ProjectionLinkMetadataRow & { profiles: string[] }> {
  const byRelation = new Map<string, ProjectionLinkMetadataRow & { profiles: string[] }>();
  for (const group of bundle.allLinkMetadata) {
    const profiles = [...group.profiles].sort();
    for (const row of group.rows) {
      const next = { ...row, evidenceRefs: [...row.evidenceRefs].sort(), profiles };
      const previous = byRelation.get(row.relationId);
      if (!previous) {
        byRelation.set(row.relationId, next);
        continue;
      }
      const withoutProfiles = (value: ProjectionLinkMetadataRow & { profiles: string[] }) => ({
        ...value,
        profiles: [],
      });
      if (!equalJson(withoutProfiles(previous), withoutProfiles(next))) {
        fail(`Link Metadata relation ${row.relationId} differs across V2 profiles`);
      }
      previous.profiles = [...new Set([...previous.profiles, ...profiles])].sort();
    }
  }
  return [...byRelation.values()].sort((left, right) => left.relationId.localeCompare(right.relationId));
}

function releaseSetIdFor(bundle: ValidatedActKGBundleV2): string {
  return `actkg-authority-candidate-v018-${bundle.bundleIdentity.bundleDigest}`;
}

function receiptIdFor(bundle: ValidatedActKGBundleV2): string {
  return `bundle-receipt:v2:${bundle.bundleIdentity.bundleDigest}`;
}

function importReceiptIdFor(bundle: ValidatedActKGBundleV2): string {
  return `receipt:v2:${bundle.releaseIdentity.releaseId}`;
}

function bindingDigest(bundle: ValidatedActKGBundleV2): string {
  return sha256(canonicalJson(bundle.registeredAdmissionBinding));
}

/** Runtime boundary validation for callers that bypass the public loader. */
export function assertValidatedActKGBundleV2Input(input: unknown): ValidatedActKGBundleV2 {
  if (typeof input === 'string' || input instanceof Buffer) {
    fail('V2 persistence rejects raw directories or bytes; provide ValidatedActKGBundleV2');
  }
  const value = object(input, 'ValidatedActKGBundleV2');
  if (value.protocol !== PUBLIC_BUNDLE_V2_PROTOCOL) fail('protocol must be actkg-public-bundle/2');
  if (value.graphRagRuntimeIntakeBlocked !== true) fail('graphRagRuntimeIntakeBlocked must be true');
  stringField(value.captureRevision, 'captureRevision');

  const identity = object(value.bundleIdentity, 'bundleIdentity');
  if (identity.protocol !== PUBLIC_BUNDLE_V2_PROTOCOL) fail('bundleIdentity.protocol mismatch');
  if (identity.bundleContractVersion !== PUBLIC_BUNDLE_V2_PROTOCOL) fail('bundleIdentity.bundleContractVersion mismatch');
  stringField(identity.bundleId, 'bundleIdentity.bundleId');
  integerField(identity.bundleRevision, 'bundleIdentity.bundleRevision');
  stringField(identity.bundleDigest, 'bundleIdentity.bundleDigest');
  if (identity.bundleKind !== 'aggregate') fail('only aggregate V2 Bundles may be staged');
  if (identity.releaseStage !== 'stable') fail('V2 candidate import requires release_stage=stable');
  stringField(identity.controlledPath, 'bundleIdentity.controlledPath');
  stringField(identity.manifestRawSha256, 'bundleIdentity.manifestRawSha256');
  stringField(identity.sha256sumsRawSha256, 'bundleIdentity.sha256sumsRawSha256');

  const release = object(value.releaseIdentity, 'releaseIdentity');
  stringField(release.releaseId, 'releaseIdentity.releaseId');
  stringField(release.releaseVersion, 'releaseIdentity.releaseVersion');
  stringField(release.releaseHash, 'releaseIdentity.releaseHash');
  stringField(release.sourceDatasetHash, 'releaseIdentity.sourceDatasetHash');
  const schema = object(value.schemaIdentity, 'schemaIdentity');
  stringField(schema.version, 'schemaIdentity.version');
  stringField(schema.rawSha256, 'schemaIdentity.rawSha256');
  object(value.manifestSourceRevision, 'manifestSourceRevision');
  const binding = object(value.registeredAdmissionBinding, 'registeredAdmissionBinding');
  if (binding.provenance !== 'registry' || binding.verificationScope !== 'admission-time') {
    fail('registeredAdmissionBinding provenance is invalid');
  }
  if (binding.verifiedDuringLoad !== false) fail('registeredAdmissionBinding.verifiedDuringLoad must be false');
  object(binding.registryIdentity, 'registeredAdmissionBinding.registryIdentity');
  object(binding.upstreamRepository, 'registeredAdmissionBinding.upstreamRepository');
  object(binding.publicationRevision, 'registeredAdmissionBinding.publicationRevision');
  object(binding.sourceRevision, 'registeredAdmissionBinding.sourceRevision');
  object(binding.bundleIdentity, 'registeredAdmissionBinding.bundleIdentity');

  const runtime = object(value.selectedRuntimeProjection, 'selectedRuntimeProjection');
  const runtimeIdentity = object(runtime.identity, 'selectedRuntimeProjection.identity');
  const runtimePayload = object(runtime.payload, 'selectedRuntimeProjection.payload');
  if (projectionNodes(runtimePayload).length !== integerField(
    runtimeIdentity.nodeCount,
    'runtime identity.nodeCount',
  )) fail('runtime projection node count disagrees with identity');
  if (projectionLinks(runtimePayload).length !== integerField(
    runtimeIdentity.linkCount,
    'runtime identity.linkCount',
  )) fail('runtime projection link count disagrees with identity');

  const profiles = array(value.projectionProfiles, 'projectionProfiles');
  const labels = array(value.multilingualLabels, 'multilingualLabels');
  if (profiles.length === 0) fail('V2 Bundle carries no projection profiles');
  if (labels.length === 0) fail('V2 Bundle carries no multilingual labels');
  for (const [index, row] of profiles.entries()) object(row, `projectionProfiles[${index}]`);
  for (const [index, row] of labels.entries()) object(row, `multilingualLabels[${index}]`);
  if (array(value.rawArtifacts, 'rawArtifacts').length === 0) fail('V2 Bundle carries no raw Artifacts');

  // The loader is the semantic validator.  These checks only protect the
  // persistence boundary and intentionally preserve the typed V2 object.
  return value as unknown as ValidatedActKGBundleV2;
}

function artifactByRole(bundle: ValidatedActKGBundleV2, role: string): ValidatedRawArtifact {
  const artifact = bundle.rawArtifacts.find((row) => row.descriptor.role === role);
  if (!artifact) fail(`V2 Bundle is missing Artifact role ${role}`);
  return artifact;
}

function counts(bundle: ValidatedActKGBundleV2, metadataRows: number): Omit<
  PublicBundleV2ImportCounts,
  'mode' | 'releaseSetId' | 'releaseId' | 'bundleId' | 'bundleRevision' | 'bundleDigest' | 'candidateState'
> {
  return {
    releaseEntries: releaseEntries(bundle).length,
    releaseNodes: bundle.statistics.releaseNodes,
    runtimeProjectionNodes: projectionNodes(bundle.selectedRuntimeProjection.payload).length,
    runtimeProjectionLinks: projectionLinks(bundle.selectedRuntimeProjection.payload).length,
    preservedProjections: uniqueProjectionRows(bundle).length,
    components: bundle.components.length,
    linkMetadataRows: metadataRows,
    profiles: bundle.projectionProfiles.length,
    multilingualLabels: bundle.multilingualLabels.length,
    rawArtifacts: bundle.rawArtifacts.length,
  };
}

function resultShape(
  bundle: ValidatedActKGBundleV2,
  mode: PublicBundleV2ImportCounts['mode'],
  metadataRows: number,
): PublicBundleV2ImportCounts {
  return {
    mode,
    ...counts(bundle, metadataRows),
    releaseSetId: releaseSetIdFor(bundle),
    releaseId: bundle.releaseIdentity.releaseId,
    bundleId: bundle.bundleIdentity.bundleId,
    bundleRevision: bundle.bundleIdentity.bundleRevision,
    bundleDigest: bundle.bundleIdentity.bundleDigest,
    candidateState: V2_CANDIDATE_STATE,
  };
}

async function acquireV2ImportLocks(tx: Tx, bundle: ValidatedActKGBundleV2): Promise<void> {
  const releaseToken = `actkg-v2-import:release:${bundle.releaseIdentity.releaseId}`;
  const bundleToken = `actkg-v2-import:bundle:${bundle.bundleIdentity.bundleDigest}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('actkg-v2-import:global'))`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${releaseToken}))`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${bundleToken}))`;
}

function componentPayload(component: ValidatedComponentReferenceV2): Prisma.InputJsonValue {
  return json(component);
}

async function stageReleaseSet(tx: Tx, bundle: ValidatedActKGBundleV2): Promise<string> {
  const id = releaseSetIdFor(bundle);
  const existing = await tx.actkgReleaseSet.findUnique({ where: { id } });
  if (existing) {
    if (existing.controlledPath !== bundle.bundleIdentity.controlledPath
      || existing.lockVersion !== V2_ADMISSION_LOCK_PROTOCOL
      || existing.candidateState !== 'CANDIDATE') {
      fail('V2 ReleaseSet identity conflicts with an existing candidate');
    }
    return id;
  }
  await tx.actkgReleaseSet.create({
    data: {
      id,
      controlledPath: bundle.bundleIdentity.controlledPath,
      lockVersion: V2_ADMISSION_LOCK_PROTOCOL,
      candidateState: 'CANDIDATE',
    },
  });
  return id;
}

async function stageReceiptAndArtifacts(
  tx: Tx,
  bundle: ValidatedActKGBundleV2,
  releaseSetId: string,
): Promise<string> {
  const id = receiptIdFor(bundle);
  const binding = bundle.registeredAdmissionBinding;
  const releaseArtifact = artifactByRole(bundle, 'release');
  const bindingLockHash = sha256(canonicalJson(binding.registryIdentity));
  await tx.actkgBundleReceipt.create({
    data: {
      id,
      bundleId: bundle.bundleIdentity.bundleId,
      bundleRevision: bundle.bundleIdentity.bundleRevision,
      bundleDigest: bundle.bundleIdentity.bundleDigest,
      bundleKind: bundle.bundleIdentity.bundleKind,
      releaseStage: bundle.bundleIdentity.releaseStage,
      bundleContractVersion: PUBLIC_BUNDLE_V2_PROTOCOL,
      controlledPath: bundle.bundleIdentity.controlledPath,
      manifestRawSha256: bundle.bundleIdentity.manifestRawSha256,
      normalization: 'actkg-public-bundle-v2/canonical-json-v1',
      publicationTag: stringField(binding.publicationRevision.tag, 'publicationRevision.tag'),
      sourceCommit: stringField(binding.sourceRevision.commit, 'sourceRevision.commit'),
      sourceTag: stringField(binding.sourceRevision.tag, 'sourceRevision.tag'),
      releaseSetId,
      releaseId: bundle.releaseIdentity.releaseId,
      releaseHash: bundle.releaseIdentity.releaseHash,
      sourceDatasetHash: bundle.releaseIdentity.sourceDatasetHash,
      schemaVersion: bundle.schemaIdentity.version,
      schemaRawSha256: bundle.schemaIdentity.rawSha256,
      lockVersion: V2_ADMISSION_LOCK_PROTOCOL,
      lockPath: `registry:${stringField(binding.registryIdentity.registryId, 'registryIdentity.registryId')}`,
      lockRawSha256: bindingLockHash,
      captureRevision: bundle.captureRevision,
      candidateState: 'STAGED',
      compatibilityCode: bundle.compatibility.code,
      runtimeProjectionId: bundle.selectedRuntimeProjection.identity.projectionId,
      runtimeProjectionProfile: bundle.selectedRuntimeProjection.identity.projectionProfile,
      runtimeProjectionDigest: bundle.selectedRuntimeProjection.identity.versionDigest,
      artifactCount: bundle.rawArtifacts.length,
      statistics: json(bundle.statistics),
    },
  });
  await tx.actkgBundleArtifact.createMany({
    data: bundle.rawArtifacts.map((artifact, ordinal) => ({
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
  await tx.actkgV2AdmissionBinding.create({
    data: {
      releaseId: bundle.releaseIdentity.releaseId,
      bundleReceiptId: id,
      protocol: PUBLIC_BUNDLE_V2_PROTOCOL,
      provenance: binding.provenance,
      verificationScope: binding.verificationScope,
      verifiedDuringLoad: binding.verifiedDuringLoad,
      registryIdentity: json(binding.registryIdentity),
      upstreamRepository: json(binding.upstreamRepository),
      publicationRevision: json(binding.publicationRevision),
      sourceRevision: json(binding.sourceRevision),
      bundleIdentity: json(binding.bundleIdentity),
      bindingDigest: bindingDigest(bundle),
    },
  });
  // Keep a local reference to the release artifact so a future adapter cannot
  // accidentally stop requiring it while changing the schema.
  if (releaseArtifact.descriptor.byteLength !== releaseArtifact.bytes.byteLength) {
    fail('release Artifact byte length mismatch');
  }
  return id;
}

async function stageSemanticRows(
  tx: Tx,
  bundle: ValidatedActKGBundleV2,
  releaseSetId: string,
): Promise<void> {
  const releaseId = bundle.releaseIdentity.releaseId;
  const releaseArtifact = artifactByRole(bundle, 'release');
  const notesArtifact = artifactByRole(bundle, 'release_notes');
  const runtime = bundle.selectedRuntimeProjection;
  const entries = releaseEntries(bundle);
  const nodes = projectionNodes(runtime.payload);
  const links = projectionLinks(runtime.payload);
  await tx.actkgRelease.create({
    data: {
      id: releaseId,
      releaseSetId,
      releaseVersion: bundle.releaseIdentity.releaseVersion,
      releaseStatus: 'RELEASED',
      protocol: PUBLIC_BUNDLE_V2_PROTOCOL,
      authority: 'ActKG',
      scope: 'engineering',
      contractHash: bundle.schemaIdentity.rawSha256,
      releaseHash: bundle.releaseIdentity.releaseHash,
      schemaRawHash: bundle.schemaIdentity.rawSha256,
      releaseRawHash: releaseArtifact.descriptor.sha256,
      notesRawHash: notesArtifact.descriptor.sha256,
      captureRevision: bundle.captureRevision,
      lockRawHash: sha256(canonicalJson(bundle.registeredAdmissionBinding.registryIdentity)),
      schemaVersion: bundle.schemaIdentity.version,
      upstreamReleaseId: bundle.releaseIdentity.releaseId,
      projectionId: runtime.identity.projectionId,
      projectionDigest: runtime.identity.versionDigest,
      sourceDatasetHash: bundle.releaseIdentity.sourceDatasetHash,
      upstreamPublicationCommit: stringField(
        bundle.registeredAdmissionBinding.publicationRevision.commit,
        'publicationRevision.commit',
      ),
      upstreamClosedCommit: null,
    },
  });
  await tx.actkgReleaseComponent.createMany({
    data: bundle.components.map((component, ordinal) => ({
      releaseId,
      ordinal,
      componentReleaseId: component.releaseId,
      releaseVersion: component.releaseVersion,
      protocol: PUBLIC_BUNDLE_V2_PROTOCOL,
      controlledPath: component.componentPath,
      releaseHash: component.releaseHash,
      releaseRawSha256: component.componentSha256,
      sha256sumsSha256: null,
      referenceKind: 'standard_bundle_v2',
      componentRole: component.componentRole,
      componentBundleId: null,
      componentBundleDigest: null,
      componentManifestSha256: null,
      payload: componentPayload(component),
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
      sourceCoverageCount: integerField(node.source_coverage_count, `projection.nodes[${ordinal}].source_coverage_count`),
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
  if (bundle.crosswalk.length > 0) {
    await tx.actkgUpstreamRagReference.createMany({
      data: bundle.crosswalk.map((row, ordinal) => ({
        releaseId,
        ordinal,
        publishedEntityId: row.publishedEntityId,
        retrievalChunkId: row.retrievalChunkId,
        citationTargetId: row.citationTargetId,
      })),
    });
  }
  const projections = uniqueProjectionRows(bundle);
  await tx.actkgProjectionIdentity.createMany({
    data: projections.map((row, ordinal) => ({
      releaseId,
      projectionId: row.identity.projectionId,
      ordinal,
      profile: normalizeProfile(row.identity.profile || row.identity.projectionProfile),
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
  const metadata = canonicalMetadata(bundle);
  if (metadata.length > 0) {
    await tx.actkgProjectionLinkMetadata.createMany({
      data: metadata.map((row, ordinal) => ({
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
  await tx.actkgV2ProjectionProfile.createMany({
    data: bundle.projectionProfiles.map((profile) => ({
      releaseId,
      profileKey: profile.key,
      manifestProfile: profile.manifestProfile,
      profileId: profile.profileId,
      profileSha256: profile.profileSha256,
      projectionKind: profile.projectionKind,
      profileVersion: profile.profileVersion,
      mappingContractVersion: profile.mappingContractVersion,
      aggregationPolicy: profile.aggregationPolicy,
      payload: json(profile.payload),
    })),
  });
  await tx.actkgV2MultilingualLabel.createMany({
    data: bundle.multilingualLabels.map((label, ordinal) => ({
      releaseId,
      ordinal,
      entityId: label.entityId,
      language: label.language,
      label: label.label,
      labelType: label.labelType,
      terminologyAssertionId: label.terminologyAssertionId,
      payload: json(label.payload),
    })),
  });
}

async function stageImportReceipt(tx: Tx, bundle: ValidatedActKGBundleV2, releaseSetId: string): Promise<void> {
  const releaseId = bundle.releaseIdentity.releaseId;
  const metadataRows = canonicalMetadata(bundle).length;
  const expected = counts(bundle, metadataRows);
  await tx.actkgImportReceipt.create({
    data: {
      id: importReceiptIdFor(bundle),
      releaseSetId,
      releaseId,
      sourceRun: null,
      sourceImplementationCommit: null,
      captureRevision: bundle.captureRevision,
      lockRawHash: sha256(canonicalJson(bundle.registeredAdmissionBinding.registryIdentity)),
      ctkgDatasetAvailability: 'UNAVAILABLE',
      revisionRegistryAvailability: 'UNAVAILABLE',
      objectCount: 0,
      sourceMappingCount: 0,
      goldRelationCount: 0,
      silverRelationCount: 0,
      sourceObjectCount: 0,
      evidenceSegmentCount: 0,
      candidateState: V2_CANDIDATE_STATE,
      schemaVersion: bundle.schemaIdentity.version,
      upstreamReleaseId: releaseId,
      projectionId: bundle.selectedRuntimeProjection.identity.projectionId,
      projectionDigest: bundle.selectedRuntimeProjection.identity.versionDigest,
      sourceDatasetHash: bundle.releaseIdentity.sourceDatasetHash,
      upstreamPublicationCommit: stringField(
        bundle.registeredAdmissionBinding.publicationRevision.commit,
        'publicationRevision.commit',
      ),
      upstreamClosedCommit: null,
      releaseEntryCount: expected.releaseEntries,
      projectionNodeCount: expected.runtimeProjectionNodes,
      projectionLinkCount: expected.runtimeProjectionLinks,
      upstreamRagReferenceCount: bundle.crosswalk.length,
      artifactCount: null,
      componentCount: bundle.components.length,
      bundleContractVersion: PUBLIC_BUNDLE_V2_PROTOCOL,
      bundleId: null,
      bundleRevision: null,
      bundleDigest: null,
      bundleKind: bundle.bundleIdentity.bundleKind,
      releaseStage: bundle.bundleIdentity.releaseStage,
      manifestRawSha256: null,
      schemaContractVersion: bundle.schemaIdentity.version,
    },
  });
}

async function verifyRoundTrip(
  tx: Tx,
  bundle: ValidatedActKGBundleV2,
  options: { requireStaged?: boolean } = {},
): Promise<void> {
  const releaseId = bundle.releaseIdentity.releaseId;
  const receipt = await tx.actkgBundleReceipt.findUnique({
    where: {
      bundleContractVersion_bundleDigest: {
        bundleContractVersion: PUBLIC_BUNDLE_V2_PROTOCOL,
        bundleDigest: bundle.bundleIdentity.bundleDigest,
      },
    },
    include: { artifacts: true, v2AdmissionBinding: true },
  });
  if (!receipt) fail('V2 receipt is missing during round-trip');
  if (options.requireStaged !== false && receipt.candidateState !== 'STAGED') {
    fail('V2 receipt must remain STAGED during round-trip');
  }
  if (!receipt.v2AdmissionBinding) fail('V2 receipt is missing registered admission binding');
  if (receipt.v2AdmissionBinding.bindingDigest !== bindingDigest(bundle)) fail('V2 admission binding digest mismatch');
  if (receipt.artifacts.length !== bundle.rawArtifacts.length) fail('V2 Artifact count mismatch');
  for (const original of bundle.rawArtifacts) {
    const persisted = receipt.artifacts.find((row) => row.relativePath === original.descriptor.path);
    if (!persisted || !Buffer.from(persisted.bytes).equals(original.bytes)
      || persisted.sha256 !== original.descriptor.sha256
      || persisted.byteLength !== original.descriptor.byteLength
      || persisted.role !== original.descriptor.role
      || persisted.contractVersion !== original.descriptor.contractVersion
      || persisted.required !== original.descriptor.required) {
      fail(`V2 Artifact round-trip mismatch for ${original.descriptor.path}`);
    }
  }
  const expectedProfiles = bundle.projectionProfiles;
  const profiles = await tx.actkgV2ProjectionProfile.findMany({
    where: { releaseId }, orderBy: { profileKey: 'asc' },
  });
  if (profiles.length !== expectedProfiles.length) fail('V2 projection profile count mismatch');
  for (const profile of expectedProfiles) {
    const row = profiles.find((candidate) => candidate.profileId === profile.profileId);
    if (!row || row.profileSha256 !== profile.profileSha256 || !equalJson(row.payload, profile.payload)
      || row.mappingContractVersion !== profile.mappingContractVersion
      || row.aggregationPolicy !== profile.aggregationPolicy) {
      fail(`V2 projection profile round-trip mismatch for ${profile.profileId}`);
    }
  }
  const labels = await tx.actkgV2MultilingualLabel.findMany({
    where: { releaseId }, orderBy: { ordinal: 'asc' },
  });
  if (labels.length !== bundle.multilingualLabels.length) fail('V2 multilingual label count mismatch');
  for (const [index, expected] of bundle.multilingualLabels.entries()) {
    const row = labels[index];
    if (!row || row.entityId !== expected.entityId || row.language !== expected.language
      || row.label !== expected.label || row.labelType !== expected.labelType
      || row.terminologyAssertionId !== expected.terminologyAssertionId
      || !equalJson(row.payload, expected.payload)) {
      fail(`V2 multilingual label round-trip mismatch at ordinal ${index}`);
    }
  }
  const expectedCounts = counts(bundle, canonicalMetadata(bundle).length);
  const actual = {
    releaseEntries: await tx.actkgReleaseEntry.count({ where: { releaseId } }),
    runtimeProjectionNodes: await tx.actkgProjectionNode.count({ where: { releaseId } }),
    runtimeProjectionLinks: await tx.actkgProjectionLink.count({ where: { releaseId } }),
    preservedProjections: await tx.actkgProjectionIdentity.count({ where: { releaseId } }),
    components: await tx.actkgReleaseComponent.count({ where: { releaseId } }),
    linkMetadataRows: await tx.actkgProjectionLinkMetadata.count({ where: { releaseId } }),
  };
  for (const [key, value] of Object.entries(actual)) {
    if (value !== expectedCounts[key as keyof typeof actual]) fail(`V2 round-trip count mismatch on ${key}`);
  }
}

async function acceptReceipt(tx: Tx, bundle: ValidatedActKGBundleV2): Promise<void> {
  const updated = await tx.actkgBundleReceipt.updateMany({
    where: {
      bundleContractVersion: PUBLIC_BUNDLE_V2_PROTOCOL,
      bundleDigest: bundle.bundleIdentity.bundleDigest,
      candidateState: 'STAGED',
    },
    data: { candidateState: V2_CANDIDATE_STATE },
  });
  if (updated.count !== 1) fail('V2 STAGED→ACCEPTED_CANDIDATE transition failed');
}

async function idempotentResult(tx: Tx, bundle: ValidatedActKGBundleV2): Promise<PublicBundleV2ImportCounts> {
  const receipt = await tx.actkgBundleReceipt.findUnique({
    where: {
      bundleContractVersion_bundleDigest: {
        bundleContractVersion: PUBLIC_BUNDLE_V2_PROTOCOL,
        bundleDigest: bundle.bundleIdentity.bundleDigest,
      },
    },
    include: { artifacts: true, v2AdmissionBinding: true },
  });
  if (!receipt || receipt.candidateState !== V2_CANDIDATE_STATE) fail('existing V2 receipt is not accepted');
  if (receipt.bundleId !== bundle.bundleIdentity.bundleId || receipt.bundleRevision !== bundle.bundleIdentity.bundleRevision
    || receipt.releaseId !== bundle.releaseIdentity.releaseId || receipt.releaseSetId !== releaseSetIdFor(bundle)
    || receipt.artifactCount !== bundle.rawArtifacts.length) {
    fail('existing V2 receipt identity conflicts with validated input');
  }
  if (!receipt.v2AdmissionBinding || receipt.v2AdmissionBinding.bindingDigest !== bindingDigest(bundle)) {
    fail('existing V2 admission binding conflicts with validated input');
  }
  await verifyRoundTrip(tx, bundle, { requireStaged: false });
  return resultShape(bundle, 'idempotent', canonicalMetadata(bundle).length);
}

async function importOnce(db: PrismaClient, bundle: ValidatedActKGBundleV2): Promise<PublicBundleV2ImportCounts> {
  const metadataRows = canonicalMetadata(bundle).length;
  return db.$transaction(async (tx) => {
    await acquireV2ImportLocks(tx, bundle);
    const existing = await tx.actkgBundleReceipt.findUnique({
      where: {
        bundleContractVersion_bundleDigest: {
          bundleContractVersion: PUBLIC_BUNDLE_V2_PROTOCOL,
          bundleDigest: bundle.bundleIdentity.bundleDigest,
        },
      },
    });
    if (existing) {
      if (existing.candidateState === V2_CANDIDATE_STATE) return idempotentResult(tx, bundle);
      fail('V2 Bundle digest is currently staged by another transaction');
    }
    const releaseConflict = await tx.actkgRelease.findUnique({ where: { id: bundle.releaseIdentity.releaseId } });
    if (releaseConflict) fail('V2 Release identity already exists');
    const releaseSetId = await stageReleaseSet(tx, bundle);
    await stageSemanticRows(tx, bundle, releaseSetId);
    await stageReceiptAndArtifacts(tx, bundle, releaseSetId);
    await stageImportReceipt(tx, bundle, releaseSetId);
    await verifyRoundTrip(tx, bundle);
    await acceptReceipt(tx, bundle);
    return resultShape(bundle, 'content', metadataRows);
  }, { isolationLevel: 'Serializable' });
}

/**
 * Persist a loader-validated V2 Bundle as an inactive candidate.  V1 remains
 * exposed through importValidatedActKGBundle and is not called here.
 */
export async function importValidatedActKGBundleV2(
  db: PrismaClient,
  input: unknown,
): Promise<PublicBundleV2ImportCounts> {
  const bundle = assertValidatedActKGBundleV2Input(input);
  if (bundle.compatibility.code !== 'COMPATIBLE_CONTENT_UPDATE'
    && bundle.compatibility.code !== 'COMPATIBLE_OPTIONAL_EXTENSION'
    && bundle.compatibility.code !== 'COMPATIBLE_PACKAGING_REVISION') {
    fail(`V2 compatibility assessment ${bundle.compatibility.code} is not importable`);
  }
  const accepted = await db.actkgBundleReceipt.findUnique({
    where: {
      bundleContractVersion_bundleDigest: {
        bundleContractVersion: PUBLIC_BUNDLE_V2_PROTOCOL,
        bundleDigest: bundle.bundleIdentity.bundleDigest,
      },
    },
  });
  if (accepted?.candidateState === V2_CANDIDATE_STATE) {
    return db.$transaction((tx) => idempotentResult(tx, bundle), { isolationLevel: 'RepeatableRead' });
  }
  return importOnce(db, bundle);
}

export function v2ReleaseSetIdentity(bundle: ValidatedActKGBundleV2): {
  releaseSetId: string;
  releaseId: string;
  bundleDigest: string;
} {
  return {
    releaseSetId: releaseSetIdFor(bundle),
    releaseId: bundle.releaseIdentity.releaseId,
    bundleDigest: bundle.bundleIdentity.bundleDigest,
  };
}

export function v2BindingDigest(bundle: ValidatedActKGBundleV2): string {
  return bindingDigest(bundle);
}

export type { TypedMultilingualLabelV2, TypedProjectionProfileV2 };
