export type GraphDataMode = 'active' | 'legacy';
export type GraphDimension = '2d' | '3d';

export interface GraphRuntimeSessionSnapshot {
  readonly selectedNodeId: string | null;
  readonly hoveredNodeId: string | null;
  readonly inspectorOpen: boolean;
  readonly enabledNodeTypes: readonly string[] | null;
  readonly enabledRelationFamilies: readonly string[] | null;
  readonly dimension: GraphDimension;
  readonly cameraKey: string;
}

const EMPTY_SESSION: GraphRuntimeSessionSnapshot = {
  selectedNodeId: null,
  hoveredNodeId: null,
  inspectorOpen: false,
  enabledNodeTypes: null,
  enabledRelationFamilies: null,
  dimension: '2d',
  cameraKey: 'default',
};

export function createEmptyGraphRuntimeSession(): GraphRuntimeSessionSnapshot {
  return { ...EMPTY_SESSION };
}

export function createGraphRuntimeSessionStore(): {
  read(mode: GraphDataMode): GraphRuntimeSessionSnapshot;
  write(mode: GraphDataMode, patch: Partial<GraphRuntimeSessionSnapshot>): GraphRuntimeSessionSnapshot;
  restore(mode: GraphDataMode): GraphRuntimeSessionSnapshot;
} {
  const sessions: Record<GraphDataMode, GraphRuntimeSessionSnapshot> = {
    active: createEmptyGraphRuntimeSession(),
    legacy: createEmptyGraphRuntimeSession(),
  };
  return {
    read(mode) {
      return sessions[mode];
    },
    write(mode, patch) {
      sessions[mode] = { ...sessions[mode], ...patch };
      return sessions[mode];
    },
    restore(mode) {
      return sessions[mode];
    },
  };
}
