/**
 * Load fully verified ACT ReleaseSet snapshots for Delta calculation.
 *
 * Accepted evidence:
 * - exact #1125 path: ActkgImportReceipt.candidateState = 'CANDIDATE'
 * - standard Bundle path: ActkgBundleReceipt.candidateState = 'ACCEPTED_CANDIDATE'
 *   (and semantic import receipt present)
 */
import type { Prisma, PrismaClient } from '@prisma/client';

import {
  buildVocabulary,
  computeSemanticCollectionDigest,
  digestObjectMaterialIdentity,
  digestPayload,
} from './release-set-delta-compute';
import type {
  DeltaComponentRecord,
  DeltaCrosswalkRecord,
  DeltaEvidenceRef,
  DeltaObjectRecord,
  DeltaProjectionRecord,
  DeltaRelationRecord,
  DeltaSemanticSnapshot,
  JsonObject,
} from './release-set-delta-types';
import {
  CTKG_0_2_AGGREGATE_PROTOCOL,
  STANDARD_PUBLIC_BUNDLE_PROTOCOL,
} from '../../src/lib/authoritative-knowledge/contracts';

type Tx = PrismaClient | Prisma.TransactionClient;

export class DeltaLoadError extends Error {
  constructor(message: string) {
    super(`ActKG ReleaseSet Delta load rejected: ${message}`);
    this.name = 'DeltaLoadError';
  }
}

function fail(message: string): never {
  throw new DeltaLoadError(message);
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function readSupersedes(payload: JsonObject): string | null {
  const direct = payload.supersedes;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const governance = asObject(payload.governance_keys);
  if (typeof governance.supersedes === 'string' && governance.supersedes.length > 0) {
    return governance.supersedes;
  }
  const identityDecision = asObject(payload.identity_decision);
  if (typeof identityDecision.supersedes === 'string' && identityDecision.supersedes.length > 0) {
    return identityDecision.supersedes;
  }
  return null;
}

function mapProjectionNode(row: {
  entityId: string;
  entityType: string;
  releaseTier: string;
  semanticName: string | null;
  displayName: string;
  payload: unknown;
}): DeltaObjectRecord {
  const payload = asObject(row.payload);
  const semanticName = row.semanticName
    ?? (typeof payload.semantic_name === 'string' ? payload.semantic_name : null);
  return {
    canonicalId: row.entityId,
    canonicalType: row.entityType,
    releaseTier: row.releaseTier,
    semanticName,
    displayName: row.displayName,
    materialIdentityDigest: digestObjectMaterialIdentity({
      canonicalId: row.entityId,
      canonicalType: row.entityType,
      semanticName,
    }),
    payloadDigest: digestPayload(payload),
    supersedes: readSupersedes(payload),
  };
}

/**
 * Protocol-level relation-tier authority shape.
 *
 * Never infer from "how many metadata rows currently happen to exist":
 * - exact aggregate (#1125): ReleaseEntry only; any LinkMetadata is drift.
 * - standard public Bundle: per-relation LinkMetadata is mandatory whenever
 *   projection links exist (full empty table fails closed).
 * Partial absence / tier mismatch are enforced per relation by
 * {@link resolveAuthoritativeRelationReleaseTier}.
 */
export function assertRelationTierProtocolShape(options: {
  releaseId: string;
  protocol: string;
  projectionLinkCount: number;
  linkMetadataRowCount: number;
}): { requireLinkMetadata: boolean } {
  const isStandardBundle = options.protocol === STANDARD_PUBLIC_BUNDLE_PROTOCOL;
  const isExactAggregate = options.protocol === CTKG_0_2_AGGREGATE_PROTOCOL;

  if (!isStandardBundle && !isExactAggregate) {
    fail(`unsupported Release protocol for delta: ${options.protocol}`);
  }

  if (isExactAggregate && options.linkMetadataRowCount > 0) {
    // Exact #1125 contract does not store ProjectionLinkMetadata; presence is drift.
    fail(
      `exact aggregate Release ${options.releaseId} must not carry ProjectionLinkMetadata `
      + `(found ${options.linkMetadataRowCount} rows)`,
    );
  }

  if (
    isStandardBundle
    && options.projectionLinkCount > 0
    && options.linkMetadataRowCount === 0
  ) {
    fail(
      `standard Bundle Release ${options.releaseId} missing ProjectionLinkMetadata `
      + `(${options.projectionLinkCount} projection links require per-relation metadata)`,
    );
  }

  return { requireLinkMetadata: isStandardBundle };
}

/**
 * Resolve authoritative relation releaseTier.
 *
 * Contract by release protocol (not by row-count heuristics):
 * - exact aggregate (#1125): ReleaseEntry.releaseTier only.
 * - standard public Bundle: ReleaseEntry.releaseTier AND per-relation
 *   ProjectionLinkMetadata.releaseTier (must agree).
 * - Projection Link payload is never authoritative (v0.2/v0.3 omit release_tier).
 */
export function resolveAuthoritativeRelationReleaseTier(options: {
  relationId: string;
  entryReleaseTier: string | null | undefined;
  metadataReleaseTier?: string | null | undefined;
  /**
   * True for standard public Bundle protocol — LinkMetadata is mandatory
   * per relation regardless of how many metadata rows currently exist.
   */
  requireLinkMetadata: boolean;
}): string {
  const entryTier = typeof options.entryReleaseTier === 'string'
    ? options.entryReleaseTier.trim()
    : '';
  if (!entryTier) {
    fail(`relation ${options.relationId} missing authoritative ReleaseEntry releaseTier`);
  }

  if (options.requireLinkMetadata) {
    const metaTier = typeof options.metadataReleaseTier === 'string'
      ? options.metadataReleaseTier.trim()
      : '';
    if (!metaTier) {
      fail(`relation ${options.relationId} missing authoritative ProjectionLinkMetadata releaseTier`);
    }
    if (metaTier !== entryTier) {
      fail(
        `relation ${options.relationId} releaseTier mismatch: `
        + `ReleaseEntry=${entryTier}, ProjectionLinkMetadata=${metaTier}`,
      );
    }
  }

  return entryTier;
}

function mapProjectionLink(
  row: {
    relationId: string;
    relationType: string;
    direction: string;
    sourceId: string;
    targetId: string;
    payload: unknown;
  },
  releaseTier: string,
): DeltaRelationRecord {
  const payload = asObject(row.payload);
  return {
    relationId: row.relationId,
    predicate: row.relationType,
    direction: row.direction,
    releaseTier,
    sourceId: row.sourceId,
    targetId: row.targetId,
    // Payload digest intentionally excludes authoritative tier (not in payload).
    payloadDigest: digestPayload(payload),
  };
}

/** Stable Crosswalk triple key. Avoid NULs — PostgreSQL text/json reject \\u0000. */
export function crosswalkTripleKey(
  publishedEntityId: string,
  retrievalChunkId: string,
  citationTargetId: string,
): string {
  return [
    publishedEntityId,
    retrievalChunkId,
    citationTargetId,
  ].join('\u001f');
}

function mapCrosswalk(row: {
  publishedEntityId: string;
  retrievalChunkId: string;
  citationTargetId: string;
}): DeltaCrosswalkRecord {
  return {
    tripleKey: crosswalkTripleKey(
      row.publishedEntityId,
      row.retrievalChunkId,
      row.citationTargetId,
    ),
    publishedEntityId: row.publishedEntityId,
    retrievalChunkId: row.retrievalChunkId,
    citationTargetId: row.citationTargetId,
  };
}

function mapComponent(row: {
  componentReleaseId: string;
  releaseHash: string;
  protocol: string;
  referenceKind: string | null;
  payload: unknown;
}): DeltaComponentRecord {
  return {
    componentReleaseId: row.componentReleaseId,
    releaseHash: row.releaseHash,
    protocol: row.protocol,
    referenceKind: row.referenceKind,
    payloadDigest: digestPayload(row.payload),
  };
}

async function loadSemanticSnapshot(tx: Tx, releaseId: string): Promise<DeltaSemanticSnapshot> {
  const release = await tx.actkgRelease.findUnique({
    where: { id: releaseId },
    include: {
      projectionNodes: { orderBy: { ordinal: 'asc' } },
      projectionLinks: { orderBy: { ordinal: 'asc' } },
      upstreamRagReferences: { orderBy: { ordinal: 'asc' } },
      components: { orderBy: { ordinal: 'asc' } },
      projectionIdentities: { orderBy: { ordinal: 'asc' } },
      // Membership authority for relation releaseTier (exact + standard).
      entries: {
        where: { entityRole: 'relation' },
        orderBy: { ordinal: 'asc' },
      },
      // Standard Bundle path also persists per-relation LinkMetadata tiers.
      linkMetadataRows: { orderBy: { ordinal: 'asc' } },
      receipt: true,
    },
  });
  if (!release) fail(`Release ${releaseId} is missing`);
  if (!release.receipt) fail(`Release ${releaseId} has no import receipt (not round-trip verified)`);

  if (release.protocol === STANDARD_PUBLIC_BUNDLE_PROTOCOL) {
    if (release.receipt.candidateState !== 'ACCEPTED_CANDIDATE') {
      fail(`standard Release ${releaseId} is not ACCEPTED_CANDIDATE`);
    }
  } else if (release.protocol === CTKG_0_2_AGGREGATE_PROTOCOL) {
    if (release.receipt.candidateState !== 'CANDIDATE') {
      fail(`exact aggregate Release ${releaseId} is not in CANDIDATE acceptance state`);
    }
  } else {
    fail(`unsupported Release protocol for delta: ${release.protocol}`);
  }

  if (!release.releaseHash || !release.sourceDatasetHash) {
    fail(`Release ${releaseId} is missing release/source dataset hashes`);
  }

  const entryTierByRelationId = new Map(
    release.entries.map((row) => [row.entityId, row.releaseTier] as const),
  );
  const metadataTierByRelationId = new Map(
    release.linkMetadataRows.map((row) => [row.relationId, row.releaseTier] as const),
  );

  // Protocol contract — never infer from "metadata rows happen to exist".
  const { requireLinkMetadata } = assertRelationTierProtocolShape({
    releaseId,
    protocol: release.protocol,
    projectionLinkCount: release.projectionLinks.length,
    linkMetadataRowCount: release.linkMetadataRows.length,
  });

  const objects = release.projectionNodes.map(mapProjectionNode);
  const relations = release.projectionLinks.map((link) => {
    const releaseTier = resolveAuthoritativeRelationReleaseTier({
      relationId: link.relationId,
      entryReleaseTier: entryTierByRelationId.get(link.relationId),
      metadataReleaseTier: requireLinkMetadata
        ? metadataTierByRelationId.get(link.relationId)
        : undefined,
      requireLinkMetadata,
    });
    return mapProjectionLink(link, releaseTier);
  });
  const crosswalk = release.upstreamRagReferences.map(mapCrosswalk);
  const components = release.components.map(mapComponent);

  let projections: DeltaProjectionRecord[];
  if (release.projectionIdentities.length > 0) {
    projections = release.projectionIdentities.map((row) => ({
      profile: row.profile,
      projectionId: row.projectionId,
      versionDigest: row.versionDigest,
      isRuntime: row.isRuntime,
    }));
  } else if (release.projectionId && release.projectionDigest) {
    projections = [{
      profile: 'runtime',
      projectionId: release.projectionId,
      versionDigest: release.projectionDigest,
      isRuntime: true,
    }];
  } else {
    projections = [];
  }

  const vocabulary = buildVocabulary(objects, relations);
  const partial = {
    releaseSetId: release.releaseSetId,
    releaseId: release.id,
    releaseVersion: release.releaseVersion,
    releaseHash: release.releaseHash,
    sourceDatasetHash: release.sourceDatasetHash,
    protocol: release.protocol,
    runtimeProjectionId: release.projectionId,
    runtimeProjectionDigest: release.projectionDigest,
    objects,
    relations,
    crosswalk,
    components,
    projections,
    vocabulary,
  };

  return {
    ...partial,
    semanticCollectionDigest: computeSemanticCollectionDigest(partial),
  };
}

export interface LoadedAcceptedEvidence {
  evidence: DeltaEvidenceRef;
  snapshot: DeltaSemanticSnapshot;
}

/**
 * Load exact #1125 accepted evidence for a release.
 */
export async function loadExactAcceptedEvidence(
  tx: Tx,
  releaseId: string,
): Promise<LoadedAcceptedEvidence> {
  const release = await tx.actkgRelease.findUnique({
    where: { id: releaseId },
    include: { receipt: true },
  });
  if (!release?.receipt) fail(`exact evidence missing for ${releaseId}`);
  if (release.protocol !== CTKG_0_2_AGGREGATE_PROTOCOL) {
    fail(`release ${releaseId} is not the exact aggregate protocol`);
  }
  if (release.receipt.candidateState !== 'CANDIDATE') {
    fail(`exact release ${releaseId} is not accepted as CANDIDATE`);
  }
  if (!release.releaseVersion || release.releaseVersion.length === 0) {
    fail(`exact release ${releaseId} is missing releaseVersion`);
  }
  if (!release.receipt.captureRevision || release.receipt.captureRevision.length === 0) {
    fail(`exact import receipt for ${releaseId} is missing captureRevision`);
  }

  const snapshot = await loadSemanticSnapshot(tx, releaseId);
  const evidence: DeltaEvidenceRef = {
    kind: 'exact_import',
    releaseSetId: release.releaseSetId,
    releaseId: release.id,
    releaseVersion: release.releaseVersion,
    releaseHash: release.releaseHash,
    sourceDatasetHash: release.sourceDatasetHash,
    importReceiptId: release.receipt.id,
    bundleReceiptId: null,
    bundleId: null,
    bundleRevision: null,
    bundleDigest: null,
    runtimeProjectionId: release.projectionId,
    runtimeProjectionDigest: release.projectionDigest,
    evidenceCaptureRevision: release.receipt.captureRevision,
    protocol: release.protocol,
    acceptedAt: release.receipt.importedAt.toISOString(),
    semanticSnapshotDigest: snapshot.semanticCollectionDigest,
  };
  return { evidence, snapshot };
}

/**
 * Load a standard Bundle accepted packaging evidence (and its semantic snapshot).
 */
export async function loadStandardAcceptedEvidence(
  tx: Tx,
  bundleReceiptId: string,
): Promise<LoadedAcceptedEvidence> {
  const receipt = await tx.actkgBundleReceipt.findUnique({
    where: { id: bundleReceiptId },
  });
  if (!receipt) fail(`Bundle receipt ${bundleReceiptId} is missing`);
  if (receipt.candidateState !== 'ACCEPTED_CANDIDATE') {
    fail(`Bundle receipt ${bundleReceiptId} is not ACCEPTED_CANDIDATE`);
  }

  const importReceipt = await tx.actkgImportReceipt.findUnique({
    where: { releaseId: receipt.releaseId },
  });
  if (!importReceipt || importReceipt.candidateState !== 'ACCEPTED_CANDIDATE') {
    fail(`standard release ${receipt.releaseId} lacks ACCEPTED_CANDIDATE import receipt`);
  }

  const release = await tx.actkgRelease.findUnique({ where: { id: receipt.releaseId } });
  if (!release) fail(`Release ${receipt.releaseId} missing for Bundle receipt`);
  if (!release.releaseVersion || release.releaseVersion.length === 0) {
    fail(`Release ${receipt.releaseId} is missing releaseVersion`);
  }
  if (!receipt.captureRevision || receipt.captureRevision.length === 0) {
    fail(`Bundle receipt ${bundleReceiptId} is missing captureRevision`);
  }

  const snapshot = await loadSemanticSnapshot(tx, receipt.releaseId);
  const evidence: DeltaEvidenceRef = {
    kind: 'standard_bundle',
    releaseSetId: receipt.releaseSetId,
    releaseId: receipt.releaseId,
    releaseVersion: release.releaseVersion,
    releaseHash: receipt.releaseHash,
    sourceDatasetHash: receipt.sourceDatasetHash,
    importReceiptId: importReceipt.id,
    bundleReceiptId: receipt.id,
    bundleId: receipt.bundleId,
    bundleRevision: receipt.bundleRevision,
    bundleDigest: receipt.bundleDigest,
    runtimeProjectionId: receipt.runtimeProjectionId,
    runtimeProjectionDigest: receipt.runtimeProjectionDigest,
    evidenceCaptureRevision: receipt.captureRevision,
    protocol: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
    acceptedAt: receipt.importedAt.toISOString(),
    semanticSnapshotDigest: snapshot.semanticCollectionDigest,
  };
  return { evidence, snapshot };
}

export async function loadCandidateEvidenceByReleaseId(
  tx: Tx,
  releaseId: string,
  options?: { bundleDigest?: string },
): Promise<LoadedAcceptedEvidence> {
  const release = await tx.actkgRelease.findUnique({
    where: { id: releaseId },
    include: { receipt: true },
  });
  if (!release?.receipt) fail(`candidate release ${releaseId} is missing or unverified`);

  if (release.protocol === CTKG_0_2_AGGREGATE_PROTOCOL) {
    if (options?.bundleDigest) {
      fail(`exact aggregate release ${releaseId} does not accept Bundle digest selection`);
    }
    return loadExactAcceptedEvidence(tx, releaseId);
  }

  if (release.protocol !== STANDARD_PUBLIC_BUNDLE_PROTOCOL) {
    fail(`unsupported candidate protocol ${release.protocol}`);
  }

  const bundleReceipt = options?.bundleDigest
    ? await tx.actkgBundleReceipt.findUnique({ where: { bundleDigest: options.bundleDigest } })
    : await tx.actkgBundleReceipt.findFirst({
      where: {
        releaseId,
        candidateState: 'ACCEPTED_CANDIDATE',
      },
      orderBy: [{ importedAt: 'desc' }, { id: 'desc' }],
    });

  if (!bundleReceipt || bundleReceipt.candidateState !== 'ACCEPTED_CANDIDATE') {
    fail(`no ACCEPTED_CANDIDATE Bundle receipt for ${releaseId}`);
  }
  if (bundleReceipt.releaseId !== releaseId) {
    fail(
      `candidate release id mismatch: requested ${releaseId}, bundle binds ${bundleReceipt.releaseId}`,
    );
  }
  return loadStandardAcceptedEvidence(tx, bundleReceipt.id);
}

export interface AcceptedAnchor {
  kind: 'exact_import' | 'standard_bundle';
  releaseId: string;
  releaseSetId: string;
  acceptedAt: Date;
  bundleReceiptId: string | null;
  importReceiptId: string;
}

/** Stable display/sort key for accepted anchors (not used for prior selection). */
export function anchorSortKey(anchor: Pick<AcceptedAnchor, 'releaseId' | 'bundleReceiptId' | 'importReceiptId' | 'kind'>): string {
  return [
    anchor.releaseId,
    anchor.kind,
    anchor.bundleReceiptId ?? '',
    anchor.importReceiptId,
  ].join('\u001f');
}

/**
 * Enumerate every fully verified accepted ReleaseSet/Release anchor.
 */
export async function listAcceptedAnchors(tx: Tx): Promise<AcceptedAnchor[]> {
  const anchors: AcceptedAnchor[] = [];

  const exactReceipts = await tx.actkgImportReceipt.findMany({
    where: {
      candidateState: 'CANDIDATE',
      release: { protocol: CTKG_0_2_AGGREGATE_PROTOCOL },
    },
    include: { release: true },
    orderBy: { importedAt: 'asc' },
  });
  for (const receipt of exactReceipts) {
    anchors.push({
      kind: 'exact_import',
      releaseId: receipt.releaseId,
      releaseSetId: receipt.releaseSetId,
      acceptedAt: receipt.importedAt,
      bundleReceiptId: null,
      importReceiptId: receipt.id,
    });
  }

  const standardReceipts = await tx.actkgBundleReceipt.findMany({
    where: { candidateState: 'ACCEPTED_CANDIDATE' },
    orderBy: [{ importedAt: 'asc' }, { id: 'asc' }],
  });
  for (const receipt of standardReceipts) {
    const importReceipt = await tx.actkgImportReceipt.findUnique({
      where: { releaseId: receipt.releaseId },
    });
    if (!importReceipt || importReceipt.candidateState !== 'ACCEPTED_CANDIDATE') continue;
    anchors.push({
      kind: 'standard_bundle',
      releaseId: receipt.releaseId,
      releaseSetId: receipt.releaseSetId,
      acceptedAt: receipt.importedAt,
      bundleReceiptId: receipt.id,
      importReceiptId: importReceipt.id,
    });
  }

  return anchors.sort((a, b) => {
    const byTime = a.acceptedAt.getTime() - b.acceptedAt.getTime();
    if (byTime !== 0) return byTime;
    return anchorSortKey(a).localeCompare(anchorSortKey(b));
  });
}

function isSameEvidence(anchor: AcceptedAnchor, candidate: LoadedAcceptedEvidence): boolean {
  if (anchor.releaseId !== candidate.evidence.releaseId) return false;
  if (candidate.evidence.kind === 'standard_bundle') {
    return anchor.bundleReceiptId === candidate.evidence.bundleReceiptId;
  }
  return anchor.kind === 'exact_import' && anchor.importReceiptId === candidate.evidence.importReceiptId;
}

/**
 * True when anchor is strictly prior to the candidate evidence.
 *
 * Only `acceptedAt < candidate.acceptedAt` counts. Equal timestamps are never
 * previous — total order is enforced at standard Bundle accept time via the
 * global acceptance lock + strictly increasing importedAt.
 */
export function isStrictlyPriorAnchor(
  anchor: AcceptedAnchor,
  candidate: LoadedAcceptedEvidence,
): boolean {
  if (isSameEvidence(anchor, candidate)) return false;
  if (!candidate.evidence.acceptedAt) return false;

  const candidateAt = new Date(candidate.evidence.acceptedAt).getTime();
  const anchorAt = anchor.acceptedAt.getTime();
  return anchorAt < candidateAt;
}

async function loadAnchor(tx: Tx, anchor: AcceptedAnchor): Promise<LoadedAcceptedEvidence> {
  if (anchor.kind === 'exact_import') {
    return loadExactAcceptedEvidence(tx, anchor.releaseId);
  }
  if (!anchor.bundleReceiptId) {
    fail(`standard anchor for ${anchor.releaseId} is missing bundle receipt id`);
  }
  return loadStandardAcceptedEvidence(tx, anchor.bundleReceiptId);
}

/**
 * Resolve the previous accepted base for a candidate evidence anchor.
 *
 * All base evidence MUST be strictly prior (`acceptedAt < candidate.acceptedAt`).
 * Equal timestamps never count as previous; total order is enforced by the
 * standard Bundle writer via the global acceptance lock and strictly increasing
 * importedAt. Future Releases accepted after the candidate never become its base.
 *
 * Preference among priors:
 * 1. Same-release packaging predecessor
 * 2. Latest cross-release prior
 * 3. Latest remaining prior
 * 4. None → BASELINE
 */
export async function resolveBaseForCandidate(
  tx: Tx,
  candidate: LoadedAcceptedEvidence,
): Promise<LoadedAcceptedEvidence | null> {
  const anchors = await listAcceptedAnchors(tx);
  const priors = anchors.filter((anchor) => isStrictlyPriorAnchor(anchor, candidate));
  if (priors.length === 0) return null;

  const sameReleasePriors = priors.filter((anchor) => (
    anchor.releaseId === candidate.evidence.releaseId
  ));
  if (sameReleasePriors.length > 0) {
    return loadAnchor(tx, sameReleasePriors[sameReleasePriors.length - 1]!);
  }

  const crossRelease = priors.filter((anchor) => (
    anchor.releaseId !== candidate.evidence.releaseId
  ));
  if (crossRelease.length > 0) {
    return loadAnchor(tx, crossRelease[crossRelease.length - 1]!);
  }

  return loadAnchor(tx, priors[priors.length - 1]!);
}

/**
 * Load optional required upstream release_diff Artifact raw JSON for a standard Bundle.
 * Multiple release_diff artifacts are ambiguous and fail closed.
 */
export async function loadUpstreamReleaseDiffRaw(
  tx: Tx,
  candidate: LoadedAcceptedEvidence,
): Promise<{ required: boolean; raw: unknown | null; parseError: string | null }> {
  if (candidate.evidence.kind !== 'standard_bundle' || !candidate.evidence.bundleReceiptId) {
    return { required: false, raw: null, parseError: null };
  }

  const artifacts = await tx.actkgBundleArtifact.findMany({
    where: {
      bundleReceiptId: candidate.evidence.bundleReceiptId,
      role: 'release_diff',
    },
    orderBy: { ordinal: 'asc' },
  });

  if (artifacts.length === 0) {
    return { required: false, raw: null, parseError: null };
  }

  if (artifacts.length > 1) {
    // Ambiguity always fails closed regardless of required flags.
    return {
      required: true,
      raw: null,
      parseError: `ambiguous release_diff artifacts: found ${artifacts.length} rows; exactly one is required`,
    };
  }

  const primary = artifacts[0]!;
  const required = primary.required === true;
  try {
    const text = Buffer.from(primary.bytes).toString('utf8');
    const parsed = JSON.parse(text) as unknown;
    return { required, raw: parsed, parseError: null };
  } catch (error) {
    return {
      required,
      raw: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}
