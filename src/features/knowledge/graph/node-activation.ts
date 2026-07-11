export type KnowledgeNodeActivationAction = 'expand' | 'collapse' | 'inspect' | 'resolve' | 'ignore';

export function resolveKnowledgeNodeActivation(input: {
  expansionState: 'expandable' | 'leaf' | 'unknown';
  expanded: boolean;
  filteredEmpty?: boolean;
  loading?: boolean;
  error?: boolean;
}): KnowledgeNodeActivationAction {
  if (input.loading) return 'ignore';
  if (input.expansionState === 'leaf') return 'inspect';
  if (input.expansionState === 'unknown') return 'resolve';
  return input.expanded ? 'collapse' : 'expand';
}
