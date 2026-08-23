import type { ActiveCanvasNode, ActiveCanvasRelation } from './active-authority-graph-contracts';
import {
  createActiveAuthorityGraphModel,
  type ActiveAuthorityGraphModel,
  type ActiveNodePresentation,
  type ActiveRelationView,
} from './active-authority-presentation';
import { visualFamilyFor, type FormalVisualFamily } from '@/lib/formal-runtime-atomic-resource-binding';

export const AUTHORITY_GRAPH_VIEW_MODEL_CONTRACT = 'authority-graph-view-model/v1' as const;

const TEACHING_FAMILIES = [
  'teaching-containment',
  'teaching-prerequisite',
  'teaching-association',
] as const;
export type AuthorityTeachingFamily = (typeof TEACHING_FAMILIES)[number];

const LEGACY_DTO_KEYS = [
  'positionX',
  'positionY',
  'positionZ',
  'bloomLevel',
  'chapterName',
  'graphImportanceScore',
] as const;

export interface AuthorityFormalBindingInput {
  readonly canonicalId: string;
  readonly subtype: 'video' | 'audio' | 'podcast' | 'card' | 'textbook' | 'handout' | 'slides' | 'exercise' | 'simulation' | 'project';
  readonly current: boolean;
  readonly accessible: boolean;
}

export interface AuthorityNodeDecoration {
  readonly visualFamilies: readonly FormalVisualFamily[];
  readonly hasCardStar: boolean;
  readonly hasCrossDomainHalo: boolean;
  readonly glyphRadius: number;
}

export interface AuthorityGraphViewNode {
  readonly canonicalId: string;
  readonly label: string;
  readonly description: string | null;
  readonly canonicalType: string;
  readonly typeLabel: string;
  readonly decoration: AuthorityNodeDecoration;
  readonly presentation: ActiveNodePresentation;
}

export interface AuthorityGraphViewEdge {
  readonly edgeId: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly predicate: string;
  readonly layer: 'ENGINEERING' | 'ACT_TEACHING' | undefined;
  readonly relationFamily: string | null | undefined;
  readonly presentation: ActiveRelationView;
}

export interface AuthorityGraphViewModel {
  readonly contract: typeof AUTHORITY_GRAPH_VIEW_MODEL_CONTRACT;
  readonly nodes: readonly AuthorityGraphViewNode[];
  readonly edges: readonly AuthorityGraphViewEdge[];
  readonly rootNavigation: readonly { visualRole: string; displayName: string }[];
}

export function assertRejectsLegacyGraphDto(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  for (const key of LEGACY_DTO_KEYS) {
    if (key in record) {
      throw new Error(`Authority adapter rejects legacy graph DTO field: ${key}`);
    }
  }
}

export function authorityGlyphRadius(input: {
  familyCount: number;
  hasStar: boolean;
  hasHalo: boolean;
}): number {
  const extra = Math.min(8, input.familyCount * 2 + (input.hasStar ? 2 : 0) + (input.hasHalo ? 2 : 0));
  return Math.min(24, 14 + extra);
}

export function createAuthorityGraphViewModel(input: {
  nodes: readonly ActiveCanvasNode[];
  relations: readonly ActiveCanvasRelation[];
  bindings?: readonly AuthorityFormalBindingInput[];
  crossDomainCanonicalIds?: readonly string[];
  rootNavigation?: readonly { visualRole: string; displayName: string }[];
  enabledNodeTypes?: readonly string[] | null;
  enabledRelationFamilies?: readonly string[] | null;
}): AuthorityGraphViewModel {
  for (const node of input.nodes) assertRejectsLegacyGraphDto(node);
  for (const relation of input.relations) assertRejectsLegacyGraphDto(relation);

  const model = createActiveAuthorityGraphModel({
    nodes: [...input.nodes],
    relations: [...input.relations],
  });
  const haloIds = new Set(input.crossDomainCanonicalIds ?? []);
  const bindingsByNode = new Map<string, AuthorityFormalBindingInput[]>();
  for (const binding of input.bindings ?? []) {
    if (!binding.current || !binding.accessible) continue;
    const rows = bindingsByNode.get(binding.canonicalId) ?? [];
    rows.push(binding);
    bindingsByNode.set(binding.canonicalId, rows);
  }

  const enabledTypes = input.enabledNodeTypes ? new Set(input.enabledNodeTypes) : null;
  const enabledFamilies = input.enabledRelationFamilies ? new Set(input.enabledRelationFamilies) : null;

  const nodes = model.nodes
    .filter((node) => !enabledTypes || enabledTypes.has(node.type.canonicalType))
    .map((node) => {
      const nodeBindings = bindingsByNode.get(node.key) ?? [];
      const families = uniqueFamilies(nodeBindings);
      const hasCardStar = nodeBindings.some((row) => row.subtype === 'card');
      const visualFamilies = hasCardStar
        ? families.filter((family) => family !== 'text')
        : families;
      const hasCrossDomainHalo = haloIds.has(node.key);
      return {
        canonicalId: node.key,
        label: node.label,
        description: node.description,
        canonicalType: node.type.canonicalType,
        typeLabel: node.type.label,
        decoration: {
          visualFamilies,
          hasCardStar,
          hasCrossDomainHalo,
          glyphRadius: authorityGlyphRadius({
            familyCount: visualFamilies.length,
            hasStar: hasCardStar,
            hasHalo: hasCrossDomainHalo,
          }),
        },
        presentation: node,
      };
    });
  const visibleIds = new Set(nodes.map((row) => row.canonicalId));
  const edges = model.relations
    .filter((relation) => {
      if (!visibleIds.has(relation.sourceKey) || !visibleIds.has(relation.targetKey)) return false;
      if (!enabledFamilies) return true;
      const family = relation.sourceRelation.relationFamily;
      if (relation.sourceRelation.layer === 'ACT_TEACHING') {
        return enabledFamilies.has(family ?? 'teaching-prerequisite');
      }
      return family ? enabledFamilies.has(family) : false;
    })
    .map((relation) => ({
      edgeId: relation.key,
      sourceId: relation.sourceKey,
      targetId: relation.targetKey,
      predicate: relation.semantic.predicate,
      layer: relation.sourceRelation.layer,
      relationFamily: relation.sourceRelation.relationFamily,
      presentation: relation,
    }));

  return {
    contract: AUTHORITY_GRAPH_VIEW_MODEL_CONTRACT,
    nodes,
    edges,
    rootNavigation: input.rootNavigation ?? [],
  };
}

export function defaultEnabledTeachingFamilies(): AuthorityTeachingFamily[] {
  return [...TEACHING_FAMILIES];
}

const TEACHING_FAMILY_TO_RUNTIME = {
  'teaching-prerequisite': 'prerequisite',
  'teaching-containment': 'contains',
  'teaching-association': 'association',
} as const;

const SAME_DIRECTION_PREDICATE_TO_RUNTIME: Record<string, string> = {
  PREREQUISITE: 'prerequisite',
  CONTAINMENT: 'contains',
  PEDAGOGICAL_ASSOCIATION: 'association',
  has_formula: 'quantified_by',
  has_representation: 'visualized_by',
  has_component: 'contains',
  is_a: 'instance_of',
  used_to_analyze: 'applies_to',
  association: 'association',
  applies_to: 'applies_to',
};

const SHARED_RUNTIME_RELATION_TYPES = new Set([
  'prerequisite',
  'contains',
  'association',
  'related',
  'applies_to',
  'derives',
  'derived_from',
  'part_of',
  'quantified_by',
  'visualized_by',
  'instance_of',
  'follows',
  'cross_domain',
]);

export function toSharedRuntimeRelationType(input: {
  predicate: string;
  relationFamily?: string | null;
}): string {
  // Reverse published predicates keep their own shared contract instead of
  // mapping onto inverted contains/derives types.
  const family = input.relationFamily ?? '';
  if (family in TEACHING_FAMILY_TO_RUNTIME) {
    return TEACHING_FAMILY_TO_RUNTIME[family as keyof typeof TEACHING_FAMILY_TO_RUNTIME];
  }
  const predicate = input.predicate;
  if (SHARED_RUNTIME_RELATION_TYPES.has(predicate)) return predicate;
  const mapped = SAME_DIRECTION_PREDICATE_TO_RUNTIME[predicate]
    ?? SAME_DIRECTION_PREDICATE_TO_RUNTIME[predicate.toLowerCase()];
  if (mapped && SHARED_RUNTIME_RELATION_TYPES.has(mapped)) return mapped;
  return 'related';
}

export function filterViewModelPreservingIdentities(
  model: AuthorityGraphViewModel,
  input: {
    enabledNodeTypes?: readonly string[] | null;
    enabledRelationFamilies?: readonly string[] | null;
  },
): AuthorityGraphViewModel {
  const enabledTypes = input.enabledNodeTypes ? new Set(input.enabledNodeTypes) : null;
  const enabledFamilies = input.enabledRelationFamilies ? new Set(input.enabledRelationFamilies) : null;
  const nodes = model.nodes.filter((row) => !enabledTypes || enabledTypes.has(row.canonicalType));
  const visibleIds = new Set(nodes.map((row) => row.canonicalId));
  const edges = model.edges.filter((row) => {
    if (!visibleIds.has(row.sourceId) || !visibleIds.has(row.targetId)) return false;
    if (!enabledFamilies) return true;
    if (row.layer === 'ACT_TEACHING') {
      return enabledFamilies.has(row.relationFamily ?? 'teaching-prerequisite');
    }
    return row.relationFamily ? enabledFamilies.has(row.relationFamily) : false;
  });
  return {
    ...model,
    nodes,
    edges,
  };
}

function uniqueFamilies(bindings: readonly AuthorityFormalBindingInput[]): FormalVisualFamily[] {
  const families = new Set<FormalVisualFamily>();
  for (const binding of bindings) {
    families.add(visualFamilyFor(binding.subtype));
  }
  return [...families].sort();
}

export function presentationModelFromView(view: AuthorityGraphViewModel): ActiveAuthorityGraphModel {
  return createActiveAuthorityGraphModel({
    nodes: view.nodes.map((row) => row.presentation.sourceNode),
    relations: view.edges.map((row) => row.presentation.sourceRelation),
  });
}
