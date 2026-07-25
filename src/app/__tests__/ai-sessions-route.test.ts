import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  verifyKonlingRuntimeScope: vi.fn(),
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
  getStepAIContext: vi.fn(() => ({
    courseId: 'course-1',
    stepId: 'page-1',
  })),
}));

vi.mock('@/lib/ai-context-resolver', () => ({
  resolveAIContext: vi.fn(() => ({
    pageContext: null,
    enabled: false,
    tools: [],
    quickQuestions: [],
  })),
}));

import { GET, POST } from '../api/ai/sessions/route';

const createGetRequest = () => new NextRequest('http://localhost/api/ai/sessions');

describe('/api/ai/sessions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
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
    mocks.prisma.konlingSession.create.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'student-1',
      courseId: 'course-1',
      pageId: 'page-1',
      title: '新对话',
      titleIsManual: false,
      pinnedAt: null,
      lastActivityAt: new Date('2026-06-12T00:00:00.000Z'),
      libraryVisible: true,
      messages: [{ role: 'system', content: 'server context' }],
      createdAt: new Date('2026-06-12T00:00:00.000Z'),
      updatedAt: new Date('2026-06-12T00:00:00.000Z'),
      expiresAt: new Date('2026-06-19T00:00:00.000Z'),
    });

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
