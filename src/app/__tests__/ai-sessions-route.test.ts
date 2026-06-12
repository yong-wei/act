import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    konlingSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
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

import { GET, POST } from '../api/ai/sessions/route';

const createGetRequest = () =>
  new NextRequest('http://localhost/api/ai/sessions?courseId=course-1&pageId=page-1');

describe('/api/ai/sessions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'student-1' } });
  });

  it('keeps GET side-effect free when no active session exists', async () => {
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce(null);

    const response = await GET(createGetRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Session not found' });
    expect(mocks.prisma.konlingSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        courseId: 'course-1',
        pageId: 'page-1',
      }),
    }));
    expect(mocks.prisma.konlingSession.create).not.toHaveBeenCalled();
  });

  it('creates sessions only through POST', async () => {
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.create.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'student-1',
      courseId: 'course-1',
      pageId: 'page-1',
      title: 'Course page',
      messages: [],
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

    expect(response.status).toBe(200);
    expect(mocks.prisma.konlingSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'student-1',
        courseId: 'course-1',
        pageId: 'page-1',
        title: 'Course page',
        messages: [],
      }),
    });
  });

  it('reuses an active session on POST instead of creating duplicates', async () => {
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce({
      id: 'session-existing',
      userId: 'student-1',
      courseId: 'course-1',
      pageId: 'page-1',
      title: 'Existing page',
      messages: [],
      createdAt: new Date('2026-06-12T00:00:00.000Z'),
      updatedAt: new Date('2026-06-12T00:01:00.000Z'),
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

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      id: 'session-existing',
      title: 'Existing page',
    }));
    expect(mocks.prisma.konlingSession.create).not.toHaveBeenCalled();
  });
});
