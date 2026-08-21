import {
  KNOWLEDGE_NODE_LABEL_POLICY,
  KNOWLEDGE_ROOT_LABEL_POLICY,
  layoutKnowledgeNodeLabel,
  layoutKnowledgeRootLabel,
} from './node-label-layout';

export const KNOWLEDGE_GRAPH_PRODUCT_VERSION = {
  active: {
    mode: 'active',
    label: '新版',
  },
  legacy: {
    mode: 'legacy',
    label: '旧版',
  },
} as const;

export type KnowledgeGraphProductVersionMode =
  typeof KNOWLEDGE_GRAPH_PRODUCT_VERSION[keyof typeof KNOWLEDGE_GRAPH_PRODUCT_VERSION]['mode'];

export function knowledgeGraphProductVersionLabel(
  mode: KnowledgeGraphProductVersionMode,
): string {
  return KNOWLEDGE_GRAPH_PRODUCT_VERSION[mode].label;
}

export {
  KNOWLEDGE_NODE_LABEL_POLICY,
  KNOWLEDGE_ROOT_LABEL_POLICY,
  layoutKnowledgeNodeLabel,
  layoutKnowledgeRootLabel,
};
