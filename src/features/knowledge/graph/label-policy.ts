import { KNOWLEDGE_NODE_LABEL_POLICY } from './node-label-layout';
import { KNOWLEDGE_ROOT_LABEL_POLICY } from './node-label-layout';

export type KnowledgeGraphLabelMode = 'focus' | 'all';

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

/**
 * 大域概览按最大可见数 + 画面中心优先绘制。desktop 下限按碰撞几何
 * 实测给出；mobile 大域 fit 后节点为像素级，画布预算仅由选中节点的
 * 钳位兜底保证。
 */
export const KNOWLEDGE_LABEL_OVERVIEW_LARGE_DOMAIN_MIN_VISIBLE_RATIO = {
  desktop: 0.14,
  mobile: 0.003,
} as const;

/** 超过此概念数的概览适用大域标签预算。 */
export const KNOWLEDGE_LABEL_OVERVIEW_COMPACT_MAX_NODES = 48;

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
  if (!input.nodeId) {
    return {
      visible: false,
      fontSize: 0,
      scale: 0,
      priority: 'deferred',
      placement: 'external',
      complete: false,
    };
  }
  const candidate = input.isKeyNode === true || input.nodeId === input.hoveredNodeId;
  const graphScale = typeof input.globalScale === 'number' && input.globalScale > 0
    ? input.globalScale
    : 1;
  const projectedFontSize = KNOWLEDGE_NODE_LABEL_POLICY.fontSize * graphScale;
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
