'use client';

/**
 * CompetencyRadar - 学生能力雷达图
 *
 * 五维度能力评估：稳态精度、动态响应、鲁棒性、安全性、能耗控制
 */

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

export interface CompetencyData {
  steadyStateAccuracy: number; // 稳态精度 (0-100)
  dynamicResponse: number; // 动态响应 (0-100)
  robustness: number; // 鲁棒性 (0-100)
  safety: number; // 安全性 (0-100)
  energyEfficiency: number; // 能耗控制 (0-100)
}

interface CompetencyRadarProps {
  data: CompetencyData;
  className?: string;
  showLegend?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// 维度名称映射
const dimensionLabels: Record<keyof CompetencyData, string> = {
  steadyStateAccuracy: '稳态精度',
  dynamicResponse: '动态响应',
  robustness: '鲁棒性',
  safety: '安全性',
  energyEfficiency: '能耗控制',
};

// 维度描述
const dimensionDescriptions: Record<keyof CompetencyData, string> = {
  steadyStateAccuracy: '控制系统达到稳定后的误差控制能力',
  dynamicResponse: '系统对变化的快速响应能力',
  robustness: '应对环境干扰的稳定性',
  safety: '遵守安全规范的程度',
  energyEfficiency: '舵机动作的能耗效率',
};

export function CompetencyRadar({
  data,
  className = '',
  showLegend = false,
  size = 'md',
}: CompetencyRadarProps) {
  // 转换数据为 Recharts 格式
  const chartData = Object.entries(data).map(([key, value]) => ({
    dimension: dimensionLabels[key as keyof CompetencyData],
    value: Math.min(100, Math.max(0, value)),
    fullMark: 100,
    description: dimensionDescriptions[key as keyof CompetencyData],
  }));

  const sizeMap = {
    sm: { width: 250, height: 200 },
    md: { width: 350, height: 280 },
    lg: { width: 450, height: 360 },
  };

  const { width, height } = sizeMap[size];

  return (
    <div className={`w-full ${className}`} style={{ minHeight: height }}>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid
            stroke="#334155"
            strokeOpacity={0.6}
          />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickLine={{ stroke: '#475569' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickCount={5}
            axisLine={{ stroke: '#475569' }}
          />
          <Radar
            name="能力评分"
            dataKey="value"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
            />
          )}
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 shadow-lg">
                    <p className="font-medium text-amber-400">{item.dimension}</p>
                    <p className="text-2xl font-bold text-white">{item.value}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                  </div>
                );
              }
              return null;
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 计算综合得分
export function calculateOverallScore(data: CompetencyData): number {
  const weights = {
    steadyStateAccuracy: 0.25,
    dynamicResponse: 0.2,
    robustness: 0.2,
    safety: 0.25,
    energyEfficiency: 0.1,
  };

  let totalScore = 0;
  for (const [key, weight] of Object.entries(weights)) {
    totalScore += (data[key as keyof CompetencyData] || 0) * weight;
  }

  return Math.round(totalScore);
}

// 获取能力等级
export function getCompetencyLevel(score: number): {
  level: string;
  color: string;
  description: string;
} {
  if (score >= 90) {
    return {
      level: '卓越',
      color: 'text-emerald-400',
      description: '您的船舶控制能力已达到专家水平',
    };
  }
  if (score >= 75) {
    return {
      level: '优秀',
      color: 'text-amber-400',
      description: '您具备扎实的控制系统设计能力',
    };
  }
  if (score >= 60) {
    return {
      level: '良好',
      color: 'text-blue-400',
      description: '您已掌握基本的控制原理和方法',
    };
  }
  if (score >= 40) {
    return {
      level: '合格',
      color: 'text-slate-400',
      description: '建议加强实践练习提升技能',
    };
  }
  return {
    level: '待提升',
    color: 'text-red-400',
    description: '需要更多的学习和练习',
  };
}

// 从仿真数据计算能力值
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

export default CompetencyRadar;
