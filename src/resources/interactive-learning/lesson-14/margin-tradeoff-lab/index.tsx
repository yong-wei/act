'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Sliders, ShieldAlert, Gauge } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface MarginRange {
  min: number;
  max: number;
}

interface MarginScenario {
  id: string;
  title: string;
  context: string;
  targetPhase: MarginRange;
  targetGain: MarginRange;
  suggestion: string;
}

const SCENARIOS: MarginScenario[] = [
  {
    id: 'robust-cruise',
    title: '稳健巡航模式',
    context: '海况变化明显，系统需要保留足够的稳定裕度。',
    targetPhase: { min: 50, max: 65 },
    targetGain: { min: 8, max: 14 },
    suggestion: '相角裕度更大，响应略慢但更稳。',
  },
  {
    id: 'fast-tracking',
    title: '快速跟踪模式',
    context: '希望缩短调节时间，但仍要避免明显超调。',
    targetPhase: { min: 35, max: 50 },
    targetGain: { min: 6, max: 10 },
    suggestion: '提高带宽但避免相角裕度过低。',
  },
  {
    id: 'edge-test',
    title: '边界试验模式',
    context: '进行极限性能测试，允许更小裕度但需标记风险。',
    targetPhase: { min: 20, max: 30 },
    targetGain: { min: 2, max: 5 },
    suggestion: '裕度偏小，系统处于风险边界。',
  },
];

const DEFAULT_CONFIG = { phase: 45, gain: 6 };

interface MarginTradeoffLabProps extends BaseWidgetProps {}

export default function MarginTradeoffLab({ onComplete, onStateChange }: MarginTradeoffLabProps) {
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(SCENARIOS[0]?.id ?? 'robust-cruise');
  const [configMap, setConfigMap] = useState<Record<string, { phase: number; gain: number }>>({});
  const [resultMap, setResultMap] = useState<Record<string, 'idle' | 'correct' | 'wrong'>>({});
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const activeScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === activeId) ?? SCENARIOS[0],
    [activeId]
  );

  const currentConfig = configMap[activeId] ?? DEFAULT_CONFIG;
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

    if (completedIds.length === SCENARIOS.length && !interactive?.progress.isComplete) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: { completed: completedIds, total: SCENARIOS.length },
      };
      interactive?.progress.markComplete(result);
      interactive?.tracking.emit('complete', result.data);
      onComplete?.(result);
    }
  }, [completedIds, interactive, onComplete, onStateChange, progressValue]);

  const updateConfig = useCallback(
    (field: 'phase' | 'gain', value: number) => {
      setConfigMap((prev) => ({
        ...prev,
        [activeId]: {
          phase: field === 'phase' ? value : currentConfig.phase,
          gain: field === 'gain' ? value : currentConfig.gain,
        },
      }));
      interactive?.tracking.emit('interact', { scenarioId: activeId, field, value });
    },
    [activeId, currentConfig.gain, currentConfig.phase, interactive]
  );

  const handleCheck = useCallback(() => {
    const { targetPhase, targetGain } = activeScenario;
    const phaseOk = currentConfig.phase >= targetPhase.min && currentConfig.phase <= targetPhase.max;
    const gainOk = currentConfig.gain >= targetGain.min && currentConfig.gain <= targetGain.max;
    const isCorrect = phaseOk && gainOk;

    setResultMap((prev) => ({ ...prev, [activeId]: isCorrect ? 'correct' : 'wrong' }));
    if (isCorrect && !completedIds.includes(activeId)) {
      setCompletedIds((prev) => [...prev, activeId]);
    }

    const snapshot = {
      progress: progressValue,
      data: {
        scenarioId: activeId,
        phase: currentConfig.phase,
        gain: currentConfig.gain,
        phaseOk,
        gainOk,
        isCorrect,
      },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.tracking.emit(isCorrect ? 'complete' : 'submit', snapshot.data);
  }, [activeScenario, activeId, completedIds, currentConfig.gain, currentConfig.phase, interactive, onStateChange, progressValue]);

  const feedback = useMemo(() => {
    const { targetPhase, targetGain } = activeScenario;
    const phaseNote = currentConfig.phase < targetPhase.min
      ? '相角裕度偏小'
      : currentConfig.phase > targetPhase.max
        ? '相角裕度偏大'
        : '相角裕度合适';
    const gainNote = currentConfig.gain < targetGain.min
      ? '幅值裕度偏小'
      : currentConfig.gain > targetGain.max
        ? '幅值裕度偏大'
        : '幅值裕度合适';
    return `${phaseNote}，${gainNote}`;
  }, [activeScenario, currentConfig.gain, currentConfig.phase]);

  const status = resultMap[activeId] ?? 'idle';

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">参与式学习 · 稳定裕度调试</p>
          <h2 className="text-2xl font-bold text-slate-900">稳定裕度策略实验室</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
          <Gauge className="h-4 w-4 text-amber-500" />
          已完成 {completedIds.length}/{SCENARIOS.length}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Sliders className="h-4 w-4 text-amber-500" />
            场景列表
          </div>
          <div className="mt-4 space-y-2">
            {SCENARIOS.map((scenario) => {
              const isCompleted = completedIds.includes(scenario.id);
              return (
                <button
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
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <h3 className="text-xl font-semibold">{activeScenario.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{activeScenario.context}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              目标裕度区间
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>相角裕度 (°)</span>
                <span className="text-slate-900 font-semibold">{currentConfig.phase}°</span>
              </div>
              <div className="mt-3">
                <Slider
                  value={[currentConfig.phase]}
                  min={0}
                  max={90}
                  step={1}
                  onValueChange={(value) => updateConfig('phase', value[0] ?? 0)}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                目标区间 {activeScenario.targetPhase.min}° - {activeScenario.targetPhase.max}°
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>幅值裕度 (dB)</span>
                <span className="text-slate-900 font-semibold">{currentConfig.gain} dB</span>
              </div>
              <div className="mt-3">
                <Slider
                  value={[currentConfig.gain]}
                  min={0}
                  max={20}
                  step={1}
                  onValueChange={(value) => updateConfig('gain', value[0] ?? 0)}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                目标区间 {activeScenario.targetGain.min} - {activeScenario.targetGain.max} dB
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-medium text-slate-700">提示</div>
            <p className="mt-2">{activeScenario.suggestion}</p>
            <p className="mt-2">{feedback}</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleCheck}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs text-white"
            >
              提交配置
            </button>
            {status === 'correct' && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                匹配目标区间，可进入下一场景。
              </div>
            )}
            {status === 'wrong' && (
              <div className="text-sm text-rose-600">
                当前配置未满足目标区间，请再调整。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
