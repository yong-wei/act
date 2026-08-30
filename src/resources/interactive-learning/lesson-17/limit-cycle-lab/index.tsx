'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Compass } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface Scenario {
  id: string;
  title: string;
  description: string;
  options: { id: string; label: string }[];
  answerId: string;
  explanation: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'stable-cycle',
    title: '交点回归',
    description: 'G(jω) 与 -1/N(A) 有交点，扰动后振幅回到原交点。',
    options: [
      { id: 'stable', label: '稳定自振' },
      { id: 'unstable', label: '不稳定自振' },
      { id: 'none', label: '无自振' },
    ],
    answerId: 'stable',
    explanation: '扰动后能回到交点，说明该交点对应稳定的极限环。',
  },
  {
    id: 'unstable-cycle',
    title: '交点远离',
    description: '有交点，但扰动后振幅继续增大或减小，无法回到交点。',
    options: [
      { id: 'stable', label: '稳定自振' },
      { id: 'unstable', label: '不稳定自振' },
      { id: 'none', label: '无自振' },
    ],
    answerId: 'unstable',
    explanation: '扰动后不能回到交点，自振点不稳定或只是过渡状态。',
  },
  {
    id: 'no-intersection',
    title: '无交点',
    description: 'G(jω) 与 -1/N(A) 无交点，轨迹不相交。',
    options: [
      { id: 'stable', label: '稳定自振' },
      { id: 'unstable', label: '不稳定自振' },
      { id: 'none', label: '无自振' },
    ],
    answerId: 'none',
    explanation: '无交点则不满足 N(A)G(jω)=-1，自振不存在。',
  },
];

interface LimitCycleLabProps extends BaseWidgetProps {}

export default function LimitCycleLab({ onComplete, onStateChange }: LimitCycleLabProps) {
  const interactive = useOptionalInteractiveContext();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isComplete, setIsComplete] = useState(false);

  const progress = useMemo(
    () => Math.round((Object.keys(answers).length / SCENARIOS.length) * 100),
    [answers]
  );

  const correctCount = useMemo(
    () => SCENARIOS.filter((item) => answers[item.id] === item.answerId).length,
    [answers]
  );

  const handleSelect = (scenarioId: string, optionId: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [scenarioId]: optionId };
      const snapshot = {
        progress: Math.round((Object.keys(next).length / SCENARIOS.length) * 100),
        data: { scenarioId, selected: optionId, correct: optionId === SCENARIOS.find((s) => s.id === scenarioId)?.answerId },
        timestamp: Date.now(),
      };
      onStateChange?.(snapshot);
      interactive?.progress.setProgress(snapshot.progress);
      interactive?.tracking.emit('interact', snapshot.data);

      if (!isComplete && Object.keys(next).length === SCENARIOS.length) {
        setIsComplete(true);
      }
      return next;
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">自振判别实验室</h2>
        <p className="text-slate-600">根据交点与扰动判断自振是否稳定</p>
      </div>

      <div className="grid gap-4">
        {SCENARIOS.map((scenario, index) => {
          const selected = answers[scenario.id];
          return (
            <div key={scenario.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Compass className="h-4 w-4 text-amber-500" />
                    <h3 className="text-lg font-semibold">案例 {index + 1}：{scenario.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{scenario.description}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                  {selected ? '已判断' : '待判断'}
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {scenario.options.map((option) => {
                  const selectedOption = selected === option.id;
                  const showCorrect = selected && option.id === scenario.answerId;
                  const showWrong = selectedOption && option.id !== scenario.answerId;
                  return (
                    <button type="button"
                      key={option.id}
                      onClick={() => handleSelect(scenario.id, option.id)}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                        showCorrect
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : showWrong
                          ? 'border-rose-400 bg-rose-50 text-rose-600'
                          : selectedOption
                          ? 'border-slate-400 bg-slate-50 text-slate-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span>{option.label}</span>
                      {showCorrect && <CheckCircle2 className="h-4 w-4" />}
                      {showWrong && <AlertTriangle className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">提示：</span>
                {selected ? scenario.explanation : '选择后可查看解析。'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <span>完成度 {Object.keys(answers).length}/{SCENARIOS.length}</span>
        <span>当前正确 {correctCount}/{SCENARIOS.length}</span>
        <span>进度 {progress}%</span>
      </div>
      {isComplete ? (
        <PathResourceContinueAction
          enabled
          result={{
            success: true,
            score: Math.round((correctCount / SCENARIOS.length) * 100),
            data: { correct: correctCount, total: SCENARIOS.length },
          }}
          onComplete={onComplete}
        />
      ) : null}
    </div>
  );
}
