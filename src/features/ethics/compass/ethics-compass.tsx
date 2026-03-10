'use client';

/**
 * EthicsCompass - 伦理罗盘导航仪（左侧面板）
 */

import { Shield, Leaf, Coins, Clock, Cloud, User } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import type { EthicsScenarioData, ExpertOpinion } from '../ethics-sandbox';

interface EthicsCompassProps {
  scenario: EthicsScenarioData;
  safetyWeight: number;
  ecologyWeight: number;
  economyWeight: number;
  onSafetyChange: (value: number) => void;
  onEcologyChange: (value: number) => void;
  onEconomyChange: (value: number) => void;
  selectedRules: string[];
  onToggleRule: (ruleId: string) => void;
  timeLimit: number;
  infoFog: number;
  onTimeLimitChange: (value: number) => void;
  onInfoFogChange: (value: number) => void;
  experts: ExpertOpinion[];
}

export function EthicsCompass({
  scenario,
  safetyWeight,
  ecologyWeight,
  economyWeight,
  onSafetyChange,
  onEcologyChange,
  onEconomyChange,
  selectedRules,
  onToggleRule,
  timeLimit,
  infoFog,
  onTimeLimitChange,
  onInfoFogChange,
  experts,
}: EthicsCompassProps) {
  const total = safetyWeight + ecologyWeight + economyWeight;

  return (
    <aside className="w-[30%] min-w-[320px] max-w-[400px] overflow-y-auto border-r border-emerald-500/30 bg-[#1a2942]/80 p-5">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="text-xl font-medium text-emerald-400">伦理罗盘导航仪</h2>
        <p className="mt-1 text-sm text-slate-400">调整价值权重，指引决策方向</p>
      </div>

      {/* 价值权重滑块 */}
      <div className="mb-6 space-y-5">
        <h3 className="text-sm font-medium text-slate-300">价值观定向</h3>

        {/* 安全优先 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-slate-300">安全优先</span>
            </div>
            <span className="text-sm font-medium text-blue-400">{safetyWeight}%</span>
          </div>
          <Slider
            value={[safetyWeight]}
            onValueChange={([v]) => onSafetyChange(v)}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* 生态保护 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-green-400" />
              <span className="text-sm text-slate-300">生态保护</span>
            </div>
            <span className="text-sm font-medium text-green-400">{ecologyWeight}%</span>
          </div>
          <Slider
            value={[ecologyWeight]}
            onValueChange={([v]) => onEcologyChange(v)}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* 经济效益 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-slate-300">经济效益</span>
            </div>
            <span className="text-sm font-medium text-amber-400">{economyWeight}%</span>
          </div>
          <Slider
            value={[economyWeight]}
            onValueChange={([v]) => onEconomyChange(v)}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* 权重总计 */}
        <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-3 text-center text-sm">
          权重总计：
          <span className={total === 100 ? 'text-green-400' : 'text-amber-400'}>
            {total}%
          </span>
          {total !== 100 && <span className="text-slate-400"> (建议调整为100%)</span>}
        </div>
      </div>

      {/* 决策树 - 法规选择 */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-slate-300">决策树生成器</h3>
        <div className="space-y-2">
          {scenario.regulations.map((rule) => (
            <label
              key={rule.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                selectedRules.includes(rule.id)
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-slate-600 bg-slate-800/30 hover:border-slate-500'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedRules.includes(rule.id)}
                onChange={() => onToggleRule(rule.id)}
                className="mt-1 h-4 w-4 rounded border-emerald-500 bg-transparent text-emerald-500"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{rule.code}</span>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                    {rule.category}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{rule.title}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 压力模拟器 */}
      <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <h3 className="mb-3 text-sm font-medium text-red-400">压力模拟器</h3>

        {/* 时间压力 */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="h-4 w-4" />
              <span>时间压力</span>
            </div>
            <span className="text-red-400">{timeLimit}s</span>
          </div>
          <Slider
            value={[timeLimit]}
            onValueChange={([v]) => onTimeLimitChange(v)}
            min={30}
            max={300}
            step={10}
            className="w-full"
          />
        </div>

        {/* 信息迷雾 */}
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <Cloud className="h-4 w-4" />
              <span>信息迷雾</span>
            </div>
            <span className="text-red-400">{infoFog}%</span>
          </div>
          <Slider
            value={[infoFog]}
            onValueChange={([v]) => onInfoFogChange(v)}
            max={100}
            step={5}
            className="w-full"
          />
        </div>
      </div>

      {/* 学者智囊团 */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-slate-300">学者智囊团</h3>
        <div className="space-y-3">
          {experts.map((expert) => (
            <div
              key={expert.id}
              className="rounded-lg border border-slate-600 bg-slate-800/50 p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-200">{expert.name}</div>
                  <div className="text-xs text-slate-500">{expert.title}</div>
                </div>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
                    expert.stance === 'support'
                      ? 'bg-green-500/20 text-green-400'
                      : expert.stance === 'oppose'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-slate-600 text-slate-400'
                  }`}
                >
                  {expert.stance === 'support' ? '支持' : expert.stance === 'oppose' ? '反对' : '中立'}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">{expert.opinion}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
