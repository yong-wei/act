import { KNOWLEDGE_NODE_LABEL_POLICY } from './node-label-layout';
import { KNOWLEDGE_ROOT_LABEL_POLICY } from './node-label-layout';

export type KnowledgeGraphLabelMode = 'focus' | 'all';

export const KNOWLEDGE_LABEL_ZOOM_THRESHOLD = 1.6;

/**
 * #1739 default readable-label budgets for the bounded DomainConcept
 * overview. After force separation, camera fit and collision deferral the
 * ordinary (unselected, unhovered) state must keep at least this share of
 * concept labels visible; deferred labels keep their accessible name and
 * the deferred count is recorded against these budgets.
 */
export const KNOWLEDGE_LABEL_OVERVIEW_MIN_VISIBLE_RATIO = {
  /** Measured on the settled twelve-concept overview fixture (#1739). */
  desktop: 0.75,
  mobile: 0.55,
} as const;

/** Visible labels never overlap one another (collision solver defers). */
export const KNOWLEDGE_LABEL_OVERVIEW_MAX_OVERLAP_COUNT = 0;

interface KnowledgeGraphLabelPolicyInput {
  labelMode: KnowledgeGraphLabelMode;
  nodeId?: string | null;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  globalScale?: number;
  isKeyNode?: boolean;
  isRootBubble?: boolean;
}

export interface KnowledgeGraphLabelPresentation {
  visible: boolean;
  fontSize: number;
  scale: number;
  priority: 'selected' | 'candidate' | 'deferred';
  placement: 'external' | 'inside';
  complete: boolean;
}

export function getKnowledgeNodeLabelPresentation(
  input: KnowledgeGraphLabelPolicyInput
): KnowledgeGraphLabelPresentation {
  const selected = Boolean(input.nodeId) && input.nodeId === input.selectedNodeId;
  if (input.isRootBubble) {
    const graphScale = typeof input.globalScale === 'number' && input.globalScale > 0
      ? input.globalScale
      : 1;
    const projectedFontSize = KNOWLEDGE_ROOT_LABEL_POLICY.fontSize * graphScale;
    const fontSize = Math.max(
      projectedFontSize,
      KNOWLEDGE_ROOT_LABEL_POLICY.minimumReadableFontSize,
    );
    return {
      visible: true,
      fontSize,
      scale: fontSize / projectedFontSize,
      priority: selected ? 'selected' : 'candidate',
      placement: 'inside',
      complete: true,
    };
  }
  const candidate = Boolean(input.nodeId) && (
    input.isKeyNode === true
    || input.nodeId === input.hoveredNodeId
  );
  const requested = Boolean(input.nodeId) && (
    input.labelMode === 'all'
    || selected
    || candidate
    || (typeof input.globalScale === 'number' && input.globalScale >= KNOWLEDGE_LABEL_ZOOM_THRESHOLD)
  );
  const graphScale = typeof input.globalScale === 'number' && input.globalScale > 0
    ? input.globalScale
    : 1;
  const projectedFontSize = KNOWLEDGE_NODE_LABEL_POLICY.fontSize * graphScale;
  if (!requested || (!selected && !candidate && projectedFontSize < KNOWLEDGE_NODE_LABEL_POLICY.minimumReadableFontSize)) {
    return {
      visible: false,
      fontSize: 0,
      scale: 0,
      priority: 'deferred',
      placement: 'external',
      complete: false,
    };
  }
  const fontSize = Math.max(projectedFontSize, KNOWLEDGE_NODE_LABEL_POLICY.minimumReadableFontSize);
  return {
    visible: true,
    fontSize,
    scale: fontSize / projectedFontSize,
    priority: selected ? 'selected' : candidate ? 'candidate' : 'deferred',
    placement: 'external',
    complete: false,
  };
}

export function shouldRenderKnowledgeNodeLabel({
  labelMode,
  nodeId,
  selectedNodeId,
  hoveredNodeId,
  globalScale,
  isKeyNode,
  isRootBubble,
}: KnowledgeGraphLabelPolicyInput): boolean {
  return getKnowledgeNodeLabelPresentation({
    labelMode, nodeId, selectedNodeId, hoveredNodeId, globalScale, isKeyNode, isRootBubble,
  }).visible;
}
