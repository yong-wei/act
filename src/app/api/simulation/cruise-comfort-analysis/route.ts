import { NextResponse } from 'next/server';

import { ControlEngineFailure, controlEngineHttpStatus } from '@/lib/control-engine';
import { computeVirtualSimulationServerStep } from '@/lib/control-engine/server';

interface CruiseComfortRequest {
  objectives: {
    comfortWeight: number;
    performanceWeight: number;
    energyWeight: number;
  };
  metrics: {
    msi: number;
    settlingTime: number;
    overshoot: number;
    finPower: number;
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CruiseComfortRequest;
    const result = computeVirtualSimulationServerStep({
      modelId: 'cruise_comfort_analysis',
      objectives: body.objectives,
      metrics: body.metrics,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ControlEngineFailure) {
      return NextResponse.json(
        { error: '邮轮舒适度分析失败', message: error.message, state: error.state },
        { status: controlEngineHttpStatus(error) },
      );
    }
    return NextResponse.json(
      {
        error: '邮轮舒适度分析失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}
