import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encode } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ilab/course-save-admission/route';

const { requireAccount, update } = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  update: vi.fn(),
}));
vi.mock('@/features/ilab/course-evidence-api', () => ({
  requireVesselEvidenceAccount: requireAccount,
  vesselEvidenceErrorResponse: () => new Response(null, { status: 401 }),
}));
vi.mock('@/features/ilab/course-save-admission', () => ({ updateCourseSaveAdmission: update }));
vi.mock('@/features/ilab/adapters/ilab-account-service', () => ({
  resolveNextAuthSessionCookieConfig: () => ({ cookieName: 'next-auth.session-token', secure: false }),
}));

const roundRef = 'a14ec036-5f47-4ce5-aceb-7020d71fddf0';
const worker = '71dc59bb-c83a-4631-8d6a-87fce701d86d';
const request = (body = { roundRef, worker, action: 'reserve' }, headers?: HeadersInit) => new NextRequest('http://localhost/api/ilab/course-save-admission', {
  method: 'POST', body: JSON.stringify(body), headers,
});

describe('classroom save admission HTTP states', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('NEXTAUTH_SECRET', undefined);
    vi.stubEnv('AUTH_SECRET', undefined);
    requireAccount.mockResolvedValue('student-1');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('uses signed session cookie identity without requesting student profile', async () => {
    const secret = 'queue-admission-test-secret';
    vi.stubEnv('NEXTAUTH_SECRET', secret);
    const token = await encode({ secret, token: { id: 'signed-student' } });
    update.mockResolvedValue(3000);
    expect((await POST(request(undefined, { cookie: `next-auth.session-token=${token}` }))).status).toBe(202);
    expect(update).toHaveBeenCalledWith('signed-student', roundRef, worker, 'reserve');
    expect(requireAccount).not.toHaveBeenCalled();
    expect((await POST(request(undefined, { authorization: `Bearer ${token}` }))).status).toBe(401);
    expect((await POST(request(undefined, { cookie: 'next-auth.session-token=invalid' }))).status).toBe(401);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('returns an authenticated queue receipt without classifying waiting as failure', async () => {
    update.mockResolvedValue(1500);
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ admitted: false, retryAfterMs: 1500 });
    expect(update).toHaveBeenCalledWith('student-1', roundRef, worker, 'reserve');
  });

  it.each([[0, 200], [-1, 429], [-2, 409]])('maps result %i to HTTP %i', async (result, status) => {
    update.mockResolvedValue(result);
    expect((await POST(request())).status).toBe(status);
  });

  it('returns a retry response if Redis is unavailable', async () => {
    update.mockRejectedValue(new Error('unavailable'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
  });

  it('rejects malformed requests and unauthenticated callers before allocating queue state', async () => {
    expect((await POST(request({ roundRef: '', worker, action: 'reserve' }))).status).toBe(400);
    requireAccount.mockRejectedValue(new Error('unauthenticated'));
    expect((await POST(request())).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});
