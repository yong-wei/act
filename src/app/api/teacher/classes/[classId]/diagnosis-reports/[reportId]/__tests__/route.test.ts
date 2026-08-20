import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  readDelivery: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getSession }));
vi.mock('@/lib/diagnosis-report-delivery', () => ({
  DiagnosisDeliveryError: class DiagnosisDeliveryError extends Error {},
  readTeacherDiagnosisDelivery: mocks.readDelivery,
}));

import { GET } from '../route';

const context = { params: Promise.resolve({ classId: 'class-1', reportId: 'report-1' }) };

describe('teacher diagnosis delivery route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readDelivery.mockResolvedValue({ projection: { id: 'safe' }, actions: [], dispositionEvents: [] });
  });

  it('requires an authenticated teacher', async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await GET(new Request('http://localhost/report'), context)).status).toBe(401);
    mocks.getSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    expect((await GET(new Request('http://localhost/report'), context)).status).toBe(403);
    expect(mocks.readDelivery).not.toHaveBeenCalled();
  });

  it('selects the student-safe role only from the fixed server route query', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    const response = await GET(new Request('http://localhost/report?role=student'), context);
    expect(response.status).toBe(200);
    expect(mocks.readDelivery).toHaveBeenCalledWith({
      teacherId: 'teacher-1', classId: 'class-1', reportId: 'report-1', role: 'student',
    });
  });
});
