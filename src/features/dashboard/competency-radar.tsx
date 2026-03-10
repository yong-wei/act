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

// 从 lib 重新导出类型和函数，以便客户端组件使用
import type { CompetencyData } from '@/lib/competency';

export type {
  CompetencyData,
} from '@/lib/competency';

export {
  computeCompetencyFromSimulations,
  calculateOverallScore,
  getCompetencyLevel,
} from '@/lib/competency';

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

export default CompetencyRadar;
