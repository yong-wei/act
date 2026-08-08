import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getJob: vi.fn(),
  retryJob: vi.fn(),
  enqueue: vi.fn(),
  parseRetry: vi.fn((value: unknown) => value),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.auth }));
vi.mock('@/lib/prisma', () => ({ prisma: { marker: 'prisma' } }));
vi.mock('@/lib/diagnosis-generation', () => ({
  diagnosisGenerationRetrySchema: { parse: mocks.parseRetry },
  diagnosisGenerationErrorResponse: () => null,
  getDiagnosisGenerationJob: mocks.getJob,
  retryDiagnosisGenerationJob: mocks.retryJob,
  projectDiagnosisGenerationJob: (job: unknown) => job,
}));
vi.mock('@/lib/diagnosis-generation-queue', () => ({ enqueueDiagnosisGenerationJob: mocks.enqueue }));

import { GET, POST } from '@/app/api/teacher/diagnosis-generation-jobs/[jobId]/route';

describe('teacher diagnosis generation job route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
  });

  it('reads only through the authenticated teacher scope', async () => {
    mocks.getJob.mockResolvedValue({ id: 'job-1', state: 'RUNNING' });
    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'job-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.getJob).toHaveBeenCalledWith({ marker: 'prisma' }, {
      teacherId: 'teacher-1',
      jobId: 'job-1',
    });
  });

  it('requeues an eligible terminal job using explicit retry intent', async () => {
    const job = { id: 'job-1', state: 'QUEUED' };
    mocks.retryJob.mockResolvedValue(job);
    mocks.enqueue.mockResolvedValue({ queued: true, job, errorCode: null });
    const response = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ action: 'retry', idempotencyKey: 'retry-123' }),
    }), { params: Promise.resolve({ jobId: 'job-1' }) });

    expect(response.status).toBe(200);
    expect(mocks.retryJob).toHaveBeenCalledWith({ marker: 'prisma' }, {
      teacherId: 'teacher-1',
      jobId: 'job-1',
      idempotencyKey: 'retry-123',
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({ marker: 'prisma' }, 'job-1');
  });

  it('rejects unauthenticated and non-teacher access before reading a job', async () => {
    mocks.auth.mockResolvedValueOnce(null);
    const unauthenticated = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'job-1' }),
    });
    mocks.auth.mockResolvedValueOnce({ user: { id: 'student-1', role: 'STUDENT' } });
    const forbidden = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ jobId: 'job-1' }),
    });

    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(mocks.getJob).not.toHaveBeenCalled();
  });
});
