import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  verifyKonlingRuntimeScope: vi.fn(),
  getStepAIContext: vi.fn(),
  prisma: {
    konlingSession: {
      findMany: vi.fn(),
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

import { GET, POST } from '../api/ai/sessions/route';

const createGetRequest = () => new NextRequest('http://localhost/api/ai/sessions');
const createdAt = new Date('2026-06-12T00:00:00.000Z');

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
});
