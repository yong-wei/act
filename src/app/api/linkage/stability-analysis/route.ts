import { NextResponse } from 'next/server';
import { analyzeStability, type TransferFunctionSpec } from '@/lib/control/linkage-engine';

interface StabilityAnalysisRequest {
  transferFunction: TransferFunctionSpec;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StabilityAnalysisRequest;
    const result = analyzeStability(body.transferFunction);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: '稳定性分析失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}
