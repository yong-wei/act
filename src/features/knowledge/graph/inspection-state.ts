export interface KnowledgeInspectionState<TNode> {
  selectedNode: TNode | null;
  isPanelOpen: boolean;
  explicitFocusNodeId: string | null;
  pendingNavigationTarget: { intentId: number; nodeId: string } | null;
}

export type KnowledgeInspectionAction<TNode> =
  | { type: 'inspect-node'; node: TNode }
  | { type: 'close-inspector' }
  | { type: 'dismiss-selection' }
  | { type: 'begin-navigation'; intentId: number; targetNodeId?: string }
  | { type: 'commit-navigation-target'; intentId: number; node: TNode; nodeId: string }
  | { type: 'return-root' }
  | { type: 'toggle-explicit-focus'; nodeId: string };

export function createKnowledgeInspectionState<TNode>(): KnowledgeInspectionState<TNode> {
  return {
    selectedNode: null,
    isPanelOpen: false,
    explicitFocusNodeId: null,
    pendingNavigationTarget: null,
  };
}

export function knowledgeInspectionReducer<TNode>(
  state: KnowledgeInspectionState<TNode>,
  action: KnowledgeInspectionAction<TNode>
): KnowledgeInspectionState<TNode> {
  switch (action.type) {
    case 'inspect-node':
      return { ...state, selectedNode: action.node, isPanelOpen: true, pendingNavigationTarget: null };
    case 'close-inspector':
      return { ...state, isPanelOpen: false };
    case 'dismiss-selection':
      return { ...state, selectedNode: null, isPanelOpen: false };
    case 'begin-navigation':
      return {
        selectedNode: null,
        isPanelOpen: false,
        explicitFocusNodeId: null,
        pendingNavigationTarget: action.targetNodeId
          ? { intentId: action.intentId, nodeId: action.targetNodeId }
          : null,
      };
    case 'commit-navigation-target':
      if (
        state.pendingNavigationTarget?.intentId !== action.intentId
        || state.pendingNavigationTarget.nodeId !== action.nodeId
      ) {
        return state;
      }
      return {
        ...state,
        selectedNode: action.node,
        isPanelOpen: true,
        pendingNavigationTarget: null,
      };
    case 'return-root':
      return createKnowledgeInspectionState<TNode>();
    case 'toggle-explicit-focus':
      return {
        ...state,
        explicitFocusNodeId: state.explicitFocusNodeId === action.nodeId ? null : action.nodeId,
      };
  }
}
