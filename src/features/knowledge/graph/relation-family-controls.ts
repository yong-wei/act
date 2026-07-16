import {
  projectKnowledgeGraphRelations,
  type KnowledgeGraphRelationFamily,
  type RawKnowledgeGraphRelation,
} from './relation-contract';

export const KNOWLEDGE_GRAPH_RELATION_FAMILIES = [
  'child',
  'post-requisite',
  'association',
] as const satisfies readonly KnowledgeGraphRelationFamily[];

export const DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES = [
  'post-requisite',
  'association',
] as const satisfies readonly KnowledgeGraphRelationFamily[];

export type RelationFamiliesCheckedState = 'true' | 'mixed' | 'false';

export interface LearnerVisibleRelationEdge {
  family: KnowledgeGraphRelationFamily;
  key: string;
  relationIds: string[];
  relationType: string;
  sourceId: string;
  strength: number | null;
  targetId: string;
}

export interface LearnerRelationLink {
  id: string;
  relation: string;
  relationType?: string;
  sourceId: string;
  strength?: number;
  targetId: string;
}

function normalizeFamilies(
  families: readonly KnowledgeGraphRelationFamily[]
): KnowledgeGraphRelationFamily[] {
  const selected = new Set(families);
  return KNOWLEDGE_GRAPH_RELATION_FAMILIES.filter((family) => selected.has(family));
}

export function getAllFamiliesCheckedState(
  families: readonly KnowledgeGraphRelationFamily[]
): RelationFamiliesCheckedState {
  const selectedCount = new Set(families).size;
  if (selectedCount === 0) return 'false';
  if (KNOWLEDGE_GRAPH_RELATION_FAMILIES.every((family) => families.includes(family))) {
    return 'true';
  }
  return 'mixed';
}

export function toggleAllRelationFamilies(
  families: readonly KnowledgeGraphRelationFamily[]
): KnowledgeGraphRelationFamily[] {
  return getAllFamiliesCheckedState(families) === 'true'
    ? [...DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES]
    : [...KNOWLEDGE_GRAPH_RELATION_FAMILIES];
}

export function toggleRelationFamily(
  families: readonly KnowledgeGraphRelationFamily[],
  family: KnowledgeGraphRelationFamily
): KnowledgeGraphRelationFamily[] {
  const next = new Set(families);
  if (next.has(family)) next.delete(family);
  else next.add(family);
  return normalizeFamilies(Array.from(next));
}

function compareStableIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function selectLearnerVisibleRelationEdges({
  links,
  activeDomainNodeIds,
  enabledFamilies,
  selectedNodeId,
}: {
  links: readonly LearnerRelationLink[];
  activeDomainNodeIds: ReadonlySet<string>;
  enabledFamilies: readonly KnowledgeGraphRelationFamily[];
  selectedNodeId: string | null;
}): LearnerVisibleRelationEdge[] {
  const canonicalEdges = selectCanonicalDomainRelationEdges({ links, activeDomainNodeIds });
  const enabled = new Set(enabledFamilies);
  const selectedIsInDomain = selectedNodeId !== null && activeDomainNodeIds.has(selectedNodeId);
  const visible = canonicalEdges.filter((edge) => enabled.has(edge.family));
  const alwaysEligible = visible.filter((edge) => edge.family !== 'association');
  if (!enabled.has('association') || !selectedIsInDomain) return alwaysEligible;

  const associations = visible
    .filter((edge) => edge.family === 'association')
    .filter((edge) => edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId)
    .sort((left, right) => {
      const strengthDifference = (right.strength ?? 0) - (left.strength ?? 0);
      if (strengthDifference !== 0) return strengthDifference;
      return compareStableIds(left.relationIds[0] ?? left.key, right.relationIds[0] ?? right.key);
    })
    .slice(0, 24);

  return [...alwaysEligible, ...associations];
}

export function selectCanonicalDomainRelationEdges({
  links,
  activeDomainNodeIds,
}: {
  links: readonly LearnerRelationLink[];
  activeDomainNodeIds: ReadonlySet<string>;
}): LearnerVisibleRelationEdge[] {
  const domainLinks = links.filter((link) => (
    typeof link.sourceId === 'string'
    && typeof link.targetId === 'string'
    && activeDomainNodeIds.has(link.sourceId)
    && activeDomainNodeIds.has(link.targetId)
  ));
  const projection = projectKnowledgeGraphRelations(domainLinks.map((link): RawKnowledgeGraphRelation => ({
    id: link.id,
    relationType: link.relationType || link.relation,
    sourceId: link.sourceId,
    strength: link.strength,
    targetId: link.targetId,
  })));
  if (projection.blocked) return [];
  return projection.visualEdges.map(toLearnerEdge);
}

function toLearnerEdge(
  edge: ReturnType<typeof projectKnowledgeGraphRelations>['visualEdges'][number]
): LearnerVisibleRelationEdge {
  return {
    family: edge.family,
    key: edge.key,
    relationIds: edge.contributingRelations.map((relation) => relation.relationId).sort(compareStableIds),
    relationType: edge.contributingRelations[0]?.canonicalType ?? 'related',
    sourceId: edge.sourceId,
    strength: edge.strength,
    targetId: edge.targetId,
  };
}
