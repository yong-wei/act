import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';

import type { KnowledgeLinkData, KnowledgeNodeData } from '../../knowledge-graph-system';
import type { GraphDimension } from '../../graph-runtime-session';
import type { KnowledgeGraphLayoutState } from '../layout-state';
import { computeKnowledgeForceStructureSignature } from '../force-lifecycle';

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
}

interface ComponentBucket {
  key: string;
  members: MutableLayoutNode[];
}

interface ActiveAuthorityNodeMetadata {
  presentationKind?: unknown;
  presentationRadius?: unknown;
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

function nodeRadius(node: KnowledgeNodeData): number {
  const metadata = metadataFor(node);
  if (isRootNode(node)) {
    const presentationRadius = finite(metadata.presentationRadius, 42);
    return Math.max(34, Math.min(54, presentationRadius * 0.52));
  }
  const glyphRadius = finite(metadata.decoration?.glyphRadius, 12);
  const importance = finite(node.graphImportanceScore ?? node.importance, 0.5);
  return Math.max(9, Math.min(17, glyphRadius * 0.45 + importance * 2));
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

function makeRootLayout(
  nodes: MutableLayoutNode[],
  layoutState: KnowledgeGraphLayoutState | undefined,
): void {
  const ordered = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  const count = ordered.length;
  const ringRadius = count <= 1 ? 0 : Math.max(240, count * 38);
  ordered.forEach((node, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, count);
    node.x = ringRadius * Math.cos(angle);
    node.y = ringRadius * Math.sin(angle);
    node.z = 0;
    node.layoutLevel = 0;
    node.layoutComponent = index;
    node.__clusterX = 0;
    node.__clusterY = 0;
    node.__levelY = 0;
  });
  const hasStoredPosition = applyStoredPositions(nodes, layoutState);
  if (!hasStoredPosition) centerNodes(nodes, false);
}

function makeDomainSeeds(
  nodes: MutableLayoutNode[],
  links: readonly KnowledgeLinkData[],
  layoutSalt = '0',
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
  const anchorRadius = connected.length <= 1 ? 0 : Math.max(150, connected.length * 108);
  const nodeGapX = 122;
  const nodeGapY = 118;

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
    bucket.members.forEach((node) => {
      const level = levels.get(node.id) ?? 0;
      const levelNodes = byLevel.get(level) ?? [node];
      const index = levelNodes.findIndex((candidate) => candidate.id === node.id);
      const xJitter = (stableUnit(`${layoutSalt}:${node.id}:x`) - 0.5) * 18;
      const yJitter = (stableUnit(`${layoutSalt}:${node.id}:y`) - 0.5) * 14;
      node.x = clusterX + (index - (levelNodes.length - 1) / 2) * nodeGapX + xJitter;
      node.y = clusterY + (level - maxLevel / 2) * nodeGapY + yJitter;
      node.z = (level - maxLevel / 2) * 76 + (stableUnit(`${layoutSalt}:${node.id}:z`) - 0.5) * 24;
      node.layoutLevel = level;
      node.layoutComponent = bucketIndex;
      node.__clusterX = clusterX;
      node.__clusterY = clusterY;
      node.__levelY = clusterY + (level - maxLevel / 2) * nodeGapY;
    });
  });

  const isolates = buckets.filter((bucket) => bucket.members.length === 1).flatMap((bucket) => bucket.members);
  if (isolates.length > 0) {
    const connectedMaxX = connected.length > 0 ? Math.max(...connected.flatMap((bucket) => bucket.members.map((node) => node.x))) : 0;
    const columns = Math.max(1, Math.ceil(Math.sqrt(isolates.length * 1.6)));
    const rows = Math.ceil(isolates.length / columns);
    isolates.forEach((node, index) => {
      const row = Math.floor(index / columns);
      const rowCount = Math.min(columns, isolates.length - row * columns);
      const column = index % columns;
      node.x = (connected.length > 0 ? connectedMaxX + 190 : 0) + (column - (rowCount - 1) / 2) * 146;
      node.y = (row - (rows - 1) / 2) * 132;
      node.z = (stableUnit(`${layoutSalt}:${node.id}:isolated-z`) - 0.5) * 100;
      node.layoutLevel = 0;
      node.layoutComponent = connected.length + index;
      node.__clusterX = node.x;
      node.__clusterY = node.y;
      node.__levelY = node.y;
    });
  }

  const hasLinks = links.length > 0;
  if (hasLinks) {
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
    const simulation = forceSimulation<MutableLayoutNode, SimulationLink>(nodes)
      .force('link', forceLink<MutableLayoutNode, SimulationLink>(simulationLinks)
        .id((node) => node.id)
        .distance((link) => isPrerequisite(link) ? 138 : 112)
        .strength(0.32))
      .force('charge', forceManyBody<MutableLayoutNode>().strength(-115))
      .force('collide', forceCollide<MutableLayoutNode>((node) => node.renderRadius + 28).strength(0.86))
      .force('cluster-x', forceX<MutableLayoutNode>((node) => node.__clusterX).strength(0.11))
      .force('hierarchy-y', forceY<MutableLayoutNode>((node) => node.__levelY).strength(0.18))
      .stop();
    for (let tick = 0; tick < 72; tick += 1) simulation.tick();
  }
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
    } satisfies MutableLayoutNode));
  const links = validLinks(nodes, input.links);
  if (nodes.every(isRootNode)) makeRootLayout(nodes, input.layoutState);
  else {
    makeDomainSeeds(nodes, links, input.layoutSalt);
    const hasStoredPosition = applyStoredPositions(nodes, input.layoutState);
    if (!hasStoredPosition) centerNodes(nodes, input.dimension === '3d');
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
  return nodes.map(({ __clusterX: _clusterX, __clusterY: _clusterY, __levelY: _levelY, ...node }) => node);
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
