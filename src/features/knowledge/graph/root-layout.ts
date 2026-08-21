import type { KnowledgeNodeData } from '../knowledge-graph-system';
import { CHAPTER_DISPLAY_ORDER } from '@/lib/knowledge-labels';
import {
  getKnowledgeNodeLabelBounds,
  getKnowledgeRootLabelBounds,
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

export const KNOWLEDGE_ROOT_BUBBLE_STYLE = {
  surface: 'hsl(var(--platform-action-primary))',
  surfaceDepth: 'hsl(var(--platform-brand-surface-2))',
  highlight: 'hsl(var(--platform-fg-inverse))',
  rim: 'hsl(var(--platform-border-strong))',
  glow: 'hsl(var(--platform-brand-focus-ring))',
  label: 'hsl(var(--platform-fg-inverse))',
  labelBacking: 'hsl(var(--platform-canvas))',
  shininess: 72,
  emissiveIntensity: 0.22,
} as const;

export interface KnowledgeRootPackingViewport {
  viewportWidth: number;
  viewportHeight: number;
  graphVersion?: string | null;
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
    seed: number;
    attempt: number;
    radialDistance: number;
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
  const metadata = (node.metadata ?? {}) as Record<string, unknown>;
  const nodeScale = getKnowledgeNodeScale({
    metadata: node.metadata,
    degree: node.graphDegree,
    focused: true,
  });
  const semanticRegion = getKnowledgeSemanticRegionStyle(node, false);
  const semanticRadius = semanticRegion.enabled
    ? Math.min(semanticRegion.maxRadius, nodeScale.radius * semanticRegion.radiusMultiplier)
    : 0;
  const minimumBodyRadius = Math.max(nodeScale.radius, nodeScale.glowRadius, semanticRadius);
  const nameRadius = Math.ceil(getKnowledgeRootLabelBounds({
    name: node.name,
    minimumBodyRadius,
  }).collisionRadius * 1000) / 1000;
  return typeof metadata.presentationRadius === 'number' && Number.isFinite(metadata.presentationRadius)
    ? Math.max(nameRadius, metadata.presentationRadius)
    : nameRadius;
}

export function getKnowledgeRootCollisionBounds(
  node: KnowledgeNodeData,
  measureText?: KnowledgeNodeLabelMeasureText
) {
  return getKnowledgeRootLabelBounds({
    name: node.name,
    minimumBodyRadius: getKnowledgeRootPresentationRadius(node),
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

function hashRootPackingSeed(value: string): number {
  let hash = 2166136261;
  for (const character of Array.from(value)) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000000) / 1000000;
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
  measureText?: KnowledgeNodeLabelMeasureText,
  compare: (left: T, right: T) => number = compareRootNodes as (left: T, right: T) => number,
): Array<KnowledgeRootPackedNode<T>> {
  if (nodes.length === 0) return [];

  const ordered = [...nodes].sort(compare);
  const labelBoundsById = new Map(ordered.map((node) => [
    node.id,
    getKnowledgeRootCollisionBounds(node, measureText),
  ]));
  const radiusById = new Map(ordered.map((node) => [
    node.id,
    labelBoundsById.get(node.id)!.collisionRadius,
  ]));
  const width = Number.isFinite(viewport.viewportWidth) && viewport.viewportWidth > 0
    ? viewport.viewportWidth
    : 1;
  const height = Number.isFinite(viewport.viewportHeight) && viewport.viewportHeight > 0
    ? viewport.viewportHeight
    : 1;
  const seed = hashRootPackingSeed([
    viewport.graphVersion ?? 'unversioned',
    `${width}x${height}`,
    ordered.map((node) => node.id).join('|'),
  ].join(':'));
  const random = createSeededRandom(seed);
  const aspect = safeViewportAspect(viewport);
  const aspectX = Math.sqrt(aspect);
  const aspectY = 1 / aspectX;
  const averageRadius = [...radiusById.values()].reduce((sum, radius) => sum + radius, 0)
    / ordered.length;
  const radialStep = Math.max(12, averageRadius * 0.42);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const placed: Array<{
    node: T;
    order: number;
    x: number;
    y: number;
    attempt: number;
    collisionRadius: number;
  }> = [];

  ordered.forEach((node, order) => {
    const collisionRadius = radiusById.get(node.id)!;
    if (order === 0) {
      placed.push({ node, order, x: 0, y: 0, attempt: 0, collisionRadius });
      return;
    }
    const phase = random() * Math.PI * 2;
    const jitterPhase = random() * Math.PI * 2;
    for (let attempt = 1; attempt <= 200000; attempt += 1) {
      const radius = radialStep * Math.sqrt(attempt);
      const angle = phase + attempt * goldenAngle;
      const jitter = radialStep * 0.28 * Math.sin(jitterPhase + attempt * 1.61803398875);
      const x = Math.cos(angle) * (radius + jitter) * aspectX;
      const y = Math.sin(angle) * (radius - jitter) * aspectY;
      const collisionFree = placed.every((candidate) => Math.hypot(
        x - candidate.x,
        y - candidate.y,
      ) >= collisionRadius + candidate.collisionRadius + KNOWLEDGE_ROOT_PACKING.minimumGap);
      if (!collisionFree) continue;
      placed.push({ node, order, x, y, attempt, collisionRadius });
      return;
    }
    throw new Error(`Unable to pack knowledge root node ${node.id}`);
  });

  const minimumX = Math.min(...placed.map((item) => item.x - item.collisionRadius));
  const maximumX = Math.max(...placed.map((item) => item.x + item.collisionRadius));
  const minimumY = Math.min(...placed.map((item) => item.y - item.collisionRadius));
  const maximumY = Math.max(...placed.map((item) => item.y + item.collisionRadius));
  const centerX = (minimumX + maximumX) / 2;
  const centerY = (minimumY + maximumY) / 2;

  return placed.map(({ node, order, x: rawX, y: rawY, attempt, collisionRadius }) => {
    const x = roundCoordinate(rawX - centerX);
    const y = roundCoordinate(rawY - centerY);
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
        seed,
        attempt,
        radialDistance: roundCoordinate(Math.hypot(rawX, rawY)),
        collisionRadius,
        labelBounds: labelBoundsById.get(node.id)!,
      },
    };
  });
}
