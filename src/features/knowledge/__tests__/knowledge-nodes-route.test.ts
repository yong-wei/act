import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadKnowledgeGraphData: vi.fn(),
  filterKnowledgeNodes: vi.fn(),
  prisma: {
    knowledgeNode: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/knowledge-graph-source', () => ({
  loadKnowledgeGraphData: mocks.loadKnowledgeGraphData,
  filterKnowledgeNodes: mocks.filterKnowledgeNodes,
  toPublicKnowledgeGraphNode: (node: unknown) => node,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { GET } from '@/app/api/knowledge/nodes/route';

describe('GET /api/knowledge/nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadKnowledgeGraphData.mockResolvedValue({
      source: 'file',
      nodes: [{ id: 'file-node', name: '文件节点' }],
      links: [],
    });
    mocks.filterKnowledgeNodes.mockReturnValue([{ id: 'file-node', name: '文件节点' }]);
    mocks.prisma.knowledgeNode.findMany.mockResolvedValue([
      { id: 'db-node', name: '数据库节点' },
    ]);
  });

  it('uses file-backed graph nodes by default', async () => {
    const response = await GET(new Request('http://localhost/api/knowledge/nodes'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual([{ id: 'file-node', name: '文件节点' }]);
    expect(mocks.loadKnowledgeGraphData).toHaveBeenCalled();
    expect(mocks.prisma.knowledgeNode.findMany).not.toHaveBeenCalled();
  });

  it('does not let the legacy source=db query bypass the canonical graph loader', async () => {
    const response = await GET(new Request('http://localhost/api/knowledge/nodes?source=db'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual([{ id: 'file-node', name: '文件节点' }]);
    expect(mocks.loadKnowledgeGraphData).toHaveBeenCalled();
    expect(mocks.prisma.knowledgeNode.findMany).not.toHaveBeenCalled();
  });
});
