/**
 * 能力评估计算函数
 *
 * 从仿真数据计算学生能力画像
 */

export interface CompetencyData {
  steadyStateAccuracy: number; // 稳态精度 (0-100)
  dynamicResponse: number; // 动态响应 (0-100)
  robustness: number; // 鲁棒性 (0-100)
  safety: number; // 安全性 (0-100)
  energyEfficiency: number; // 能耗控制 (0-100)
}

/**
 * 从仿真数据计算能力值
 */
export function computeCompetencyFromSimulations(
  simulations: Array<{
    avgError: number;
    maxRudderRate: number;
    settlingTime?: number;
    overshoot?: number;
    seaStateLevel: number;
    isEthicalViolation: boolean;
  }>
): CompetencyData {
  if (simulations.length === 0) {
    return {
      steadyStateAccuracy: 0,
      dynamicResponse: 0,
      robustness: 0,
      safety: 0,
      energyEfficiency: 0,
    };
  }

  // 稳态精度：基于平均误差
  const avgErrors = simulations.map((s) => s.avgError);
  const avgError = avgErrors.reduce((a, b) => a + b, 0) / avgErrors.length;
  const steadyStateAccuracy = Math.max(0, 100 - avgError * 0.5);

  // 动态响应：基于调节时间
  const settlingTimes = simulations
    .filter((s) => s.settlingTime !== undefined)
    .map((s) => s.settlingTime!);
  const avgSettlingTime =
    settlingTimes.length > 0
      ? settlingTimes.reduce((a, b) => a + b, 0) / settlingTimes.length
      : 60;
  const dynamicResponse = Math.max(0, 100 - avgSettlingTime * 0.8);

  // 鲁棒性：高海况下的表现
  const highSeaSims = simulations.filter((s) => s.seaStateLevel >= 3);
  const robustness =
    highSeaSims.length > 0
      ? Math.max(
          0,
          100 -
            (highSeaSims.reduce((a, b) => a + b.avgError, 0) / highSeaSims.length) * 0.4
        )
      : 50;

  // 安全性：无伦理违规的比例
  const safeSimulations = simulations.filter((s) => !s.isEthicalViolation);
  const safety = (safeSimulations.length / simulations.length) * 100;

  // 能耗控制：舵角速度
  const avgRudderRate =
    simulations.reduce((a, b) => a + b.maxRudderRate, 0) / simulations.length;
  const energyEfficiency = Math.max(0, 100 - avgRudderRate * 15);

  return {
    steadyStateAccuracy: Math.round(steadyStateAccuracy),
    dynamicResponse: Math.round(dynamicResponse),
    robustness: Math.round(robustness),
    safety: Math.round(safety),
    energyEfficiency: Math.round(energyEfficiency),
  };
}

/**
 * 计算综合得分
 */
export function calculateOverallScore(data: CompetencyData): number {
  const scores = Object.values(data);
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / scores.length);
}

/**
 * 根据得分获取能力等级
 */
export function getCompetencyLevel(score: number): {
  level: string;
  color: string;
  description: string;
} {
  if (score >= 90) {
    return {
      level: '卓越',
      color: 'text-emerald-400',
      description: '控制理论掌握扎实，实践能力强',
    };
  }
  if (score >= 80) {
    return {
      level: '优秀',
      color: 'text-blue-400',
      description: '理论基础好，能够应对复杂场景',
    };
  }
  if (score >= 70) {
    return {
      level: '良好',
      color: 'text-amber-400',
      description: '基本掌握要点，需继续提升',
    };
  }
  if (score >= 60) {
    return {
      level: '及格',
      color: 'text-orange-400',
      description: '达到基本要求，需加强练习',
    };
  }
  return {
    level: '待提升',
    color: 'text-red-400',
    description: '需要更多的学习和练习',
  };
}
