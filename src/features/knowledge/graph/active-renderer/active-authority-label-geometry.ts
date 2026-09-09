import type { KnowledgeNodeData } from '../../knowledge-graph-system';
import {
  deriveKnowledgeNodeCanvasName,
  getSharedKnowledgeNodeLabelMeasureText,
  layoutKnowledgeNodeLabel,
  layoutKnowledgeRootLabel,
  type KnowledgeNodeLabelLayout,
} from '../node-label-layout';
import {
  ACTIVE_AUTHORITY_LABEL_DOM_BUDGET,
  ACTIVE_AUTHORITY_LABEL_FONT_SIZE,
  ACTIVE_AUTHORITY_LABEL_SCREEN_BUDGET,
  ACTIVE_AUTHORITY_ROOT_LABEL_FONT_SIZE,
  type ActiveAuthorityLabelDescriptor,
  type ActiveAuthorityLabelPlacement,
  type ActiveAuthorityLayoutNode,
} from './active-authority-geometry';

function isRootNode(node: Pick<KnowledgeNodeData, 'id' | 'metadata'>): boolean {
  const metadata = (node.metadata ?? {}) as { presentationKind?: unknown };
  return metadata.presentationKind === 'domain'
    || metadata.presentationKind === 'aggregate'
    || metadata.presentationKind === 'active-root-navigation'
    || node.id.startsWith('root-entry-');
}

function labelPriority(
  node: ActiveAuthorityLayoutNode,
  selectedNodeId: string | null,
  hoveredNodeId: string | null,
): number {
  if (node.id === selectedNodeId) return 5;
  if (node.id === hoveredNodeId) return 4;
  if (isRootNode(node)) return 3;
  if (node.labelPriority) return 2;
  if ((node.graphImportanceScore ?? node.importance ?? 0) >= 0.75) return 1;
  return 0;
}

function labelLayoutFor(node: ActiveAuthorityLayoutNode): KnowledgeNodeLabelLayout {
  const name = deriveKnowledgeNodeCanvasName(node.name);
  const measureText = getSharedKnowledgeNodeLabelMeasureText();
  return isRootNode(node) ? layoutKnowledgeRootLabel(name, measureText) : layoutKnowledgeNodeLabel(name, measureText);
}

export function buildActiveAuthorityLabelDescriptors(input: {
  nodes: readonly ActiveAuthorityLayoutNode[];
  kind: 'root' | 'domain';
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
}): ActiveAuthorityLabelDescriptor[] {
  const descriptors = input.nodes.map((node) => {
    const label = labelLayoutFor(node);
    const richTitle = node.richTitle;
    const mathematics = node.mathematics;
    const humanContext = mathematics?.state === 'available' && richTitle?.state === 'available'
      && richTitle.accessibleName.trim()
      ? richTitle.accessibleName
      : undefined;
    const accessibleName = mathematics?.state === 'available' && mathematics.accessibleLabel.trim()
      ? mathematics.accessibleLabel
      : richTitle?.state === 'available' && richTitle.accessibleName.trim()
        ? richTitle.accessibleName
        : label.accessibleName;
    return {
      id: node.id,
      displayName: label.displayName,
      accessibleName,
      fallbackLines: label.lines.map((line) => line.text),
      richTitle,
      mathematics,
      humanContext,
      width: Math.max(54, label.width + (isRootNode(node) ? 20 : 12)),
      height: label.height + (mathematics?.state === 'available' ? 18 : 0),
      fontSize: isRootNode(node) ? ACTIVE_AUTHORITY_ROOT_LABEL_FONT_SIZE : ACTIVE_AUTHORITY_LABEL_FONT_SIZE,
      priority: labelPriority(node, input.selectedNodeId, input.hoveredNodeId),
      isRoot: input.kind === 'root' || isRootNode(node),
    } satisfies ActiveAuthorityLabelDescriptor;
  });
  const ordered = descriptors.sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  const limit = Math.min(ACTIVE_AUTHORITY_LABEL_DOM_BUDGET, ordered.length);
  const selected = ordered.filter((label) => label.priority >= 4);
  const visible = ordered.slice(0, limit);
  for (const label of selected) {
    if (visible.some((candidate) => candidate.id === label.id)) continue;
    visible[visible.length - 1] = label;
  }
  return visible.sort((left, right) => left.id.localeCompare(right.id));
}

function overlaps(left: ActiveAuthorityLabelPlacement, right: ActiveAuthorityLabelPlacement): boolean {
  return Math.abs(left.x - right.x) < (left.width + right.width) / 2
    && Math.abs(left.y - right.y) < (left.height + right.height) / 2;
}

export function placeActiveAuthorityLabels(input: {
  descriptors: readonly ActiveAuthorityLabelDescriptor[];
  points: ReadonlyMap<string, { x: number; y: number; scale?: number }>;
  width: number;
  height: number;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
}): ActiveAuthorityLabelPlacement[] {
  const width = Math.max(1, input.width);
  const height = Math.max(1, input.height);
  const padding = 16;
  const accepted: ActiveAuthorityLabelPlacement[] = [];
  const ordered = [...input.descriptors].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  const hardBudget = Math.min(ACTIVE_AUTHORITY_LABEL_SCREEN_BUDGET, ordered.length);
  const placements = ordered.map((descriptor) => {
    const point = input.points.get(descriptor.id);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return { ...descriptor, x: 0, y: 0, visible: false, opacity: 0 };
    }
    const isPriority = descriptor.id === input.selectedNodeId || descriptor.id === input.hoveredNodeId;
    const maxWidth = Math.max(48, width - padding * 2);
    const labelWidth = Math.min(descriptor.width, maxWidth);
    const scale = Math.max(0.25, point.scale ?? 1);
    const candidate: ActiveAuthorityLabelPlacement = {
      ...descriptor,
      width: labelWidth,
      height: Math.max(16, descriptor.height),
      x: point.x,
      y: point.y + (descriptor.isRoot ? 50 : 28) * Math.min(1.5, Math.max(0.7, scale)),
      visible: false,
      opacity: descriptor.priority >= 2 ? 1 : 0.8,
    };
    const outside = candidate.x - candidate.width / 2 < padding
      || candidate.x + candidate.width / 2 > width - padding
      || candidate.y - candidate.height / 2 < padding
      || candidate.y + candidate.height / 2 > height - padding;
    const collision = accepted.some((placed) => overlaps(candidate, placed));
    const canShow = isPriority || (!outside && !collision && accepted.length < hardBudget);
    if (canShow) {
      if (isPriority && outside) {
        candidate.x = Math.min(width - padding - candidate.width / 2, Math.max(padding + candidate.width / 2, candidate.x));
        candidate.y = Math.min(height - padding - candidate.height / 2, Math.max(padding + candidate.height / 2, candidate.y));
      }
      candidate.visible = true;
      candidate.opacity = isPriority ? 1 : candidate.opacity;
      accepted.push(candidate);
    }
    return candidate;
  });
  return placements;
}
