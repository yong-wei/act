import type { KnowledgeNodeData, KnowledgeLinkData } from '../knowledge-graph-system';
import { CHAPTER_DISPLAY_ORDER } from '@/lib/knowledge-labels';
import { CHAPTER_NODE_PREFIX } from './filter-utils';
import type { KnowledgeGraphLayoutState } from './layout-state';

export interface KnowledgeGraphPositionedNode extends KnowledgeNodeData {
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  __knowledgeAutomaticAnchor?: {
    id: string;
    x: number;
    y: number;
    z?: number;
  };
}

export interface KnowledgeGraphFocusedExpansionLayoutInput<T extends KnowledgeGraphPositionedNode> {
  nodes: T[];
  expandedNodeIds: readonly string[];
  directExpansionLinks: readonly KnowledgeLinkData[];
  layoutState: KnowledgeGraphLayoutState;
}

const FOCUSED_EXPANSION_RING_CAPACITY = 8;
const FOCUSED_EXPANSION_FIRST_RING_RADIUS = 96;
const FOCUSED_EXPANSION_RING_GAP = 72;

function compareNodeIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function readFiniteCoordinate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function resolveNodeCenter(
  node: KnowledgeGraphPositionedNode,
  layoutState: KnowledgeGraphLayoutState
): { x: number; y: number } {
  const pinned = layoutState.positionsByNodeId[node.id];
  if (pinned?.pinned) {
    return { x: pinned.x, y: pinned.y };
  }

  const automaticAnchorX = readFiniteCoordinate(node.__knowledgeAutomaticAnchor?.x);
  const automaticAnchorY = readFiniteCoordinate(node.__knowledgeAutomaticAnchor?.y);
  if (automaticAnchorX !== null && automaticAnchorY !== null) {
    return { x: automaticAnchorX, y: automaticAnchorY };
  }

  const runtimeX = readFiniteCoordinate(node.x);
  const runtimeY = readFiniteCoordinate(node.y);
  if (runtimeX !== null && runtimeY !== null) {
    return { x: runtimeX, y: runtimeY };
  }

  return {
    x: readFiniteCoordinate(node.positionX) ?? 0,
    y: readFiniteCoordinate(node.positionY) ?? 0,
  };
}

export function applyFocusedExpansionLayout<T extends KnowledgeGraphPositionedNode>({
  nodes,
  expandedNodeIds,
  directExpansionLinks,
  layoutState,
}: KnowledgeGraphFocusedExpansionLayoutInput<T>): T[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const expandedIds = [...new Set(expandedNodeIds)]
    .filter((nodeId) => nodeById.has(nodeId))
    .sort(compareNodeIds);
  const expandedIdSet = new Set(expandedIds);
  const focusedCoordinates = new Map<string, { x: number; y: number }>();

  expandedIds.forEach((centerId) => {
    const centerNode = nodeById.get(centerId);
    if (!centerNode) return;

    const directChildIds = new Set<string>();
    directExpansionLinks.forEach((link) => {
      if (link.sourceId === centerId && link.targetId !== centerId) {
        directChildIds.add(link.targetId);
      } else if (link.targetId === centerId && link.sourceId !== centerId) {
        directChildIds.add(link.sourceId);
      }
    });

    const orderedChildIds = [...directChildIds]
      .filter((nodeId) => nodeById.has(nodeId) && !expandedIdSet.has(nodeId))
      .sort(compareNodeIds);
    const center = resolveNodeCenter(centerNode, layoutState);

    orderedChildIds.forEach((childId, index) => {
      if (focusedCoordinates.has(childId)) return;
      const ringIndex = Math.floor(index / FOCUSED_EXPANSION_RING_CAPACITY);
      const slotIndex = index % FOCUSED_EXPANSION_RING_CAPACITY;
      const nodesInRing = Math.min(
        FOCUSED_EXPANSION_RING_CAPACITY,
        orderedChildIds.length - ringIndex * FOCUSED_EXPANSION_RING_CAPACITY
      );
      const angle = -Math.PI / 2 + (slotIndex / nodesInRing) * 2 * Math.PI;
      const radius = FOCUSED_EXPANSION_FIRST_RING_RADIUS + ringIndex * FOCUSED_EXPANSION_RING_GAP;
      focusedCoordinates.set(childId, {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    });
  });

  return nodes.map((node) => {
    const pinned = layoutState.positionsByNodeId[node.id];
    const focused = focusedCoordinates.get(node.id);
    if (pinned?.pinned) {
      if (!focused && !expandedIdSet.has(node.id)) return node;
      return {
        ...node,
        x: pinned.x,
        y: pinned.y,
        positionX: pinned.x,
        positionY: pinned.y,
        fx: pinned.x,
        fy: pinned.y,
        ...(pinned.z === undefined
          ? {}
          : { z: pinned.z, positionZ: pinned.z, fz: pinned.z }),
        ...(focused
          ? {
              __knowledgeAutomaticAnchor: {
                id: node.id,
                x: focused.x,
                y: focused.y,
              },
            }
          : {}),
      } as T;
    }

    if (!focused) return node;
    return {
      ...node,
      x: focused.x,
      y: focused.y,
      positionX: focused.x,
      positionY: focused.y,
      fx: focused.x,
      fy: focused.y,
      __knowledgeAutomaticAnchor: {
        id: node.id,
        x: focused.x,
        y: focused.y,
      },
    } as T;
  });
}

/**
 * Calculates a Radial Layout for the graph.
 * Since the data might not be a strict tree, we use a BFS approach to determine "levels" (hops from center).
 * 
 * @param nodes List of nodes
 * @param links List of links
 * @param centerId Optional ID of the center node. If omitted, the node with highest degree is chosen.
 * @param radiusStep Distance between concentric circles
 */
export function applyRadialLayout(
  nodes: KnowledgeNodeData[],
  links: KnowledgeLinkData[],
  centerId?: string,
  radiusStep: number = 150
): KnowledgeNodeData[] {
  if (nodes.length === 0) return [];

  const chapterNodes = nodes.filter((node) => node.id.startsWith(CHAPTER_NODE_PREFIX));
  if (chapterNodes.length > 0) {
    const chapterOrderMap = new Map<string, number>(
      CHAPTER_DISPLAY_ORDER.map((name, index) => [name, index])
    );
    const resultNodes = nodes.map((node) => ({ ...node }));
    const nodeById = new Map(resultNodes.map((node) => [node.id, node]));

    const orderedChapterNodes = [...chapterNodes].sort((a, b) => {
      const orderA = chapterOrderMap.get(a.name);
      const orderB = chapterOrderMap.get(b.name);
      if (typeof orderA === 'number' && typeof orderB === 'number') return orderA - orderB;
      if (typeof orderA === 'number') return -1;
      if (typeof orderB === 'number') return 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });

    const chapterRadius = Math.max(220, orderedChapterNodes.length * 38);
    orderedChapterNodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index / orderedChapterNodes.length) * 2 * Math.PI;
      const x = chapterRadius * Math.cos(angle);
      const y = chapterRadius * Math.sin(angle);
      const target = nodeById.get(node.id);
      if (!target) return;
      (target as any).x = x;
      (target as any).y = y;
      (target as any).fx = x;
      (target as any).fy = y;
      target.positionX = x;
      target.positionY = y;
    });

    const membersByChapter = new Map<string, string[]>();
    links.forEach((link) => {
      const relation = link.relationType || link.relation;
      if (relation !== 'contains') return;
      if (!link.sourceId.startsWith(CHAPTER_NODE_PREFIX)) return;
      if (!nodeById.has(link.targetId)) return;
      const list = membersByChapter.get(link.sourceId) ?? [];
      list.push(link.targetId);
      membersByChapter.set(link.sourceId, list);
    });

    orderedChapterNodes.forEach((chapterNode) => {
      const chapter = nodeById.get(chapterNode.id);
      if (!chapter) return;
      const chapterX = (chapter as any).x ?? 0;
      const chapterY = (chapter as any).y ?? 0;
      const members = membersByChapter.get(chapterNode.id) ?? [];
      members.forEach((memberId, index) => {
        const member = nodeById.get(memberId);
        if (!member) return;
        const ring = Math.floor(index / 16);
        const angle = (index % 16) * ((2 * Math.PI) / 16) - Math.PI / 2;
        const radius = 65 + ring * 26;
        const x = chapterX + radius * Math.cos(angle);
        const y = chapterY + radius * Math.sin(angle);
        (member as any).x = x;
        (member as any).y = y;
        member.positionX = x;
        member.positionY = y;
      });
    });

    const unassigned = resultNodes.filter(
      (node) => !node.id.startsWith(CHAPTER_NODE_PREFIX) && (node as any).x === undefined
    );
    unassigned.forEach((node, index) => {
      const angle = (index / Math.max(1, unassigned.length)) * 2 * Math.PI;
      const radius = chapterRadius + 150;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      (node as any).x = x;
      (node as any).y = y;
      node.positionX = x;
      node.positionY = y;
    });

    return resultNodes;
  }

  // 1. Build Adjacency List & Degree Count
  const adjacency: Record<string, string[]> = {};
  const degrees: Record<string, number> = {};
  
  nodes.forEach(n => {
    adjacency[n.id] = [];
    degrees[n.id] = 0;
  });

  links.forEach(link => {
    if (adjacency[link.sourceId]) adjacency[link.sourceId].push(link.targetId);
    if (adjacency[link.targetId]) adjacency[link.targetId].push(link.sourceId);
    
    degrees[link.sourceId] = (degrees[link.sourceId] || 0) + 1;
    degrees[link.targetId] = (degrees[link.targetId] || 0) + 1;
  });

  // 2. Determine Center Node
  let rootId = centerId;
  if (!rootId) {
    // Find node with max degree
    let maxDegree = -1;
    for (const id in degrees) {
      if (degrees[id] > maxDegree) {
        maxDegree = degrees[id];
        rootId = id;
      }
    }
  }

  if (!rootId) return nodes; // Should not happen if nodes > 0

  // 3. BFS to assign levels (depth)
  const levels: Record<string, number> = {};
  const visited = new Set<string>();
  const queue: { id: string; level: number }[] = [{ id: rootId, level: 0 }];
  
  visited.add(rootId);
  levels[rootId] = 0;

  let maxLevel = 0;

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    maxLevel = Math.max(maxLevel, level);

    const neighbors = adjacency[id] || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        levels[neighborId] = level + 1;
        queue.push({ id: neighborId, level: level + 1 });
      }
    }
  }

  // Handle disconnected nodes (assign to maxLevel + 1)
  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      levels[n.id] = maxLevel + 1;
    }
  });

  // 4. Assign Coordinates
  // Group nodes by level
  const nodesByLevel: Record<number, KnowledgeNodeData[]> = {};
  nodes.forEach(n => {
    const lvl = levels[n.id];
    if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
    nodesByLevel[lvl].push(n);
  });

  // Assign x, y
  // Level 0 is at (0,0)
  const resultNodes = nodes.map(n => ({ ...n })); // Clone to avoid mutating original state refs if any

  resultNodes.forEach(n => {
    const lvl = levels[n.id];
    
    if (lvl === 0) {
      n.positionX = 0;
      n.positionY = 0; // Using 2D plane, mapping to positionX/Y (or we can use x/y for the library)
      // Note: react-force-graph uses x, y. Our data has positionX, positionY, positionZ.
      // We will inject x, y properties.
      (n as any).x = 0;
      (n as any).y = 0;
      (n as any).fx = 0; // Fix the center? Optional. Let's not fix it so it can drift slightly.
      (n as any).fy = 0;
      return;
    }

    const levelNodes = nodesByLevel[lvl];
    const index = levelNodes.findIndex(node => node.id === n.id);
    const totalInLevel = levelNodes.length;
    
    // Spread evenly around the circle
    // We add a random phase shift per level to avoid alignment artifacts
    const phaseShift = lvl * (Math.PI / 4); 
    const angle = (index / totalInLevel) * 2 * Math.PI + phaseShift;
    const radius = lvl * radiusStep;

    (n as any).x = radius * Math.cos(angle);
    (n as any).y = radius * Math.sin(angle);
  });

  return resultNodes;
}
