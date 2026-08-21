import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  readDelivery: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getSession }));
vi.mock('@/lib/diagnosis-report-delivery', () => ({
  DiagnosisDeliveryError: class DiagnosisDeliveryError extends Error {},
  readStudentDiagnosisDelivery: mocks.readDelivery,
}));

import { GET } from '../route';

describe('student-safe diagnosis delivery route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readDelivery.mockResolvedValue({ projection: { role: 'student' }, actions: [], dispositionEvents: [] });
  });

  it('rejects teacher sessions and derives the audience from the authenticated student', async () => {
    const context = { params: Promise.resolve({ reportId: 'report-1' }) };
    mocks.getSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    expect((await GET(new Request('http://localhost/report'), context)).status).toBe(403);
    mocks.getSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    expect((await GET(new Request('http://localhost/report'), context)).status).toBe(200);
    expect(mocks.readDelivery).toHaveBeenCalledWith({ studentId: 'student-1', reportId: 'report-1' });
  });
});
