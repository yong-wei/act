import type { KnowledgeNodeData } from '../../knowledge-graph-system';
import {
  deriveKnowledgeNodeCanvasName,
  getSharedKnowledgeNodeLabelMeasureText,
  KNOWLEDGE_ROOT_LABEL_POLICY,
  layoutKnowledgeNodeLabel,
  layoutKnowledgeRootLabel,
  type KnowledgeNodeLabelLayout,
} from '../node-label-layout';
import {
  ACTIVE_AUTHORITY_LABEL_DOM_BUDGET,
  ACTIVE_AUTHORITY_LABEL_FONT_SIZE,
  ACTIVE_AUTHORITY_LABEL_SCREEN_BUDGET,
  ACTIVE_AUTHORITY_ROOT_LABEL_FONT_SIZE,
  ACTIVE_ROOT_BUBBLE,
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

let rootMeasureText: ((text: string) => number) | null = null;

function measureRootText(text: string): number {
  if (!rootMeasureText) {
    const fallback = (value: string) => Array.from(value)
      .reduce((width, character) => width + (/[\u2E80-\uFFFF]/u.test(character) ? 14 : 8), 0);
    rootMeasureText = fallback;
    if (typeof document !== 'undefined' && typeof CanvasRenderingContext2D !== 'undefined') {
      try {
        const context = document.createElement('canvas').getContext('2d');
        if (context) {
          context.font = KNOWLEDGE_ROOT_LABEL_POLICY.font;
          rootMeasureText = (value) => context.measureText(value).width || fallback(value);
        }
      } catch {
        rootMeasureText = fallback;
      }
    }
  }
  return rootMeasureText(text);
}

function splitToLineCount(tokens: readonly string[], joiner: string, count: number, target: number): string[] {
  const lines: string[] = [];
  let current = '';
  tokens.forEach((token, index) => {
    const next = current ? current + joiner + token : token;
    const remainingSlots = count - lines.length - 1;
    const remainingTokens = tokens.length - index;
    if (current && remainingSlots > 0 && measureRootText(next) > target * 1.08 && remainingTokens >= 1) {
      lines.push(current);
      current = token;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

/** Balanced 1–3 line wrap that fits a root bubble; avoids single-character orphan lines. */
export function balanceActiveRootLabelLines(name: string, maxWidth: number): string[] {
  const text = name.trim().replace(/\s+/gu, ' ') || '未命名领域';
  const total = measureRootText(text);
  if (total <= maxWidth) return [text];
  const spaced = text.includes(' ');
  const tokens = spaced ? text.split(' ') : Array.from(text);
  const joiner = spaced ? ' ' : '';
  for (let count = 2; count <= KNOWLEDGE_ROOT_LABEL_POLICY.maxLines; count += 1) {
    const lines = splitToLineCount(tokens, joiner, count, total / count);
    if (lines.every((line) => measureRootText(line) <= maxWidth)) return lines;
  }
  return splitToLineCount(tokens, joiner, KNOWLEDGE_ROOT_LABEL_POLICY.maxLines, total / KNOWLEDGE_ROOT_LABEL_POLICY.maxLines);
}

function labelLayoutFor(node: ActiveAuthorityLayoutNode): KnowledgeNodeLabelLayout {
  const name = deriveKnowledgeNodeCanvasName(node.name);
  const measureText = getSharedKnowledgeNodeLabelMeasureText();
  return isRootNode(node) ? layoutKnowledgeRootLabel(name, measureText) : layoutKnowledgeNodeLabel(name, measureText);
}

export function buildActiveAuthorityLabelDescriptors(input: {
  nodes: readonly ActiveAuthorityLayoutNode[];
  kind: 'root' | 'domain';
  focusNodeIds?: ReadonlySet<string>;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  captions?: ReadonlyMap<string, string>;
}): ActiveAuthorityLabelDescriptor[] {
  const descriptors = input.nodes.map((node) => {
    const label = labelLayoutFor(node);
    const root = input.kind === 'root' || isRootNode(node);
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
    const rootLines = root ? balanceActiveRootLabelLines(label.displayName, node.renderRadius * 2 * 0.8 - 8) : null;
    const caption = root ? input.captions?.get(node.id) : undefined;
    const rootWidth = rootLines
      ? Math.max(...rootLines.map(measureRootText), caption ? measureRootText(caption) * 0.72 : 0) + 12
      : 0;
    return {
      id: node.id,
      displayName: label.displayName,
      accessibleName,
      fallbackLines: rootLines ?? label.lines.map((line) => line.text),
      richTitle: root ? undefined : richTitle,
      mathematics: root ? undefined : mathematics,
      humanContext,
      // Node chips carry px-1.5 py-0.5 plus a 1px ring around the measured text.
      width: rootLines ? Math.max(54, rootWidth) : Math.max(54, label.width + 14),
      height: (rootLines ? rootLines.length * KNOWLEDGE_ROOT_LABEL_POLICY.lineHeight : label.height + 6)
        + (!root && mathematics?.state === 'available' ? 18 : 0)
        + (root && input.captions?.has(node.id) ? ACTIVE_ROOT_BUBBLE.captionHeight : 0),
      fontSize: isRootNode(node) ? ACTIVE_AUTHORITY_ROOT_LABEL_FONT_SIZE : ACTIVE_AUTHORITY_LABEL_FONT_SIZE,
      priority: node.id !== input.selectedNodeId && input.focusNodeIds?.has(node.id) ? 4 : labelPriority(node, input.selectedNodeId, input.selectedNodeId ? null : input.hoveredNodeId),
      isRoot: root,
      anchorRadius: node.renderRadius,
      ...(root && input.captions?.has(node.id) ? { caption: input.captions.get(node.id) } : {}),
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
  const clampInside = (candidate: ActiveAuthorityLabelPlacement) => {
    candidate.x = Math.min(width - padding - candidate.width / 2, Math.max(padding + candidate.width / 2, candidate.x));
    candidate.y = Math.min(height - padding - candidate.height / 2, Math.max(padding + candidate.height / 2, candidate.y));
  };
  const isOutside = (candidate: ActiveAuthorityLabelPlacement) => candidate.x - candidate.width / 2 < padding
    || candidate.x + candidate.width / 2 > width - padding
    || candidate.y - candidate.height / 2 < padding
    || candidate.y + candidate.height / 2 > height - padding;
  const collides = (candidate: ActiveAuthorityLabelPlacement) => accepted.some((placed) => overlaps(candidate, placed));
  const placements = ordered.map((descriptor) => {
    const point = input.points.get(descriptor.id);
    if (input.selectedNodeId && descriptor.priority < 4) {
      return { ...descriptor, x: point?.x ?? 0, y: point?.y ?? 0, visible: false, opacity: 0 };
    }
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return { ...descriptor, x: 0, y: 0, visible: false, opacity: 0 };
    }
    const isSelected = descriptor.id === input.selectedNodeId;
    const isHovered = !input.selectedNodeId && descriptor.id === input.hoveredNodeId;
    const zoom = Math.max(0.03, point.scale ?? 1);
    const maxWidth = Math.max(48, width - padding * 2);
    const fontScale = descriptor.isRoot
      ? Math.min(18, Math.max(12, ACTIVE_AUTHORITY_ROOT_LABEL_FONT_SIZE * zoom)) / ACTIVE_AUTHORITY_ROOT_LABEL_FONT_SIZE
      : 1;
    const labelWidth = Math.min(descriptor.width * fontScale, maxWidth);
    const labelHeight = Math.max(16, descriptor.height * fontScale);
    const glyph = descriptor.anchorRadius * zoom;
    const base: ActiveAuthorityLabelPlacement = {
      ...descriptor,
      fontSize: descriptor.fontSize * fontScale,
      width: labelWidth,
      height: labelHeight,
      x: point.x,
      y: point.y,
      visible: false,
      opacity: descriptor.priority >= 2 ? 1 : 0.8,
    };
    // Root names live inside their bubble; node labels hang below the glyph, with
    // above/right/left as fallbacks for selection-priority labels.
    const anchors = descriptor.isRoot
      ? [{ x: point.x, y: point.y }]
      : [
        { x: point.x, y: point.y + glyph + 4 + labelHeight / 2 },
        { x: point.x, y: point.y - glyph - 4 - labelHeight / 2 },
        { x: point.x + glyph + 6 + labelWidth / 2, y: point.y },
        { x: point.x - glyph - 6 - labelWidth / 2, y: point.y },
      ];
    const tryAnchors = descriptor.priority >= 4 || isHovered ? anchors : anchors.slice(0, 1);
    let chosen: ActiveAuthorityLabelPlacement | null = null;
    for (const anchor of tryAnchors) {
      const candidate = { ...base, ...anchor };
      if (isSelected || isHovered) clampInside(candidate);
      if (isOutside(candidate) || collides(candidate)) continue;
      chosen = candidate;
      break;
    }
    if (!chosen && (isSelected || isHovered)) {
      chosen = { ...base, ...tryAnchors[0] };
      clampInside(chosen);
    }
    if (!chosen || (!isSelected && !isHovered && descriptor.priority < 4 && accepted.length >= hardBudget)) {
      return { ...base, ...anchors[0] };
    }
    chosen.visible = true;
    chosen.opacity = isSelected || isHovered || descriptor.priority >= 4 ? 1 : chosen.opacity;
    accepted.push(chosen);
    return chosen;
  });
  return placements;
}
