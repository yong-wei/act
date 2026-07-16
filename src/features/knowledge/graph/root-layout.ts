import type { KnowledgeNodeData } from '../knowledge-graph-system';
import { CHAPTER_DISPLAY_ORDER } from '@/lib/knowledge-labels';
import {
  getKnowledgeNodeLabelBounds,
  type KnowledgeNodeLabelBounds,
  type KnowledgeNodeLabelMeasureText,
} from './node-label-layout';
import {
  getKnowledgeNodeScale,
  getKnowledgeSemanticRegionStyle,
} from './visual-config';

export const KNOWLEDGE_ROOT_PACKING = {
  minimumGap: 20,
  minimumViewportAspect: 0.4,
  maximumViewportAspect: 2.5,
} as const;

export interface KnowledgeRootPackingViewport {
  viewportWidth: number;
  viewportHeight: number;
}

export interface KnowledgeGraphFitRequest {
  id: number;
  target: 'current' | 'root' | 'teaching-layout';
}

export type KnowledgeRootPackedNode<T extends KnowledgeNodeData = KnowledgeNodeData> = T & {
  x: number;
  y: number;
  z: number;
  fx: number;
  fy: number;
  fz: number;
  __knowledgeRootPacking: {
    order: number;
    row: number;
    column: number;
    collisionRadius: number;
    labelBounds: KnowledgeNodeLabelBounds;
  };
};

const chapterOrderByName = new Map<string, number>(
  CHAPTER_DISPLAY_ORDER.map((name, index) => [name, index])
);

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareRootNodes(left: KnowledgeNodeData, right: KnowledgeNodeData): number {
  const leftOrder = chapterOrderByName.get(left.name);
  const rightOrder = chapterOrderByName.get(right.name);
  if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
  if (leftOrder !== undefined) return -1;
  if (rightOrder !== undefined) return 1;
  return compareText(left.name, right.name) || compareText(left.id, right.id);
}

export function getKnowledgeRootPresentationRadius(node: KnowledgeNodeData): number {
  const nodeScale = getKnowledgeNodeScale({
    metadata: node.metadata,
    degree: node.graphDegree,
    focused: true,
  });
  const semanticRegion = getKnowledgeSemanticRegionStyle(node, false);
  const semanticRadius = semanticRegion.enabled
    ? Math.min(semanticRegion.maxRadius, nodeScale.radius * semanticRegion.radiusMultiplier)
    : 0;
  return Math.ceil(Math.max(nodeScale.radius, nodeScale.glowRadius, semanticRadius) * 1000) / 1000;
}

export function getKnowledgeRootCollisionBounds(
  node: KnowledgeNodeData,
  measureText?: KnowledgeNodeLabelMeasureText
) {
  return getKnowledgeNodeLabelBounds({
    name: node.name,
    bodyRadius: getKnowledgeRootPresentationRadius(node),
    measureText,
  });
}

function safeViewportAspect(viewport: KnowledgeRootPackingViewport): number {
  const width = Number.isFinite(viewport.viewportWidth) && viewport.viewportWidth > 0
    ? viewport.viewportWidth
    : 1;
  const height = Number.isFinite(viewport.viewportHeight) && viewport.viewportHeight > 0
    ? viewport.viewportHeight
    : 1;
  return Math.max(
    KNOWLEDGE_ROOT_PACKING.minimumViewportAspect,
    Math.min(KNOWLEDGE_ROOT_PACKING.maximumViewportAspect, width / height)
  );
}

function calculateGridGeometry<T extends KnowledgeNodeData>(
  nodes: readonly T[],
  boundsById: ReadonlyMap<string, KnowledgeNodeLabelBounds>,
  columns: number
) {
  const rows = Math.ceil(nodes.length / columns);
  const columnHalfWidths = Array.from({ length: columns }, () => 0);
  const rowHalfHeights = Array.from({ length: rows }, () => 0);
  nodes.forEach((node, index) => {
    const bounds = boundsById.get(node.id)!;
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnHalfWidths[column] = Math.max(columnHalfWidths[column], bounds.halfWidth);
    rowHalfHeights[row] = Math.max(rowHalfHeights[row], bounds.halfHeight);
  });
  const width = columnHalfWidths.reduce((sum, radius) => sum + radius * 2, 0)
    + KNOWLEDGE_ROOT_PACKING.minimumGap * Math.max(0, columns - 1);
  const height = rowHalfHeights.reduce((sum, radius) => sum + radius * 2, 0)
    + KNOWLEDGE_ROOT_PACKING.minimumGap * Math.max(0, rows - 1);
  return { rows, columnHalfWidths, rowHalfHeights, width, height };
}

function chooseColumnCount<T extends KnowledgeNodeData>(
  nodes: readonly T[],
  boundsById: ReadonlyMap<string, KnowledgeNodeLabelBounds>,
  viewport: KnowledgeRootPackingViewport
): number {
  const aspect = safeViewportAspect(viewport);
  let best = { columns: 1, score: Number.POSITIVE_INFINITY };
  for (let columns = 1; columns <= nodes.length; columns += 1) {
    const geometry = calculateGridGeometry(nodes, boundsById, columns);
    const gridAspect = geometry.width / geometry.height;
    const emptyCells = columns * geometry.rows - nodes.length;
    const score = Math.abs(Math.log(gridAspect / aspect))
      + emptyCells / Math.max(1, nodes.length) * 0.08;
    if (score < best.score - 1e-12) best = { columns, score };
  }
  return best.columns;
}

export function isCompactKnowledgeRootSet(nodes: readonly KnowledgeNodeData[]): boolean {
  return nodes.length > 0 && nodes.every((node) => {
    const metadata = (node.metadata ?? {}) as Record<string, unknown>;
    return Boolean(metadata.isVirtualChapter || metadata.isCollapsedRoot || node.id.startsWith('chapter-node:'));
  });
}

export function packKnowledgeGraphRootNodes<T extends KnowledgeNodeData>(
  nodes: readonly T[],
  viewport: KnowledgeRootPackingViewport,
  measureText?: KnowledgeNodeLabelMeasureText
): Array<KnowledgeRootPackedNode<T>> {
  if (nodes.length === 0) return [];

  const ordered = [...nodes].sort(compareRootNodes);
  const labelBoundsById = new Map(ordered.map((node) => [
    node.id,
    getKnowledgeRootCollisionBounds(node, measureText),
  ]));
  const radiusById = new Map(ordered.map((node) => [
    node.id,
    labelBoundsById.get(node.id)!.collisionRadius,
  ]));
  const columns = chooseColumnCount(ordered, labelBoundsById, viewport);
  const geometry = calculateGridGeometry(ordered, labelBoundsById, columns);

  const centers = (halfExtents: readonly number[]) => {
    const values: number[] = [];
    let cursor = 0;
    halfExtents.forEach((halfExtent, index) => {
      if (index === 0) {
        cursor = halfExtent;
      } else {
        cursor += halfExtents[index - 1] + KNOWLEDGE_ROOT_PACKING.minimumGap + halfExtent;
      }
      values.push(cursor);
    });
    const minimum = values[0] - halfExtents[0];
    const last = values.length - 1;
    const maximum = values[last] + halfExtents[last];
    const midpoint = (minimum + maximum) / 2;
    return values.map((value) => value - midpoint);
  };

  const xCenters = centers(geometry.columnHalfWidths);
  const yCenters = centers(geometry.rowHalfHeights);

  return ordered.map((node, order) => {
    const row = Math.floor(order / columns);
    const column = order % columns;
    const x = xCenters[column];
    const y = yCenters[row];
    const collisionRadius = radiusById.get(node.id)!;
    return {
      ...node,
      x,
      y,
      z: 0,
      fx: x,
      fy: y,
      fz: 0,
      positionX: x,
      positionY: y,
      positionZ: 0,
      __knowledgeRootPacking: {
        order,
        row,
        column,
        collisionRadius,
        labelBounds: labelBoundsById.get(node.id)!,
      },
    };
  });
}
