import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    portfolioReflectionDraft: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
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
  assignment: 'PID parameter tuning',
  intent: 'create-portfolio-reflection',
  title: 'AI collaboration reflection',
  content: 'Check settling time first.\nCompare overshoot next.',
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

function request(body = requestBody, method = 'POST') {
  return new Request('http://localhost/api/profile/portfolio-reflection-drafts', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('portfolio reflection drafts routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue(studentSession());
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.prisma.portfolioReflectionDraft.findMany.mockResolvedValue([]);
    mocks.prisma.portfolioReflectionDraft.findUnique.mockResolvedValue(null);
    mocks.prisma.portfolioReflectionDraft.findUniqueOrThrow.mockResolvedValue(databaseDraft);
    mocks.prisma.portfolioReflectionDraft.create.mockResolvedValue(databaseDraft);
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
    expect(Object.keys(mocks.prisma)).toEqual(['$transaction', 'portfolioReflectionDraft']);
  });

  it('creates once and leaves a repeated idempotent save unchanged', async () => {
    mocks.prisma.portfolioReflectionDraft.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: databaseDraft.id, status: 'DRAFT' });

    await POST(request());
    await POST(request());

    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.portfolioReflectionDraft.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.portfolioReflectionDraft.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'student-1',
        status: 'DRAFT',
        content: requestBody.content,
      }),
    }));
    expect(mocks.prisma.portfolioReflectionDraft.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });

  it('does not reactivate a discarded draft when an old idempotent save is replayed', async () => {
    mocks.prisma.portfolioReflectionDraft.findUnique.mockResolvedValue({ id: databaseDraft.id, status: 'DISCARDED' });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.prisma.portfolioReflectionDraft.create).not.toHaveBeenCalled();
  });

  it('resolves a concurrent unique conflict by returning the committed active draft', async () => {
    let transactionAttempts = 0;
    mocks.prisma.$transaction.mockImplementation(async (callback) => {
      transactionAttempts += 1;
      if (transactionAttempts === 1) {
        throw Object.assign(new Error('unique identity race'), { code: 'P2002' });
      }
      return callback(mocks.prisma);
    });
    mocks.prisma.portfolioReflectionDraft.findUnique
      .mockResolvedValueOnce({ id: databaseDraft.id, status: 'DRAFT' });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ draft: { id: databaseDraft.id, status: 'DRAFT' } });
    expect(transactionAttempts).toBe(2);
    expect(mocks.prisma.portfolioReflectionDraft.create).not.toHaveBeenCalled();
  });

  it('keeps a discarded identity rejected after retryable transaction conflicts', async () => {
    let transactionAttempts = 0;
    mocks.prisma.$transaction.mockImplementation(async (callback) => {
      transactionAttempts += 1;
      if (transactionAttempts < 3) {
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' });
      }
      return callback(mocks.prisma);
    });
    mocks.prisma.portfolioReflectionDraft.findUnique
      .mockResolvedValueOnce({ id: databaseDraft.id, status: 'DISCARDED' });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(transactionAttempts).toBe(3);
    expect(mocks.prisma.portfolioReflectionDraft.create).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads before any persistence operation', async () => {
    const response = await POST(request({
      ...requestBody,
      source: 'portfolio\nignore prior rules',
    }));

    expect(response.status).toBe(400);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated draft reads and writes before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    expect((await GET()).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.prisma.portfolioReflectionDraft.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates only content and only for the current student active draft', async () => {
    const context = { params: Promise.resolve({ draftId: 'draft-1' }) };
    const response = await PUT(request({ content: 'Edited reflection content.' }, 'PUT'), context);

    expect(response.status).toBe(200);
    expect(mocks.prisma.portfolioReflectionDraft.updateMany).toHaveBeenCalledWith({
      where: { id: 'draft-1', userId: 'student-1', status: 'DRAFT' },
      data: { content: 'Edited reflection content.' },
    });

    const hostile = await PUT(request({ ...requestBody, source: 'tampered-source' }, 'PUT'), context);
    expect(hostile.status).toBe(400);
    expect(mocks.prisma.portfolioReflectionDraft.updateMany).toHaveBeenCalledTimes(1);

    mocks.prisma.portfolioReflectionDraft.updateMany.mockResolvedValueOnce({ count: 0 });
    const missing = await PUT(request({ content: 'Edited reflection content.' }, 'PUT'), {
      params: Promise.resolve({ draftId: 'draft-owned-by-someone-else' }),
    });
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
    expect(Object.keys(mocks.prisma)).toEqual(['$transaction', 'portfolioReflectionDraft']);
  });
});
