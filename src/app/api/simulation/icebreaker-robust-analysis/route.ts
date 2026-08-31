import { NextResponse } from 'next/server';

import { ControlEngineFailure, controlEngineHttpStatus } from '@/lib/control-engine';
import { computeVirtualSimulationServerStep } from '@/lib/control-engine/server';

interface RobustAnalysisRequest {
  uncertaintyRange: {
    paramK: [number, number];
    paramT: [number, number];
  };
  disturbanceScenarios: Array<{
    name: string;
    intensity: number;
  }>;
  sampleCount?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RobustAnalysisRequest;
    const result = computeVirtualSimulationServerStep({
      modelId: 'icebreaker_robust_analysis',
      uncertaintyRange: body.uncertaintyRange,
      disturbanceScenarios: body.disturbanceScenarios,
      sampleCount: body.sampleCount,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ControlEngineFailure) {
      return NextResponse.json(
        { error: '破冰船鲁棒分析失败', message: error.message, state: error.state },
        { status: controlEngineHttpStatus(error) },
      );
    }
    return NextResponse.json(
      {
        error: '破冰船鲁棒分析失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}
