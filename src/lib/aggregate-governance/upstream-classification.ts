/**
 * Classify opaque upstream RAG published_entity_id values against ACT
 * Canonical Object membership. Relation-type upstream records (130 of 1361
 * for v0.3-r2) are not Canonical Objects and must remain unresolved.
 */

import type { OpaqueUpstreamRagReference, UpstreamReferenceKind } from './contracts';

export interface ClassifiedUpstreamReference extends OpaqueUpstreamRagReference {
  kind: UpstreamReferenceKind;
  /** Only set when kind === 'canonical_object'. */
  canonicalId: string | null;
}

export function classifyUpstreamReference(
  upstream: OpaqueUpstreamRagReference,
  currentCanonicalIds: ReadonlySet<string> | readonly string[],
): ClassifiedUpstreamReference {
  const membership = currentCanonicalIds instanceof Set
    ? currentCanonicalIds
    : new Set(currentCanonicalIds);
  if (membership.has(upstream.publishedEntityId)) {
    return {
      ...upstream,
      kind: 'canonical_object',
      canonicalId: upstream.publishedEntityId,
    };
  }
  return {
    ...upstream,
    kind: 'relation_or_other',
    canonicalId: null,
  };
}

export function classifyUpstreamReferences(
  upstream: readonly OpaqueUpstreamRagReference[],
  currentCanonicalIds: ReadonlySet<string> | readonly string[],
): ClassifiedUpstreamReference[] {
  return upstream.map((row) => classifyUpstreamReference(row, currentCanonicalIds));
}

export function partitionUpstreamByKind(
  classified: readonly ClassifiedUpstreamReference[],
): {
  canonicalObject: ClassifiedUpstreamReference[];
  relationOrOther: ClassifiedUpstreamReference[];
} {
  const canonicalObject: ClassifiedUpstreamReference[] = [];
  const relationOrOther: ClassifiedUpstreamReference[] = [];
  for (const row of classified) {
    if (row.kind === 'canonical_object') canonicalObject.push(row);
    else relationOrOther.push(row);
  }
  return { canonicalObject, relationOrOther };
}
