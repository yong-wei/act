import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  konlingSessionFindFirst: vi.fn(),
  agentToolRunFindMany: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    konlingSession: { findFirst: mocks.konlingSessionFindFirst },
    agentToolRun: { findMany: mocks.agentToolRunFindMany },
  },
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/ai/sessions/[id]/route';
import {
  createKonlingAssistantBindingEvent,
  createKonlingContextEvent,
  normalizeKonlingConversationAssistantBinding,
} from '@/lib/konling-conversation-library';

const now = new Date('2026-07-26T00:00:00.000Z');

const canaryValues = [
  'CANARY-CLASS-1', 'CANARY-RES-1', 'CANARY-NODE-1', 'CANARY-RSET-1', 'CANARY-REL-1',
  'CANARY-DIGEST-1', 'CANARY-HASH-1', 'CANARY-CANON-1',
  '[控灵当前页面上下文]', '[控灵助手绑定]', 'konlingContextEvent', 'konlingAssistantBindingEvent',
];

function persistedConversation() {
  return {
    id: 'session-1',
    userId: 'student-1',
    courseId: 'course-a',
    pageId: 'page-a',
    title: '新对话',
    titleIsManual: false,
    pinnedAt: null,
    lastActivityAt: now,
    libraryVisible: true,
    activeTurnId: null,
    activeTurnClaimedAt: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    messages: [
      createKonlingContextEvent({
        courseId: 'course-a',
        pageId: 'page-a',
        classId: 'CANARY-CLASS-1',
        resourceId: 'CANARY-RES-1',
        pathNodeId: 'CANARY-NODE-1',
        candidateGraph: {
          authorityState: 'candidate' as const,
          releaseSetId: 'CANARY-RSET-1',
          releaseId: 'CANARY-REL-1',
          projectionDigest: 'CANARY-DIGEST-1',
          sourceDatasetHash: 'CANARY-HASH-1',
          selectedCanonicalId: 'CANARY-CANON-1',
          selectedCanonicalType: 'DomainConcept',
          governanceFilter: 'EXTENSION' as const,
          canonicalTypeFilter: null,
          coverageStatus: 'ready' as const,
          objectCount: 10,
          relationCount: 12,
        },
      }, 'context-canary'),
      createKonlingAssistantBindingEvent(normalizeKonlingConversationAssistantBinding({
        modeId: 'resource-coach',
        clientContextHints: { resourceId: 'textbook-res-9' },
      }), 'binding-canary'),
      { id: 'user-1', role: 'user', content: '帮我看看这道题', parts: [{ type: 'text', text: '帮我看看这道题' }] },
      { id: 'assistant-1', role: 'assistant', content: '好的，我们来看这道题。', parts: [{ type: 'text', text: '好的，我们来看这道题。' }] },
    ],
  };
}

const context = { params: Promise.resolve({ id: 'session-1' }) };

function request() {
  return new NextRequest('https://act.example/api/ai/sessions/session-1');
}

describe('konling session detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'student-1' } });
    mocks.konlingSessionFindFirst.mockResolvedValue(persistedConversation());
    mocks.agentToolRunFindMany.mockResolvedValue([]);
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await GET(request(), context);

    expect(response.status).toBe(401);
    expect(mocks.konlingSessionFindFirst).not.toHaveBeenCalled();
  });

  it('omits internal system records and canary identifiers from the raw JSON', async () => {
    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    const body = await response.json();
    const raw = JSON.stringify(body);

    expect(body.messages.map((message: { id: string; role: string }) => [message.id, message.role]))
      .toEqual([['user-1', 'user'], ['assistant-1', 'assistant']]);
    for (const canary of canaryValues) {
      expect(raw).not.toContain(canary);
    }
    expect(body.assistantBinding).toMatchObject({
      teachingAssistantModeId: 'resource-coach',
      modeClientContextHints: { resourceId: 'textbook-res-9' },
    });
  });

  it('returns 404 for a conversation owned by someone else', async () => {
    mocks.konlingSessionFindFirst.mockResolvedValue(null);

    const response = await GET(request(), context);

    expect(response.status).toBe(404);
  });
});
