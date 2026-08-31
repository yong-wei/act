'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface FeatureScenario {
  id: string;
  title: string;
  description: string;
  options: { id: string; label: string }[];
  answerId: string;
  explanation: string;
}

const SCENARIOS: FeatureScenario[] = [
  {
    id: 'saturation',
    title: '执行器触顶',
    description: '输入超过阈值后，输出保持在最大值不再增长。',
    options: [
      { id: 'saturation', label: '饱和特性' },
      { id: 'dead-zone', label: '死区特性' },
      { id: 'relay', label: '滞环继电特性' },
      { id: 'backlash', label: '间隙特性' },
    ],
    answerId: 'saturation',
    explanation: '输入超过范围后输出被限制，典型表现为饱和。',
  },
  {
    id: 'dead-zone',
    title: '小信号无响应',
    description: '输入小于某阈值时输出为 0，超过阈值后才开始线性变化。',
    options: [
      { id: 'saturation', label: '饱和特性' },
      { id: 'dead-zone', label: '死区特性' },
      { id: 'relay', label: '滞环继电特性' },
      { id: 'backlash', label: '间隙特性' },
    ],
    answerId: 'dead-zone',
    explanation: '死区特性会过滤小幅输入，只有超过阈值才有输出。',
  },
  {
    id: 'relay',
    title: '吸合与释放不同',
    description: '正向与反向切换时存在不同的阈值，输出呈现滞回回线。',
    options: [
      { id: 'saturation', label: '饱和特性' },
      { id: 'dead-zone', label: '死区特性' },
      { id: 'relay', label: '滞环继电特性' },
      { id: 'backlash', label: '间隙特性' },
    ],
    answerId: 'relay',
    explanation: '滞环继电器有不同的吸合/释放阈值，输出具有回线。',
  },
  {
    id: 'backlash',
    title: '反向有空程',
    description: '输入方向改变时，输出暂不变化，消除空程后才响应。',
    options: [
      { id: 'saturation', label: '饱和特性' },
      { id: 'dead-zone', label: '死区特性' },
      { id: 'relay', label: '滞环继电特性' },
      { id: 'backlash', label: '间隙特性' },
    ],
    answerId: 'backlash',
    explanation: '间隙特性常见于齿轮传动，反向需要先消除空程。',
  },
];

interface NonlinearFeatureMatchProps extends BaseWidgetProps {}

export default function NonlinearFeatureMatch({ onComplete, onStateChange }: NonlinearFeatureMatchProps) {
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
        <h2 className="text-2xl font-bold text-slate-900">非线性特性识别</h2>
        <p className="text-slate-600">将工程现象对应到典型非线性环节</p>
      </div>

      <div className="grid gap-4">
        {SCENARIOS.map((scenario, index) => {
          const selected = answers[scenario.id];
          return (
            <div key={scenario.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Target className="h-4 w-4 text-amber-500" />
                    <h3 className="text-lg font-semibold">案例 {index + 1}：{scenario.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{scenario.description}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                  {selected ? '已选择' : '待选择'}
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
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
