import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  readAdaptiveLearnerState: vi.fn(),
  isAdaptiveLearnerStateServiceEnabled: vi.fn(),
  prisma: {
    class: {
      findUnique: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('../adaptive-learner-state-service', () => ({
  isAdaptiveLearnerStateServiceEnabled: mocks.isAdaptiveLearnerStateServiceEnabled,
  readAdaptiveLearnerState: mocks.readAdaptiveLearnerState,
}));

import { GET } from '@/app/api/adaptive/learner-state/route';

function request(url: string) {
  return GET(new Request(url));
}

describe('adaptive learner-state API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAdaptiveLearnerStateServiceEnabled.mockReturnValue(true);
    mocks.readAdaptiveLearnerState.mockResolvedValue({
      userId: 'student-1',
      authority: 'server-owned',
    });
  });

  it('keeps the route behind the learner-state feature flag', async () => {
    mocks.isAdaptiveLearnerStateServiceEnabled.mockReturnValue(false);
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await request('http://localhost/api/adaptive/learner-state');

    expect(response.status).toBe(503);
    expect(mocks.readAdaptiveLearnerState).not.toHaveBeenCalled();
  });

  it('allows a student to read only their own learner state', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const ownResponse = await request('http://localhost/api/adaptive/learner-state');
    const otherResponse = await request('http://localhost/api/adaptive/learner-state?userId=student-2');

    expect(ownResponse.status).toBe(200);
    expect(otherResponse.status).toBe(403);
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'student-1',
        role: 'student',
      }),
    );
  });

  it('requires teacher class ownership before returning a scoped student state', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({
      userId: 'student-1',
      classId: 'class-1',
    });

    const response = await request('http://localhost/api/adaptive/learner-state?userId=student-1&classId=class-1');

    expect(response.status).toBe(200);
    expect(mocks.prisma.class.findUnique).toHaveBeenCalledWith({
      where: { id: 'class-1' },
      select: { id: true, teacherId: true },
    });
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'student-1',
        role: 'teacher',
        classId: 'class-1',
      }),
    );
  });

  it('allows a teacher to read their own learner state without class scope', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.readAdaptiveLearnerState.mockResolvedValue({
      userId: 'teacher-1',
      authority: 'server-owned',
    });

    const response = await request('http://localhost/api/adaptive/learner-state');

    expect(response.status).toBe(200);
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.studentProfile.findFirst).not.toHaveBeenCalled();
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'teacher-1',
        role: 'teacher',
        classId: null,
      }),
    );
  });

  it('allows admins to read a learner state without a class scope', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const response = await request('http://localhost/api/adaptive/learner-state?userId=student-1');

    expect(response.status).toBe(200);
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'student-1',
        role: 'admin',
      }),
    );
  });

  it('passes the requested control-correction goal slice to the learner-state service', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await request('http://localhost/api/adaptive/learner-state?goal=control-correction');

    expect(response.status).toBe(200);
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'student-1',
        role: 'student',
        goal: 'control-correction',
      }),
    );
  });

  it('ignores unsupported learner-state goal values instead of forwarding arbitrary strings', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await request('http://localhost/api/adaptive/learner-state?goal=unknown-goal');

    expect(response.status).toBe(200);
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'student-1',
        role: 'student',
        goal: null,
      }),
    );
  });
});
