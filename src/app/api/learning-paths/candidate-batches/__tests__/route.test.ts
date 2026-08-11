import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requester: vi.fn(),
  readLatest: vi.fn(),
  readExact: vi.fn(),
  classFindUnique: vi.fn(),
  profileFindUnique: vi.fn(),
}));

vi.mock('../../route-helpers', () => ({
  getLearningPathRequester: mocks.requester,
}));
vi.mock('@/lib/adaptive-path-candidate-batches', () => ({
  readLatestAdaptivePathCandidateBatch: mocks.readLatest,
  readAdaptivePathCandidateBatch: mocks.readExact,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    class: { findUnique: mocks.classFindUnique },
    studentProfile: { findUnique: mocks.profileFindUnique },
  },
}));

import { GET as getLatest } from '../latest/route';
import { GET as getExact } from '../[batchId]/route';

const batch = {
  id: 'batch-1',
  userId: 'student-1',
  classId: 'class-1',
  goalId: 'control-correction',
  generationRequestId: 'request-1',
  sourcePathId: 'path-1',
  plannerVersion: 'v1',
  status: 'succeeded',
  createdAt: '2026-08-03T00:00:00.000Z',
  candidates: [{ id: 'candidate-1', ordinal: 0, styleId: 'mastery-first', policyFamily: 'mastery-first', label: '稳步掌握', snapshot: {} }],
};

describe('candidate batch routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requester.mockResolvedValue({ userId: 'student-1', role: 'student' });
    mocks.readLatest.mockResolvedValue(batch);
    mocks.readExact.mockResolvedValue(batch);
  });

  it('returns the latest successful batch for the learner and goal', async () => {
    const response = await getLatest(new Request('http://test/api/learning-paths/candidate-batches/latest?goal=control-correction'));
    expect(response.status).toBe(200);
    expect((await response.json()).batch.id).toBe('batch-1');
    expect(mocks.readLatest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'student-1' }));
  });

  it('denies a student requesting another learner latest batch', async () => {
    const response = await getLatest(new Request('http://test/api/learning-paths/candidate-batches/latest?goal=control-correction&userId=student-2'));
    expect(response.status).toBe(403);
    expect(mocks.readLatest).not.toHaveBeenCalled();
  });

  it('allows the owning teacher through class scope', async () => {
    mocks.requester.mockResolvedValue({ userId: 'teacher-1', role: 'teacher' });
    mocks.profileFindUnique.mockResolvedValue({ classId: 'class-1' });
    mocks.classFindUnique.mockResolvedValue({ teacherId: 'teacher-1' });
    const response = await getLatest(new Request('http://test/api/learning-paths/candidate-batches/latest?goal=control-correction&userId=student-1'));
    expect(response.status).toBe(200);
    expect(mocks.readLatest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ classId: 'class-1' }));
  });

  it('allows an administrator to read an exact batch', async () => {
    mocks.requester.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    const response = await getExact(
      new Request('http://test/api/learning-paths/candidate-batches/batch-1'),
      { params: Promise.resolve({ batchId: 'batch-1' }) },
    );
    expect(response.status).toBe(200);
  });

  it('rejects a candidate identity from another batch', async () => {
    const response = await getExact(
      new Request('http://test/api/learning-paths/candidate-batches/batch-1?candidate=candidate-2'),
      { params: Promise.resolve({ batchId: 'batch-1' }) },
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error).toContain('不属于该批次');
  });
});
