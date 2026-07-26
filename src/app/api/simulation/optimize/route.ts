/**
 * 仿真参数优化 API
 *
 * 使用 Monte Carlo 方法搜索最优 PID 参数
 */

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  createSimulationRunContext,
  normalizeSeed,
} from '@/resources/simulations/core/seeded-rng';
import {
  optimizePIDParams,
  type OptimizationTarget,
  type OptimizationConstraints,
  type SimpleSimConfig,
  DEFAULT_CONSTRAINTS,
  DEFAULT_TARGET,
} from '@/resources/simulations/lib/monte-carlo-optimizer';

export const dynamic = 'force-dynamic';

export interface OptimizeRequest {
  config: Partial<SimpleSimConfig>;
  target?: Partial<OptimizationTarget>;
  constraints?: Partial<OptimizationConstraints>;
  maxIterations?: number;
  seed?: number | string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as OptimizeRequest;

    // 构建仿真配置
    const config: SimpleSimConfig = {
      nomotoK: body.config.nomotoK ?? 0.08,
      nomotoT: body.config.nomotoT ?? 55,
      shipSpeed: body.config.shipSpeed ?? 15,
      seaState: body.config.seaState ?? {
        level: 3,
        waveHeight: 1.0,
        windSpeed: 10,
      },
    };

    // 构建优化目标
    const target: OptimizationTarget = {
      ...DEFAULT_TARGET,
      ...body.target,
    };

    // 构建约束
    const constraints: OptimizationConstraints = {
      kpRange: body.constraints?.kpRange ?? DEFAULT_CONSTRAINTS.kpRange,
      kiRange: body.constraints?.kiRange ?? DEFAULT_CONSTRAINTS.kiRange,
      kdRange: body.constraints?.kdRange ?? DEFAULT_CONSTRAINTS.kdRange,
    };

    const replaySeed = normalizeSeed(
      body.seed,
      JSON.stringify({ config, target, constraints, maxIterations: body.maxIterations ?? 50 })
    );

    // 推荐 API 使用默认 v2 校准场景（240s 有限过渡，turn90-calibrated-v1），
    // v1 legacy 场景仅由3参数重载在 scene-trace 路径中使用。
    const result = optimizePIDParams(
      config,
      target,
      constraints,
      body.maxIterations ?? 50,
      20,
      {
        runContext: createSimulationRunContext({
          runId: `optimizer-${session.user.id}-${replaySeed.toString(16)}`,
          sceneId: 'simulation/optimizer/nomoto-quick-sim',
          scenarioId: 'turn90-calibrated-v1',
          seed: replaySeed,
          runtimeVersion: 'simulation-optimizer-runtime-v2',
          modelVersion: 'nomoto-quick-sim-v1',
        }),
      }
    );

    return NextResponse.json({
      success: true,
      result: {
        recommendedParams: result.bestParams,
        score: result.score,
        metrics: result.metrics,
        searchInfo: {
          iterations: result.iterations,
          timeMs: result.searchTime,
          convergenceHistory: result.convergenceHistory.slice(-10), // 只返回最后10条
        },
        replay: result.replay,
      },
      advice: generateAdvice(result.score, result.metrics),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('参数优化失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

/**
 * 生成参数建议文本
 */
function generateAdvice(
  score: number,
  metrics: { avgError: number; maxRudderRate: number; settlingTime: number; overshoot: number }
): string {
  const advices: string[] = [];

  if (score >= 90) {
    advices.push('推荐参数已达到优秀水平，可直接应用。');
  } else if (score >= 70) {
    advices.push('推荐参数达到良好水平，可在此基础上微调。');
  } else {
    advices.push('当前海况较为复杂，建议适当放宽误差要求。');
  }

  if (metrics.avgError > 150) {
    advices.push('航迹误差较大，可尝试增大 Kp 提升响应速度。');
  }

  if (metrics.maxRudderRate > 4.5) {
    advices.push('舵角速度接近安全限制，建议适当减小 Kp 或增大 Kd。');
  }

  if (metrics.overshoot > 15) {
    advices.push('存在明显超调，建议增大 Kd 以增加阻尼。');
  }

  if (metrics.settlingTime > 60) {
    advices.push('调节时间较长，可适当增大 Kp 加快响应。');
  }

  return advices.join(' ');
}
