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
    activationSequence?: number;
    provenanceCenterId?: string;
  };
}

export interface KnowledgeGraphLivePositionedNode extends KnowledgeGraphPositionedNode {
  vx?: number;
  vy?: number;
  vz?: number;
}

export interface KnowledgeGraphFocusedExpansionLayoutInput<T extends KnowledgeGraphPositionedNode> {
  nodes: T[];
  expandedNodeIds: readonly string[];
  directExpansionLinks: readonly KnowledgeLinkData[];
  layoutState: KnowledgeGraphLayoutState;
  activationSequenceByCenterId?: Readonly<Record<string, number>>;
  materializedNodeIds?: readonly string[];
}

export type KnowledgeGraphViewMode = '2D' | '3D';

export interface KnowledgeGraphNodeScreenPosition {
  nodeId: string | null;
  viewMode: KnowledgeGraphViewMode;
  x?: number;
  y?: number;
  z?: number;
}

export interface KnowledgeGraphNodeControlPosition {
  left: number;
  top: number;
  centerX: number;
  centerY: number;
  clamped: boolean;
}

export interface KnowledgeGraphFocusedExpansionRevealTranslation {
  x: number;
  y: number;
  fullyVisible: boolean;
}

const FOCUSED_EXPANSION_ARC_CAPACITY = 7;
const FOCUSED_EXPANSION_FIRST_RING_RADIUS = 96;
const FOCUSED_EXPANSION_RING_GAP = 72;
const FOCUSED_EXPANSION_SECTOR_ANGLE = Math.PI * 0.8;
const FOCUSED_EXPANSION_CANDIDATE_ANGLES = Array.from(
  { length: 8 },
  (_, index) => index * Math.PI / 4
);
const NODE_EXPANSION_CONTROL_EDGE_CLEARANCE = 8;
const NODE_EXPANSION_CONTROL_OFFSET = -40;
const NODE_EXPANSION_CONTROL_MAX_ANCHOR_DISTANCE = 64;
const NODE_EXPANSION_CONTROL_AVOIDANCE_OFFSETS = [
  { x: NODE_EXPANSION_CONTROL_OFFSET, y: NODE_EXPANSION_CONTROL_OFFSET },
  { x: -NODE_EXPANSION_CONTROL_OFFSET, y: NODE_EXPANSION_CONTROL_OFFSET },
  { x: NODE_EXPANSION_CONTROL_OFFSET, y: -NODE_EXPANSION_CONTROL_OFFSET },
  { x: -NODE_EXPANSION_CONTROL_OFFSET, y: -NODE_EXPANSION_CONTROL_OFFSET },
  { x: 0, y: -64 },
  { x: -64, y: 0 },
  { x: 64, y: 0 },
  { x: 0, y: 64 },
] as const;
const FOCUSED_EXPANSION_REVEAL_MAX_VIEWPORT_RATIO = 0.2;

function compareNodeIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function readFiniteCoordinate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function calculateRectangleUnionArea(
  rectangles: ReadonlyArray<{ left: number; top: number; right: number; bottom: number }>
): number {
  if (rectangles.length === 0) return 0;
  const xBoundaries = [...new Set(rectangles.flatMap((rect) => [rect.left, rect.right]))]
    .sort((a, b) => a - b);
  let area = 0;
  for (let index = 0; index < xBoundaries.length - 1; index += 1) {
    const left = xBoundaries[index];
    const right = xBoundaries[index + 1];
    if (right <= left) continue;
    const yIntervals = rectangles
      .filter((rect) => rect.left < right && rect.right > left)
      .map((rect) => [rect.top, rect.bottom] as const)
      .sort((a, b) => a[0] - b[0]);
    let coveredHeight = 0;
    let intervalTop: number | null = null;
    let intervalBottom: number | null = null;
    yIntervals.forEach(([top, bottom]) => {
      if (intervalTop === null || intervalBottom === null) {
        intervalTop = top;
        intervalBottom = bottom;
      } else if (top <= intervalBottom) {
        intervalBottom = Math.max(intervalBottom, bottom);
      } else {
        coveredHeight += intervalBottom - intervalTop;
        intervalTop = top;
        intervalBottom = bottom;
      }
    });
    if (intervalTop !== null && intervalBottom !== null) {
      coveredHeight += intervalBottom - intervalTop;
    }
    area += (right - left) * coveredHeight;
  }
  return area;
}

function calculateRevealAxisTranslation({
  minimum,
  maximum,
  viewportSize,
  padding,
  maximumTranslation,
}: {
  minimum: number;
  maximum: number;
  viewportSize: number;
  padding: number;
  maximumTranslation: number;
}): number {
  const safeMinimum = padding;
  const safeMaximum = viewportSize - padding;
  let desiredTranslation = 0;

  if (minimum < safeMinimum && maximum > safeMaximum) {
    desiredTranslation = viewportSize / 2 - (minimum + maximum) / 2;
  } else if (minimum < safeMinimum) {
    desiredTranslation = safeMinimum - minimum;
  } else if (maximum > safeMaximum) {
    desiredTranslation = safeMaximum - maximum;
  }

  return Math.max(-maximumTranslation, Math.min(maximumTranslation, desiredTranslation));
}

export function calculateFocusedExpansionRevealTranslation(input: {
  points: ReadonlyArray<{ x: number; y: number }>;
  viewportWidth: number;
  viewportHeight: number;
  padding: number;
}): KnowledgeGraphFocusedExpansionRevealTranslation | null {
  const viewportWidth = readFiniteCoordinate(input.viewportWidth);
  const viewportHeight = readFiniteCoordinate(input.viewportHeight);
  const padding = readFiniteCoordinate(input.padding);
  const points = input.points
    .map((point) => ({
      x: readFiniteCoordinate(point.x),
      y: readFiniteCoordinate(point.y),
    }))
    .filter((point): point is { x: number; y: number } => point.x !== null && point.y !== null);

  if (
    viewportWidth === null
    || viewportHeight === null
    || padding === null
    || viewportWidth <= padding * 2
    || viewportHeight <= padding * 2
    || padding < 0
    || points.length === 0
  ) {
    return null;
  }

  const minimumX = Math.min(...points.map((point) => point.x));
  const maximumX = Math.max(...points.map((point) => point.x));
  const minimumY = Math.min(...points.map((point) => point.y));
  const maximumY = Math.max(...points.map((point) => point.y));
  const maximumTranslation = Math.min(viewportWidth, viewportHeight)
    * FOCUSED_EXPANSION_REVEAL_MAX_VIEWPORT_RATIO;
  let x = calculateRevealAxisTranslation({
    minimum: minimumX,
    maximum: maximumX,
    viewportSize: viewportWidth,
    padding,
    maximumTranslation,
  });
  let y = calculateRevealAxisTranslation({
    minimum: minimumY,
    maximum: maximumY,
    viewportSize: viewportHeight,
    padding,
    maximumTranslation,
  });
  const translationMagnitude = Math.hypot(x, y);
  if (translationMagnitude > maximumTranslation) {
    const scale = maximumTranslation / translationMagnitude;
    x *= scale;
    y *= scale;
  }
  const fullyVisible = minimumX + x >= padding
    && maximumX + x <= viewportWidth - padding
    && minimumY + y >= padding
    && maximumY + y <= viewportHeight - padding;

  return { x, y, fullyVisible };
}

export function createFocusedExpansionRevealSignature(
  expandedNodeIds: readonly string[],
  directExpansionLinks: readonly KnowledgeLinkData[]
): string {
  const expandedIds = [...new Set(expandedNodeIds)].sort(compareNodeIds);
  const expandedIdSet = new Set(expandedIds);
  const directLinkTokens = directExpansionLinks
    .filter((link) => expandedIdSet.has(link.sourceId) || expandedIdSet.has(link.targetId))
    .map((link) => {
      const endpoints = [link.sourceId, link.targetId].sort(compareNodeIds);
      return `${link.id}:${endpoints[0]}:${endpoints[1]}`;
    })
    .sort(compareNodeIds);

  return JSON.stringify([expandedIds, directLinkTokens]);
}

export function resolveFocusedExpansionRevealTarget(
  previousExpandedNodeIds: readonly string[],
  expandedNodeIds: readonly string[]
): string | null {
  const previousIdSet = new Set(previousExpandedNodeIds);
  const newlyExpandedIds = [...new Set(expandedNodeIds)]
    .filter((nodeId) => !previousIdSet.has(nodeId));
  return newlyExpandedIds.at(-1) ?? null;
}

export function selectFocusedExpansionGraphNodes<T extends { id: string }>(input: {
  refNodes: readonly T[] | undefined;
  currentNodes: readonly T[];
  requiredNodeIds: readonly string[];
}): readonly T[] {
  if (!input.refNodes) return input.currentNodes;
  const refNodeIds = new Set(input.refNodes.map((node) => node.id));
  return input.requiredNodeIds.every((nodeId) => refNodeIds.has(nodeId))
    ? input.refNodes
    : input.currentNodes;
}

export function translateKnowledgeGraphCameraPose(input: {
  cameraPosition: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  translation: { x: number; y: number; z: number };
}): {
  cameraPosition: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
} {
  return {
    cameraPosition: {
      x: input.cameraPosition.x + input.translation.x,
      y: input.cameraPosition.y + input.translation.y,
      z: input.cameraPosition.z + input.translation.z,
    },
    target: {
      x: input.target.x + input.translation.x,
      y: input.target.y + input.translation.y,
      z: input.target.z + input.translation.z,
    },
  };
}

export function preserveKnowledgeGraphLiveNodeCoordinates<T extends KnowledgeGraphPositionedNode>({
  nodes,
  liveNodes,
  preserve = true,
}: {
  nodes: T[];
  liveNodes: readonly KnowledgeGraphLivePositionedNode[] | undefined;
  preserve?: boolean;
}): T[] {
  if (!preserve) return nodes;
  if (!liveNodes || liveNodes.length === 0) return nodes;
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const livePositionsByNodeId = new Map<string, Partial<KnowledgeGraphLivePositionedNode>>();

  liveNodes.forEach((node) => {
    if (!visibleNodeIds.has(node.id)) return;
    const x = readFiniteCoordinate(node.x);
    const y = readFiniteCoordinate(node.y);
    if (x === null || y === null) return;
    const z = readFiniteCoordinate(node.z);
    const vx = readFiniteCoordinate(node.vx);
    const vy = readFiniteCoordinate(node.vy);
    const vz = readFiniteCoordinate(node.vz);
    const fx = readFiniteCoordinate(node.fx);
    const fy = readFiniteCoordinate(node.fy);
    const fz = readFiniteCoordinate(node.fz);
    livePositionsByNodeId.set(node.id, {
      x,
      y,
      ...(z === null ? {} : { z }),
      ...(vx === null ? {} : { vx }),
      ...(vy === null ? {} : { vy }),
      ...(vz === null ? {} : { vz }),
      ...(fx === null ? {} : { fx }),
      ...(fy === null ? {} : { fy }),
      ...(fz === null ? {} : { fz }),
      ...(node.__knowledgeAutomaticAnchor
        ? { __knowledgeAutomaticAnchor: node.__knowledgeAutomaticAnchor }
        : {}),
    });
  });

  if (livePositionsByNodeId.size === 0) return nodes;
  return nodes.map((node) => {
    const livePosition = livePositionsByNodeId.get(node.id);
    return livePosition ? { ...node, ...livePosition } as T : node;
  });
}

export function resolveKnowledgeGraphRuntimeNodeCoordinates<T extends KnowledgeGraphPositionedNode>({
  nodes,
  liveNodes,
  runtimePositionsByNodeId,
  preserve,
}: {
  nodes: T[];
  liveNodes: readonly KnowledgeGraphLivePositionedNode[] | undefined;
  runtimePositionsByNodeId: ReadonlyMap<string, Partial<KnowledgeGraphLivePositionedNode>>;
  preserve: boolean;
}): T[] {
  const liveLayoutNodes = preserveKnowledgeGraphLiveNodeCoordinates({ nodes, liveNodes, preserve });
  if (!preserve) return liveLayoutNodes;
  return liveLayoutNodes.map((node, index) => {
    if (node !== nodes[index]) return node;
    const runtimePosition = runtimePositionsByNodeId.get(node.id);
    return runtimePosition ? { ...node, ...runtimePosition } as T : node;
  });
}

export function commitKnowledgeGraphRelayoutVersion({
  committedVersion,
  nextVersion,
  runtimePositions,
}: {
  committedVersion: number;
  nextVersion: number;
  runtimePositions: { clear: () => void };
}): number {
  if (committedVersion !== nextVersion) runtimePositions.clear();
  return nextVersion;
}

export function clampNodeExpansionControlPosition(input: {
  nodeX: number;
  nodeY: number;
  viewportWidth: number;
  viewportHeight: number;
  controlWidth: number;
  controlHeight: number;
  avoidRects?: ReadonlyArray<{ left: number; top: number; right: number; bottom: number }>;
}): KnowledgeGraphNodeControlPosition | null {
  const nodeX = readFiniteCoordinate(input.nodeX);
  const nodeY = readFiniteCoordinate(input.nodeY);
  const viewportWidth = readFiniteCoordinate(input.viewportWidth);
  const viewportHeight = readFiniteCoordinate(input.viewportHeight);
  const controlWidth = readFiniteCoordinate(input.controlWidth);
  const controlHeight = readFiniteCoordinate(input.controlHeight);
  if (
    nodeX === null
    || nodeY === null
    || viewportWidth === null
    || viewportHeight === null
    || controlWidth === null
    || controlHeight === null
    || controlWidth <= 0
    || controlHeight <= 0
    || viewportWidth < controlWidth + NODE_EXPANSION_CONTROL_EDGE_CLEARANCE * 2
    || viewportHeight < controlHeight + NODE_EXPANSION_CONTROL_EDGE_CLEARANCE * 2
  ) {
    return null;
  }

  const maxLeft = viewportWidth - NODE_EXPANSION_CONTROL_EDGE_CLEARANCE - controlWidth;
  const maxTop = viewportHeight - NODE_EXPANSION_CONTROL_EDGE_CLEARANCE - controlHeight;
  const finiteAvoidRects = (input.avoidRects ?? []).filter((rect) => (
    [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite)
    && rect.right > rect.left
    && rect.bottom > rect.top
  ));
  const avoidRects = finiteAvoidRects.filter((rect, index, rects) => (
    index === rects.findIndex((candidate) => (
      candidate.left === rect.left
      && candidate.top === rect.top
      && candidate.right === rect.right
      && candidate.bottom === rect.bottom
    ))
    && !rects.some((candidate, candidateIndex) => (
      candidateIndex !== index
      && candidate.left <= rect.left
      && candidate.top <= rect.top
      && candidate.right >= rect.right
      && candidate.bottom >= rect.bottom
      && (
        candidate.left < rect.left
        || candidate.top < rect.top
        || candidate.right > rect.right
        || candidate.bottom > rect.bottom
      )
    ))
  ));
  const desiredCandidates = NODE_EXPANSION_CONTROL_AVOIDANCE_OFFSETS.map((offset, index) => ({
    desiredLeft: nodeX + offset.x - controlWidth / 2,
    desiredTop: nodeY + offset.y - controlHeight / 2,
    index,
  }));
  avoidRects.forEach((rect) => {
    const nextIndex = desiredCandidates.length;
    desiredCandidates.push(
      {
        desiredLeft: nodeX - controlWidth / 2,
        desiredTop: rect.bottom + NODE_EXPANSION_CONTROL_EDGE_CLEARANCE,
        index: nextIndex,
      },
      {
        desiredLeft: nodeX - controlWidth / 2,
        desiredTop: rect.top - controlHeight - NODE_EXPANSION_CONTROL_EDGE_CLEARANCE,
        index: nextIndex + 1,
      },
      {
        desiredLeft: rect.right + NODE_EXPANSION_CONTROL_EDGE_CLEARANCE,
        desiredTop: nodeY - controlHeight / 2,
        index: nextIndex + 2,
      },
      {
        desiredLeft: rect.left - controlWidth - NODE_EXPANSION_CONTROL_EDGE_CLEARANCE,
        desiredTop: nodeY - controlHeight / 2,
        index: nextIndex + 3,
      },
    );
  });
  const positionedCandidates = desiredCandidates.map(({ desiredLeft, desiredTop, index }) => {
    const left = Math.min(maxLeft, Math.max(NODE_EXPANSION_CONTROL_EDGE_CLEARANCE, desiredLeft));
    const top = Math.min(maxTop, Math.max(NODE_EXPANSION_CONTROL_EDGE_CLEARANCE, desiredTop));
    const right = left + controlWidth;
    const bottom = top + controlHeight;
    const overlapRects = avoidRects.flatMap((rect) => {
      const overlapWidth = Math.max(0, Math.min(right, rect.right) - Math.max(left, rect.left));
      const overlapHeight = Math.max(0, Math.min(bottom, rect.bottom) - Math.max(top, rect.top));
      return overlapWidth > 0 && overlapHeight > 0
        ? [{
            left: Math.max(left, rect.left),
            top: Math.max(top, rect.top),
            right: Math.min(right, rect.right),
            bottom: Math.min(bottom, rect.bottom),
          }]
        : [];
    });
    const overlapArea = calculateRectangleUnionArea(overlapRects);
    return {
      position: {
        left,
        top,
        centerX: left + controlWidth / 2,
        centerY: top + controlHeight / 2,
        clamped: index > 0 || left !== desiredLeft || top !== desiredTop,
      },
      overlapArea,
      anchorDistance: Math.hypot(
        left + controlWidth / 2 - nodeX,
        top + controlHeight / 2 - nodeY
      ),
      index,
    };
  });
  const nodeInsideViewport = nodeX >= 0
    && nodeX <= viewportWidth
    && nodeY >= 0
    && nodeY <= viewportHeight;
  const nearbyCandidates = positionedCandidates.filter((candidate) => (
    !nodeInsideViewport
    || candidate.anchorDistance <= NODE_EXPANSION_CONTROL_MAX_ANCHOR_DISTANCE + Number.EPSILON
  ));
  const zeroOverlapNearbyCandidates = nearbyCandidates.filter((candidate) => candidate.overlapArea === 0);
  zeroOverlapNearbyCandidates.sort((left, right) => left.index - right.index);
  if (zeroOverlapNearbyCandidates[0]) return zeroOverlapNearbyCandidates[0].position;

  const zeroOverlapCandidates = positionedCandidates.filter((candidate) => candidate.overlapArea === 0);
  zeroOverlapCandidates.sort((left, right) => (
    left.anchorDistance - right.anchorDistance || left.index - right.index
  ));
  if (zeroOverlapCandidates[0]) return zeroOverlapCandidates[0].position;

  const fallbackCandidates = nearbyCandidates.length > 0 ? nearbyCandidates : positionedCandidates;
  fallbackCandidates.sort((left, right) => (
    left.overlapArea - right.overlapArea || left.index - right.index
  ));
  return fallbackCandidates[0]?.position ?? null;
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
  activationSequenceByCenterId = {},
  materializedNodeIds,
}: KnowledgeGraphFocusedExpansionLayoutInput<T>): T[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const expandedIds = [...new Set(expandedNodeIds)]
    .filter((nodeId) => nodeById.has(nodeId))
    .sort((left, right) => (
      (activationSequenceByCenterId[left] ?? Number.MAX_SAFE_INTEGER)
      - (activationSequenceByCenterId[right] ?? Number.MAX_SAFE_INTEGER)
      || compareNodeIds(left, right)
    ));
  const expandedIdSet = new Set(expandedIds);
  const materializedIdSet = materializedNodeIds ? new Set(materializedNodeIds) : null;
  const focusedCoordinates = new Map<string, {
    x: number;
    y: number;
    activationSequence: number;
    provenanceCenterId: string;
  }>();
  const occupied = nodes.flatMap((node) => {
    if (materializedIdSet?.has(node.id)) return [];
    const center = resolveNodeCenter(node, layoutState);
    return [{ id: node.id, ...center }];
  });

  expandedIds.forEach((centerId) => {
    const centerNode = nodeById.get(centerId);
    if (!centerNode) return;

    const directChildIds = new Set<string>();
    directExpansionLinks.forEach((link) => {
      const relation = link.relationType || link.relation;
      const chapterRoot = centerId.startsWith(CHAPTER_NODE_PREFIX);
      if (chapterRoot && (relation !== 'contains' || link.sourceId !== centerId)) return;
      if (link.sourceId === centerId && link.targetId !== centerId) {
        directChildIds.add(link.targetId);
      } else if (link.targetId === centerId && link.sourceId !== centerId) {
        directChildIds.add(link.sourceId);
      }
    });

    const orderedChildIds = [...directChildIds]
      .filter((nodeId) => nodeById.has(nodeId) && !expandedIdSet.has(nodeId))
      .sort((left, right) => {
        const leftNode = nodeById.get(left)!;
        const rightNode = nodeById.get(right)!;
        const leftLink = directExpansionLinks.find((link) => (
          (link.sourceId === centerId && link.targetId === left)
          || (link.targetId === centerId && link.sourceId === left)
        ));
        const rightLink = directExpansionLinks.find((link) => (
          (link.sourceId === centerId && link.targetId === right)
          || (link.targetId === centerId && link.sourceId === right)
        ));
        const priority = (link?: KnowledgeLinkData) => {
          const density = String((link as KnowledgeLinkData & { density?: string })?.density ?? 'optional');
          return ['structure', 'context', 'optional', 'weak'].indexOf(density);
        };
        return priority(leftLink) - priority(rightLink)
          || String(leftLink?.relationType || leftLink?.relation).localeCompare(String(rightLink?.relationType || rightLink?.relation))
          || Number(leftLink?.sourceId !== centerId) - Number(rightLink?.sourceId !== centerId)
          || Number((rightNode.metadata as Record<string, unknown> | undefined)?.importance ?? 0)
            - Number((leftNode.metadata as Record<string, unknown> | undefined)?.importance ?? 0)
          || leftNode.name.localeCompare(rightNode.name, 'zh-Hans-CN')
          || compareNodeIds(left, right);
      });
    const center = resolveNodeCenter(centerNode, layoutState);
    const provenanceCenterId = centerNode.__knowledgeAutomaticAnchor?.provenanceCenterId;
    const provenanceNode = provenanceCenterId ? nodeById.get(provenanceCenterId) : undefined;
    const provenanceCenter = provenanceNode ? resolveNodeCenter(provenanceNode, layoutState) : null;
    const inheritedAngle = provenanceCenter
      ? Math.atan2(center.y - provenanceCenter.y, center.x - provenanceCenter.x)
      : null;
    const candidateAngles = inheritedAngle === null ? FOCUSED_EXPANSION_CANDIDATE_ANGLES : [inheritedAngle];
    const direction = candidateAngles
      .map((angle, index) => {
        const score = orderedChildIds.reduce((sum, _childId, childIndex) => {
          const arcIndex = Math.floor(childIndex / FOCUSED_EXPANSION_ARC_CAPACITY);
          const slotIndex = childIndex % FOCUSED_EXPANSION_ARC_CAPACITY;
          const nodesInArc = Math.min(
            FOCUSED_EXPANSION_ARC_CAPACITY,
            orderedChildIds.length - arcIndex * FOCUSED_EXPANSION_ARC_CAPACITY
          );
          const offset = nodesInArc === 1 ? 0 : (slotIndex / (nodesInArc - 1) - 0.5) * FOCUSED_EXPANSION_SECTOR_ANGLE;
          const radius = FOCUSED_EXPANSION_FIRST_RING_RADIUS + arcIndex * FOCUSED_EXPANSION_RING_GAP;
          const x = center.x + radius * Math.cos(angle + offset);
          const y = center.y + radius * Math.sin(angle + offset);
          return sum + occupied.reduce((collision, point) => {
            const distance = Math.hypot(x - point.x, y - point.y);
            return collision + Math.max(0, 64 - distance) ** 2;
          }, 0);
        }, 0);
        return { angle, score, index };
      })
      .sort((left, right) => left.score - right.score || left.index - right.index)[0].angle;

    orderedChildIds.forEach((childId, index) => {
      if (focusedCoordinates.has(childId)) return;
      if (materializedIdSet && !materializedIdSet.has(childId)) return;
      const existingProvenance = nodeById.get(childId)?.__knowledgeAutomaticAnchor;
      const nextSequence = activationSequenceByCenterId[centerId] ?? Number.MAX_SAFE_INTEGER;
      if (
        existingProvenance?.provenanceCenterId
        && (
          (existingProvenance.activationSequence ?? Number.MAX_SAFE_INTEGER) < nextSequence
          || (
            existingProvenance.activationSequence === nextSequence
            && compareNodeIds(existingProvenance.provenanceCenterId, centerId) <= 0
          )
        )
      ) return;
      const ringIndex = Math.floor(index / FOCUSED_EXPANSION_ARC_CAPACITY);
      const slotIndex = index % FOCUSED_EXPANSION_ARC_CAPACITY;
      const nodesInRing = Math.min(
        FOCUSED_EXPANSION_ARC_CAPACITY,
        orderedChildIds.length - ringIndex * FOCUSED_EXPANSION_ARC_CAPACITY
      );
      const angle = direction + (nodesInRing === 1
        ? 0
        : (slotIndex / (nodesInRing - 1) - 0.5) * FOCUSED_EXPANSION_SECTOR_ANGLE);
      const radius = FOCUSED_EXPANSION_FIRST_RING_RADIUS + ringIndex * FOCUSED_EXPANSION_RING_GAP;
      focusedCoordinates.set(childId, {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
        activationSequence: nextSequence,
        provenanceCenterId: centerId,
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
                activationSequence: focused.activationSequence,
                provenanceCenterId: focused.provenanceCenterId,
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
        activationSequence: focused.activationSequence,
        provenanceCenterId: focused.provenanceCenterId,
      },
    } as T;
  });
}

export function updateKnowledgeGraphDraggedNode<T extends KnowledgeGraphPositionedNode>(
  nodes: readonly T[],
  dragged: { id: string; x: number; y: number; z?: number }
): T[] {
  return nodes.map((node) => node.id !== dragged.id ? node : ({
    ...node,
    x: dragged.x,
    y: dragged.y,
    positionX: dragged.x,
    positionY: dragged.y,
    fx: dragged.x,
    fy: dragged.y,
    ...(dragged.z === undefined ? {} : {
      z: dragged.z,
      positionZ: dragged.z,
      fz: dragged.z,
    }),
  } as T));
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
