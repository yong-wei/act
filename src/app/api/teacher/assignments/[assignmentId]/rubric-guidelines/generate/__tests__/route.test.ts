import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  generate: vi.fn(),
  resolveProvider: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));
vi.mock('@/lib/assignments/assignment-rubric-generation', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/assignments/assignment-rubric-generation')>(),
  generateAssignmentRubricGuidelines: mocks.generate,
  resolveAssignmentRubricGenerationProvider: mocks.resolveProvider,
}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { rateLimiter } from '@/lib/rate-limiter';
import { AssignmentDomainError } from '@/lib/assignments/assignment-domain';
import { POST } from '../route';

const actor = { id: 'rubric-route-teacher', role: 'TEACHER' as const };
const body = {
  revisionId: 'revision-1',
  expectedVersion: 2,
  questionId: 'question-1',
  scoringItemId: 'criterion-1',
  levelIds: ['level-high', 'level-low'],
  basis: 'scoring-standard',
};

function request(payload: unknown = body) {
  return new Request(
    'https://act.example/api/teacher/assignments/assignment-1/rubric-guidelines/generate',
    {
      method: 'POST',
      headers: { origin: 'https://act.example' },
      body: JSON.stringify(payload),
    },
  );
}

const context = {
  params: Promise.resolve({ assignmentId: 'assignment-1' }),
};

describe('assignment rubric guideline generation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter.reset(`assignment-mutation:${actor.id}`);
    rateLimiter.reset(`assignment-rubric-generation:${actor.id}`);
    mocks.getServerAuthSession.mockResolvedValue({ user: actor });
    mocks.resolveProvider.mockResolvedValue({
      provider: 'fixture',
      model: 'fixture',
      generate: vi.fn(),
    });
    mocks.generate.mockResolvedValue({
      levels: [
        { levelId: 'level-high', guideline: '高档准则。' },
        { levelId: 'level-low', guideline: '低档准则。' },
      ],
    });
  });

  it('requires teacher authorization and a strict bounded request', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    expect((await POST(request(), context)).status).toBe(401);

    mocks.getServerAuthSession.mockResolvedValueOnce({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    expect((await POST(request(), context)).status).toBe(403);

    const invalid = await POST(request({ ...body, unknown: true }), context);
    expect(invalid.status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('passes the bound draft identities and selected basis to the service', async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.anything(),
      {
        actor,
        assignmentId: 'assignment-1',
        request: body,
      },
      expect.objectContaining({ provider: 'fixture' }),
    );
  });

  it('rate limits rubric generation independently from ordinary draft saves', async () => {
    for (let index = 0; index < 10; index += 1) {
      expect((await POST(request(), context)).status).toBe(200);
    }
    const blocked = await POST(request(), context);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('60');
    await expect(blocked.json()).resolves.toEqual({
      error: 'rubric-generation-rate-limited',
    });
    expect(mocks.generate).toHaveBeenCalledTimes(10);
  });

  it('returns a safe unavailable response when no structured provider can be resolved', async () => {
    mocks.resolveProvider.mockRejectedValueOnce(
      new AssignmentDomainError('rubric-generation-unavailable'),
    );
    const response = await POST(request(), context);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'rubric-generation-unavailable',
      details: [],
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
