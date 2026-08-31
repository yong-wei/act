/**
 * POST /api/math/calculate
 *
 * 接收 LaTeX 表达式，返回 SymPy 计算结果（LaTeX 格式 + 中间步骤）。
 * 仅允许已登录用户调用，并限制并发子进程数量，防止资源耗尽。
 */

import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  MathCalculateCapacityError,
  MathCalculateUnavailableError,
  mathCalculateRequestSchema,
  runMathCalculate,
} from '@/lib/math-calc';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    rethrowIfNextDynamicError(session);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = mathCalculateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await runMathCalculate(parsed.data, { signal: request.signal });
    if (result.status === 'error') {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof MathCalculateCapacityError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof MathCalculateUnavailableError) {
      return NextResponse.json(
        { status: 'error', result: '', steps: [], error: error.message },
        { status: 503 }
      );
    }
    console.error('[math/calculate] unexpected error', error);
    return NextResponse.json(
      { status: 'error', result: '', steps: [], error: 'Internal server error' },
      { status: 500 }
    );
  }
}
