import { NextResponse } from 'next/server';

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CruiseComfortRequest;
    const { objectives, metrics } = body;

    const comfortScore = clamp(100 - metrics.msi * 1.5 - metrics.overshoot * 0.6, 0, 100);
    const performanceScore = clamp(100 - metrics.settlingTime * 1.1 - metrics.overshoot * 0.5, 0, 100);
    const energyScore = clamp(100 - metrics.finPower * 0.08, 0, 100);

    const weightSum = objectives.comfortWeight + objectives.performanceWeight + objectives.energyWeight;
    const comfortWeight = objectives.comfortWeight / Math.max(weightSum, 1);
    const performanceWeight = objectives.performanceWeight / Math.max(weightSum, 1);
    const energyWeight = objectives.energyWeight / Math.max(weightSum, 1);

    const blendedScore = Number(
      (
        comfortScore * comfortWeight +
        performanceScore * performanceWeight +
        energyScore * energyWeight
      ).toFixed(2)
    );

    const paretoFront = Array.from({ length: 12 }, (_, index) => {
      const ratio = index / 11;
      return {
        comfort: Number((95 - ratio * 45 + Math.sin(index) * 2).toFixed(2)),
        performance: Number((60 + ratio * 35 - Math.cos(index * 0.6) * 3).toFixed(2)),
      };
    });

    const advice: string[] = [];
    if (comfortScore < 65) advice.push('舒适度偏低：建议降低带宽或加强减摇策略。');
    if (performanceScore < 65) advice.push('性能偏弱：可适当提高 Kp 并控制超调。');
    if (energyScore < 60) advice.push('能耗偏高：建议限制减摇鳍动作频率。');
    if (advice.length === 0) advice.push('当前权衡较均衡，可继续微调提升 Pareto 前沿位置。');

    return NextResponse.json({
      objectiveScores: {
        comfort: Number(comfortScore.toFixed(2)),
        performance: Number(performanceScore.toFixed(2)),
        energy: Number(energyScore.toFixed(2)),
      },
      blendedScore,
      paretoFront,
      currentDesign: {
        comfort: Number(comfortScore.toFixed(2)),
        performance: Number(performanceScore.toFixed(2)),
      },
      advice,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: '邮轮舒适度分析失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}
