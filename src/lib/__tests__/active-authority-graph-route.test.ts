import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeActiveGraph: vi.fn(),
  readActiveCanvas: vi.fn(),
  readActiveNode: vi.fn(),
  activeProjectionResponse: vi.fn(),
  activeUnavailableResponse: vi.fn(),
}));

vi.mock('@/app/api/knowledge/_active-authority', () => mocks);

import { NextResponse } from 'next/server';
import { GET as getCanvas } from '@/app/api/knowledge/graph/active/route';
import { GET as getNode } from '@/app/api/knowledge/nodes/active/[id]/route';

const available = { status: 'available', projection: { source: { authorityState: 'active' } } } as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeActiveGraph.mockResolvedValue({ ok: true, role: 'STUDENT' });
  mocks.readActiveCanvas.mockReturnValue(available);
  mocks.readActiveNode.mockReturnValue(available);
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
  it('ignores client authority selectors and resolves the committed active contract', async () => {
    const response = await getCanvas(new Request(
      'http://localhost/api/knowledge/graph/active?releaseId=attacker&snapshotId=other&manifest=raw',
    ));
    expect(response.status).toBe(200);
    expect(mocks.authorizeActiveGraph).toHaveBeenCalledTimes(1);
    expect(mocks.readActiveCanvas).toHaveBeenCalledWith();
    expect(mocks.activeProjectionResponse).toHaveBeenCalledWith(available);
  });

  it('returns authorization responses before touching the active resolver', async () => {
    mocks.authorizeActiveGraph.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ code: 'ACTIVE_GRAPH_UNAUTHORIZED' }, { status: 401 }),
    });
    const response = await getCanvas(new Request('http://localhost/api/knowledge/graph/active'));
    expect(response.status).toBe(401);
    expect(mocks.readActiveCanvas).not.toHaveBeenCalled();
  });

  it('passes only the path node id to the active detail resolver', async () => {
    const response = await getNode(
      new Request('http://localhost/api/knowledge/nodes/active/node-1?snapshotId=other'),
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
});

