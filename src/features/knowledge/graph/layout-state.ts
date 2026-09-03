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

interface KnowledgeGraphAutomaticAnchor {
  id: string;
  x: number;
  y: number;
  z?: number;
  /**
   * True when the seed itself arrived as a governed fixed coordinate
   * (root packing, chapter scaffolding). Only governed anchors and
   * explicit user pins own `fx`/`fy` after an unpin (#1739).
   */
  fixed?: boolean;
}

interface KnowledgeGraphMutablePositionNode extends KnowledgeNodeData {
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  __knowledgeUserPinned?: true;
  __knowledgeRootPacking?: unknown;
  __knowledgeAutomaticAnchor?: KnowledgeGraphAutomaticAnchor;
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

/**
 * Record the deterministic automatic seed for every node without claiming
 * fixed-coordinate ownership (#1739). Ordinary nodes stay movable under
 * force ownership; governed root packing and explicit user pins remain the
 * only sources of `fx`/`fy`/`fz`.
 */
export function markKnowledgeGraphAutomaticNodeAnchors<T extends KnowledgeGraphMutablePositionNode>(
  nodes: T[] | undefined
): void {
  if (!nodes) return;
  nodes.forEach((node) => {
    if (node.__knowledgeAutomaticAnchor) return;
    const x = readCoordinate(node.fx ?? node.x ?? node.positionX);
    const y = readCoordinate(node.fy ?? node.y ?? node.positionY);
    if (x === null || y === null) return;
    const z = readCoordinate(node.fz ?? node.z ?? node.positionZ);
    node.__knowledgeAutomaticAnchor = {
      id: node.id,
      x,
      y,
      ...(z === null ? {} : { z }),
      ...(readCoordinate(node.fx) === null ? {} : { fixed: true }),
    };
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
        // Unpin returns the node to force ownership: the automatic anchor
        // becomes a soft seed again, never a fixed coordinate (#1739).
        // Governed root packing is the exception — it stays fixed.
        const automaticAnchor = node.__knowledgeAutomaticAnchor;
        if (automaticAnchor) {
          node.x = automaticAnchor.x;
          node.y = automaticAnchor.y;
          node.positionX = automaticAnchor.x;
          node.positionY = automaticAnchor.y;
          if (automaticAnchor.z === undefined) {
            delete node.z;
            delete node.fz;
          } else {
            node.z = automaticAnchor.z;
            node.positionZ = automaticAnchor.z;
          }
          if (node.__knowledgeRootPacking || automaticAnchor.fixed) {
            node.fx = automaticAnchor.x;
            node.fy = automaticAnchor.y;
            if (automaticAnchor.z !== undefined) node.fz = automaticAnchor.z;
          }
        }
        if (!node.__knowledgeRootPacking && !node.__knowledgeAutomaticAnchor?.fixed) {
          delete node.fx;
          delete node.fy;
          delete node.fz;
        }
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
