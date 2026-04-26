import type { RuntimeLessonEntryBundle, RuntimeLessonEntryNode } from '@/lib/course-runtime';

type KnowledgeMapGroup = RuntimeLessonEntryBundle['graphOverlay']['groups'][number];
type KnowledgeMapLink = RuntimeLessonEntryBundle['graphOverlay']['links'][number];

export type KnowledgeMapInputNode = Partial<RuntimeLessonEntryNode> & {
  id: string;
  name: string;
  nodeType?: string;
  description?: string;
  knowledgeDim?: string;
};

export type KnowledgeMapPositionedNode = {
  node: KnowledgeMapInputNode;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  columnIndex: number;
  rowIndex: number;
  incomingCount: number;
  outgoingCount: number;
};

export type KnowledgeMapColumn = {
  id: string;
  title: string;
  x: number;
  width: number;
  nodeIds: string[];
};

export type KnowledgeMapLayout = {
  columns: KnowledgeMapColumn[];
  nodes: KnowledgeMapPositionedNode[];
  nodeById: Map<string, KnowledgeMapPositionedNode>;
  validLinks: KnowledgeMapLink[];
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
};

export type KnowledgeMapVisibleLink = KnowledgeMapLink & {
  source: KnowledgeMapPositionedNode;
  target: KnowledgeMapPositionedNode;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  relationLabel: '前置' | '后置' | null;
};

const NODE_WIDTH = 172;
const NODE_HEIGHT = 78;
const COLUMN_WIDTH = 206;
const COLUMN_GAP = 44;
const ROW_GAP = 22;
const MAP_PADDING = 24;
const HEADER_HEIGHT = 58;

function compareByCardOrder(cardOrderIndex: Map<string, number>, originalIndex: Map<string, number>) {
  return (left: string, right: string) => {
    const leftOrder = cardOrderIndex.get(left);
    const rightOrder = cardOrderIndex.get(right);
    if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0);
  };
}

function uniqueExistingNodeIds(
  nodeIds: string[],
  nodeById: Map<string, KnowledgeMapInputNode>,
  assigned: Set<string>,
) {
  const result: string[] = [];
  for (const nodeId of nodeIds) {
    if (!nodeById.has(nodeId) || assigned.has(nodeId) || result.includes(nodeId)) continue;
    result.push(nodeId);
  }
  return result;
}

function createColumnId(title: string, index: number) {
  return `${index + 1}-${title.replace(/\s+/g, '-') || 'stage'}`;
}

function getLineEndpoint(
  source: KnowledgeMapPositionedNode,
  target: KnowledgeMapPositionedNode,
  direction: 'source' | 'target',
) {
  const from = direction === 'source' ? source : target;
  const to = direction === 'source' ? target : source;
  const dx = to.centerX - from.centerX;
  const dy = to.centerY - from.centerY;
  if (dx === 0 && dy === 0) return { x: from.centerX, y: from.centerY };

  const halfWidth = NODE_WIDTH / 2 + 8;
  const halfHeight = NODE_HEIGHT / 2 + 8;
  const scale = Math.min(
    Math.abs(dx) > 0 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY,
    Math.abs(dy) > 0 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY,
  );
  return {
    x: from.centerX + dx * scale,
    y: from.centerY + dy * scale,
  };
}

function resolveRelationLabel(link: KnowledgeMapLink, selectedNodeId: string | null) {
  if (!selectedNodeId) return null;
  if (link.sourceId === selectedNodeId) return '后置';
  if (link.targetId === selectedNodeId) return '前置';
  return null;
}

export function createLessonKnowledgeMapLayout({
  nodes,
  links,
  groups,
  cardOrder,
}: {
  nodes: KnowledgeMapInputNode[];
  links: KnowledgeMapLink[];
  groups: KnowledgeMapGroup[];
  cardOrder: string[];
}): KnowledgeMapLayout {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const cardOrderIndex = new Map(cardOrder.map((nodeId, index) => [nodeId, index]));
  const originalIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const compareNodeIds = compareByCardOrder(cardOrderIndex, originalIndex);
  const assigned = new Set<string>();

  const columns: Array<{ title: string; nodeIds: string[] }> = groups.map((group) => {
    const nodeIds = uniqueExistingNodeIds(group.node_ids ?? [], nodeById, assigned).sort(compareNodeIds);
    nodeIds.forEach((nodeId) => assigned.add(nodeId));
    return {
      title: group.group_name,
      nodeIds,
    };
  });

  const relatedNodeIds = nodes
    .map((node) => node.id)
    .filter((nodeId) => !assigned.has(nodeId))
    .sort(compareNodeIds);
  if (relatedNodeIds.length || !columns.length) {
    columns.push({
      title: '相关知识',
      nodeIds: relatedNodeIds,
    });
  }

  const validLinks = links.filter((link) => nodeById.has(link.sourceId) && nodeById.has(link.targetId));
  const incomingCounts = new Map<string, number>();
  const outgoingCounts = new Map<string, number>();
  for (const link of validLinks) {
    outgoingCounts.set(link.sourceId, (outgoingCounts.get(link.sourceId) ?? 0) + 1);
    incomingCounts.set(link.targetId, (incomingCounts.get(link.targetId) ?? 0) + 1);
  }

  const positionedNodes: KnowledgeMapPositionedNode[] = [];
  columns.forEach((column, columnIndex) => {
    column.nodeIds.forEach((nodeId, rowIndex) => {
      const node = nodeById.get(nodeId);
      if (!node) return;
      const x = MAP_PADDING + columnIndex * (COLUMN_WIDTH + COLUMN_GAP) + (COLUMN_WIDTH - NODE_WIDTH) / 2;
      const y = MAP_PADDING + HEADER_HEIGHT + rowIndex * (NODE_HEIGHT + ROW_GAP);
      positionedNodes.push({
        node,
        x,
        y,
        centerX: x + NODE_WIDTH / 2,
        centerY: y + NODE_HEIGHT / 2,
        columnIndex,
        rowIndex,
        incomingCount: incomingCounts.get(nodeId) ?? 0,
        outgoingCount: outgoingCounts.get(nodeId) ?? 0,
      });
    });
  });

  const maxRows = Math.max(1, ...columns.map((column) => column.nodeIds.length));
  const layoutColumns = columns.map((column, index) => ({
    id: createColumnId(column.title, index),
    title: column.title,
    x: MAP_PADDING + index * (COLUMN_WIDTH + COLUMN_GAP),
    width: COLUMN_WIDTH,
    nodeIds: column.nodeIds,
  }));

  return {
    columns: layoutColumns,
    nodes: positionedNodes,
    nodeById: new Map(positionedNodes.map((node) => [node.node.id, node])),
    validLinks,
    width: MAP_PADDING * 2 + columns.length * COLUMN_WIDTH + Math.max(0, columns.length - 1) * COLUMN_GAP,
    height: MAP_PADDING * 2 + HEADER_HEIGHT + maxRows * NODE_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP,
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
  };
}

export function getVisibleKnowledgeMapLinks(
  layout: KnowledgeMapLayout,
  selectedNodeId: string | null,
  showAllRelations: boolean,
): KnowledgeMapVisibleLink[] {
  return layout.validLinks
    .filter((link) => showAllRelations || link.sourceId === selectedNodeId || link.targetId === selectedNodeId)
    .map((link) => {
      const source = layout.nodeById.get(link.sourceId);
      const target = layout.nodeById.get(link.targetId);
      if (!source || !target) return null;
      const start = getLineEndpoint(source, target, 'source');
      const end = getLineEndpoint(source, target, 'target');
      return {
        ...link,
        source,
        target,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        relationLabel: resolveRelationLabel(link, selectedNodeId),
      };
    })
    .filter((link): link is KnowledgeMapVisibleLink => Boolean(link));
}
