import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildKnowledgeNodeDetailFromGraph: vi.fn(),
  loadKnowledgeGraphData: vi.fn(),
}));

vi.mock('@/lib/knowledge-graph-source', () => ({
  buildKnowledgeNodeDetailFromGraph: mocks.buildKnowledgeNodeDetailFromGraph,
  loadKnowledgeGraphData: mocks.loadKnowledgeGraphData,
}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));

import { GET } from '@/app/api/knowledge/nodes/[id]/route';

describe('GET /api/knowledge/nodes/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns every raw association with visual merge provenance and directional evidence state', async () => {
    const graph = { nodes: [], links: [], source: 'file' };
    const detail = {
      id: 'node-a', name: '节点 A', relatedNodes: [
        { relationId: 'supports-a-b', canonicalType: 'supports', sourceId: 'node-a', targetId: 'node-b',
          inspectionSentence: '本节点支撑目标结论', evidenceState: 'unavailable',
          visualMergeKey: 'association|node-a|node-b', visualMergeCount: 2 },
        { relationId: 'applies-a-b', canonicalType: 'applies_to', sourceId: 'node-a', targetId: 'node-b',
          inspectionSentence: '本节点可应用于目标', evidenceState: 'available',
          visualMergeKey: 'association|node-a|node-b', visualMergeCount: 2 },
      ],
    };
    mocks.loadKnowledgeGraphData.mockResolvedValue(graph);
    mocks.buildKnowledgeNodeDetailFromGraph.mockReturnValue(detail);

    const response = await GET(new Request('http://localhost/api/knowledge/nodes/node-a'), {
      params: Promise.resolve({ id: 'node-a' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(detail);
    expect(mocks.buildKnowledgeNodeDetailFromGraph).toHaveBeenCalledWith(graph, 'node-a');
  });
});
