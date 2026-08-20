/** Identity-only mapping and impact evidence for the v0.22 rebase. */

import type { TeachingProjectionArtifacts } from '../contracts';
import { projectionDigest } from '../hash';
import type {
  V022AuthorityNodeRecord,
  V022ImpactEvidence,
  V022MappingRecord,
} from './v022-contracts';

const FORBIDDEN_MAPPING_TOKENS = [
  'name',
  'label',
  'alias',
  'similarity',
  'embedding',
  'graph',
  'neighbor',
  'proximity',
  'exact_label',
  'semanticname',
  'semantic_name',
] as const;

export class V022MappingError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'V022MappingError';
    this.code = code;
  }
}

function activeNode(node: V022AuthorityNodeRecord): boolean {
  const lifecycle = String(node.lifecycleStatus ?? 'active').toLowerCase();
  const publication = String(node.publicationStatus ?? 'published').toLowerCase();
  return lifecycle !== 'retired' && lifecycle !== 'draft' && publication !== 'retired' && publication !== 'draft';
}

export function assertV022IdentityOnlyEvidence(evidence: readonly string[]): void {
  const joined = evidence.join(' ').toLowerCase();
  const forbidden = FORBIDDEN_MAPPING_TOKENS.find((token) => joined.includes(token));
  if (forbidden) {
    throw new V022MappingError(
      'name-inference-forbidden',
      `v0.22 mapping evidence cannot use ${forbidden} inference`,
    );
  }
}

export interface V022ReviewedMapping {
  sourceCanonicalId: string;
  sourceCanonicalType: string;
  targetCanonicalId: string;
  targetCanonicalType: string;
  evidence: string[];
  reviewId: string;
}

export interface V022IdentityMappingInput {
  sourceNodes: readonly V022AuthorityNodeRecord[];
  targetNodes: readonly V022AuthorityNodeRecord[];
  referencedCanonicalIds: ReadonlySet<string>;
  reviewedMappings?: readonly V022ReviewedMapping[];
}

function nodeKey(id: string, type: string): string {
  return `${id}\u001f${type}`;
}

/**
 * Compare only canonical ID and canonical type.  The semanticName field is
 * intentionally never read, so v0.22's translated labels cannot alter a
 * binding.
 */
export function classifyV022IdentityMappings(input: V022IdentityMappingInput): V022MappingRecord[] {
  const reviewed = new Map<string, V022ReviewedMapping>();
  for (const row of input.reviewedMappings ?? []) {
    assertV022IdentityOnlyEvidence(row.evidence);
    const key = nodeKey(row.sourceCanonicalId, row.sourceCanonicalType);
    if (reviewed.has(key)) throw new V022MappingError('duplicate-reviewed-mapping', `duplicate reviewed mapping for ${key}`);
    reviewed.set(key, row);
  }
  const targetById = new Map<string, V022AuthorityNodeRecord[]>();
  for (const node of input.targetNodes) {
    const list = targetById.get(node.canonicalId) ?? [];
    list.push(node);
    targetById.set(node.canonicalId, list);
  }
  const records: V022MappingRecord[] = [];
  for (const source of [...input.sourceNodes].sort((a, b) => {
    const ak = nodeKey(a.canonicalId, a.canonicalType);
    const bk = nodeKey(b.canonicalId, b.canonicalType);
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  })) {
    const sourceKey = nodeKey(source.canonicalId, source.canonicalType);
    const explicit = reviewed.get(sourceKey);
    if (explicit) {
      const target = input.targetNodes.find((node) => node.canonicalId === explicit.targetCanonicalId && node.canonicalType === explicit.targetCanonicalType);
      if (!target || !activeNode(target)) {
        records.push({
          sourceCanonicalId: source.canonicalId,
          sourceCanonicalType: source.canonicalType,
          targetCanonicalId: null,
          targetCanonicalType: null,
          disposition: 'REVIEW_REQUIRED',
          reason: 'MISSING_TARGET',
          evidence: [...explicit.evidence, `review:${explicit.reviewId}`].sort(),
        });
      } else {
        records.push({
          sourceCanonicalId: source.canonicalId,
          sourceCanonicalType: source.canonicalType,
          targetCanonicalId: target.canonicalId,
          targetCanonicalType: target.canonicalType,
          disposition: 'CARRY_FORWARD',
          reason: 'EXPLICIT_REVIEWED_MAPPING',
          evidence: [...explicit.evidence, `review:${explicit.reviewId}`].sort(),
        });
      }
      continue;
    }
    const candidates = targetById.get(source.canonicalId) ?? [];
    if (candidates.length === 0) {
      records.push({
        sourceCanonicalId: source.canonicalId,
        sourceCanonicalType: source.canonicalType,
        targetCanonicalId: null,
        targetCanonicalType: null,
        disposition: 'REVIEW_REQUIRED',
        reason: 'MISSING_TARGET',
        evidence: ['canonical-id-absent-in-v022-authority'],
      });
      continue;
    }
    if (candidates.length !== 1) {
      records.push({
        sourceCanonicalId: source.canonicalId,
        sourceCanonicalType: source.canonicalType,
        targetCanonicalId: null,
        targetCanonicalType: null,
        disposition: 'REVIEW_REQUIRED',
        reason: 'DUPLICATE_TARGET',
        evidence: ['canonical-id-not-unique-in-v022-authority'],
      });
      continue;
    }
    const target = candidates[0];
    if (target.canonicalType !== source.canonicalType) {
      records.push({
        sourceCanonicalId: source.canonicalId,
        sourceCanonicalType: source.canonicalType,
        targetCanonicalId: target.canonicalId,
        targetCanonicalType: target.canonicalType,
        disposition: 'REVIEW_REQUIRED',
        reason: 'TYPE_DRIFT',
        evidence: ['canonical-id-matched-but-canonical-type-drifted'],
      });
      continue;
    }
    if (!activeNode(target)) {
      records.push({
        sourceCanonicalId: source.canonicalId,
        sourceCanonicalType: source.canonicalType,
        targetCanonicalId: target.canonicalId,
        targetCanonicalType: target.canonicalType,
        disposition: 'REVIEW_REQUIRED',
        reason: 'SOURCE_NOT_ACTIVE',
        evidence: ['canonical-id-and-type-matched-but-target-not-active'],
      });
      continue;
    }
    records.push({
      sourceCanonicalId: source.canonicalId,
      sourceCanonicalType: source.canonicalType,
      targetCanonicalId: target.canonicalId,
      targetCanonicalType: target.canonicalType,
      disposition: 'CARRY_FORWARD',
      reason: 'IDENTICAL_CANONICAL_ID_AND_TYPE',
      evidence: ['canonical-id-and-canonical-type-identical'],
    });
  }
  for (const target of input.targetNodes) {
    if (!activeNode(target) || input.referencedCanonicalIds.has(target.canonicalId)) continue;
    if (input.sourceNodes.some((source) => source.canonicalId === target.canonicalId)) continue;
    records.push({
      sourceCanonicalId: target.canonicalId,
      sourceCanonicalType: target.canonicalType,
      targetCanonicalId: target.canonicalId,
      targetCanonicalType: target.canonicalType,
      disposition: 'NEW_UNREFERENCED',
      reason: 'UNREFERENCED_NEW_NODE',
      evidence: ['v022-authority-node-not-in-capture-bound-act-denominator'],
    });
  }
  return records.sort((a, b) => {
    const ak = `${a.sourceCanonicalId}\u001f${a.sourceCanonicalType}\u001f${a.disposition}`;
    const bk = `${b.sourceCanonicalId}\u001f${b.sourceCanonicalType}\u001f${b.disposition}`;
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });
}

export function buildV022ImpactEvidence(input: {
  records: readonly V022MappingRecord[];
  historicalExcludedCount?: number;
  unreferencedExcludedCount?: number;
  upstreamImpactEvidence?: {
    status: 'REJECTED_UPSTREAM';
    path: string;
    digest: string;
  };
}): V022ImpactEvidence {
  const records = [...input.records].sort((a, b) => {
    const ak = `${a.sourceCanonicalId}\u001f${a.sourceCanonicalType}\u001f${a.disposition}`;
    const bk = `${b.sourceCanonicalId}\u001f${b.sourceCanonicalType}\u001f${b.disposition}`;
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });
  const evidence = {
    contract: 'act-teaching-projection-v022-impact-evidence/v1' as const,
    directAuthorityDeltaStatus: 'REJECTED_UPSTREAM' as const,
    denominatorKind: 'capture-bound-active-act-teaching-refs' as const,
    carriedForwardCount: records.filter((r) => r.disposition === 'CARRY_FORWARD').length,
    reviewRequiredCount: records.filter((r) => r.disposition === 'REVIEW_REQUIRED').length,
    unreferencedNewNodeCount: records.filter((r) => r.disposition === 'NEW_UNREFERENCED').length,
    excludedHistoricalCount: input.historicalExcludedCount ?? 4880,
    excludedUnreferencedCount: input.unreferencedExcludedCount ?? 0,
    records,
    ...(input.upstreamImpactEvidence ? { upstreamImpactEvidence: input.upstreamImpactEvidence } : {}),
  };
  return { ...evidence, digest: projectionDigest(evidence) };
}

export function assertV022MappingsResolved(evidence: V022ImpactEvidence): void {
  if (evidence.reviewRequiredCount > 0) {
    throw new V022MappingError(
      'review-required',
      `v0.22 identity mapping has ${evidence.reviewRequiredCount} REVIEW_REQUIRED records`,
    );
  }
}

export function resolveV022CanonicalId(
  canonicalId: string,
  evidence: V022ImpactEvidence,
): string {
  const row = evidence.records.find((record) => record.sourceCanonicalId === canonicalId && record.disposition !== 'NEW_UNREFERENCED');
  if (!row || row.disposition === 'REVIEW_REQUIRED' || !row.targetCanonicalId) {
    throw new V022MappingError('review-required', `canonical ID ${canonicalId} is not resolved by identity-only mapping`);
  }
  return row.targetCanonicalId;
}

export function referencedCanonicalIdsFromProjection(artifacts: TeachingProjectionArtifacts): Set<string> {
  const ids = new Set<string>();
  for (const binding of artifacts.bindings) ids.add(binding.canonicalId);
  for (const prerequisite of artifacts.prerequisites) {
    ids.add(prerequisite.sourceCanonicalId);
    ids.add(prerequisite.targetCanonicalId);
  }
  for (const node of artifacts.coreNodes) ids.add(node.canonicalId);
  for (const card of artifacts.cardsIndex.cards) ids.add(card.canonicalId);
  return ids;
}
