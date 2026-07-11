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

export function shouldCommitKnowledgeNodeActivation(input: {
  mounted: boolean;
  aborted: boolean;
  expectedGeneration: number;
  currentGeneration: number | undefined;
  expectedSequence: number;
  currentSequence: number;
}): boolean {
  return input.mounted
    && !input.aborted
    && input.currentGeneration === input.expectedGeneration
    && input.currentSequence === input.expectedSequence;
}

export function shouldCommitKnowledgeExpansionPayload(input: {
  mounted: boolean;
  aborted: boolean;
  expectedGeneration: number;
  currentGeneration: number | undefined;
}): boolean {
  return input.mounted
    && !input.aborted
    && input.currentGeneration === input.expectedGeneration;
}

export function isExpansionFilteredEmpty(input: {
  shardLoaded: boolean;
  nodeId: string;
  visibleLinks: ReadonlyArray<{ sourceId: string; targetId: string }>;
}): boolean {
  return input.shardLoaded && !input.visibleLinks.some(
    (link) => link.sourceId === input.nodeId || link.targetId === input.nodeId
  );
}
