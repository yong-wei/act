import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  runMathCalculate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/math-calc', async () => {
  const actual = await vi.importActual<typeof import('@/lib/math-calc')>('@/lib/math-calc');
  return {
    ...actual,
    runMathCalculate: mocks.runMathCalculate,
  };
});

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

import { POST } from '../route';

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/math/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/math/calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.runMathCalculate.mockResolvedValue({
      status: 'ok',
      result: '\\frac{1}{s}',
      steps: [
        {
          step: 1,
          description: '原始表达式',
          input: '1',
          output: '1',
        },
      ],
    });
  });

  it('rejects unauthenticated requests before spawning a subprocess', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await POST(createPostRequest({ expression: '1' }));

    expect(response.status).toBe(401);
    expect(mocks.runMathCalculate).not.toHaveBeenCalled();
  });

  it('rejects invalid or oversized expressions', async () => {
    const invalid = await POST(createPostRequest({ expression: '  ' }));
    expect(invalid.status).toBe(400);

    const oversized = await POST(createPostRequest({ expression: 'x'.repeat(301) }));
    expect(oversized.status).toBe(400);

    const wrongType = await POST(createPostRequest({ expression: '1', operation: 'eval' }));
    expect(wrongType.status).toBe(400);

    expect(mocks.runMathCalculate).not.toHaveBeenCalled();
  });

  it('returns SymPy calculation steps for an authenticated student', async () => {
    const response = await POST(createPostRequest({ expression: '1', operation: 'laplace' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: 'ok',
      result: '\\frac{1}{s}',
      steps: [
        {
          step: 1,
          description: '原始表达式',
        },
      ],
    });
    expect(mocks.runMathCalculate).toHaveBeenCalledWith({
      expression: '1',
      operation: 'laplace',
    });
  });

  it('projects SymPy calculation failure as 422', async () => {
    mocks.runMathCalculate.mockResolvedValue({
      status: 'error',
      result: '',
      steps: [],
      error: '表达式无法解析',
    });

    const response = await POST(createPostRequest({ expression: 'nonsense(' }));
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload).toMatchObject({
      status: 'error',
      error: '表达式无法解析',
    });
  });

  it('projects missing Python runtime as 503', async () => {
    const { MathCalculateUnavailableError } = await import('@/lib/math-calc');
    mocks.runMathCalculate.mockRejectedValue(
      new MathCalculateUnavailableError('Python 运行时不可用')
    );

    const response = await POST(createPostRequest({ expression: '1' }));

    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('Python 运行时不可用');
  });

  it('rejects requests when the calculation concurrency queue is saturated', async () => {
    const resolvers: Array<() => void> = [];
    mocks.runMathCalculate.mockImplementation(
      () => new Promise((resolve) => {
        resolvers.push(() => resolve({
          status: 'ok' as const,
          result: '1',
          steps: [],
        }));
      })
    );

    const first = POST(createPostRequest({ expression: '1' }));
    await vi.waitFor(() => {
      expect(mocks.runMathCalculate).toHaveBeenCalledTimes(1);
    });

    // 4 个并发已占满，队列容量 8 被填满后，后续请求直接返回 429。
    const pending = Array.from({ length: 12 }, () => POST(createPostRequest({ expression: '1' })));
    await vi.waitFor(() => {
      expect(mocks.runMathCalculate).toHaveBeenCalledTimes(4);
    });
    const rejected = await POST(createPostRequest({ expression: '1' }));
    expect(rejected.status).toBe(429);

    // 逐批释放：每个完成请求会放行一个排队请求，直到全部清空。
    for (let round = 0; round < 20 && resolvers.length > 0; round += 1) {
      const batch = resolvers.splice(0);
      for (const resolve of batch) resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(resolvers.length).toBe(0);
    await Promise.all([first, ...pending]);
  });
});
