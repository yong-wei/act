import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  verifyKonlingRuntimeScope: vi.fn(),
  getStepAIContext: vi.fn(),
  loadTextbookCoachContext: vi.fn(),
  prisma: {
    konlingSession: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    teachingResource: {
      findUnique: vi.fn(),
    },
    knowledgeNode: {
      findUnique: vi.fn(),
    },
    courseBasis: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

vi.mock('@/lib/konling-agent-runtime', () => ({
  verifyKonlingRuntimeScope: mocks.verifyKonlingRuntimeScope,
}));

vi.mock('@/lib/course-ai-contexts', () => ({
  getStepAIContext: mocks.getStepAIContext,
}));

vi.mock('@/lib/ai-context-resolver', () => ({
  resolveRegisteredAIContextFromPath: vi.fn(() => null),
}));

vi.mock('@/lib/textbook-resource-coach/loader', () => ({
  loadTextbookCoachContext: mocks.loadTextbookCoachContext,
}));

import { GET, POST } from '../api/ai/sessions/route';
import { hashTextbookMarkdown } from '@/lib/textbook-resource-coach/identity';

const createGetRequest = () => new NextRequest('http://localhost/api/ai/sessions');
const createdAt = new Date('2026-06-12T00:00:00.000Z');

const coachIdentity = {
  resourceKind: 'structured-textbook-unit',
  resourceId: 'unit-3-1',
  bookId: 'hu-shousong-auto-control-8th',
  edition: '第 8 版',
  sourceRevision: 'rev-2026-08',
  unitId: 'unit-3-1',
  contentHash: hashTextbookMarkdown('单元正文'),
  anchorId: null,
};

function coachPostBody() {
  return JSON.stringify({
    courseId: 'course-1',
    pageId: 'page-1',
    assistantBinding: {
      modeId: 'resource-coach',
      clientContextHints: { ...coachIdentity },
    },
  });
}

function createdConversation(courseId: string, pageId: string, userId = 'student-1') {
  return {
    id: 'session-1',
    userId,
    courseId,
    pageId,
    title: '新对话',
    titleIsManual: false,
    pinnedAt: null,
    lastActivityAt: createdAt,
    libraryVisible: true,
    messages: [{ role: 'system', content: 'server context' }],
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date('2026-06-19T00:00:00.000Z'),
  };
}

describe('/api/ai/sessions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.getStepAIContext.mockReturnValue({
      courseId: 'course-1',
      stepId: 'page-1',
    });
    mocks.verifyKonlingRuntimeScope.mockResolvedValue({
      ok: true,
      scope: {
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        role: 'student',
        courseId: 'course-1',
        pageId: 'page-1',
        classId: null,
        resourceId: null,
        pathNodeId: null,
        privacyScopes: ['self'],
      },
    });
  });

  it('keeps the owner-scoped library GET side-effect free when empty', async () => {
    mocks.prisma.konlingSession.findMany.mockResolvedValueOnce([]);

    const response = await GET(createGetRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ conversations: [] });
    expect(mocks.prisma.konlingSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        libraryVisible: true,
      }),
    }));
    expect(mocks.prisma.konlingSession.create).not.toHaveBeenCalled();
  });

  it('filters owner conversations by courseId and pageId when recovering a resource session', async () => {
    mocks.prisma.konlingSession.findMany.mockResolvedValueOnce([]);

    const response = await GET(new NextRequest(
      'http://localhost/api/ai/sessions?courseId=interactive&pageId=%2Finteractive-learning%2Fresources%2Fpid-tuner',
    ));

    expect(response.status).toBe(200);
    expect(mocks.prisma.konlingSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        courseId: 'interactive',
        pageId: '/interactive-learning/resources/pid-tuner',
      }),
    }));
  });

  it('creates a new blank conversation only through POST', async () => {
    mocks.prisma.konlingSession.create.mockResolvedValueOnce(createdConversation('course-1', 'page-1'));

    const response = await POST(new NextRequest('http://localhost/api/ai/sessions', {
      method: 'POST',
      body: JSON.stringify({
        courseId: 'course-1',
        pageId: 'page-1',
        title: 'Course page',
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.prisma.konlingSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'student-1',
        courseId: 'course-1',
        pageId: 'page-1',
        title: '新对话',
        messages: [expect.objectContaining({ role: 'system' })],
      }),
    });
    const createInput = mocks.prisma.konlingSession.create.mock.calls[0]?.[0].data;
    expect(createInput).not.toHaveProperty('expiresAt');
  });

  it('creates conversations for bounded smart-prep bootstrap and path-advisor contexts', async () => {
    mocks.getStepAIContext.mockReturnValue(null);
    mocks.getServerSession.mockResolvedValueOnce({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.verifyKonlingRuntimeScope.mockResolvedValueOnce({
      ok: true,
      scope: {
        authenticatedUserId: 'teacher-1',
        targetUserId: 'teacher-1',
        role: 'teacher',
        courseId: 'smart-prep',
        pageId: '/teacher/smart-prep',
        classId: null,
        resourceId: null,
        pathNodeId: null,
        privacyScopes: ['teacher-scoped'],
      },
    });
    mocks.prisma.konlingSession.create.mockResolvedValueOnce(
      createdConversation('smart-prep', '/teacher/smart-prep', 'teacher-1'),
    );
    const smartPrepResponse = await POST(new NextRequest('http://localhost/api/ai/sessions', {
      method: 'POST',
      body: JSON.stringify({ courseId: 'smart-prep', pageId: '/teacher/smart-prep' }),
    }));
    expect(smartPrepResponse.status).toBe(201);

    mocks.verifyKonlingRuntimeScope.mockResolvedValueOnce({
      ok: true,
      scope: {
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        role: 'student',
        courseId: 'control-correction',
        pageId: 'adaptive-path-center',
        classId: 'class-1',
        resourceId: null,
        pathNodeId: null,
        privacyScopes: ['self'],
      },
    });
    mocks.prisma.konlingSession.create.mockResolvedValueOnce(
      createdConversation('control-correction', 'adaptive-path-center'),
    );
    const pathAdvisorResponse = await POST(new NextRequest('http://localhost/api/ai/sessions', {
      method: 'POST',
      body: JSON.stringify({
        courseId: 'control-correction',
        pageId: 'adaptive-path-center',
        classId: 'class-1',
      }),
    }));
    expect(pathAdvisorResponse.status).toBe(201);
  });

  it('rejects unregistered page contexts before creating a conversation', async () => {
    mocks.verifyKonlingRuntimeScope.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'Forbidden',
    });
    const response = await POST(new NextRequest('http://localhost/api/ai/sessions', {
      method: 'POST',
      body: JSON.stringify({ courseId: 'course-other', pageId: 'page-other' }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.prisma.konlingSession.create).not.toHaveBeenCalled();
  });

  it('persists the server-verified resource-coach binding with a deterministic identity key', async () => {
    mocks.loadTextbookCoachContext.mockResolvedValueOnce({
      status: 'ready',
      identity: coachIdentity,
    });
    mocks.prisma.konlingSession.create.mockImplementationOnce(async ({ data }) =>
      createdConversation('course-1', 'page-1'));

    const response = await POST(new NextRequest('http://localhost/api/ai/sessions', {
      method: 'POST',
      body: coachPostBody(),
    }));

    expect(response.status).toBe(201);
    const createInput = mocks.prisma.konlingSession.create.mock.calls[0]?.[0].data;
    expect(createInput.migrationSourceId).toBe(
      `resource-coach:student-1:unit-3-1:rev-2026-08:${coachIdentity.contentHash}:-`,
    );
    expect(createInput.messages).toHaveLength(2);
    expect(createInput.messages[1]).toMatchObject({
      role: 'system',
      metadata: {
        konlingAssistantBindingEvent: {
          teachingAssistantModeId: 'resource-coach',
          pinnedTextbookResourceIdentity: coachIdentity,
        },
      },
    });
  });

  it('reuses the racing winner when a concurrent first question already created the bound conversation', async () => {
    mocks.loadTextbookCoachContext.mockResolvedValue({
      status: 'ready',
      identity: coachIdentity,
    });
    mocks.prisma.konlingSession.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique violation', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const winner = {
      ...createdConversation('course-1', 'page-1'),
      id: 'winner-session',
      expiresAt: null,
    };
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce(winner);

    const response = await POST(new NextRequest('http://localhost/api/ai/sessions', {
      method: 'POST',
      body: coachPostBody(),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 'winner-session' });
    expect(mocks.prisma.konlingSession.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        migrationSourceId: `resource-coach:student-1:unit-3-1:rev-2026-08:${coachIdentity.contentHash}:-`,
        userId: 'student-1',
      }),
    });
  });

  it('does not create a conversation when the pinned resource version is unavailable', async () => {
    mocks.loadTextbookCoachContext.mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'revision-unavailable',
    });

    const response = await POST(new NextRequest('http://localhost/api/ai/sessions', {
      method: 'POST',
      body: coachPostBody(),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'KONLING_MODE_UNAVAILABLE',
      unavailableReasons: ['textbook-coach:revision-unavailable'],
    });
    expect(mocks.prisma.konlingSession.create).not.toHaveBeenCalled();
  });
});
