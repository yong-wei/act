import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  canvas: vi.fn(),
  nodeDetail: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/authoritative-knowledge', () => ({
  CURRENT_AGGREGATE_RELEASE_SET_ID: 'actkg-authoritative-candidate-v2',
  CURRENT_AGGREGATE_RELEASE_ID: 'control-theory-engineering-v0.2',
  AuthoritativeKnowledgeProjectionService: class {
    canvas = mocks.canvas;
    nodeDetail = mocks.nodeDetail;
  },
}));

import { GET as getCanvas } from '@/app/api/knowledge/graph/v2/route';
import { GET as getNode } from '@/app/api/knowledge/nodes/v2/[id]/route';

const originalActivation = process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION;
const originalV2Acceptance = process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID;
const originalKonlingAcceptance = process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_KONLING_ACCEPTED_RELEASE_SET_ID;

function activateCandidateRelease() {
  process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION = 'true';
  process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID = 'actkg-authoritative-candidate-v2';
  process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_KONLING_ACCEPTED_RELEASE_SET_ID = 'actkg-authoritative-candidate-v2';
}

function session(role: string) {
  return { user: { id: 'user-1', role } };
}

function availableProjection(role?: string) {
  return {
    status: 'available',
    projection: role
      ? {
          projectionVersion: 'act.node-detail.v2',
          role,
          node: { id: 'node-1' },
        }
      : {
          projectionVersion: 'act.canvas.v2',
          source: {
            releaseSetId: 'actkg-authoritative-candidate-v2',
            releaseId: 'control-theory-engineering-v0.2',
          },
        },
    diagnostics: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION = 'false';
  delete process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID;
  delete process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_KONLING_ACCEPTED_RELEASE_SET_ID;
  mocks.canvas.mockResolvedValue(availableProjection());
  mocks.nodeDetail.mockResolvedValue(availableProjection('ADMIN'));
});

describe('candidate authoritative V2 routes', () => {
  it('returns stable 401 without authentication', async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const response = await getCanvas(new Request('http://localhost/api/knowledge/graph/v2'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized',
      code: 'CANDIDATE_GRAPH_UNAUTHORIZED',
    });
    expect(mocks.canvas).not.toHaveBeenCalled();
  });

  it.each(['STUDENT', 'TEACHER'])(
    'returns stable 403 to %s while the public gate is closed',
    async (role) => {
      mocks.getServerSession.mockResolvedValue(session(role));
      const response = await getCanvas(new Request('http://localhost/api/knowledge/graph/v2'));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        code: 'CANDIDATE_GRAPH_FORBIDDEN',
      });
      expect(mocks.canvas).not.toHaveBeenCalled();
    },
  );

  it('allows ADMIN controlled verification with one fixed selector', async () => {
    mocks.getServerSession.mockResolvedValue(session('ADMIN'));
    const response = await getCanvas(new Request('http://localhost/api/knowledge/graph/v2'));
    expect(response.status).toBe(200);
    expect(mocks.canvas).toHaveBeenCalledWith(
      {
        authorityState: 'candidate',
        releaseSetId: 'actkg-authoritative-candidate-v2',
        releaseId: 'control-theory-engineering-v0.2',
      },
      expect.objectContaining({
        consumerId: 'candidate-authoritative-knowledge-graph',
      }),
    );
  });

  it('keeps the fixed candidate diagnostic administrator-only after activation', async () => {
    activateCandidateRelease();
    for (const role of ['STUDENT', 'TEACHER']) {
      mocks.getServerSession.mockResolvedValue(session(role));
      const response = await getCanvas(new Request('http://localhost/api/knowledge/graph/v2'));
      expect(response.status).toBe(403);
    }
    mocks.getServerSession.mockResolvedValue(session('ADMIN'));
    const admin = await getCanvas(new Request('http://localhost/api/knowledge/graph/v2'));
    expect(admin.status).toBe(200);
    const body = await admin.json() as { knowledgeSurface?: { authority?: { snapshotId: string | null; snapshotHash: string | null; releaseId: string } } };
    expect(body.knowledgeSurface?.authority?.releaseId).toBe('control-theory-engineering-v0.2');
    expect(body.knowledgeSurface?.authority?.snapshotId).toBeNull();
    expect(body.knowledgeSurface?.authority?.snapshotHash).toBeNull();
    mocks.getServerSession.mockResolvedValue(session('SUPERUSER'));
    const forbidden = await getCanvas(new Request('http://localhost/api/knowledge/graph/v2'));
    expect(forbidden.status).toBe(403);
  });

  it('does not accept selector parameters from the client', async () => {
    mocks.getServerSession.mockResolvedValue(session('ADMIN'));
    const response = await getCanvas(new Request(
      'http://localhost/api/knowledge/graph/v2?releaseId=other',
    ));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'CANDIDATE_GRAPH_SELECTOR_FIXED',
    });
    expect(mocks.getServerSession).not.toHaveBeenCalled();
    expect(mocks.canvas).not.toHaveBeenCalled();
  });

  it('fails closed on drift without a Legacy request', async () => {
    mocks.getServerSession.mockResolvedValue(session('ADMIN'));
    mocks.canvas.mockResolvedValue({
      status: 'drift',
      selector: {},
      diagnostics: [{ code: 'receipt-count-mismatch' }],
    });
    const response = await getCanvas(new Request('http://localhost/api/knowledge/graph/v2'));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Candidate graph release drift detected.',
      code: 'CANDIDATE_GRAPH_DRIFT',
    });
  });

  it('returns 404 for an absent node and passes the authenticated role to detail projection', async () => {
    activateCandidateRelease();
    mocks.getServerSession.mockResolvedValue(session('ADMIN'));
    mocks.nodeDetail.mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'node-not-found',
      selector: {},
      diagnostics: [],
    });
    const missing = await getNode(
      new Request('http://localhost/api/knowledge/nodes/v2/missing'),
      { params: Promise.resolve({ id: 'missing' }) },
    );
    expect(missing.status).toBe(404);

    mocks.nodeDetail.mockResolvedValueOnce(availableProjection('ADMIN'));
    const available = await getNode(
      new Request('http://localhost/api/knowledge/nodes/v2/node-1'),
      { params: Promise.resolve({ id: 'node-1' }) },
    );
    expect(available.status).toBe(200);
    await expect(available.json()).resolves.toMatchObject({ role: 'ADMIN' });
    expect(mocks.nodeDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        releaseSetId: 'actkg-authoritative-candidate-v2',
        releaseId: 'control-theory-engineering-v0.2',
      }),
      'ADMIN',
      'node-1',
      expect.any(Object),
    );
  });
});

afterAll(() => {
  if (originalActivation === undefined) {
    delete process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION;
  } else {
    process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION = originalActivation;
  }
  if (originalV2Acceptance === undefined) delete process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID;
  else process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID = originalV2Acceptance;
  if (originalKonlingAcceptance === undefined) delete process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_KONLING_ACCEPTED_RELEASE_SET_ID;
  else process.env.AUTHORITATIVE_KNOWLEDGE_GRAPH_KONLING_ACCEPTED_RELEASE_SET_ID = originalKonlingAcceptance;
});
