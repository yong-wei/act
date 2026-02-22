import { NextResponse } from 'next/server';

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

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RobustAnalysisRequest;
    const sampleCount = Math.max(20, Math.min(body.sampleCount ?? 80, 300));

    const scenarioResults = body.disturbanceScenarios.map((scenario) => {
      const samples = Array.from({ length: sampleCount }, () => {
        const k = randomInRange(body.uncertaintyRange.paramK[0], body.uncertaintyRange.paramK[1]);
        const t = randomInRange(body.uncertaintyRange.paramT[0], body.uncertaintyRange.paramT[1]);

        const rejection = clamp(92 - scenario.intensity * 9 - Math.abs(1 - k) * 26 - Math.abs(1 - t) * 18, 10, 100);
        const margin = clamp(58 - scenario.intensity * 6 - Math.abs(1 - t) * 28, 5, 80);

        return {
          rejection,
          margin,
          sensitivity: Math.abs(1 - k) * 100 + Math.abs(1 - t) * 100,
        };
      });

      const avgRejection = samples.reduce((sum, item) => sum + item.rejection, 0) / samples.length;
      const avgMargin = samples.reduce((sum, item) => sum + item.margin, 0) / samples.length;
      const avgSensitivity = samples.reduce((sum, item) => sum + item.sensitivity, 0) / samples.length;

      return {
        name: scenario.name,
        intensity: scenario.intensity,
        disturbanceRejection: Number(avgRejection.toFixed(2)),
        stabilityMargin: Number(avgMargin.toFixed(2)),
        parameterSensitivity: Number(avgSensitivity.toFixed(2)),
      };
    });

    const aggregate = {
      disturbanceRejection: Number(
        (scenarioResults.reduce((sum, item) => sum + item.disturbanceRejection, 0) / Math.max(scenarioResults.length, 1)).toFixed(2)
      ),
      stabilityMargin: Number(
        (scenarioResults.reduce((sum, item) => sum + item.stabilityMargin, 0) / Math.max(scenarioResults.length, 1)).toFixed(2)
      ),
      parameterSensitivity: Number(
        (scenarioResults.reduce((sum, item) => sum + item.parameterSensitivity, 0) / Math.max(scenarioResults.length, 1)).toFixed(2)
      ),
    };

    return NextResponse.json({
      robustnessMetrics: aggregate,
      scenarioResults,
      recommendation:
        aggregate.stabilityMargin < 25
          ? '稳定裕度偏低，建议提高阻尼并放缓高频控制动作。'
          : aggregate.parameterSensitivity > 45
          ? '参数敏感性偏高，建议收缩增益并增加鲁棒补偿。'
          : '鲁棒性表现良好，可继续进行局部精调优化。',
    });
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
