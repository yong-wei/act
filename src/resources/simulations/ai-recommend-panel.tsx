'use client';

/**
 * AIRecommendPanel - AI 参数推荐面板
 *
 * 调用优化 API 获取推荐参数并展示结果
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { EnvelopePoint } from './target-envelope-editor';

interface AIRecommendPanelProps {
  envelope: EnvelopePoint[];
  seaState: {
    level: number;
    waveHeight: number;
    windSpeed: number;
  };
  currentParams: {
    kp: number;
    ki: number;
    kd: number;
  };
  onApplyParams?: (params: { kp: number; ki: number; kd: number }) => void;
  className?: string;
}

interface OptimizationResult {
  recommendedParams: {
    kp: number;
    ki: number;
    kd: number;
  };
  score: number;
  metrics: {
    avgError: number;
    maxRudderRate: number;
    settlingTime: number;
    overshoot: number;
  };
  searchInfo: {
    iterations: number;
    timeMs: number;
  };
  advice: string;
}

export function AIRecommendPanel({
  envelope,
  seaState,
  currentParams,
  onApplyParams,
  className = '',
}: AIRecommendPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 从包络点提取目标航向变化
      const targetHeading = envelope.length > 1
        ? envelope[envelope.length - 1].heading - envelope[0].heading
        : 90;

      const maxTolerance = Math.max(...envelope.map((p) => p.tolerance));

      const response = await fetch('/api/simulation/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            seaState,
            shipSpeed: 15,
          },
          target: {
            targetHeading,
            maxError: maxTolerance * 10, // 将角度误差转为距离误差估算
            maxRudderRate: 5.0,
            maxOvershoot: 20,
          },
          maxIterations: 50,
        }),
      });

      if (!response.ok) {
        throw new Error('优化请求失败');
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (result && onApplyParams) {
      onApplyParams(result.recommendedParams);
    }
  };

  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900 p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
            <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
            </svg>
          </div>
          <h3 className="font-semibold text-white">AI 参数推荐</h3>
        </div>
        <Button
          onClick={handleOptimize}
          disabled={isLoading || envelope.length < 2}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
        >
          {isLoading ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              搜索中...
            </>
          ) : (
            '智能推荐'
          )}
        </Button>
      </div>

      {/* 当前参数 */}
      <div className="mb-4 rounded-lg bg-slate-800/50 p-3">
        <p className="mb-2 text-xs text-slate-500">当前参数</p>
        <div className="flex gap-4">
          <ParamBadge label="Kp" value={currentParams.kp} />
          <ParamBadge label="Ki" value={currentParams.ki} />
          <ParamBadge label="Kd" value={currentParams.kd} />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* 优化结果 */}
      {result && (
        <div className="space-y-4">
          {/* 推荐参数 */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-amber-400">推荐参数</p>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                得分: {result.score}
              </span>
            </div>
            <div className="flex gap-4">
              <ParamBadge
                label="Kp"
                value={result.recommendedParams.kp}
                highlight={result.recommendedParams.kp !== currentParams.kp}
              />
              <ParamBadge
                label="Ki"
                value={result.recommendedParams.ki}
                highlight={result.recommendedParams.ki !== currentParams.ki}
              />
              <ParamBadge
                label="Kd"
                value={result.recommendedParams.kd}
                highlight={result.recommendedParams.kd !== currentParams.kd}
              />
            </div>
          </div>

          {/* 预期指标 */}
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              label="预期误差"
              value={`${result.metrics.avgError.toFixed(1)}m`}
              status={result.metrics.avgError < 150 ? 'good' : result.metrics.avgError < 200 ? 'warning' : 'bad'}
            />
            <MetricCard
              label="舵角速度"
              value={`${result.metrics.maxRudderRate.toFixed(2)}°/s`}
              status={result.metrics.maxRudderRate < 4 ? 'good' : result.metrics.maxRudderRate < 5 ? 'warning' : 'bad'}
            />
            <MetricCard
              label="调节时间"
              value={`${result.metrics.settlingTime.toFixed(0)}s`}
              status={result.metrics.settlingTime < 45 ? 'good' : result.metrics.settlingTime < 60 ? 'warning' : 'bad'}
            />
            <MetricCard
              label="超调量"
              value={`${result.metrics.overshoot.toFixed(1)}%`}
              status={result.metrics.overshoot < 10 ? 'good' : result.metrics.overshoot < 20 ? 'warning' : 'bad'}
            />
          </div>

          {/* 建议 */}
          <div className="rounded-lg bg-slate-800/50 p-3">
            <p className="text-xs text-slate-500 mb-1">AI 建议</p>
            <p className="text-sm text-slate-300">{result.advice}</p>
          </div>

          {/* 搜索信息 */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>迭代次数: {result.searchInfo.iterations}</span>
            <span>搜索耗时: {result.searchInfo.timeMs}ms</span>
          </div>

          {/* 应用按钮 */}
          <Button
            onClick={handleApply}
            className="w-full"
            variant="outline"
          >
            应用推荐参数
          </Button>
        </div>
      )}

      {/* 空状态 */}
      {!result && !isLoading && !error && (
        <div className="py-8 text-center">
          <div className="text-4xl mb-2">🎯</div>
          <p className="text-sm text-slate-400">
            绘制目标航迹包络后，点击「智能推荐」
          </p>
          <p className="text-xs text-slate-500 mt-1">
            AI 将为您搜索最优 PID 参数
          </p>
        </div>
      )}
    </div>
  );
}

function ParamBadge({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg px-3 py-2 ${highlight ? 'bg-amber-500/20' : 'bg-slate-700/50'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>
        {typeof value === 'number' && value < 0.1 ? value.toFixed(4) : value.toFixed(2)}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'bad';
}) {
  const statusColors = {
    good: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    bad: 'text-red-400 bg-red-500/10 border-red-500/30',
  };

  return (
    <div className={`rounded-lg border p-2 ${statusColors[status]}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

export default AIRecommendPanel;
