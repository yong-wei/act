import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  forceZ,
} from 'd3-force-3d';

import type { KnowledgeLinkData, KnowledgeNodeData } from '../../knowledge-graph-system';
import type { GraphDimension } from '../../graph-runtime-session';
import type { KnowledgeGraphLayoutState } from '../layout-state';
import { computeKnowledgeForceStructureSignature } from '../force-lifecycle';
import {
  deriveKnowledgeNodeCanvasName,
  getKnowledgeRootLabelBounds,
  layoutKnowledgeNodeLabel,
} from '../node-label-layout';

/** Root bubble size grows with the domain's knowledge-point count; the name and caption always fit inside. */
export const ACTIVE_ROOT_BUBBLE = {
  baseRadius: 48,
  radiusPerSqrtMember: 2,
  captionHeight: 18,
  packingGap: 18,
} as const;

export const ACTIVE_AUTHORITY_LABEL_DOM_BUDGET = 192;
export const ACTIVE_AUTHORITY_LABEL_SCREEN_BUDGET = 144;
export const ACTIVE_AUTHORITY_LABEL_FONT_SIZE = 13;
export const ACTIVE_AUTHORITY_ROOT_LABEL_FONT_SIZE = 14;

export interface ActiveAuthorityLayoutNode extends KnowledgeNodeData {
  x: number;
  y: number;
  z: number;
  renderRadius: number;
  layoutLevel: number;
  layoutComponent: number;
}

export interface ActiveAuthorityLayoutLink extends KnowledgeLinkData {
  source?: string | ActiveAuthorityLayoutNode;
  target?: string | ActiveAuthorityLayoutNode;
}

export interface ActiveAuthorityWorldBounds {
  x: [number, number];
  y: [number, number];
  z: [number, number];
  center: { x: number; y: number; z: number };
  width: number;
  height: number;
  depth: number;
}

export interface ActiveAuthorityLabelDescriptor {
  id: string;
  displayName: string;
  accessibleName: string;
  fallbackLines: readonly string[];
  richTitle?: KnowledgeNodeData['richTitle'];
  mathematics?: KnowledgeNodeData['mathematics'];
  humanContext?: string;
  width: number;
  height: number;
  fontSize: number;
  priority: number;
  isRoot: boolean;
  /** World-space glyph radius the label is anchored to. */
  anchorRadius: number;
  /** Secondary line shown inside root bubbles (knowledge-point count, mastery). */
  caption?: string;
}

export interface ActiveAuthorityLabelPlacement extends ActiveAuthorityLabelDescriptor {
  x: number;
  y: number;
  visible: boolean;
  opacity: number;
}

interface MutableLayoutNode extends ActiveAuthorityLayoutNode {
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
  __clusterX: number;
  __clusterY: number;
  __levelY: number;
  __clusterZ: number;
  __flowHorizontal?: boolean;
}

interface ComponentBucket {
  key: string;
  members: MutableLayoutNode[];
}

interface ActiveAuthorityNodeMetadata {
  presentationKind?: unknown;
  presentationRadius?: unknown;
  memberCount?: unknown;
  nodeCount?: unknown;
  decoration?: { glyphRadius?: unknown };
}

function metadataFor(node: KnowledgeNodeData): ActiveAuthorityNodeMetadata {
  return (node.metadata ?? {}) as ActiveAuthorityNodeMetadata;
}

function isRootNode(node: KnowledgeNodeData): boolean {
  const metadata = metadataFor(node);
  return metadata.presentationKind === 'domain'
    || metadata.presentationKind === 'aggregate'
    || metadata.presentationKind === 'active-root-navigation'
    || node.id.startsWith('root-entry-');
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function activeRootBubbleRadius(node: Pick<KnowledgeNodeData, 'name' | 'metadata'>): number {
  const metadata = (node.metadata ?? {}) as ActiveAuthorityNodeMetadata;
  const members = Math.max(0, finite(metadata.memberCount, finite(metadata.nodeCount, 16)));
  const label = getKnowledgeRootLabelBounds({ name: node.name });
  const fitRadius = Math.hypot(label.halfWidth, label.halfHeight + ACTIVE_ROOT_BUBBLE.captionHeight / 2);
  const sizedRadius = ACTIVE_ROOT_BUBBLE.baseRadius + ACTIVE_ROOT_BUBBLE.radiusPerSqrtMember * Math.sqrt(members);
  return Math.ceil(Math.max(fitRadius, sizedRadius));
}

function nodeRadius(node: KnowledgeNodeData): number {
  const metadata = metadataFor(node);
  if (isRootNode(node)) return activeRootBubbleRadius(node);
  const glyphRadius = finite(metadata.decoration?.glyphRadius, 12);
  const importance = finite(node.graphImportanceScore ?? node.importance, 0.5);
  return Math.max(9, Math.min(17, glyphRadius * 0.45 + importance * 2));
}

/** World-space spacing a domain node needs so its glyph and external label stay clear of neighbours. */
function domainCollisionRadius(node: MutableLayoutNode): number {
  const label = layoutKnowledgeNodeLabel(deriveKnowledgeNodeCanvasName(node.name));
  return Math.max(node.renderRadius, label.width * 0.5 * 0.62, (label.height + node.renderRadius * 2) * 0.5) + 10;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (const character of input) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableUnit(input: string): number {
  return stableHash(input) / 0xffffffff;
}

function isPrerequisite(link: Pick<KnowledgeLinkData, 'relation' | 'relationType'>): boolean {
  const relation = `${link.relationType ?? ''}:${link.relation ?? ''}`.toLowerCase();
  return relation.includes('prerequisite') || relation.includes('先修');
}

function validLinks(
  nodes: readonly ActiveAuthorityLayoutNode[],
  links: readonly KnowledgeLinkData[],
): KnowledgeLinkData[] {
  const ids = new Set(nodes.map((node) => node.id));
  return links
    .filter((link) => ids.has(link.sourceId) && ids.has(link.targetId))
    .sort((left, right) => left.id.localeCompare(right.id)
      || left.sourceId.localeCompare(right.sourceId)
      || left.targetId.localeCompare(right.targetId));
}

function unionFind(ids: readonly string[], links: readonly KnowledgeLinkData[]): Map<string, string> {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const join = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    parent.set(leftRoot, rightRoot);
  };
  links.forEach((link) => join(link.sourceId, link.targetId));
  return new Map(ids.map((id) => [id, find(id)]));
}

function prerequisiteLevels(
  ids: readonly string[],
  links: readonly KnowledgeLinkData[],
): Map<string, number> {
  const levels = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));
  const incomingCount = new Map(ids.map((id) => [id, 0]));
  const seen = new Set<string>();
  links
    .filter(isPrerequisite)
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((link) => {
      const edgeKey = `${link.sourceId}\u0000${link.targetId}`;
      if (seen.has(edgeKey)) return;
      seen.add(edgeKey);
      outgoing.get(link.sourceId)?.push(link.targetId);
      incomingCount.set(link.targetId, (incomingCount.get(link.targetId) ?? 0) + 1);
    });

  const queue = ids.filter((id) => incomingCount.get(id) === 0).sort();
  while (queue.length > 0) {
    const sourceId = queue.shift()!;
    const sourceLevel = levels.get(sourceId) ?? 0;
    for (const targetId of outgoing.get(sourceId) ?? []) {
      levels.set(targetId, Math.max(levels.get(targetId) ?? 0, sourceLevel + 1));
      const remaining = (incomingCount.get(targetId) ?? 0) - 1;
      incomingCount.set(targetId, remaining);
      if (remaining === 0) queue.push(targetId);
    }
    queue.sort();
  }
  return levels;
}

function centerNodes(nodes: MutableLayoutNode[], includeZ: boolean): void {
  if (nodes.length === 0) return;
  const minX = Math.min(...nodes.map((node) => node.x - node.renderRadius));
  const maxX = Math.max(...nodes.map((node) => node.x + node.renderRadius));
  const minY = Math.min(...nodes.map((node) => node.y - node.renderRadius));
  const maxY = Math.max(...nodes.map((node) => node.y + node.renderRadius));
  const minZ = Math.min(...nodes.map((node) => node.z - node.renderRadius));
  const maxZ = Math.max(...nodes.map((node) => node.z + node.renderRadius));
  const offsetX = (minX + maxX) / 2;
  const offsetY = (minY + maxY) / 2;
  const offsetZ = includeZ ? (minZ + maxZ) / 2 : 0;
  nodes.forEach((node) => {
    node.x -= offsetX;
    node.y -= offsetY;
    node.z -= offsetZ;
  });
}

function applyStoredPositions(
  nodes: MutableLayoutNode[],
  layoutState: KnowledgeGraphLayoutState | undefined,
): boolean {
  const positions = layoutState?.positionsByNodeId ?? {};
  let hasStoredPosition = false;
  nodes.forEach((node) => {
    const stored = positions[node.id];
    if (!stored || !Number.isFinite(stored.x) || !Number.isFinite(stored.y)) return;
    hasStoredPosition = true;
    node.x = stored.x;
    node.y = stored.y;
    node.positionX = stored.x;
    node.positionY = stored.y;
    node.fx = stored.x;
    node.fy = stored.y;
    if (Number.isFinite(stored.z)) {
      node.z = stored.z!;
      node.positionZ = stored.z!;
      node.fz = stored.z!;
    }
  });
  return hasStoredPosition;
}

/**
 * Deterministic compact cluster: largest bubbles settle near the centre, the rest follow a
 * golden-angle spiral (stretched to a 16:10 canvas) and take the first collision-free slot.
 */
function packRootBubbles(nodes: MutableLayoutNode[]): void {
  const aspectX = Math.sqrt(1.6);
  const aspectY = 1 / aspectX;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const bySize = [...nodes].sort((left, right) => right.renderRadius - left.renderRadius || left.id.localeCompare(right.id));
  const averageRadius = bySize.reduce((sum, node) => sum + node.renderRadius, 0) / Math.max(1, bySize.length);
  const step = Math.max(6, averageRadius * 0.18);
  const placed: MutableLayoutNode[] = [];
  bySize.forEach((node, order) => {
    if (order === 0) {
      node.x = 0;
      node.y = 0;
      placed.push(node);
      return;
    }
    const phase = stableUnit(`root-pack:${node.id}`) * Math.PI * 2;
    for (let attempt = 1; attempt <= 40000; attempt += 1) {
      const distance = step * Math.sqrt(attempt) * 2.2;
      const angle = phase + attempt * goldenAngle;
      const x = Math.cos(angle) * distance * aspectX;
      const y = Math.sin(angle) * distance * aspectY;
      const clear = placed.every((other) => Math.hypot(x - other.x, y - other.y)
        >= node.renderRadius + other.renderRadius + ACTIVE_ROOT_BUBBLE.packingGap);
      if (!clear) continue;
      node.x = x;
      node.y = y;
      placed.push(node);
      return;
    }
    node.x = (order % 2 === 0 ? 1 : -1) * order * averageRadius * 2.4;
    node.y = 0;
    placed.push(node);
  });
}

function makeRootLayout(
  nodes: MutableLayoutNode[],
  layoutState: KnowledgeGraphLayoutState | undefined,
  dimension: GraphDimension,
): void {
  const ordered = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  const count = ordered.length;
  packRootBubbles(ordered);
  ordered.forEach((node, index) => {
    node.z = 0;
    node.layoutLevel = 0;
    node.layoutComponent = index;
    node.__clusterX = 0;
    node.__clusterY = 0;
    node.__levelY = 0;
    node.__clusterZ = 0;
    if (dimension === '3d') {
      Object.assign(node, volumePoint(index, count, Math.max(240, Math.cbrt(count) * 140), true));
    }
  });
  const hasStoredPosition = applyStoredPositions(nodes, layoutState);
  if (!hasStoredPosition) centerNodes(nodes, dimension === '3d');
}

function volumePoint(index: number, count: number, radius: number, surface = false) {
  const vertical = 1 - 2 * (index + 0.5) / Math.max(1, count);
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  const r = surface ? radius : radius * Math.cbrt(0.25 + stableUnit(`volume:${index}`) * 0.75);
  const horizontal = Math.sqrt(1 - vertical * vertical);
  return { x: r * horizontal * Math.cos(angle), y: r * vertical, z: r * horizontal * Math.sin(angle) };
}

/**
 * Labels are screen-fixed and wider than tall, so a tall cluster on a wide
 * canvas hides most names at fit zoom. Stretch x toward the canvas aspect.
 */
const DOMAIN_CLUSTER_TARGET_ASPECT = 1.6;
const DOMAIN_CLUSTER_MAX_STRETCH = 2.2;

function widenConnectedCluster(connectedNodes: readonly MutableLayoutNode[]): void {
  if (connectedNodes.length < 3) return;
  const xs = connectedNodes.map((node) => node.x);
  const ys = connectedNodes.map((node) => node.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  if (width <= 0 || width >= height * DOMAIN_CLUSTER_TARGET_ASPECT) return;
  const stretch = Math.min(DOMAIN_CLUSTER_MAX_STRETCH, (height * DOMAIN_CLUSTER_TARGET_ASPECT) / width);
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
  connectedNodes.forEach((node) => {
    node.x = centerX + (node.x - centerX) * stretch;
  });
}

/** Concepts without visible relations sit in tidy rows directly below the connected cluster. */
function placeIsolateBand(
  isolates: MutableLayoutNode[],
  connectedNodes: readonly MutableLayoutNode[],
  collisionById: ReadonlyMap<string, number>,
  componentOffset: number,
  layoutState: KnowledgeGraphLayoutState | undefined,
): void {
  if (isolates.length === 0) return;
  const cell = Math.max(...isolates.map((node) => collisionById.get(node.id) ?? node.renderRadius)) * 2;
  const clusterWidth = connectedNodes.length > 0
    ? Math.max(...connectedNodes.map((node) => node.x)) - Math.min(...connectedNodes.map((node) => node.x))
    : 0;
  const columns = Math.max(
    1,
    Math.min(isolates.length, Math.max(Math.ceil(Math.sqrt(isolates.length * 2.4)), Math.floor(clusterWidth / cell) + 1)),
  );
  const rows = Math.ceil(isolates.length / columns);
  const centerX = connectedNodes.length > 0
    ? (Math.max(...connectedNodes.map((node) => node.x)) + Math.min(...connectedNodes.map((node) => node.x))) / 2
    : 0;
  const top = connectedNodes.length > 0
    ? Math.max(...connectedNodes.map((node) => node.y + (collisionById.get(node.id) ?? node.renderRadius))) + cell * 0.9
    : -((rows - 1) * cell) / 2;
  isolates.forEach((node, index) => {
    node.layoutLevel = 0;
    node.layoutComponent = componentOffset + index;
    if (layoutState?.positionsByNodeId[node.id]) return;
    const row = Math.floor(index / columns);
    const inRow = row === rows - 1 ? isolates.length - row * columns : columns;
    const column = index - row * columns;
    node.x = centerX + (column - (inRow - 1) / 2) * cell;
    node.y = top + row * cell;
    node.z = 0;
  });
}

function makeDomainSeeds(
  nodes: MutableLayoutNode[],
  links: readonly KnowledgeLinkData[],
  layoutSalt = '0',
  dimension: GraphDimension = '2d',
  layoutState?: KnowledgeGraphLayoutState,
): void {
  const ids = nodes.map((node) => node.id);
  const componentById = unionFind(ids, links);
  const levels = prerequisiteLevels(ids, links);
  const bucketsByRoot = new Map<string, MutableLayoutNode[]>();
  nodes.forEach((node) => {
    const key = componentById.get(node.id) ?? node.id;
    const bucket = bucketsByRoot.get(key) ?? [];
    bucket.push(node);
    bucketsByRoot.set(key, bucket);
  });
  const buckets: ComponentBucket[] = [...bucketsByRoot.entries()]
    .map(([key, members]) => ({
      key,
      members: members.sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => right.members.length - left.members.length || left.key.localeCompare(right.key));
  const connected = buckets.filter((bucket) => bucket.members.length > 1);
  const collisionById = new Map(nodes.map((node) => [node.id, domainCollisionRadius(node)]));
  const widestCollision = Math.max(40, ...collisionById.values());
  const anchorRadius = connected.length <= 1 ? 0 : Math.max(150, Math.sqrt(connected.length) * widestCollision * 2.2);
  const nodeGapX = Math.max(122, widestCollision * 2.05);
  const nodeGapY = Math.max(118, widestCollision * 1.7);

  connected.forEach((bucket, bucketIndex) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * bucketIndex) / Math.max(1, connected.length);
    const clusterX = anchorRadius * Math.cos(angle);
    const clusterY = anchorRadius * Math.sin(angle);
    const maxLevel = Math.max(...bucket.members.map((node) => levels.get(node.id) ?? 0));
    const byLevel = new Map<number, MutableLayoutNode[]>();
    bucket.members.forEach((node) => {
      const level = levels.get(node.id) ?? 0;
      const levelNodes = byLevel.get(level) ?? [];
      levelNodes.push(node);
      byLevel.set(level, levelNodes);
    });
    // Deep, narrow prerequisite chains flow left-to-right in 2D so the cluster
    // uses the wide canvas instead of stacking labels in a tall column.
    const widestLevel = Math.max(...[...byLevel.values()].map((levelNodes) => levelNodes.length));
    const horizontal = dimension === '2d' && maxLevel + 1 > widestLevel * 1.25;
    const siblingGap = horizontal ? Math.max(72, widestCollision * 1.15) : nodeGapX;
    const levelGap = horizontal ? nodeGapX : nodeGapY;
    bucket.members.forEach((node) => {
      const level = levels.get(node.id) ?? 0;
      const levelNodes = byLevel.get(level) ?? [node];
      const index = levelNodes.findIndex((candidate) => candidate.id === node.id);
      const xJitter = (stableUnit(`${layoutSalt}:${node.id}:x`) - 0.5) * 18;
      const yJitter = (stableUnit(`${layoutSalt}:${node.id}:y`) - 0.5) * 14;
      const sibling = (index - (levelNodes.length - 1) / 2) * siblingGap;
      const depth = (level - maxLevel / 2) * levelGap;
      node.x = clusterX + (horizontal ? depth : sibling) + xJitter;
      node.y = clusterY + (horizontal ? sibling : depth) + yJitter;
      node.__flowHorizontal = horizontal;
      node.z = (level - maxLevel / 2) * 76 + (stableUnit(`${layoutSalt}:${node.id}:z`) - 0.5) * 24;
      node.layoutLevel = level;
      node.layoutComponent = bucketIndex;
      node.__clusterX = horizontal ? clusterX + depth : clusterX;
      node.__clusterY = clusterY;
      node.__levelY = horizontal ? clusterY : clusterY + depth;
      if (dimension === '3d') {
        const point = volumePoint(bucket.members.indexOf(node), bucket.members.length, Math.cbrt(bucket.members.length) * 90);
        node.x = clusterX + point.x;
        node.y = clusterY + point.y;
        node.z = point.z;
        node.__clusterX = node.x;
        node.__levelY = node.y;
      }
      node.__clusterZ = node.z;
    });
  });

  const isolates = buckets.filter((bucket) => bucket.members.length === 1).flatMap((bucket) => bucket.members);
  const connectedNodes = connected.flatMap((bucket) => bucket.members);
  // Existing positions participate as fixed anchors while only new nodes settle.
  const hasStoredPosition = applyStoredPositions(nodes, layoutState);
  if (connectedNodes.length > 0) {
    type SimulationLink = {
      source: string | MutableLayoutNode;
      target: string | MutableLayoutNode;
      relation: string;
      relationType?: string;
    };
    const simulationLinks: SimulationLink[] = links.map((link) => ({
      source: link.sourceId,
      target: link.targetId,
      relation: link.relation,
      relationType: link.relationType,
    }));
    const simulation = forceSimulation<MutableLayoutNode, SimulationLink>(connectedNodes, dimension === '3d' ? 3 : 2)
      .force('link', forceLink<MutableLayoutNode, SimulationLink>(simulationLinks)
        .id((node) => node.id)
        .distance((link) => isPrerequisite(link) ? 138 : 112)
        .strength(0.32))
      .force('charge', forceManyBody<MutableLayoutNode>().strength(-115))
      .force('collide', forceCollide<MutableLayoutNode>((node) => collisionById.get(node.id) ?? node.renderRadius + 28).strength(0.9).iterations(2))
      .force('cluster-x', forceX<MutableLayoutNode>((node) => node.__clusterX).strength((node) => (node.__flowHorizontal ? 0.18 : 0.11)))
      .force('hierarchy-y', forceY<MutableLayoutNode>((node) => node.__levelY).strength((node) => (node.__flowHorizontal ? 0.11 : 0.18)))
      .stop();
    if (dimension === '3d') {
      simulation.force('depth-z', forceZ<MutableLayoutNode>((node) => node.__clusterZ).strength(0.18));
    }
    for (let tick = 0; tick < 72; tick += 1) simulation.tick();
  }
  if (!hasStoredPosition && connectedNodes.length > 0) centerNodes(connectedNodes, dimension === '3d');
  if (!hasStoredPosition && dimension === '2d') widenConnectedCluster(connectedNodes);
  const center = connectedNodes.length > 0 ? {
    x: (Math.min(...connectedNodes.map((node) => node.x)) + Math.max(...connectedNodes.map((node) => node.x))) / 2,
    y: (Math.min(...connectedNodes.map((node) => node.y)) + Math.max(...connectedNodes.map((node) => node.y))) / 2,
    z: dimension === '3d' ? (Math.min(...connectedNodes.map((node) => node.z)) + Math.max(...connectedNodes.map((node) => node.z))) / 2 : 0,
  } : { x: 0, y: 0, z: 0 };
  const inner = connectedNodes.length > 0
    ? Math.max(...connectedNodes.map((node) => Math.hypot(node.x - center.x, node.y - center.y, dimension === '3d' ? node.z - center.z : 0) + node.renderRadius)) + 110
    : 0;
  const outer = dimension === '3d'
    ? Math.cbrt(inner ** 3 + Math.max(1, isolates.length) * 100 ** 3)
    : Math.sqrt(inner ** 2 + Math.max(1, isolates.length) * 105 ** 2);
  const rotation = stableUnit(layoutSalt) * Math.PI * 2;
  if (dimension === '2d') {
    placeIsolateBand(isolates, connectedNodes, collisionById, connected.length, layoutState);
    nodes.forEach((node) => {
      node.x = finite(node.x, 0);
      node.y = finite(node.y, 0);
      node.z = 0;
    });
    return;
  }
  isolates.forEach((node, index) => {
    node.layoutLevel = 0;
    node.layoutComponent = connected.length + index;
    if (layoutState?.positionsByNodeId[node.id]) return;
    const fraction = (index + 0.5) / isolates.length;
    const angle = rotation + index * Math.PI * (3 - Math.sqrt(5));
    if (dimension === '3d') {
      const vertical = 1 - 2 * fraction;
      const radius = Math.cbrt(inner ** 3 + stableUnit(layoutSalt + ':' + node.id) * (outer ** 3 - inner ** 3));
      const horizontal = Math.sqrt(1 - vertical ** 2);
      node.x = center.x + radius * horizontal * Math.cos(angle);
      node.y = center.y + radius * vertical;
      node.z = center.z + radius * horizontal * Math.sin(angle);
    } else {
      const radius = Math.sqrt(inner ** 2 + fraction * (outer ** 2 - inner ** 2));
      node.x = center.x + radius * Math.cos(angle);
      node.y = center.y + radius * Math.sin(angle);
      node.z = 0;
    }
  });
  nodes.forEach((node) => {
    node.x = finite(node.x, 0);
    node.y = finite(node.y, 0);
    node.z = finite(node.z, 0);
  });
}

export function deriveActiveAuthorityLayout(input: {
  nodes: readonly KnowledgeNodeData[];
  links: readonly KnowledgeLinkData[];
  dimension: GraphDimension;
  layoutState?: KnowledgeGraphLayoutState;
  layoutSalt?: string;
}): ActiveAuthorityLayoutNode[] {
  const nodes = [...input.nodes]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => ({
      ...node,
      x: finite(node.positionX, 0),
      y: finite(node.positionY, 0),
      z: finite(node.positionZ, 0),
      renderRadius: nodeRadius(node),
      layoutLevel: 0,
      layoutComponent: 0,
      __clusterX: 0,
      __clusterY: 0,
      __levelY: 0,
      __clusterZ: 0,
      __flowHorizontal: false,
    } satisfies MutableLayoutNode));
  const links = validLinks(nodes, input.links);
  if (nodes.every(isRootNode)) makeRootLayout(nodes, input.layoutState, input.dimension);
  else {
    makeDomainSeeds(nodes, links, input.layoutSalt, input.dimension, input.layoutState);
    applyStoredPositions(nodes, input.layoutState);
  }
  if (input.dimension === '2d') {
    nodes.forEach((node) => {
      node.z = 0;
      node.positionX = node.x;
      node.positionY = node.y;
      node.positionZ = 0;
    });
  } else {
    nodes.forEach((node) => {
      node.positionX = node.x;
      node.positionY = node.y;
      node.positionZ = node.z;
    });
  }
  return nodes.map(({ __clusterX: _clusterX, __clusterY: _clusterY, __levelY: _levelY, __clusterZ: _clusterZ, __flowHorizontal: _flowHorizontal, ...node }) => ({
    ...node, fx: node.x, fy: node.y, fz: node.z,
  }));
}

export interface ActiveAuthorityLayoutSession {
  nodes: Map<string, ActiveAuthorityLayoutNode>;
  relayoutVersion: number;
}

export type ActiveAuthorityLayoutSessions = Map<string, ActiveAuthorityLayoutSession>;

/** Presentation refresh and incremental disclosure never reseed existing nodes. */
export function reconcileActiveAuthorityLayout(
  session: ActiveAuthorityLayoutSession,
  input: Parameters<typeof deriveActiveAuthorityLayout>[0] & { relayoutVersion: number },
): ActiveAuthorityLayoutNode[] {
  if (session.relayoutVersion !== input.relayoutVersion) {
    session.nodes.clear();
    session.relayoutVersion = input.relayoutVersion;
  }
  const stored = Object.fromEntries([...session.nodes].map(([id, node]) => [id, {
    x: node.x, y: node.y, z: node.z, pinned: true,
  }]));
  const positions = { ...stored, ...input.layoutState?.positionsByNodeId };
  const seeded = input.nodes.some((node) => !session.nodes.has(node.id))
    ? new Map(deriveActiveAuthorityLayout({
      ...input,
      layoutState: { version: input.layoutState?.version ?? 0, positionsByNodeId: positions },
    }).map((node) => [node.id, node]))
    : new Map<string, ActiveAuthorityLayoutNode>();
  return [...input.nodes].sort((a, b) => a.id.localeCompare(b.id)).map((node) => {
    const existing = session.nodes.get(node.id) ?? seeded.get(node.id)!;
    const point = input.layoutState?.positionsByNodeId[node.id] ?? existing;
    const x = point.x;
    const y = point.y;
    const z = input.dimension === '2d' ? 0 : finite(point.z, existing.z);
    Object.assign(existing, node, {
      x, y, z, positionX: x, positionY: y, positionZ: z, fx: x, fy: y, fz: z,
      renderRadius: nodeRadius(node),
    });
    session.nodes.set(node.id, existing);
    return existing;
  });
}

export function cloneActiveAuthorityLinks(
  links: readonly KnowledgeLinkData[],
): ActiveAuthorityLayoutLink[] {
  return links.map((link) => ({ ...link }));
}

export function activeAuthorityStructureSignature(
  nodes: readonly KnowledgeNodeData[],
  links: readonly KnowledgeLinkData[],
  dimension: GraphDimension,
  relayoutVersion: number,
): string {
  return computeKnowledgeForceStructureSignature(
    nodes,
    links,
    [
      dimension,
      relayoutVersion,
      ...links.map((link) => `${link.id}:${link.relationType ?? ''}:${link.relation}`).sort(),
    ],
  );
}

export function getActiveAuthorityWorldBounds(
  nodes: readonly Pick<ActiveAuthorityLayoutNode, 'x' | 'y' | 'z' | 'renderRadius'>[],
): ActiveAuthorityWorldBounds {
  if (nodes.length === 0) {
    return {
      x: [0, 0], y: [0, 0], z: [0, 0], center: { x: 0, y: 0, z: 0 },
      width: 0, height: 0, depth: 0,
    };
  }
  const x = [
    Math.min(...nodes.map((node) => node.x - node.renderRadius)),
    Math.max(...nodes.map((node) => node.x + node.renderRadius)),
  ] as [number, number];
  const y = [
    Math.min(...nodes.map((node) => node.y - node.renderRadius)),
    Math.max(...nodes.map((node) => node.y + node.renderRadius)),
  ] as [number, number];
  const z = [
    Math.min(...nodes.map((node) => node.z - node.renderRadius)),
    Math.max(...nodes.map((node) => node.z + node.renderRadius)),
  ] as [number, number];
  return {
    x,
    y,
    z,
    center: { x: (x[0] + x[1]) / 2, y: (y[0] + y[1]) / 2, z: (z[0] + z[1]) / 2 },
    width: x[1] - x[0],
    height: y[1] - y[0],
    depth: z[1] - z[0],
  };
}
