import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeActiveGraph: vi.fn(),
  authorizeActiveFullGraphDiagnostics: vi.fn(),
  readActiveCanvas: vi.fn(),
  readActiveNode: vi.fn(),
  activeProjectionResponse: vi.fn(),
  activeUnavailableResponse: vi.fn(),
  readActiveDetailShard: vi.fn(),
  readActiveDetailInfograph: vi.fn(),
  activeShardResponse: vi.fn(),
}));

vi.mock('@/app/api/knowledge/_active-authority', () => mocks);

import { NextResponse } from 'next/server';
import { GET as getCanvas } from '@/app/api/knowledge/graph/active/route';
import { GET as getNode } from '@/app/api/knowledge/nodes/active/[id]/route';
import { GET as getShardNode } from '@/app/api/knowledge/shards/active/nodes/[id]/route';
import { GET as getShardInfograph } from '@/app/api/knowledge/shards/active/nodes/[id]/infograph/route';

const available = { status: 'available', projection: { source: { authorityState: 'active' } } } as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeActiveGraph.mockResolvedValue({ ok: true, role: 'STUDENT' });
  mocks.authorizeActiveFullGraphDiagnostics.mockResolvedValue({ ok: true, role: 'ADMIN' });
  mocks.readActiveCanvas.mockReturnValue(available);
  mocks.readActiveNode.mockReturnValue(available);
  mocks.readActiveDetailShard.mockReturnValue({ shardClass: 'node-detail' });
  mocks.readActiveDetailInfograph.mockReturnValue(Buffer.from([1, 2, 3]));
  mocks.activeShardResponse.mockImplementation((read, role) => {
    read();
    return NextResponse.json({ role });
  });
  mocks.activeProjectionResponse.mockImplementation((result) => (
    result.status === 'available'
      ? NextResponse.json(result.projection)
      : NextResponse.json({ code: 'ACTIVE_GRAPH_UNAVAILABLE' }, { status: 503 })
  ));
  mocks.activeUnavailableResponse.mockImplementation((reason: string) => (
    NextResponse.json({ code: reason }, { status: 503 })
  ));
});

describe('active Authority graph routes', () => {
  it('rejects client authority selectors instead of resolving a supplied release', async () => {
    const response = await getCanvas(new Request(
      'http://localhost/api/knowledge/graph/active?releaseId=attacker&snapshotId=other&manifest=raw',
    ));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'KNOWLEDGE_SURFACE_SELECTOR_FIXED',
      parameter: 'releaseId',
    });
    expect(mocks.authorizeActiveFullGraphDiagnostics).not.toHaveBeenCalled();
    expect(mocks.readActiveCanvas).not.toHaveBeenCalled();
  });

  it('returns authorization responses before touching the active resolver', async () => {
    mocks.authorizeActiveFullGraphDiagnostics.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ code: 'ACTIVE_GRAPH_DIAGNOSTICS_FORBIDDEN' }, { status: 403 }),
    });
    const response = await getCanvas(new Request('http://localhost/api/knowledge/graph/active'));
    expect(response.status).toBe(403);
    expect(mocks.readActiveCanvas).not.toHaveBeenCalled();
  });

  it('rejects client snapshot selectors on active node detail', async () => {
    const response = await getNode(
      new Request('http://localhost/api/knowledge/nodes/active/node-1?snapshotId=other'),
      { params: Promise.resolve({ id: 'node-1' }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.readActiveNode).not.toHaveBeenCalled();
  });

  it('passes only the path node id to the active detail resolver', async () => {
    const response = await getNode(
      new Request('http://localhost/api/knowledge/nodes/active/node-1'),
      { params: Promise.resolve({ id: 'node-1' }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.readActiveNode).toHaveBeenCalledWith('STUDENT', 'node-1');
  });

  it('rejects malformed detail ids without resolving Authority data', async () => {
    const response = await getNode(
      new Request('http://localhost/api/knowledge/nodes/active/invalid'),
      { params: Promise.resolve({ id: '' }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.authorizeActiveGraph).not.toHaveBeenCalled();
    expect(mocks.readActiveNode).not.toHaveBeenCalled();
  });

  it('keeps unavailable active state independent from Legacy routes', async () => {
    mocks.readActiveCanvas.mockReturnValueOnce({ status: 'unavailable', reason: 'engineering-graph-activation-absent' });
    mocks.activeProjectionResponse.mockImplementationOnce(() => (
      NextResponse.json({ code: 'ACTIVE_GRAPH_ACTIVATION_ABSENT' }, { status: 503 })
    ));
    const response = await getCanvas(new Request('http://localhost/api/knowledge/graph/active'));
    expect(response.status).toBe(503);
    expect(mocks.readActiveCanvas).toHaveBeenCalledTimes(1);
    expect(mocks.readActiveNode).not.toHaveBeenCalled();
  });

  it('passes the authenticated role into the active node-detail shard projection', async () => {
    mocks.authorizeActiveGraph.mockResolvedValueOnce({ ok: true, role: 'STUDENT' });
    const response = await getShardNode(
      new Request('http://localhost/api/knowledge/shards/active/nodes/node-1'),
      { params: Promise.resolve({ id: 'node-1' }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.readActiveDetailShard).toHaveBeenCalledWith('node-1');
    expect(mocks.activeShardResponse).toHaveBeenCalledWith(expect.any(Function), 'STUDENT', expect.any(Request));
  });

  it('serves only the selected authorized infograph without exposing a source locator', async () => {
    const response = await getShardInfograph(
      new Request('http://localhost/api/knowledge/shards/active/nodes/node-1/infograph'),
      { params: Promise.resolve({ id: 'node-1' }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, max-age=300');
    expect(mocks.readActiveDetailInfograph).toHaveBeenCalledWith('node-1');
  });

  it('returns a controlled response when selected infograph bytes are unavailable', async () => {
    mocks.readActiveDetailInfograph.mockReturnValueOnce(null);
    const response = await getShardInfograph(
      new Request('http://localhost/api/knowledge/shards/active/nodes/node-1/infograph'),
      { params: Promise.resolve({ id: 'node-1' }) },
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: '当前信息图暂时不可用。',
      code: 'ACTIVE_INFOGRAPH_UNAVAILABLE',
    });
  });
});
