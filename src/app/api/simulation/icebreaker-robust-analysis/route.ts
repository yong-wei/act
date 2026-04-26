import { NextResponse } from 'next/server';

import { computeVirtualSimulationServerStep } from '@/resources/simulations/rust/control-engine-server-runtime';

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
    return NextResponse.json(
      {
        error: '破冰船鲁棒分析失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}
