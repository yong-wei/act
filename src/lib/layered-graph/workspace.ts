/**
 * Pure workspace filter and inspector view models for layered graph UI (#1273).
 *
 * Does not change engineering predicate rendering; teaching overlays are opt-in.
 */

import type {
  LayerFilterMode,
  LayeredGraphPayload,
  LayeredGraphWorkspaceFilterState,
  LayeredNodeInspectorSections,
} from './contracts';
import { buildLayeredNodeInspectorSections } from './payload';
import {
  teachingResourceTypeLabel,
  teachingRoleLabel,
} from './drawer';

export const LAYERED_GRAPH_FILTER_MODES: LayerFilterMode[] = [
  'engineering-only',
  'teaching-only',
  'resources-only',
  'mixed',
  'all',
];

export function buildLayeredGraphWorkspaceFilterState(
  mode: LayerFilterMode,
  engineeringPredicateFilter: readonly string[] | null = null,
): LayeredGraphWorkspaceFilterState {
  switch (mode) {
    case 'engineering-only':
      return {
        mode,
        showEngineering: true,
        showTeachingPrerequisites: false,
        showTeachingResources: false,
        engineeringPredicateFilter,
      };
    case 'teaching-only':
      return {
        mode,
        showEngineering: false,
        showTeachingPrerequisites: true,
        showTeachingResources: false,
        engineeringPredicateFilter,
      };
    case 'resources-only':
      return {
        mode,
        showEngineering: false,
        showTeachingPrerequisites: false,
        showTeachingResources: true,
        engineeringPredicateFilter,
      };
    case 'mixed':
      return {
        mode,
        showEngineering: true,
        showTeachingPrerequisites: true,
        showTeachingResources: true,
        engineeringPredicateFilter,
      };
    case 'all':
    default:
      return {
        mode: 'all',
        showEngineering: true,
        showTeachingPrerequisites: true,
        showTeachingResources: true,
        engineeringPredicateFilter,
      };
  }
}

export interface LayeredInspectorEvidenceGroup {
  id:
    | 'engineering-relations'
    | 'teaching-prerequisites'
    | 'teaching-resources'
    | 'projection-identity'
    | 'fallback-provenance'
    | 'not-projected';
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
}

/**
 * Build inspector evidence groups for a selected Canonical node.
 * Engineering predicates remain exact and separate from teaching groups.
 */
export function buildLayeredInspectorEvidenceGroups(input: {
  payload: LayeredGraphPayload;
  canonicalId: string;
}): {
  sections: LayeredNodeInspectorSections;
  groups: LayeredInspectorEvidenceGroup[];
  filterHints: LayeredGraphWorkspaceFilterState;
} {
  const sections = buildLayeredNodeInspectorSections(input);
  const groups: LayeredInspectorEvidenceGroup[] = [];

  if (sections.engineering.present) {
    groups.push({
      id: 'engineering-relations',
      label: '工程关系',
      items: sections.engineering.relations.map((relation) => ({
        id: relation.relationId,
        label: relation.relationType,
        detail: `${relation.sourceId} → ${relation.targetId}`,
      })),
    });
  }

  if (
    sections.teachingPrerequisites.incoming.length > 0
    || sections.teachingPrerequisites.outgoing.length > 0
  ) {
    groups.push({
      id: 'teaching-prerequisites',
      label: '教学先修',
      items: [
        ...sections.teachingPrerequisites.incoming.map((edge) => ({
          id: `${edge.prerequisiteId}:in`,
          label: `${edge.strength} 先修`,
          detail: `${edge.sourceCanonicalId} → ${edge.targetCanonicalId}`,
        })),
        ...sections.teachingPrerequisites.outgoing.map((edge) => ({
          id: `${edge.prerequisiteId}:out`,
          label: `${edge.strength} 引出`,
          detail: `${edge.sourceCanonicalId} → ${edge.targetCanonicalId}`,
        })),
      ],
    });
  }

  if (sections.teachingResources.status === 'NOT_PROJECTED') {
    groups.push({
      id: 'not-projected',
      label: '课程投影状态',
      items: [
        {
          id: `not-projected:${sections.canonicalId}`,
          label: 'NOT_PROJECTED',
          detail: '该工程节点尚未绑定到当前课程范围，不表示上游图谱缺陷。',
        },
      ],
    });
  } else if (sections.teachingResources.bindings.length > 0) {
    groups.push({
      id: 'teaching-resources',
      label: '教学资源',
      items: sections.teachingResources.bindings.map((binding) => ({
        id: binding.bindingId,
        label: `${teachingResourceTypeLabel(binding.resourceType)} · ${teachingRoleLabel(binding.role)}`,
        detail: binding.resourceTitle ?? binding.resourceId,
      })),
    });
  }

  groups.push({
    id: 'projection-identity',
    label: '投影身份',
    items: [
      {
        id: 'projection-id',
        label: 'Projection',
        detail:
          sections.projectionIdentity.projectionId
          ?? sections.teachingResources.status,
      },
      {
        id: 'scope-id',
        label: 'Scope',
        detail: sections.projectionIdentity.scopeId ?? '—',
      },
      {
        id: 'optional-card',
        label: '可选卡片',
        detail: sections.teachingResources.optionalCardStatus,
      },
    ],
  });

  if (sections.fallback) {
    groups.push({
      id: 'fallback-provenance',
      label: '兼容回退',
      items: [
        {
          id: 'fallback-kind',
          label: sections.fallback.kind,
          detail: sections.fallback.adapterId,
        },
        {
          id: 'fallback-projection',
          label: '回退投影',
          detail:
            sections.fallback.projectionId
            ?? sections.fallback.reasons.join('; '),
        },
      ],
    });
  }

  return {
    sections,
    groups,
    filterHints: buildLayeredGraphWorkspaceFilterState('mixed'),
  };
}

/**
 * Apply layer filters to payload for rendering. Engineering predicate list is
 * preserved when filtering — callers still render exact predicates.
 */
export function selectLayeredGraphView(input: {
  payload: LayeredGraphPayload;
  filter: LayeredGraphWorkspaceFilterState;
}): {
  nodes: LayeredGraphPayload['engineering']['nodes'];
  engineeringRelations: LayeredGraphPayload['engineering']['relations'];
  teachingEdges: LayeredGraphPayload['teachingPrerequisites']['edges'];
  resourceBindings: LayeredGraphPayload['teachingResources']['bindings'];
  engineeringPredicates: string[];
  layerStatuses: {
    engineering: string;
    teachingPrerequisites: string;
    teachingResources: string;
  };
  fallback: LayeredGraphPayload['fallback'];
} {
  const { payload, filter } = input;
  const predicateFilter = filter.engineeringPredicateFilter;

  const engineeringRelations = filter.showEngineering
    ? payload.engineering.relations.filter((relation) =>
      !predicateFilter
      || predicateFilter.length === 0
      || predicateFilter.includes(relation.relationType),
    )
    : [];

  const nodes = filter.showEngineering
    || filter.showTeachingPrerequisites
    || filter.showTeachingResources
    ? payload.engineering.nodes
    : [];

  return {
    nodes,
    engineeringRelations,
    teachingEdges: filter.showTeachingPrerequisites
      ? payload.teachingPrerequisites.edges
      : [],
    resourceBindings: filter.showTeachingResources
      ? payload.teachingResources.bindings
      : [],
    // Exact predicate vocabulary is never rewritten by teaching layers.
    engineeringPredicates: [...payload.engineering.predicates],
    layerStatuses: {
      engineering: payload.engineering.identity.status,
      teachingPrerequisites: payload.teachingPrerequisites.identity.status,
      teachingResources: payload.teachingResources.identity.status,
    },
    fallback: payload.fallback,
  };
}

/** Student-safe status labels (no Rust/WASM/implementation detail). */
export function layeredStatusLabel(status: string): string {
  switch (status) {
    case 'ready':
      return '就绪';
    case 'absent':
      return '未提供';
    case 'NOT_PROJECTED':
      return '未投影到当前课程';
    case 'unavailable':
      return '暂不可用';
    case 'identity-drift':
      return '版本不一致';
    case 'fallback':
      return '兼容回退';
    default:
      return status;
  }
}
