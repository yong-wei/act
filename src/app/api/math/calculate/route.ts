/**
 * POST /api/math/calculate
 *
 * 接收 LaTeX 表达式，返回 SymPy 计算结果（LaTeX 格式 + 中间步骤）。
 * 仅允许已登录用户调用，并限制并发子进程数量，防止资源耗尽。
 */

import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  MathCalculateUnavailableError,
  mathCalculateRequestSchema,
  runMathCalculate,
} from '@/lib/math-calc';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

const MAX_CONCURRENT_CALCULATIONS = 4;
const MAX_QUEUED_CALCULATIONS = 8;

let activeCalculations = 0;
let queuedCalculations = 0;
const releaseQueue: Array<() => void> = [];

async function acquireCalculationSlot(): Promise<boolean> {
  if (activeCalculations < MAX_CONCURRENT_CALCULATIONS) {
    activeCalculations += 1;
    return true;
  }
  if (queuedCalculations >= MAX_QUEUED_CALCULATIONS) {
    return false;
  }
  queuedCalculations += 1;
  await new Promise<void>((resolve) => {
    releaseQueue.push(resolve);
  });
  queuedCalculations -= 1;
  activeCalculations += 1;
  return true;
}

function releaseCalculationSlot(): void {
  activeCalculations -= 1;
  const next = releaseQueue.shift();
  if (next) next();
}

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

    const acquired = await acquireCalculationSlot();
    if (!acquired) {
      return NextResponse.json(
        { error: '公式计算并发超限，请稍后重试' },
        { status: 429 }
      );
    }

    try {
      const result = await runMathCalculate(parsed.data);
      if (result.status === 'error') {
        return NextResponse.json(result, { status: 422 });
      }
      return NextResponse.json(result);
    } finally {
      releaseCalculationSlot();
    }
  } catch (error) {
    rethrowIfNextDynamicError(error);
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
