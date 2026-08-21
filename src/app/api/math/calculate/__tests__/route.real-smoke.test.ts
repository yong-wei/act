import { spawnSync } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

import { POST } from '../route';

const hasWolframScript = spawnSync('wolframscript', ['-code', '1+1'], {
  stdio: 'ignore',
}).status === 0;

const describeWithWolfram = hasWolframScript ? describe : describe.skip;

describeWithWolfram('POST /api/math/calculate real Wolfram smoke', () => {
  it('returns a real Wolfram Laplace result for an authenticated caller', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await POST(
      new NextRequest('http://localhost/api/math/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expression: '1',
          operation: 'laplace',
          variable: 't',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe('ok');
    expect(payload.result).toContain('\\frac{1}{s}');
    expect(payload.steps.length).toBeGreaterThan(0);
  });
});
