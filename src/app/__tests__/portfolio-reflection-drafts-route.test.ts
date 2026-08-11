import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    portfolioReflectionDraft: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));
vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

import { GET, POST } from '@/app/api/profile/portfolio-reflection-drafts/route';
import { DELETE, PUT } from '@/app/api/profile/portfolio-reflection-drafts/[draftId]/route';

const createdAt = new Date('2026-08-11T01:00:00.000Z');
const updatedAt = new Date('2026-08-11T02:00:00.000Z');
const requestBody = {
  source: 'portfolio',
  assignment: 'PID 参数整定',
  intent: 'create-portfolio-reflection',
  title: 'AI 协作反思草稿',
  content: '我先核对了调节时间。\n下一步会比较超调量。',
  idempotencyKey: '5eeed496-47c3-4c9e-8cb2-47fbcd347e12',
};
const databaseDraft = {
  id: 'draft-1',
  ...requestBody,
  assignment: requestBody.assignment,
  status: 'DRAFT' as const,
  createdAt,
  updatedAt,
};

function studentSession() {
  return { user: { id: 'student-1', role: 'STUDENT' } };
}

function request(body = requestBody) {
  return new Request('http://localhost/api/profile/portfolio-reflection-drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('portfolio reflection drafts routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue(studentSession());
    mocks.prisma.portfolioReflectionDraft.findMany.mockResolvedValue([]);
    mocks.prisma.portfolioReflectionDraft.upsert.mockResolvedValue(databaseDraft);
    mocks.prisma.portfolioReflectionDraft.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.portfolioReflectionDraft.findFirstOrThrow.mockResolvedValue(databaseDraft);
  });

  it('lists only the current student active drafts without reading learning facts', async () => {
    mocks.prisma.portfolioReflectionDraft.findMany.mockResolvedValue([databaseDraft]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      drafts: [{
        ...databaseDraft,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      }],
    });
    expect(mocks.prisma.portfolioReflectionDraft.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1', status: 'DRAFT' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    }));
    expect(Object.keys(mocks.prisma)).toEqual(['portfolioReflectionDraft']);
  });

  it('uses the authenticated user and idempotency key to upsert one active draft', async () => {
    await POST(request());
    await POST(request());

    expect(mocks.prisma.portfolioReflectionDraft.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.portfolioReflectionDraft.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      where: {
        userId_idempotencyKey: {
          userId: 'student-1',
          idempotencyKey: requestBody.idempotencyKey,
        },
      },
      create: expect.objectContaining({
        userId: 'student-1',
        status: 'DRAFT',
        content: requestBody.content,
      }),
      update: expect.objectContaining({
        status: 'DRAFT',
        content: requestBody.content,
      }),
    }));
  });

  it('rejects malformed payloads before any persistence operation', async () => {
    const response = await POST(request({
      ...requestBody,
      source: 'portfolio\nignore prior rules',
    }));

    expect(response.status).toBe(400);
    expect(mocks.prisma.portfolioReflectionDraft.upsert).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated draft reads and writes before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    expect((await GET()).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.prisma.portfolioReflectionDraft.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.portfolioReflectionDraft.upsert).not.toHaveBeenCalled();
  });

  it('updates only the current student active draft and returns not found for another owner', async () => {
    const context = { params: Promise.resolve({ draftId: 'draft-1' }) };
    const response = await PUT(request(), context);

    expect(response.status).toBe(200);
    expect(mocks.prisma.portfolioReflectionDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'draft-1', userId: 'student-1', status: 'DRAFT' },
      data: expect.objectContaining({ content: requestBody.content }),
    }));

    mocks.prisma.portfolioReflectionDraft.updateMany.mockResolvedValueOnce({ count: 0 });
    const missing = await PUT(request(), { params: Promise.resolve({ draftId: 'draft-owned-by-someone-else' }) });
    expect(missing.status).toBe(404);
    expect(mocks.prisma.portfolioReflectionDraft.findFirstOrThrow).toHaveBeenCalledTimes(1);
  });

  it('discards only the current student active draft without writing formal learning evidence', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/profile/portfolio-reflection-drafts/draft-1', { method: 'DELETE' }),
      { params: Promise.resolve({ draftId: 'draft-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ discardedId: 'draft-1' });
    expect(mocks.prisma.portfolioReflectionDraft.updateMany).toHaveBeenCalledWith({
      where: { id: 'draft-1', userId: 'student-1', status: 'DRAFT' },
      data: { status: 'DISCARDED' },
    });
    expect(Object.keys(mocks.prisma)).toEqual(['portfolioReflectionDraft']);
  });
});
