import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { user: { id: 'teacher-1', role: 'TEACHER' } } as { user?: { id: string; role: string } } | null,
  state: vi.fn(),
  staticValidation: vi.fn(),
  browserValidation: vi.fn(),
  gap: vi.fn(),
  stale: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: vi.fn(async () => mocks.session) }));
vi.mock('@/lib/prisma', () => ({ prisma: { marker: 'prisma' } }));
vi.mock('@/lib/smart-courseware', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/smart-courseware')>(),
  getSmartCoursewarePublicationState: mocks.state,
  runSmartCoursewareStaticPublicationValidation: mocks.staticValidation,
  runSmartCoursewareBrowserPublicationValidation: mocks.browserValidation,
  acknowledgeSmartCoursewarePublicationGap: mocks.gap,
  acknowledgeSmartCoursewareStalePlan: mocks.stale,
  publishSmartCoursewareRevision: mocks.publish,
}));

import { GET, POST } from '../revisions/[revisionId]/publication/route';

const context = { params: Promise.resolve({ revisionId: 'revision-1' }) };
const actor = { id: 'teacher-1', role: 'TEACHER' };

function post(body: unknown) {
  return POST(new Request('http://localhost/api/teacher/smart-courseware/revisions/revision-1/publication', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), context);
}

describe('smart courseware publication route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: actor };
    mocks.state.mockResolvedValue({ sourceRevisionId: 'revision-1', receipts: { static: false, browser: false }, pendingGaps: [], stalePlan: null, publication: null });
  });

  it('derives the owner from the authenticated session when reading state', async () => {
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(200);
    expect(mocks.state).toHaveBeenCalledWith({ marker: 'prisma' }, { actor, sourceRevisionId: 'revision-1' });
  });

  it.each([
    [{ action: 'validate-static' }, 'staticValidation'],
    [{ action: 'validate-browser' }, 'browserValidation'],
  ] as const)('runs %s through the server-owned validator', async (body, method) => {
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(mocks[method]).toHaveBeenCalledWith({ marker: 'prisma' }, { actor, sourceRevisionId: 'revision-1' });
  });

  it('records only an explicit individual gap acknowledgement', async () => {
    const response = await post({ action: 'acknowledge-gap', scope: 'MODULE', targetId: 'module-1', gapIdentity: 'smart-module-gap:1', reason: '教师已核对演示来源。' });
    expect(response.status).toBe(200);
    expect(mocks.gap).toHaveBeenCalledWith({ marker: 'prisma' }, expect.objectContaining({ actor, sourceRevisionId: 'revision-1', scope: 'MODULE', targetId: 'module-1', reason: '教师已核对演示来源。' }));
  });

  it('records stale-baseline confirmation and publishes with separate actions', async () => {
    expect((await post({ action: 'acknowledge-stale-plan', newestPlanRevisionId: 'plan-2', reason: '保留已排练版本。' })).status).toBe(200);
    expect(mocks.stale).toHaveBeenCalledWith({ marker: 'prisma' }, expect.objectContaining({ actor, sourceRevisionId: 'revision-1', newestPlanRevisionId: 'plan-2' }));
    expect((await post({ action: 'publish', idempotencyKey: 'publish-key-123' })).status).toBe(201);
    expect(mocks.publish).toHaveBeenCalledWith({ marker: 'prisma' }, { actor, sourceRevisionId: 'revision-1', idempotencyKey: 'publish-key-123' });
  });

  it('rejects student identity before publication services run', async () => {
    mocks.session = { user: { id: 'student-1', role: 'STUDENT' } };
    expect((await post({ action: 'validate-static' })).status).toBe(403);
    expect(mocks.staticValidation).not.toHaveBeenCalled();
  });
});
