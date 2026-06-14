import type { KnowledgeNodeData } from '../knowledge-graph-system';

export interface KnowledgeGraphStoredPosition {
  x: number;
  y: number;
  z?: number;
  pinned: boolean;
}

export interface KnowledgeGraphLayoutState {
  version: number;
  positionsByNodeId: Record<string, KnowledgeGraphStoredPosition>;
}

export interface KnowledgeGraphNodePositionInput {
  id: string;
  x?: number;
  y?: number;
  z?: number;
}

interface KnowledgeGraphMutablePositionNode extends KnowledgeNodeData {
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  __knowledgeUserPinned?: true;
}

const EMPTY_LAYOUT_STATE: KnowledgeGraphLayoutState = {
  version: 0,
  positionsByNodeId: {},
};

function readCoordinate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function getEmptyKnowledgeGraphLayoutState(): KnowledgeGraphLayoutState {
  return EMPTY_LAYOUT_STATE;
}

export function storeKnowledgeGraphNodePosition(
  state: KnowledgeGraphLayoutState | undefined,
  node: KnowledgeGraphNodePositionInput
): KnowledgeGraphLayoutState {
  const x = readCoordinate(node.x);
  const y = readCoordinate(node.y);
  if (!node.id || x === null || y === null) {
    return state ?? EMPTY_LAYOUT_STATE;
  }

  const z = readCoordinate(node.z);
  return {
    version: (state?.version ?? 0) + 1,
    positionsByNodeId: {
      ...(state?.positionsByNodeId ?? {}),
      [node.id]: {
        x,
        y,
        ...(z === null ? {} : { z }),
        pinned: true,
      },
    },
  };
}

export function removeKnowledgeGraphNodePin(
  state: KnowledgeGraphLayoutState,
  nodeId: string
): KnowledgeGraphLayoutState {
  if (!state.positionsByNodeId[nodeId]) return state;
  const { [nodeId]: _removed, ...remainingPositions } = state.positionsByNodeId;
  return {
    version: state.version + 1,
    positionsByNodeId: remainingPositions,
  };
}

export function clearKnowledgeGraphLayoutPins(
  state: KnowledgeGraphLayoutState
): KnowledgeGraphLayoutState {
  if (Object.keys(state.positionsByNodeId).length === 0) return state;
  return {
    version: state.version + 1,
    positionsByNodeId: {},
  };
}

export function isKnowledgeGraphNodePinned(
  state: KnowledgeGraphLayoutState,
  nodeId?: string | null
): boolean {
  return Boolean(nodeId && state.positionsByNodeId[nodeId]);
}

export function getKnowledgeGraphRuntimeNodePosition(
  node: KnowledgeGraphNodePositionInput | undefined | null
): KnowledgeGraphNodePositionInput | null {
  if (!node?.id) return null;
  const x = readCoordinate(node.x);
  const y = readCoordinate(node.y);
  if (x === null || y === null) return null;
  const z = readCoordinate(node.z);
  return {
    id: node.id,
    x,
    y,
    ...(z === null ? {} : { z }),
  };
}

export function applyKnowledgeGraphStoredPositions<T extends KnowledgeNodeData>(
  nodes: T[],
  state: KnowledgeGraphLayoutState
): T[] {
  if (Object.keys(state.positionsByNodeId).length === 0) return nodes;

  return nodes.map((node) => {
    const stored = state.positionsByNodeId[node.id];
    if (!stored) return node;
    return {
      ...node,
      positionX: stored.x,
      positionY: stored.y,
      positionZ: stored.z ?? node.positionZ,
      x: stored.x,
      y: stored.y,
      ...(stored.z === undefined ? {} : { z: stored.z }),
      fx: stored.x,
      fy: stored.y,
      ...(stored.z === undefined ? {} : { fz: stored.z }),
    } as T;
  });
}

export function syncKnowledgeGraphMutableNodePositions<T extends KnowledgeGraphMutablePositionNode>(
  nodes: T[] | undefined,
  state: KnowledgeGraphLayoutState
): void {
  if (!nodes) return;
  nodes.forEach((node) => {
    const stored = state.positionsByNodeId[node.id];
    if (!stored) {
      if (node.__knowledgeUserPinned) {
        delete node.fx;
        delete node.fy;
        delete node.fz;
        delete node.__knowledgeUserPinned;
      }
      return;
    }
    node.x = stored.x;
    node.y = stored.y;
    node.positionX = stored.x;
    node.positionY = stored.y;
    node.fx = stored.x;
    node.fy = stored.y;
    node.__knowledgeUserPinned = true;
    if (stored.z === undefined) {
      return;
    }
    node.z = stored.z;
    node.positionZ = stored.z;
    node.fz = stored.z;
  });
}
