import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  queryRaw: vi.fn(),
  loadTextbookCoachContext: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));
vi.mock('@/lib/textbook-resource-coach/loader', () => ({
  loadTextbookCoachContext: mocks.loadTextbookCoachContext,
}));

import { GET } from '@/app/api/ai/sessions/resource-coach-match/route';
import { hashTextbookMarkdown } from '@/lib/textbook-resource-coach/identity';

const identityParams = {
  resourceKind: 'structured-textbook-unit',
  resourceId: 'unit-3-1',
  bookId: 'hu-shousong-auto-control-8th',
  edition: '第 8 版',
  sourceRevision: 'rev-2026-08',
  unitId: 'unit-3-1',
  contentHash: hashTextbookMarkdown('单元正文'),
};

function matchUrl(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({ ...identityParams, ...overrides });
  return new NextRequest(`http://localhost/api/ai/sessions/resource-coach-match?${params.toString()}`);
}

function readyLoad() {
  return {
    status: 'ready',
    identity: { ...identityParams, anchorId: null },
    title: '稳态误差',
    unitMarkdown: '单元正文',
    fragmentMarkdown: null,
    selectionHint: null,
    citation: { citationId: 'textbook-unit:unit-3-1', title: '稳态误差', identity: identityParams },
    structuralPath: [],
  };
}

describe('/api/ai/sessions/resource-coach-match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.loadTextbookCoachContext.mockResolvedValue(readyLoad());
    mocks.queryRaw.mockResolvedValue([]);
  });

  it('returns the exact matching owned conversation without exposing messages', async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: 'other-mode',
        title: '无关会话',
        lastActivityAt: new Date('2026-08-30T00:00:00Z'),
        binding: { teachingAssistantModeId: 'diagnosis-explainer', modeClientContextHints: { answerId: 'a-1' } },
      },
      {
        id: 'matched-1',
        title: '稳态误差讨论',
        lastActivityAt: new Date('2026-08-29T00:00:00Z'),
        binding: {
          teachingAssistantModeId: 'resource-coach',
          modeClientContextHints: {},
          pinnedTextbookResourceIdentity: { ...identityParams, anchorId: null },
        },
      },
      {
        id: 'older-revision',
        title: '旧版本会话',
        lastActivityAt: new Date('2026-08-28T00:00:00Z'),
        binding: {
          teachingAssistantModeId: 'resource-coach',
          modeClientContextHints: {},
          pinnedTextbookResourceIdentity: { ...identityParams, sourceRevision: 'rev-2026-07', anchorId: null },
        },
      },
    ]);

    const response = await GET(matchUrl());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'matched',
      conversation: {
        id: 'matched-1',
        title: '稳态误差讨论',
        lastActivityAt: '2026-08-29T00:00:00.000Z',
      },
    });
    // 有界投影只取最近候选，查询参数限定当前用户
    const call = mocks.queryRaw.mock.calls[0]!;
    expect(call.slice(1)).toContain('student-1');
  });

  it('returns blank when no owned exact match exists', async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: 'other-anchor',
        title: '其他锚点',
        lastActivityAt: new Date('2026-08-29T00:00:00Z'),
        binding: {
          teachingAssistantModeId: 'resource-coach',
          modeClientContextHints: {},
          pinnedTextbookResourceIdentity: { ...identityParams, anchorId: 'figure-3-1-1' },
        },
      },
    ]);

    const response = await GET(matchUrl());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'blank' });
  });

  it('reports version-unavailable instead of matching when the pinned revision is unreadable', async () => {
    mocks.loadTextbookCoachContext.mockResolvedValue({ status: 'unavailable', reason: 'revision-unavailable' });

    const response = await GET(matchUrl());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'unavailable', reason: 'revision-unavailable' });
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it('rejects forged or incomplete identities before any lookup', async () => {
    const tampered = await GET(matchUrl({ contentHash: 'forged' }));
    expect(tampered.status).toBe(400);
    expect(mocks.loadTextbookCoachContext).not.toHaveBeenCalled();
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it('requires authentication before any lookup', async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const response = await GET(matchUrl());
    expect(response.status).toBe(401);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it('filters by the complete pinned identity in the database before bounding results', async () => {
    mocks.queryRaw.mockResolvedValue([]);
    await GET(matchUrl());
    const call = mocks.queryRaw.mock.calls[0]!;
    const sql = (call[0] as readonly string[]).join('?');
    // 绑定过滤先于结果限界：EXISTS 位于 WHERE，截断只作用于过滤后的命中集
    expect(sql).toContain('EXISTS');
    expect(sql).toContain('pinnedTextbookResourceIdentity');
    expect(sql.indexOf('EXISTS')).toBeLessThan(sql.indexOf('ORDER BY s."lastActivityAt"'));
    const values = call.slice(1);
    expect(values).toContain('student-1');
    expect(values).toContain(identityParams.unitId);
    expect(values).toContain(identityParams.sourceRevision);
    expect(values).toContain(identityParams.contentHash);
  });
});
