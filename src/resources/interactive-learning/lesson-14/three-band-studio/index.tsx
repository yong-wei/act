'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Waves, Activity, Radio } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface BandTargets {
  low: number;
  mid: number;
  high: number;
}

interface BandScenario {
  id: string;
  title: string;
  context: string;
  targets: BandTargets;
  tips: string[];
}

const SCENARIOS: BandScenario[] = [
  {
    id: 'precision-tracking',
    title: '精密跟踪任务',
    context: '要求稳态误差极小，动态响应适中，噪声影响可控。',
    targets: { low: 80, mid: 55, high: 50 },
    tips: ['抬高低频增益，改善稳态误差。', '中频保持适中带宽，避免过快。'],
  },
  {
    id: 'fast-maneuver',
    title: '快速机动任务',
    context: '希望调节时间短，但仍需可接受的稳定裕度。',
    targets: { low: 60, mid: 80, high: 40 },
    tips: ['中频段要宽，带宽提升。', '高频不要过高，避免噪声放大。'],
  },
  {
    id: 'noise-sensitive',
    title: '噪声敏感任务',
    context: '传感器噪声强，必须提升高频衰减。',
    targets: { low: 65, mid: 50, high: 75 },
    tips: ['高频段要陡，抑制噪声。', '低频维持基本精度。'],
  },
];

const DEFAULT_BANDS: BandTargets = { low: 60, mid: 60, high: 60 };
const TOLERANCE = 10;

interface ThreeBandStudioProps extends BaseWidgetProps {}

export default function ThreeBandStudio({ onComplete, onStateChange }: ThreeBandStudioProps) {
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(SCENARIOS[0]?.id ?? 'precision-tracking');
  const [bandMap, setBandMap] = useState<Record<string, BandTargets>>({});
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [resultMap, setResultMap] = useState<Record<string, 'idle' | 'correct' | 'wrong'>>({});

  const activeScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === activeId) ?? SCENARIOS[0],
    [activeId]
  );

  const currentBands = bandMap[activeId] ?? DEFAULT_BANDS;
  const progressValue = useMemo(
    () => Math.round((completedIds.length / Math.max(SCENARIOS.length, 1)) * 100),
    [completedIds.length]
  );

  useEffect(() => {
    const snapshot = {
      progress: progressValue,
      data: { completed: completedIds, total: SCENARIOS.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
  }, [completedIds, interactive, onStateChange, progressValue]);

  const updateBand = useCallback(
    (band: keyof BandTargets, value: number) => {
      setBandMap((prev) => ({
        ...prev,
        [activeId]: {
          ...currentBands,
          [band]: value,
        },
      }));
      interactive?.tracking.emit('interact', { scenarioId: activeId, band, value });
    },
    [activeId, currentBands, interactive]
  );

  const handleCheck = useCallback(() => {
    const { targets } = activeScenario;
    const inRange = (value: number, target: number) => Math.abs(value - target) <= TOLERANCE;
    const lowOk = inRange(currentBands.low, targets.low);
    const midOk = inRange(currentBands.mid, targets.mid);
    const highOk = inRange(currentBands.high, targets.high);
    const isCorrect = lowOk && midOk && highOk;

    setResultMap((prev) => ({ ...prev, [activeId]: isCorrect ? 'correct' : 'wrong' }));
    if (isCorrect && !completedIds.includes(activeId)) {
      setCompletedIds((prev) => [...prev, activeId]);
    }

    const snapshot = {
      progress: progressValue,
      data: {
        scenarioId: activeId,
        bands: currentBands,
        lowOk,
        midOk,
        highOk,
        isCorrect,
      },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.tracking.emit(isCorrect ? 'complete' : 'submit', snapshot.data);
  }, [activeScenario, activeId, completedIds, currentBands, interactive, onStateChange, progressValue]);

  const status = resultMap[activeId] ?? 'idle';

  const bandInsight = useMemo(() => {
    const insights: string[] = [];
    if (currentBands.low >= 75) insights.push('低频段较高，稳态误差更小');
    if (currentBands.mid >= 75) insights.push('中频段较宽，动态响应更快');
    if (currentBands.high >= 75) insights.push('高频段偏高，噪声抑制更强');
    if (insights.length === 0) insights.push('三频段较均衡，性能更平均');
    return insights;
  }, [currentBands.high, currentBands.low, currentBands.mid]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">参与式学习 · 三频段调优</p>
          <h2 className="text-2xl font-bold text-slate-900">三频段配置工作台</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
          <Radio className="h-4 w-4 text-cyan-500" />
          已完成 {completedIds.length}/{SCENARIOS.length}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Waves className="h-4 w-4 text-cyan-500" />
            任务列表
          </div>
          <div className="mt-4 space-y-2">
            {SCENARIOS.map((scenario) => {
              const isCompleted = completedIds.includes(scenario.id);
              return (
                <button type="button"
                  key={scenario.id}
                  onClick={() => setActiveId(scenario.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeId === scenario.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{scenario.title}</span>
                  {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-700">
                <Activity className="h-5 w-5 text-cyan-500" />
                <h3 className="text-xl font-semibold">{activeScenario.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{activeScenario.context}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              目标配置
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>低频段 (稳态误差)</span>
                <span className="text-slate-900 font-semibold">{currentBands.low}</span>
              </div>
              <div className="mt-3">
                <Slider
                  value={[currentBands.low]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(value) => updateBand('low', value[0] ?? 0)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>中频段 (动态性能)</span>
                <span className="text-slate-900 font-semibold">{currentBands.mid}</span>
              </div>
              <div className="mt-3">
                <Slider
                  value={[currentBands.mid]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(value) => updateBand('mid', value[0] ?? 0)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>高频段 (抗噪鲁棒性)</span>
                <span className="text-slate-900 font-semibold">{currentBands.high}</span>
              </div>
              <div className="mt-3">
                <Slider
                  value={[currentBands.high]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(value) => updateBand('high', value[0] ?? 0)}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-medium text-slate-700">调优提示</div>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              {activeScenario.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-slate-500">实时洞察：{bandInsight.join('；')}</div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button"
              onClick={handleCheck}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs text-white"
            >
              提交配置
            </button>
            {status === 'correct' && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                配置满足目标区间，可进入下一任务。
              </div>
            )}
            {status === 'wrong' && (
              <div className="text-sm text-rose-600">当前配置未命中目标区间。</div>
            )}
          </div>
        </div>
      </div>
          <PathResourceContinueAction
            enabled={completedIds.length === SCENARIOS.length}
            result={{ success: true, score: 100, data: { completed: completedIds, total: SCENARIOS.length } }}
            onComplete={onComplete}
          />

    </div>
  );
}
