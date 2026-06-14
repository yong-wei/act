'use client';

/**
 * ConsequencesPanel - 代价评估面板（右侧滑出）
 */

import { X, Users, Leaf, DollarSign, Globe } from 'lucide-react';
import type { DecisionOption } from '../ethics-sandbox';

interface ConsequencesPanelProps {
  isOpen: boolean;
  selectedOption: DecisionOption | null;
  safetyWeight: number;
  ecologyWeight: number;
  economyWeight: number;
  onClose: () => void;
}

export function ConsequencesPanel({
  isOpen,
  selectedOption,
  safetyWeight,
  ecologyWeight,
  economyWeight,
  onClose,
}: ConsequencesPanelProps) {
  if (!isOpen || !selectedOption) return null;

  const { consequences } = selectedOption;

  // 计算综合评分
  const totalWeight = safetyWeight + ecologyWeight + economyWeight;
  const normalizedSafety = totalWeight > 0 ? safetyWeight / totalWeight : 0.33;
  const normalizedEcology = totalWeight > 0 ? ecologyWeight / totalWeight : 0.33;
  const normalizedEconomy = totalWeight > 0 ? economyWeight / totalWeight : 0.34;

  const weightedScore =
    100 -
    (consequences.humanCost * normalizedSafety +
      consequences.ecologicalCost * normalizedEcology +
      consequences.economicCost * normalizedEconomy);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getCostLevel = (cost: number) => {
    if (cost >= 70) return { label: '严重', color: 'text-red-400', bg: 'bg-red-500' };
    if (cost >= 40) return { label: '中等', color: 'text-amber-400', bg: 'bg-amber-500' };
    return { label: '轻微', color: 'text-green-400', bg: 'bg-green-500' };
  };

  const costItems = [
    {
      icon: Users,
      label: '人本成本',
      value: consequences.humanCost,
      description: '对船员安全和人员福祉的影响',
    },
    {
      icon: Leaf,
      label: '生态成本',
      value: consequences.ecologicalCost,
      description: '对海洋生态和环境的影响',
    },
    {
      icon: DollarSign,
      label: '经济成本',
      value: consequences.economicCost,
      description: '财务损失和运营成本',
    },
    {
      icon: Globe,
      label: '文化影响',
      value: consequences.culturalImpact,
      description: '对当地社区和文化的影响',
    },
  ];

  return (
    <aside
      className={`fixed right-0 top-0 h-full w-[350px] transform overflow-y-auto border-l border-emerald-500/30 bg-[#1a2942]/95 p-6 shadow-2xl transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* 头部 */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-medium text-emerald-400">多维度代价沙盘</h2>
        <button type="button"
          onClick={onClose}
          className="text-slate-400 transition-colors hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 决策结果 */}
      <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="mb-2 text-sm text-slate-400">您的决策</div>
        <div className="text-lg font-medium text-emerald-400">{selectedOption.label}</div>
        <p className="mt-2 text-sm text-slate-300">{selectedOption.description}</p>
      </div>

      {/* 综合评分 */}
      <div className="mb-6 rounded-xl border border-slate-600 bg-slate-800/50 p-4 text-center">
        <div className="mb-2 text-sm text-slate-400">综合伦理评分</div>
        <div className={`text-4xl font-bold ${getScoreColor(weightedScore)}`}>
          {Math.round(weightedScore)}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          基于您的价值权重计算（安全 {safetyWeight}% / 生态 {ecologyWeight}% / 经济 {economyWeight}%）
        </div>
      </div>

      {/* 代价详情 */}
      <div className="space-y-4">
        {costItems.map((item) => {
          const Icon = item.icon;
          const level = getCostLevel(item.value);

          return (
            <div key={item.label} className="rounded-xl border border-slate-600 bg-slate-800/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${level.color}`} />
                  <span className="font-medium text-slate-200">{item.label}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${level.color} bg-opacity-20`}>
                  {level.label}
                </span>
              </div>

              {/* 代价条 */}
              <div className="mb-2 h-3 overflow-hidden rounded-full bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${level.bg}`}
                  style={{ width: `${item.value}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{item.description}</span>
                <span className={level.color}>{item.value}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI 反馈 */}
      <div className="mt-6 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-purple-400">
          <span>🤖</span>
          <span>AI 伦理顾问反馈</span>
        </div>
        <p className="text-sm leading-relaxed text-slate-300">
          您的决策在当前价值权重下表现{weightedScore >= 60 ? '良好' : '需要改进'}。
          {consequences.ecologicalCost > 50 &&
            '建议在未来类似场景中更多考虑生态保护因素。'}
          {consequences.humanCost > 50 &&
            '人员安全应始终作为首要考量，建议重新评估决策。'}
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="mt-6 space-y-3">
        <button type="button" className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white transition-colors hover:bg-emerald-500">
          保存决策记录
        </button>
        <button type="button" className="w-full rounded-lg border border-slate-600 bg-slate-800 py-3 text-slate-300 transition-colors hover:bg-slate-700">
          查看历史决策对比
        </button>
      </div>
    </aside>
  );
}
