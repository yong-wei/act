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

/**
 * 大域（概念数超过 compact 上限）概览经重点标签通道（labelPriority）
 * 呈现，可见率下限按无钳位碰撞几何实测给出（273 概念真实分片 + 画布
 * 同参力学沉降 + fit + 碰撞求解，#1739）。mobile 大域 fit 后节点为
 * 像素级，画布标签几何不可行（320×568 实测未选中可见 0/273）：
 * spec 语义为节点目录承担无选择可读名称，画布预算仅由选中节点的
 * 钳位兜底保证（≈1/273）。
 */
export const KNOWLEDGE_LABEL_OVERVIEW_LARGE_DOMAIN_MIN_VISIBLE_RATIO = {
  desktop: 0.15,
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
