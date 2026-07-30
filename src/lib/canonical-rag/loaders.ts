/**
 * Read-only adapters from repository / ACT observations into Canonical RAG.
 *
 * - Crosswalks are wrapped only after joining an authoritative context snapshot.
 * - Structural targets are derived from concrete unit + SourcePack + inventory
 *   observations; callers cannot pass endpoint strings individually.
 */

import type { ActStructuralUnitCrosswalkRecord } from '@/lib/aggregate-governance/contracts';
import type { TextbookStructureUnitProjection } from '@/lib/structured-textbook-runtime';
import type { SourcePackItem } from '@/lib/source-pack/types';

import {
  assertCandidateContextFingerprint,
  attachCandidateContext,
  buildCandidateContextFingerprint,
  type CandidateContextFields,
  type CandidateContextFingerprint,
} from './context-fingerprint';
import type {
  ActStructuralCitationTarget,
  CanonicalRagCoverageEntry,
  CanonicalRagObject,
  CanonicalRagRelation,
  CanonicalRagReleaseContext,
  UpstreamRagReferenceSeed,
  VersionBoundCrosswalk,
} from './contracts';
import { assertCompleteReleaseContext } from './version-context';

export class StructuralObservationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'StructuralObservationError';
    this.field = field;
  }
}

/**
 * Build complete context fingerprint from an independently read authoritative
 * snapshot. All fields required — no compile-time defaults.
 */
export function releaseContextFromAuthoritativeSnapshot(
  input: CandidateContextFields,
): CanonicalRagReleaseContext {
  return buildCandidateContextFingerprint(input);
}

/**
 * Wrap raw Prisma Crosswalk rows after joining an authoritative snapshot.
 * Executable resolver consumes VersionBoundCrosswalk only.
 */
export function wrapCrosswalksFromAuthoritativeSnapshot(
  rows: readonly ActStructuralUnitCrosswalkRecord[],
  context: CanonicalRagReleaseContext,
): VersionBoundCrosswalk[] {
  const closed = assertCompleteReleaseContext(context);
  return [...rows]
    .filter((row) => (
      row.releaseSetId === closed.releaseSetId
      && row.releaseId === closed.releaseId
      && row.deltaReceiptId === closed.deltaReceiptId
      && row.captureRevision === closed.coverageCaptureRevision
      && (row.inventoryRunId == null || row.inventoryRunId === closed.inventoryRunId)
    ))
    .map((row) => ({
      ...closed,
      row,
    }))
    .sort((a, b) => a.row.id.localeCompare(b.row.id));
}

/** @deprecated Use wrapCrosswalksFromAuthoritativeSnapshot. */
export function loadActCrosswalkTargets(
  rows: readonly ActStructuralUnitCrosswalkRecord[],
  release: CanonicalRagReleaseContext,
): VersionBoundCrosswalk[] {
  return wrapCrosswalksFromAuthoritativeSnapshot(rows, release);
}

/**
 * Independent inventory / resource-segment observation (not Crosswalk-sourced).
 */
export interface InventoryResourceSegmentObservation {
  inventoryRunId: string;
  atomicResourceId: string;
  resourceId: string;
  segmentId: string;
  resourceSegmentHash: string;
  captureRevision: string;
}

/**
 * Derive a structural citation target from concrete independent observations.
 *
 * Callers supply the real unit, adapted SourcePack item, inventory observation,
 * and authoritative context. Endpoint strings are derived and cross-checked —
 * they cannot be passed individually to force a match.
 */
export function deriveStructuralTargetFromObservations(input: {
  unit: TextbookStructureUnitProjection;
  sourcePackItem: SourcePackItem;
  inventory: InventoryResourceSegmentObservation;
  context: CanonicalRagReleaseContext;
}): ActStructuralCitationTarget {
  const context = assertCandidateContextFingerprint(input.context);
  const { unit, sourcePackItem, inventory } = input;

  // Derive edition/version from unit identity.
  const sourceEditionId = `${unit.identity.bookId}:${unit.identity.edition}`;
  const sourceVersion = unit.identity.sourceRevision;
  const structuralUnitVersion = unit.identity.sourceRevision;
  const structuralUnitId = unit.id;
  const structuralUnitHash = normalizeHash(unit.contentHash);
  const evidenceContentHash = structuralUnitHash;

  // Retrieval / citation from adapted SourcePack item + unit citation address.
  const retrievalChunkId = requireNonEmpty(
    sourcePackItem.retrievalChunkId,
    'sourcePackItem.retrievalChunkId',
  );
  const citationTargetId = requireNonEmpty(
    sourcePackItem.citationTargetId,
    'sourcePackItem.citationTargetId',
  );
  if (sourcePackItem.citation?.citationTargetId
    && sourcePackItem.citation.citationTargetId !== citationTargetId) {
    throw new StructuralObservationError(
      'sourcePackItem.citation.citationTargetId disagrees with item.citationTargetId',
      'citationTargetId',
    );
  }
  if (sourcePackItem.id !== unit.id) {
    throw new StructuralObservationError(
      'sourcePackItem.id must equal unit.id',
      'sourcePackItem.id',
    );
  }

  const href = unit.href;
  if (!href?.trim()) {
    throw new StructuralObservationError('unit.href is required', 'href');
  }
  if (sourcePackItem.citation?.href && sourcePackItem.citation.href !== href) {
    throw new StructuralObservationError(
      'sourcePackItem.citation.href disagrees with unit.href',
      'href',
    );
  }

  // Content hash consistency between unit and SourcePack metadata when present.
  const itemHash = typeof sourcePackItem.metadata?.contentHash === 'string'
    ? normalizeHash(sourcePackItem.metadata.contentHash)
    : null;
  if (itemHash && itemHash !== structuralUnitHash) {
    throw new StructuralObservationError(
      'sourcePackItem contentHash disagrees with unit.contentHash',
      'contentHash',
    );
  }

  // Resource / segment from unit.resourceProjection + inventory agreement.
  const unitResourceId = unit.resourceProjection.resourceId || unit.id;
  const unitSegmentRef = unit.resourceProjection.segmentRef || unit.id;
  if (inventory.resourceId !== unitResourceId) {
    throw new StructuralObservationError(
      'inventory.resourceId disagrees with unit.resourceProjection.resourceId',
      'resourceId',
    );
  }
  if (inventory.segmentId !== unitSegmentRef && inventory.segmentId !== unit.id) {
    throw new StructuralObservationError(
      'inventory.segmentId disagrees with unit.resourceProjection.segmentRef',
      'segmentId',
    );
  }
  if (inventory.inventoryRunId !== context.inventoryRunId) {
    throw new StructuralObservationError(
      'inventory.inventoryRunId disagrees with context.inventoryRunId',
      'inventoryRunId',
    );
  }
  if (inventory.captureRevision !== context.coverageCaptureRevision) {
    throw new StructuralObservationError(
      'inventory.captureRevision disagrees with context.coverageCaptureRevision',
      'captureRevision',
    );
  }

  const readable = Boolean(unit.text?.trim()) && Boolean(href);
  const locator = unit.citationAddress.locator
    ?? unit.metadata.naturalNumber
    ?? null;

  return {
    ...context,
    structuralUnitId,
    structuralUnitVersion,
    structuralUnitHash,
    retrievalChunkId,
    citationTargetId,
    sourceEditionId,
    sourceVersion,
    evidenceContentHash,
    atomicResourceId: inventory.atomicResourceId,
    resourceId: inventory.resourceId,
    segmentId: inventory.segmentId,
    resourceSegmentHash: inventory.resourceSegmentHash,
    captureRevision: inventory.captureRevision,
    locator: typeof locator === 'string' ? locator : null,
    href,
    displayTitle: unit.title,
    readable,
    observationSource: 'derived-from-independent-observations',
  };
}

/**
 * @deprecated Removed from public construction path. Use
 * deriveStructuralTargetFromObservations with concrete observations.
 */
export function independentObservationFromTextbookUnit(_input: unknown): never {
  throw new StructuralObservationError(
    'independentObservationFromTextbookUnit is removed: use deriveStructuralTargetFromObservations with unit + SourcePackItem + inventory observations',
  );
}

/**
 * @deprecated Use deriveStructuralTargetFromObservations.
 */
export function structuralTargetFromIndependentObservation(_input: unknown): never {
  throw new StructuralObservationError(
    'structuralTargetFromIndependentObservation is removed: use deriveStructuralTargetFromObservations',
  );
}

export function coverageEntriesFromRecords(
  entries: ReadonlyArray<{ canonicalId: string; role: CanonicalRagCoverageEntry['role'] }>,
  context: CanonicalRagReleaseContext,
): CanonicalRagCoverageEntry[] {
  const closed = assertCompleteReleaseContext(context);
  return entries
    .map((entry) => attachCandidateContext({
      canonicalId: entry.canonicalId,
      role: entry.role,
    }, closed))
    .sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
}

export function objectsFromProjectionNodes(
  nodes: ReadonlyArray<{
    nodeId: string;
    entityType: string;
    displayName?: string | null;
    semanticName?: string | null;
    aliases?: readonly string[] | null;
    summary?: string | null;
  }>,
  context: CanonicalRagReleaseContext,
): CanonicalRagObject[] {
  const closed = assertCompleteReleaseContext(context);
  return nodes.map((node) => attachCandidateContext({
    canonicalId: node.nodeId,
    canonicalType: node.entityType,
    label: node.displayName || node.semanticName || node.nodeId,
    aliases: [...(node.aliases ?? [])],
    summary: node.summary ?? null,
  }, closed));
}

export function relationsFromProjectionLinks(
  links: ReadonlyArray<{
    linkId: string;
    relationType: string;
    sourceId: string;
    targetId: string;
  }>,
  context: CanonicalRagReleaseContext,
): CanonicalRagRelation[] {
  const closed = assertCompleteReleaseContext(context);
  return links.map((link) => attachCandidateContext({
    relationId: link.linkId,
    predicate: link.relationType,
    sourceId: link.sourceId,
    targetId: link.targetId,
  }, closed));
}

export function upstreamSeedsFromCrosswalks(
  crosswalks: readonly VersionBoundCrosswalk[],
  context: CanonicalRagReleaseContext,
): Map<string, UpstreamRagReferenceSeed[]> {
  const closed = assertCompleteReleaseContext(context);
  const byCanonical = new Map<string, UpstreamRagReferenceSeed[]>();
  for (const wrapped of crosswalks) {
    if (!membershipEqual(wrapped, closed)) continue;
    const row = wrapped.row;
    if (!row.canonicalId) continue;
    const list = byCanonical.get(row.canonicalId) ?? [];
    list.push({
      publishedEntityId: row.publishedEntityId,
      retrievalChunkId: row.retrievalChunkId,
      citationTargetId: row.citationTargetId,
      canonicalId: row.canonicalId,
      context: closed,
    });
    byCanonical.set(row.canonicalId, list);
  }
  return byCanonical;
}

function membershipEqual(
  a: CandidateContextFingerprint,
  b: CandidateContextFingerprint,
): boolean {
  return a.contextDigest === b.contextDigest
    && a.releaseSetId === b.releaseSetId
    && a.releaseId === b.releaseId
    && a.releaseHash === b.releaseHash
    && a.sourceDatasetHash === b.sourceDatasetHash
    && a.projectionId === b.projectionId
    && a.projectionProfile === b.projectionProfile
    && a.projectionDigest === b.projectionDigest
    && a.deltaReceiptId === b.deltaReceiptId
    && a.coverageOverlayId === b.coverageOverlayId
    && a.coverageOverlayVersion === b.coverageOverlayVersion
    && a.coverageSourceHash === b.coverageSourceHash
    && a.coverageCaptureRevision === b.coverageCaptureRevision
    && a.inventoryRunId === b.inventoryRunId;
}

function normalizeHash(value: string): string {
  return value.replace(/^sha256:/u, '');
}

function requireNonEmpty(value: string | null | undefined, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StructuralObservationError(`${field} is required`, field);
  }
  return value;
}
