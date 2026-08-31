import {
  KNOWLEDGE_NODE_LABEL_POLICY,
  KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE,
  type KnowledgeNodeLabelBounds,
} from './node-label-layout';
import { getKnowledgeNodeLabelPresentation, type KnowledgeGraphLabelMode } from './label-policy';

export const KNOWLEDGE_GRAPH_VIEWPORT_PADDING = 48;
export const KNOWLEDGE_GRAPH_COMPACT_MAX_WIDTH = 639;
export const KNOWLEDGE_GRAPH_SUPPORTED_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobileNarrow: { width: 320, height: 720 },
  mobile: { width: 390, height: 844 },
} as const;

export interface KnowledgeViewportSafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function getKnowledgeGraphViewportSafeInsets(input: {
  width: number;
  height: number;
}): KnowledgeViewportSafeInsets {
  const compact = input.width < 1024;
  return {
    top: compact ? 120 : 16,
    right: 16,
    bottom: compact ? 96 : 72,
    left: compact ? 16 : 512,
  };
}

function normalizeSafeInsets(
  padding: number | KnowledgeViewportSafeInsets | undefined,
): KnowledgeViewportSafeInsets {
  if (typeof padding === 'object') return padding;
  const value = Math.max(0, padding ?? KNOWLEDGE_GRAPH_VIEWPORT_PADDING);
  return { top: value, right: value, bottom: value, left: value };
}

export function getPerspectiveCameraFitDistance(input: {
  viewportHeight: number;
  pixelsPerWorldUnit: number;
  fovDegrees?: number;
  zoom?: number;
}): number {
  const fov = Number.isFinite(input.fovDegrees) ? input.fovDegrees! : 50;
  const zoom = Number.isFinite(input.zoom) && input.zoom! > 0 ? input.zoom! : 1;
  return input.viewportHeight * zoom
    / (2 * Math.tan(fov * Math.PI / 360) * Math.max(0.0001, input.pixelsPerWorldUnit));
}

export function getKnowledgeRootProjectionSafeCameraDistance(input: {
  viewportHeight: number;
  fovDegrees?: number;
  zoom?: number;
}): number {
  return getPerspectiveCameraFitDistance({
    ...input,
    pixelsPerWorldUnit: KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE,
  });
}

export function getKnowledgeGraph3DControlsPolicy(input: {
  compactRootView: boolean;
  viewportHeight: number;
  fovDegrees?: number;
  zoom?: number;
}) {
  if (!input.compactRootView) return null;
  return {
    enablePan: true,
    enableRotate: false,
    enableZoom: true,
    maxDistance: getKnowledgeRootProjectionSafeCameraDistance(input),
  } as const;
}

export function applyKnowledgeGraph3DControlsPolicy(
  controls: { enablePan?: boolean; enableRotate?: boolean; enableZoom?: boolean; maxDistance?: number },
  policy: ReturnType<typeof getKnowledgeGraph3DControlsPolicy>,
): () => void {
  if (!policy) return () => undefined;
  const previous = {
    enablePan: controls.enablePan,
    enableRotate: controls.enableRotate,
    enableZoom: controls.enableZoom,
    maxDistance: controls.maxDistance,
  };
  Object.assign(controls, policy);
  return () => Object.assign(controls, previous);
}

export function normalizeKnowledgeRootCameraPose<T extends {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}>(pose: T, maximumDistance: number): T {
  const originalDistance = Math.hypot(
    pose.position.x - pose.target.x,
    pose.position.y - pose.target.y,
    pose.position.z - pose.target.z,
  );
  const validOriginalDistance = Number.isFinite(originalDistance) && originalDistance > 0
    ? originalDistance
    : null;
  const validMaximumDistance = Number.isFinite(maximumDistance) && maximumDistance > 0
    ? maximumDistance
    : null;
  const safeDistance = validOriginalDistance && validMaximumDistance
    ? Math.min(validOriginalDistance, validMaximumDistance)
    : validOriginalDistance ?? validMaximumDistance;
  if (!safeDistance) return pose;
  return {
    ...pose,
    position: {
      x: pose.target.x,
      y: pose.target.y,
      z: pose.target.z + safeDistance,
    },
  };
}

export interface KnowledgeViewportNode {
  id: string;
  x: number;
  y: number;
  bodyRadius: number;
  labelBounds: KnowledgeNodeLabelBounds;
  isKeyNode?: boolean;
  isRootBubble?: boolean;
  importance?: number;
  screenX?: number;
  screenY?: number;
  projectedScale?: number;
  isInFrustum?: boolean;
  depth?: number;
}

export function projectKnowledgeWorldPoint(input: {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  project: (point: { x: number; y: number; z: number }) => { x: number; y: number; z?: number };
}) {
  const projected = input.project({ x: input.x, y: input.y, z: input.z });
  return {
    x: (projected.x + 1) * input.width / 2,
    y: (1 - projected.y) * input.height / 2,
    z: projected.z ?? 0,
  };
}

export function getKnowledgeProjectionScale(input: {
  center: { x: number; y: number; z: number };
  right: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
  width: number;
  height: number;
  project: (point: { x: number; y: number; z: number }) => { x: number; y: number; z?: number };
  minimumScale?: number;
}): number {
  const center = projectKnowledgeWorldPoint({
    ...input.center,
    width: input.width,
    height: input.height,
    project: input.project,
  });
  const projectBasis = (basis: { x: number; y: number; z: number }) => projectKnowledgeWorldPoint({
    x: input.center.x + basis.x,
    y: input.center.y + basis.y,
    z: input.center.z + basis.z,
    width: input.width,
    height: input.height,
    project: input.project,
  });
  const basisScales = [projectBasis(input.right), projectBasis(input.up)]
    .map((point) => Math.hypot(point.x - center.x, point.y - center.y))
    .filter((scale) => Number.isFinite(scale) && scale > 0);
  const minimumScale = Number.isFinite(input.minimumScale) && input.minimumScale! > 0
    ? input.minimumScale!
    : 0.0001;
  return Math.max(minimumScale, ...basisScales);
}

function compareUnicodeScalars(left: string, right: string): number {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0)!);
  const rightScalars = Array.from(right, (value) => value.codePointAt(0)!);
  for (let index = 0; index < Math.min(leftScalars.length, rightScalars.length); index += 1) {
    if (leftScalars[index] !== rightScalars[index]) return leftScalars[index] - rightScalars[index];
  }
  return leftScalars.length - rightScalars.length;
}

export function placeKnowledgeGraphLabels(input: Pick<KnowledgeViewportFitInput,
  'nodes' | 'labelMode' | 'selectedNodeId' | 'hoveredNodeId' | 'width' | 'height' | 'padding'> & {
    scale: number;
    enforceViewport?: boolean;
  }) {
  const safeInsets = normalizeSafeInsets(input.padding);
  const center = (node: KnowledgeViewportNode) => ({
    x: node.screenX ?? node.x * input.scale,
    y: node.screenY ?? node.y * input.scale,
  });
  const nodeScale = (node: KnowledgeViewportNode) => node.projectedScale ?? input.scale;
  const bodyRects = input.nodes.map((node) => ({
    id: node.id,
    left: center(node).x - node.bodyRadius * nodeScale(node),
    right: center(node).x + node.bodyRadius * nodeScale(node),
    top: center(node).y - node.bodyRadius * nodeScale(node),
    bottom: center(node).y + node.bodyRadius * nodeScale(node),
  }));
  const priority = (node: KnowledgeViewportNode) => {
    if (node.id === input.selectedNodeId) return 0;
    if (node.id === input.hoveredNodeId) return 1;
    if (node.isRootBubble) return 2;
    if ((node.importance ?? 0) >= 4 || node.isKeyNode) return 3;
    return 4;
  };
  const ordered = [...input.nodes].sort((left, right) => priority(left) - priority(right)
    || compareUnicodeScalars(left.id, right.id));
  const accepted: Array<{ id: string; left: number; right: number; top: number; bottom: number }> = [];
  const maximumVisibleLabels = Math.min(24, Math.max(4, Math.floor(input.width / 96) * 3));
  const result = new Map<string, ReturnType<typeof getKnowledgeNodeLabelPresentation> & {
    offsetX: number;
    offsetY: number;
    projectedScale: number;
  }>();
  const overlaps = (left: { left: number; right: number; top: number; bottom: number }, right: typeof left) => (
    left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top
  );
  ordered.forEach((node) => {
    if (node.isInFrustum === false || (node.depth !== undefined && !Number.isFinite(node.depth))) {
      result.set(node.id, {
        visible: false, fontSize: 0, scale: 0, priority: 'deferred',
        placement: 'external', complete: false,
        offsetX: 0, offsetY: 0, projectedScale: nodeScale(node),
      });
      return;
    }
    const label = getKnowledgeNodeLabelPresentation({
      labelMode: input.labelMode,
      nodeId: node.id,
      selectedNodeId: input.selectedNodeId,
      hoveredNodeId: input.hoveredNodeId,
      globalScale: nodeScale(node),
      isKeyNode: (node.importance ?? 0) >= 4 || node.isKeyNode,
      isRootBubble: node.isRootBubble,
    });
    if (!label.visible) {
      result.set(node.id, { ...label, offsetX: 0, offsetY: 0, projectedScale: nodeScale(node) });
      return;
    }
    if (label.placement === 'inside') {
      const point = center(node);
      const halfWidth = node.labelBounds.halfWidth * nodeScale(node) * label.scale;
      const halfHeight = node.labelBounds.halfHeight * nodeScale(node) * label.scale;
      accepted.push({
        id: node.id,
        left: point.x - halfWidth,
        right: point.x + halfWidth,
        top: point.y - halfHeight,
        bottom: point.y + halfHeight,
      });
      result.set(node.id, {
        ...label,
        offsetX: 0,
        offsetY: 0,
        projectedScale: nodeScale(node),
      });
      return;
    }
    const halfWidth = node.labelBounds.halfWidth * nodeScale(node) * label.scale;
    const halfHeight = node.labelBounds.halfHeight * nodeScale(node) * label.scale;
    const ownBody = node.bodyRadius * nodeScale(node);
    const gap = 4;
    const horizontal = ownBody + halfWidth + gap;
    const vertical = ownBody + halfHeight + gap;
    const offsets = [
      [0, -vertical], [0, vertical], [horizontal, 0], [-horizontal, 0],
      [horizontal, -vertical], [-horizontal, -vertical], [horizontal, vertical], [-horizontal, vertical],
    ];
    const candidates = offsets.map(([offsetX, offsetY]) => {
      const point = center(node);
      return { id: node.id, offsetX, offsetY, left: point.x + offsetX - halfWidth,
        right: point.x + offsetX + halfWidth, top: point.y + offsetY - halfHeight,
        bottom: point.y + offsetY + halfHeight };
    });
    const collisionFree = candidates.filter((rect) => !accepted.some((other) => overlaps(rect, other))
      && !bodyRects.some((body) => body.id !== node.id
        && input.nodes.find((candidateNode) => candidateNode.id === body.id)!.bodyRadius > 0
        && overlaps(rect, body)));
    let candidate = accepted.length >= maximumVisibleLabels && priority(node) > 1
      ? undefined
      : collisionFree.find((rect) => (!input.enforceViewport
      || (rect.left >= safeInsets.left && rect.right <= input.width - safeInsets.right
        && rect.top >= safeInsets.top && rect.bottom <= input.height - safeInsets.bottom)));
    if (!candidate && input.enforceViewport && (priority(node) <= 1 || node.isKeyNode)) {
      const point = center(node);
      const safeLeft = safeInsets.left;
      const safeRight = input.width - safeInsets.right;
      const safeTop = safeInsets.top;
      const safeBottom = input.height - safeInsets.bottom;
      const centerX = Math.min(safeRight - halfWidth, Math.max(safeLeft + halfWidth, point.x));
      const centerY = Math.min(safeBottom - halfHeight, Math.max(safeTop + halfHeight, point.y));
      candidate = {
        id: node.id,
        offsetX: centerX - point.x,
        offsetY: centerY - point.y,
        left: centerX - halfWidth,
        right: centerX + halfWidth,
        top: centerY - halfHeight,
        bottom: centerY + halfHeight,
      };
    }
    if (!candidate) result.set(node.id, {
      ...label, visible: false, fontSize: 0, scale: 0, offsetX: 0, offsetY: 0,
      projectedScale: nodeScale(node),
    });
    else {
      accepted.push(candidate);
      result.set(node.id, {
        ...label, offsetX: candidate.offsetX, offsetY: candidate.offsetY,
        projectedScale: nodeScale(node),
      });
    }
  });
  return result;
}

export interface KnowledgeViewportFitInput {
  nodes: readonly KnowledgeViewportNode[];
  width: number;
  height: number;
  padding?: number | KnowledgeViewportSafeInsets;
  labelMode: KnowledgeGraphLabelMode;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
}

function projectedBounds(input: KnowledgeViewportFitInput, scale: number) {
  const placements = placeKnowledgeGraphLabels({ ...input, scale });
  const items = input.nodes.map((node) => {
    const label = placements.get(node.id)!;
    const body = node.bodyRadius * scale;
    const labelHalfWidth = label.visible ? node.labelBounds.halfWidth * scale * label.scale : 0;
    const labelHalfHeight = label.visible ? node.labelBounds.halfHeight * scale * label.scale : 0;
    const bodyCenterX = node.x * scale;
    const bodyCenterY = node.y * scale;
    const bodyRect = {
      left: bodyCenterX - body,
      right: bodyCenterX + body,
      top: bodyCenterY - body,
      bottom: bodyCenterY + body,
    };
    const labelCenterX = bodyCenterX + label.offsetX;
    const labelCenterY = bodyCenterY + label.offsetY;
    const labelRect = label.visible ? {
      left: labelCenterX - labelHalfWidth,
      right: labelCenterX + labelHalfWidth,
      top: labelCenterY - labelHalfHeight,
      bottom: labelCenterY + labelHalfHeight,
    } : null;
    return {
      id: node.id,
      left: Math.min(bodyRect.left, labelRect?.left ?? bodyRect.left),
      right: Math.max(bodyRect.right, labelRect?.right ?? bodyRect.right),
      top: Math.min(bodyRect.top, labelRect?.top ?? bodyRect.top),
      bottom: Math.max(bodyRect.bottom, labelRect?.bottom ?? bodyRect.bottom),
      bodyRect,
      labelRect,
      label,
    };
  });
  const minX = Math.min(...items.map((item) => item.left));
  const maxX = Math.max(...items.map((item) => item.right));
  const minY = Math.min(...items.map((item) => item.top));
  const maxY = Math.max(...items.map((item) => item.bottom));
  return { items, minX, maxX, minY, maxY };
}

export function getKnowledgeGraphViewportFit(input: KnowledgeViewportFitInput) {
  const safeInsets = normalizeSafeInsets(input.padding);
  const availableWidth = Math.max(1, input.width - safeInsets.left - safeInsets.right);
  const availableHeight = Math.max(1, input.height - safeInsets.top - safeInsets.bottom);
  let low = 0.01;
  let high = 8;
  for (let index = 0; index < 48; index += 1) {
    const scale = (low + high) / 2;
    const bounds = projectedBounds(input, scale);
    if (bounds.maxX - bounds.minX <= availableWidth && bounds.maxY - bounds.minY <= availableHeight) low = scale;
    else high = scale;
  }
  const scale = low;
  const raw = projectedBounds(input, scale);
  const safeCenterX = safeInsets.left + availableWidth / 2;
  const safeCenterY = safeInsets.top + availableHeight / 2;
  const viewportCenterX = input.width / 2;
  const viewportCenterY = input.height / 2;
  const rawCenterWorldX = (raw.minX + raw.maxX) / (2 * scale);
  const rawCenterWorldY = (raw.minY + raw.maxY) / (2 * scale);
  const offsetX = safeCenterX - (raw.minX + raw.maxX) / 2;
  const offsetY = safeCenterY - (raw.minY + raw.maxY) / 2;
  return {
    scale,
    centerX: rawCenterWorldX - (safeCenterX - viewportCenterX) / scale,
    centerY: rawCenterWorldY - (safeCenterY - viewportCenterY) / scale,
    cameraCenterY: rawCenterWorldY + (safeCenterY - viewportCenterY) / scale,
    safeInsets,
    projectedFontSize: Math.max(
      KNOWLEDGE_NODE_LABEL_POLICY.minimumReadableFontSize,
      KNOWLEDGE_NODE_LABEL_POLICY.fontSize * scale
    ),
    nodes: raw.items.map((item) => ({
      id: item.id,
      left: item.left + offsetX,
      right: item.right + offsetX,
      top: item.top + offsetY,
      bottom: item.bottom + offsetY,
      bodyRect: {
        left: item.bodyRect.left + offsetX,
        right: item.bodyRect.right + offsetX,
        top: item.bodyRect.top + offsetY,
        bottom: item.bodyRect.bottom + offsetY,
      },
      labelRect: item.labelRect ? {
        left: item.labelRect.left + offsetX,
        right: item.labelRect.right + offsetX,
        top: item.labelRect.top + offsetY,
        bottom: item.labelRect.bottom + offsetY,
      } : null,
      label: item.label,
    })),
  };
}
