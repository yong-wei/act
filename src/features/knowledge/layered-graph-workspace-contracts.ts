/**
 * Knowledge workspace contracts for layered Engineering / Teaching graph (#1273).
 *
 * Pure view-model helpers; does not alter existing engineering predicate
 * rendering paths. Teaching layers are opt-in overlays.
 */

export {
  LAYERED_GRAPH_FILTER_MODES,
  buildLayeredGraphWorkspaceFilterState,
  buildLayeredInspectorEvidenceGroups,
  layeredStatusLabel,
  selectLayeredGraphView,
} from '@/lib/layered-graph/workspace';

export type {
  LayerFilterMode,
  LayeredGraphWorkspaceFilterState,
  LayeredNodeInspectorSections,
} from '@/lib/layered-graph/contracts';

export type { LayeredInspectorEvidenceGroup } from '@/lib/layered-graph/workspace';

export {
  resolveStepDrawerContent,
  resolveStepDrawerEntries,
  teachingResourceTypeLabel,
  teachingRoleLabel,
  type DrawerCardStatus,
  type StepDrawerResolution,
} from '@/lib/layered-graph/drawer';

/** Workspace region ids for layered inspector evidence. */
export const LAYERED_GRAPH_INSPECTOR_REGIONS = [
  'engineering-relations',
  'teaching-prerequisites',
  'teaching-resources',
  'projection-identity',
  'fallback-provenance',
  'not-projected',
] as const;

export type LayeredGraphInspectorRegion =
  (typeof LAYERED_GRAPH_INSPECTOR_REGIONS)[number];

/**
 * Default filter when the workspace opens: engineering authority visible,
 * teaching overlays available but not forced.
 */
export function defaultLayeredGraphFilterMode(): 'mixed' {
  return 'mixed';
}
