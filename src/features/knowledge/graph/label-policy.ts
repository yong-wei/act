import { isChapterNodeId } from './filter-utils';

export type KnowledgeGraphLabelMode = 'focus' | 'all';

export const KNOWLEDGE_LABEL_ZOOM_THRESHOLD = 1.6;

interface KnowledgeGraphLabelPolicyInput {
  labelMode: KnowledgeGraphLabelMode;
  nodeId?: string | null;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  globalScale?: number;
}

export function shouldRenderKnowledgeNodeLabel({
  labelMode,
  nodeId,
  selectedNodeId,
  hoveredNodeId,
  globalScale,
}: KnowledgeGraphLabelPolicyInput): boolean {
  if (!nodeId) return false;
  if (labelMode === 'all') return true;
  if (isChapterNodeId(nodeId)) return true;
  if (nodeId === selectedNodeId || nodeId === hoveredNodeId) return true;
  return typeof globalScale === 'number' && globalScale >= KNOWLEDGE_LABEL_ZOOM_THRESHOLD;
}
