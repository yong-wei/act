import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { graph, lessonContext, resolveExactRuntimeLessonContext } = vi.hoisted(() => {
  const graph = {
    nodes: [{ id: 'a' }],
    links: [],
    source: 'file' as const,
  };
  const lessonContext = {
    lessonId: '1-1',
    overlayRevision: 'a'.repeat(64),
    cardOrderNodeIds: ['a'],
    mappingGaps: { cardOrder: [], links: [] },
  };
  return {
    graph,
    lessonContext,
    resolveExactRuntimeLessonContext: vi.fn(async () => lessonContext),
  };
});

vi.mock('@/lib/knowledge-graph-source', () => ({
  buildKnowledgeGraphActiveFilterPayload: vi.fn(),
  buildKnowledgeGraphExpansionPayload: vi.fn(),
  buildKnowledgeGraphManifestPayload: vi.fn(),
  buildKnowledgeGraphRemainingPayload: vi.fn(),
  buildKnowledgeGraphRootPayload: vi.fn(() => ({
    mode: 'root',
    graphVersion: 'graph-v1',
    shardKey: 'graph-v1:shard:root:chapters',
    filterSignature: 'default',
    nodes: [],
    links: [],
    source: 'file',
    truncated: { nodes: false, links: false, membershipLinks: false },
  })),
  loadKnowledgeGraphData: vi.fn(),
  loadKnowledgeGraphRootData: vi.fn(async () => graph),
  toPublicKnowledgeGraphPayload: vi.fn(),
}));
vi.mock('@/lib/knowledge-lesson-context', () => ({ resolveExactRuntimeLessonContext }));
vi.mock('@/lib/knowledge-graph-relation-runtime', () => ({
  RuntimeKnowledgeRelationCoverageError: class extends Error {},
  toPublicRuntimeKnowledgeDiagnostics: vi.fn(),
}));

import { GET } from '@/app/api/knowledge/graph/route';

describe('knowledge graph lesson context route', () => {
  beforeEach(() => resolveExactRuntimeLessonContext.mockClear());

  it('passes the validated canonical graph into exact lookup and returns only sanitized context', async () => {
    const response = await GET(new Request('http://localhost/api/knowledge/graph?mode=root&lessonId=1-1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(resolveExactRuntimeLessonContext).toHaveBeenCalledWith('1-1', graph);
    expect(payload.lessonContext).toEqual(lessonContext);
    expect(Object.keys(payload.lessonContext).sort()).toEqual([
      'cardOrderNodeIds',
      'lessonId',
      'mappingGaps',
      'overlayRevision',
    ]);
  });

  it('passes null for duplicate lesson ids instead of choosing an alias or fallback', async () => {
    await GET(new Request('http://localhost/api/knowledge/graph?mode=root&lessonId=1-1&lessonId=2-1'));

    expect(resolveExactRuntimeLessonContext).toHaveBeenCalledWith(null, graph);
  });
});
