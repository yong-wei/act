/**
 * Semantic Authority cache for a captured predecessor/successor pair.
 *
 * Snapshot and capture identities are intentionally not cache keys. A
 * record is reusable only when the Canonical record itself has the same
 * semantic revision; a new capture of the same published Authority therefore
 * does not turn into a whole-library rebuild.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

export const AUTHORITY_SEMANTIC_CACHE_CONTRACT =
  'authority-semantic-cache/v1' as const;

export interface AuthoritySemanticObject {
  readonly canonicalId: string;
  readonly canonicalType: string;
  readonly semanticName: string | null;
  readonly reviewStatus: string | null;
  readonly publicationStatus: string | null;
  readonly lifecycleStatus: string | null;
  readonly payload: unknown;
}

export interface AuthoritySemanticRelation {
  readonly relationId: string;
  readonly qualityTier: string | null;
  readonly sourceId: string;
  readonly targetId: string;
  readonly relationType: string;
  readonly reviewStatus: string | null;
  readonly publicationStatus: string | null;
  readonly direct: boolean;
  readonly payload: unknown;
}

export interface AuthoritySemanticSurface {
  readonly objects: readonly AuthoritySemanticObject[];
  readonly relations: readonly AuthoritySemanticRelation[];
}

export type AuthoritySemanticCacheDisposition = 'REUSED' | 'RECOMPUTED' | 'RETIRED';

export interface AuthoritySemanticCacheEntry {
  readonly recordId: string;
  readonly kind: 'object' | 'relation';
  readonly predecessorRevision: string | null;
  readonly successorRevision: string | null;
  readonly disposition: AuthoritySemanticCacheDisposition;
}

export interface AuthoritySemanticCache {
  readonly contract: typeof AUTHORITY_SEMANTIC_CACHE_CONTRACT;
  readonly entries: readonly AuthoritySemanticCacheEntry[];
  readonly summary: {
    readonly reusedCount: number;
    readonly recomputedCount: number;
    readonly retiredCount: number;
    readonly objectCount: number;
    readonly relationCount: number;
  };
  readonly cacheHash: string;
}

function semanticObjectRevision(row: AuthoritySemanticObject): string {
  return projectionDigest({
    canonicalId: row.canonicalId,
    canonicalType: row.canonicalType,
    semanticName: row.semanticName,
    reviewStatus: row.reviewStatus,
    publicationStatus: row.publicationStatus,
    lifecycleStatus: row.lifecycleStatus,
    payload: row.payload,
  });
}

function semanticRelationRevision(row: AuthoritySemanticRelation): string {
  return projectionDigest({
    relationId: row.relationId,
    qualityTier: row.qualityTier,
    sourceId: row.sourceId,
    targetId: row.targetId,
    relationType: row.relationType,
    reviewStatus: row.reviewStatus,
    publicationStatus: row.publicationStatus,
    direct: row.direct,
    payload: row.payload,
  });
}

function revisionsById<T>(input: {
  readonly rows: readonly T[];
  readonly kind: 'object' | 'relation';
  readonly identify: (row: T) => string;
  readonly revision: (row: T) => string;
}): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const row of input.rows) {
    const recordId = input.identify(row);
    if (!recordId) throw new Error(`Authority semantic cache ${input.kind} has an empty record id`);
    if (result.has(recordId)) throw new Error(`Authority semantic cache repeats ${input.kind} ${recordId}`);
    result.set(recordId, input.revision(row));
  }
  return result;
}

/**
 * Compute a complete, deterministic semantic cache over both Authority
 * surfaces. Fields such as ordinal and capture revision are deliberately
 * excluded because they do not change what a Canonical object or relation
 * means to downstream derivations.
 */
export function buildAuthoritySemanticCache(input: {
  readonly predecessor: AuthoritySemanticSurface;
  readonly successor: AuthoritySemanticSurface;
}): AuthoritySemanticCache {
  const predecessorObjects = revisionsById({
    rows: input.predecessor.objects,
    kind: 'object',
    identify: (row) => row.canonicalId,
    revision: semanticObjectRevision,
  });
  const successorObjects = revisionsById({
    rows: input.successor.objects,
    kind: 'object',
    identify: (row) => row.canonicalId,
    revision: semanticObjectRevision,
  });
  const predecessorRelations = revisionsById({
    rows: input.predecessor.relations,
    kind: 'relation',
    identify: (row) => row.relationId,
    revision: semanticRelationRevision,
  });
  const successorRelations = revisionsById({
    rows: input.successor.relations,
    kind: 'relation',
    identify: (row) => row.relationId,
    revision: semanticRelationRevision,
  });

  const collect = (
    kind: AuthoritySemanticCacheEntry['kind'],
    predecessor: ReadonlyMap<string, string>,
    successor: ReadonlyMap<string, string>,
  ): AuthoritySemanticCacheEntry[] => [...new Set([...predecessor.keys(), ...successor.keys()])]
    .sort((left, right) => left.localeCompare(right))
    .map((recordId) => {
      const predecessorRevision = predecessor.get(recordId) ?? null;
      const successorRevision = successor.get(recordId) ?? null;
      return {
        recordId,
        kind,
        predecessorRevision,
        successorRevision,
        disposition: successorRevision === null
          ? 'RETIRED'
          : predecessorRevision === successorRevision
            ? 'REUSED'
            : 'RECOMPUTED',
      } satisfies AuthoritySemanticCacheEntry;
    });

  const entries = [
    ...collect('object', predecessorObjects, successorObjects),
    ...collect('relation', predecessorRelations, successorRelations),
  ];
  const summary = {
    reusedCount: entries.filter((entry) => entry.disposition === 'REUSED').length,
    recomputedCount: entries.filter((entry) => entry.disposition === 'RECOMPUTED').length,
    retiredCount: entries.filter((entry) => entry.disposition === 'RETIRED').length,
    objectCount: successorObjects.size,
    relationCount: successorRelations.size,
  } as const;
  return {
    contract: AUTHORITY_SEMANTIC_CACHE_CONTRACT,
    entries,
    summary,
    cacheHash: projectionDigest({
      contract: AUTHORITY_SEMANTIC_CACHE_CONTRACT,
      entries,
      summary,
    }),
  };
}
