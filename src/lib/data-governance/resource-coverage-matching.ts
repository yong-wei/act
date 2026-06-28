import type {
  LearningEvidenceCorpusChunk,
  LearningEvidenceResourceProjectionMetadata,
} from './learning-evidence-rag-corpus';
import type { ResourceNode } from '../resource-node-registry';

export function resourceMatchesGraphCoverageRefs(
  resource: ResourceNode,
  refs: ReadonlySet<string> | readonly string[],
): boolean {
  const refSet = toRefSet(refs);
  return [
    resource.id,
    resource.sourceRef,
    ...resource.sourceRefs.map((ref) => ref.ref),
    ...resource.planningMetadata.knowledgeCoverage,
    ...Object.keys(resource.planningMetadata.abilityImpact),
    ...resource.planningMetadata.evidenceInstrumentation,
  ].some((ref) => refSet.has(ref));
}

export function chunkMatchesGraphCoverageRefs(
  chunk: LearningEvidenceCorpusChunk,
  refs: ReadonlySet<string> | readonly string[],
  linkedResources: readonly ResourceNode[] = [],
): boolean {
  const refSet = toRefSet(refs);
  const projectionRefs = [
    ...learningEvidenceProjectionGraphRefs(chunk.resourceProjection),
    ...chunk.retrieval.tags,
    ...chunk.retrieval.goals,
  ];
  if (chunk.resourceProjection) {
    return projectionRefs.some((ref) => refSet.has(ref));
  }

  const linkedResourceIds = new Set(linkedResources.flatMap((resource) => [
    resource.id,
    `resource:${resource.id}`,
    resource.sourceRef,
  ]));
  return [
    chunk.id,
    chunk.sourceRef.id,
    chunk.sourceRef.resourceId ?? '',
  ].some((ref) => refSet.has(ref) || linkedResourceIds.has(ref));
}

function toRefSet(refs: ReadonlySet<string> | readonly string[]): ReadonlySet<string> {
  return refs instanceof Set ? refs : new Set(refs);
}

export function learningEvidenceProjectionGraphRefs(
  projection: LearningEvidenceResourceProjectionMetadata | null | undefined,
): string[] {
  return uniqueSorted([
    ...(projection?.knowledgeNodeRefs ?? []),
    ...(projection?.capabilityTargetRefs ?? []),
    ...(projection?.graphNodeRefs?.knowledge ?? []),
    ...(projection?.graphNodeRefs?.capability ?? []),
    ...(projection?.graphNodeRefs?.quality ?? []),
  ]);
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)))
    .sort((left, right) => left.localeCompare(right));
}
