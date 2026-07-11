export type KnowledgeNodeActivationAction = 'expand' | 'collapse' | 'inspect' | 'resolve' | 'ignore';

export interface KnowledgeExpansionCommitQueue {
  register: (sequence: number) => void;
  settle: (sequence: number, commit?: () => void) => void;
  clear: () => void;
}

export function createKnowledgeExpansionCommitQueue(): KnowledgeExpansionCommitQueue {
  const entries = new Map<number, { ready: boolean; commit?: () => void }>();
  const flush = () => {
    while (entries.size > 0) {
      const sequence = Math.min(...entries.keys());
      const entry = entries.get(sequence);
      if (!entry?.ready) return;
      entries.delete(sequence);
      entry.commit?.();
    }
  };
  return {
    register(sequence) {
      entries.set(sequence, { ready: false });
    },
    settle(sequence, commit) {
      const current = entries.get(sequence);
      if (!current || current.ready) return;
      entries.set(sequence, { ready: true, commit });
      flush();
    },
    clear() {
      entries.clear();
    },
  };
}

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

export function selectNewlyMaterializedKnowledgeNodeIds(input: {
  payloadNodeIds: readonly string[];
  visibleNodeIdsAtActivation: ReadonlySet<string>;
}): string[] {
  return [...new Set(input.payloadNodeIds)]
    .filter((nodeId) => !input.visibleNodeIdsAtActivation.has(nodeId));
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
