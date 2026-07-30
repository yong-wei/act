import {
  RAG_EXPANSION_DEFAULTS,
  RAG_SUPPORTED_OBJECT_TYPES,
  type CanonicalRagCoverageEntry,
  type CanonicalRagObject,
  type CanonicalRagRelation,
  type RelationExpansionResult,
  type RelationExpansionStep,
} from './contracts';
import { admittedCoverageIds } from './entity-alignment';
import { resolveExpansionNeighbor } from './predicate-adapters';

function isSupportedObjectType(canonicalType: string | undefined): boolean {
  if (!canonicalType) return false;
  return (RAG_SUPPORTED_OBJECT_TYPES as readonly string[]).includes(canonicalType);
}

/**
 * Bounded relation expansion over explicit RAG predicate adapters.
 * Unsupported predicates never expand. Directed adapters never expand backwards.
 */
export function expandCanonicalRelations(input: {
  seedCanonicalIds: readonly string[];
  relations: readonly CanonicalRagRelation[];
  objects: readonly CanonicalRagObject[];
  coverage: readonly CanonicalRagCoverageEntry[];
  maxHops?: 0 | 1 | 2;
  maxExpandedObjects?: number;
}): RelationExpansionResult {
  const maxHops = input.maxHops ?? RAG_EXPANSION_DEFAULTS.maxHops;
  const maxExpanded = Math.min(
    Math.max(input.maxExpandedObjects ?? RAG_EXPANSION_DEFAULTS.maxExpandedObjects, 1),
    32,
  );
  const admitted = admittedCoverageIds(input.coverage);
  const typeById = new Map(input.objects.map((row) => [row.canonicalId, row.canonicalType]));
  const seedCanonicalIds = [...new Set(input.seedCanonicalIds)]
    .filter((id) => admitted.has(id))
    .sort((a, b) => a.localeCompare(b));

  const expanded = new Set<string>(seedCanonicalIds);
  const steps: RelationExpansionStep[] = [];
  const skippedUnsupported = new Set<string>();
  let skippedWrongDirection = 0;
  let truncated = false;
  let frontier = [...seedCanonicalIds];

  for (let hop = 1; hop <= maxHops; hop += 1) {
    if (frontier.length === 0) break;
    const nextFrontier: string[] = [];
    for (const fromId of frontier) {
      const adjacent = input.relations.filter(
        (relation) => relation.sourceId === fromId || relation.targetId === fromId,
      );
      for (const relation of adjacent) {
        const resolved = resolveExpansionNeighbor({
          seedId: fromId,
          predicate: relation.predicate,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
        });

        if (resolved.skipReason === 'unsupported-predicate') {
          skippedUnsupported.add(relation.predicate);
          steps.push({
            fromCanonicalId: fromId,
            toCanonicalId: null,
            relationId: relation.relationId,
            predicate: relation.predicate,
            hop,
            supported: false,
            skipReason: 'unsupported-predicate',
          });
          continue;
        }
        if (resolved.skipReason === 'self-loop') {
          steps.push({
            fromCanonicalId: fromId,
            toCanonicalId: fromId,
            relationId: relation.relationId,
            predicate: relation.predicate,
            hop,
            supported: false,
            skipReason: 'self-loop',
          });
          continue;
        }
        if (resolved.skipReason === 'wrong-direction' || !resolved.neighborId) {
          skippedWrongDirection += 1;
          steps.push({
            fromCanonicalId: fromId,
            toCanonicalId: relation.sourceId === fromId ? relation.targetId : relation.sourceId,
            relationId: relation.relationId,
            predicate: relation.predicate,
            hop,
            supported: true,
            skipReason: 'wrong-direction',
          });
          continue;
        }

        const toId = resolved.neighborId;
        if (!admitted.has(toId)) {
          steps.push({
            fromCanonicalId: fromId,
            toCanonicalId: toId,
            relationId: relation.relationId,
            predicate: relation.predicate,
            hop,
            supported: true,
            skipReason: 'outside-coverage',
          });
          continue;
        }
        if (!isSupportedObjectType(typeById.get(toId))) {
          steps.push({
            fromCanonicalId: fromId,
            toCanonicalId: toId,
            relationId: relation.relationId,
            predicate: relation.predicate,
            hop,
            supported: true,
            skipReason: 'unsupported-object-type',
          });
          continue;
        }
        if (expanded.has(toId)) {
          steps.push({
            fromCanonicalId: fromId,
            toCanonicalId: toId,
            relationId: relation.relationId,
            predicate: relation.predicate,
            hop,
            supported: true,
            skipReason: null,
          });
          continue;
        }
        if (expanded.size >= maxExpanded) {
          truncated = true;
          steps.push({
            fromCanonicalId: fromId,
            toCanonicalId: toId,
            relationId: relation.relationId,
            predicate: relation.predicate,
            hop,
            supported: true,
            skipReason: 'budget-exhausted',
          });
          continue;
        }
        expanded.add(toId);
        nextFrontier.push(toId);
        steps.push({
          fromCanonicalId: fromId,
          toCanonicalId: toId,
          relationId: relation.relationId,
          predicate: relation.predicate,
          hop,
          supported: true,
          skipReason: null,
        });
      }
    }
    frontier = nextFrontier.sort((a, b) => a.localeCompare(b));
  }

  const expandedCanonicalIds = [...expanded]
    .filter((id) => !seedCanonicalIds.includes(id))
    .sort((a, b) => a.localeCompare(b));

  return {
    seedCanonicalIds,
    expandedCanonicalIds,
    steps,
    skippedUnsupportedPredicates: [...skippedUnsupported].sort((a, b) => a.localeCompare(b)),
    skippedWrongDirection,
    truncated,
  };
}
