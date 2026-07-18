import { normalizeExactKnowledgeLessonId } from '@/lib/knowledge-lesson-identity';

export type KnowledgeNodeActivationAction = 'expand' | 'collapse' | 'inspect' | 'resolve' | 'ignore';

export function resolveKnowledgeLessonLocation(
  search: string,
  trustedLessonId: string | null = null
): { lessonId: string | null; search: string } {
  const params = new URLSearchParams(search);
  const lessonValues = params.getAll('lessonId');
  const urlLessonId = lessonValues.length === 1
    ? normalizeExactKnowledgeLessonId(lessonValues[0])
    : null;
  params.delete('lessonId');

  const lessonId = lessonValues.length > 0
    ? urlLessonId
    : normalizeExactKnowledgeLessonId(trustedLessonId);
  if (lessonId) params.set('lessonId', lessonId);
  const normalized = params.toString();
  return { lessonId, search: normalized ? `?${normalized}` : '' };
}

export function resolveInitialKnowledgeNodeId(
  search: string,
  initialSelectedNodeId: string | null = null
): string | null {
  const params = new URLSearchParams(search);
  return params.get('node') ?? params.get('nodeId') ?? initialSelectedNodeId;
}

export interface KnowledgeExpansionCommitQueue {
  register: (sequence: number, onCancel?: () => void) => void;
  settle: (sequence: number, commit?: () => void, onCancel?: () => void) => boolean;
  cancel: (sequence: number) => boolean;
  clear: () => void;
}

export function createKnowledgeExpansionCommitQueue(): KnowledgeExpansionCommitQueue {
  const entries = new Map<number, { ready: boolean; commit?: () => void; onCancel?: () => void }>();
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
    register(sequence, onCancel) {
      entries.set(sequence, { ready: false, onCancel });
    },
    settle(sequence, commit, onCancel) {
      const current = entries.get(sequence);
      if (!current || current.ready) return false;
      entries.set(sequence, { ready: true, commit, onCancel });
      flush();
      return true;
    },
    cancel(sequence) {
      const current = entries.get(sequence);
      if (!current) return false;
      current.onCancel?.();
      entries.set(sequence, { ready: true });
      flush();
      return true;
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
  cancelled?: boolean;
}): boolean {
  return input.mounted
    && !input.aborted
    && !input.cancelled
    && input.currentGeneration === input.expectedGeneration
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
