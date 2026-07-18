import { isChapterNodeId } from './filter-utils';
import { KNOWLEDGE_NODE_LABEL_POLICY } from './node-label-layout';
import { KNOWLEDGE_ROOT_LABEL_POLICY } from './node-label-layout';

export type KnowledgeGraphLabelMode = 'focus' | 'all';

export const KNOWLEDGE_LABEL_ZOOM_THRESHOLD = 1.6;

interface KnowledgeGraphLabelPolicyInput {
  labelMode: KnowledgeGraphLabelMode;
  nodeId?: string | null;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  globalScale?: number;
  isKeyNode?: boolean;
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
  const isRoot = Boolean(input.nodeId) && isChapterNodeId(input.nodeId!);
  if (isRoot) {
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
}: KnowledgeGraphLabelPolicyInput): boolean {
  return getKnowledgeNodeLabelPresentation({
    labelMode, nodeId, selectedNodeId, hoveredNodeId, globalScale, isKeyNode,
  }).visible;
}
