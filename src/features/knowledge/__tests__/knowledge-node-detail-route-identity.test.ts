import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { knowledgeNode: { update: vi.fn() } } }));

const graphSource = vi.hoisted(() => ({
  buildDetail: vi.fn(),
  loadGraph: vi.fn(async () => ({ nodes: [], links: [], source: 'database' })),
}));

vi.mock('@/lib/knowledge-graph-source', () => ({
  buildKnowledgeNodeDetailFromGraph: graphSource.buildDetail,
  loadKnowledgeGraphData: graphSource.loadGraph,
}));

import { GET } from '@/app/api/knowledge/nodes/[id]/route';

function decodedRouteId(id: string): string {
  const url = new URL(`/api/knowledge/nodes/${encodeURIComponent(id)}`, 'http://localhost');
  return decodeURIComponent(url.pathname.split('/').at(-1)!);
}

describe('knowledge node detail route canonical identity', () => {
  beforeEach(() => {
    graphSource.buildDetail.mockReset();
    graphSource.loadGraph.mockClear();
  });

  it.each(['node / with ? # %', '控制 Ω 节点', 'x'.repeat(200)])(
    'round-trips an encoded canonical id: %s',
    async (id) => {
      graphSource.buildDetail.mockImplementation((_graph, receivedId) => ({ id: receivedId }));
      const decodedId = decodedRouteId(id);
      const response = await GET(
        new Request(`http://localhost/api/knowledge/nodes/${encodeURIComponent(id)}`),
        { params: Promise.resolve({ id: decodedId }) },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ id });
      expect(graphSource.buildDetail).toHaveBeenCalledWith(expect.anything(), id);
    },
  );

  it('rejects a 201-character canonical id before graph loading', async () => {
    const id = 'x'.repeat(201);
    const response = await GET(
      new Request(`http://localhost/api/knowledge/nodes/${encodeURIComponent(id)}`),
      { params: Promise.resolve({ id: decodedRouteId(id) }) },
    );

    expect(response.status).toBe(400);
    expect(graphSource.loadGraph).not.toHaveBeenCalled();
  });
});
