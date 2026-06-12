import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    class: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { GET } from '../route';

const params = { params: Promise.resolve({ classId: 'demo-ita-class' }) };

function get(url = 'http://localhost/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true') {
  return new Request(url);
}

describe('GET /api/teacher/classes/[classId]/assistant-effect-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.class.findUnique.mockResolvedValue({ id: 'demo-ita-class', teacherId: 'teacher-1' });
  });

  it('requires a signed-in teacher or admin', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    expect((await GET(get(), params)).status).toBe(401);

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'student-1', role: 'STUDENT' } });
    expect((await GET(get(), params)).status).toBe(403);
  });

  it('rejects non-demo class ids and other teachers', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-1', role: 'TEACHER' } });
    const missing = await GET(get('http://localhost/api/teacher/classes/class-2/assistant-effect-report?export=true'), {
      params: Promise.resolve({ classId: 'class-2' }),
    });
    expect(missing.status).toBe(404);

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-2', role: 'TEACHER' } });
    const forbidden = await GET(get(), params);
    expect(forbidden.status).toBe(403);
  });

  it('returns the source-backed assistant effect report export', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await GET(get(), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.effectReport).toMatchObject({
      id: 'effect-report-demo-ita',
      classId: 'demo-ita-class',
      goalId: 'control-correction',
      syntheticOnly: true,
      export: {
        id: 'effect-report-demo-ita-export',
        redacted: true,
        route: '/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true',
      },
    });
    expect(payload.effectReport.metrics.map((metric: { id: string }) => metric.id)).toEqual([
      'gradingTimeSaved',
      'teacherEditRate',
      'pathAdoption',
      'secondAttemptImprovement',
      'userFeedbackQuality',
    ]);
  });
});
