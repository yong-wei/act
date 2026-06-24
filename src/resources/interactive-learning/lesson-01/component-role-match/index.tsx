'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, Link2 } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface MatchItem {
  id: string;
  title: string;
  prompt: string;
  options: string[];
  answer: string;
  hint: string;
}

const MATCH_ITEMS: MatchItem[] = [
  {
    id: 'plant',
    title: '对象（被控过程）',
    prompt: '对象的主要作用是：',
    options: ['输出控制动作', '执行控制算法', '产生被控输出', '测量输出'],
    answer: '产生被控输出',
    hint: '对象是“被控制的系统”。',
  },
  {
    id: 'controller',
    title: '控制器',
    prompt: '控制器的主要作用是：',
    options: ['比较误差并输出控制信号', '执行力矩或电流', '测量输出', '仅提供电源'],
    answer: '比较误差并输出控制信号',
    hint: '控制器负责决策。',
  },
  {
    id: 'actuator',
    title: '执行器',
    prompt: '执行器的主要作用是：',
    options: ['把控制信号转化为动作', '估计状态', '产生误差', '求取目标值'],
    answer: '把控制信号转化为动作',
    hint: '执行器是系统的“肌肉”。',
  },
  {
    id: 'sensor',
    title: '传感器',
    prompt: '传感器的主要作用是：',
    options: ['测量输出并反馈', '调节控制律', '放大控制信号', '保证能量供给'],
    answer: '测量输出并反馈',
    hint: '传感器是系统的“眼睛”。',
  },
];

interface ComponentRoleMatchProps extends BaseWidgetProps {}

export default function ComponentRoleMatch({ onComplete, onStateChange }: ComponentRoleMatchProps) {
  const interactive = useOptionalInteractiveContext();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const correctCount = useMemo(
    () => MATCH_ITEMS.filter((item) => answers[item.id] === item.answer).length,
    [answers]
  );

  const progress = useMemo(
    () => Math.round((correctCount / MATCH_ITEMS.length) * 100),
    [correctCount]
  );

  const handleCheck = useCallback(() => {
    setChecked(true);
    const snapshot = {
      progress,
      data: { answers, correctCount, total: MATCH_ITEMS.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progress);
    interactive?.tracking.emit('submit', snapshot.data);

    if (correctCount === MATCH_ITEMS.length) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: snapshot.data,
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [answers, correctCount, interactive, onComplete, onStateChange, progress]);

  const handleReset = useCallback(() => {
    setAnswers({});
    setChecked(false);
    onStateChange?.({
      progress: 0,
      data: { action: 'reset' },
      timestamp: Date.now(),
    });
    interactive?.progress.setProgress(0);
    interactive?.tracking.emit('interact', { action: 'reset' });
  }, [interactive, onStateChange]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">参与式 · 控制系统要素</p>
            <h2 className="text-2xl font-bold text-slate-900">组件与职责匹配</h2>
          </div>
          <div className="text-sm text-slate-500">正确 {correctCount}/{MATCH_ITEMS.length}</div>
        </div>

        <div className="mt-5 space-y-4">
          {MATCH_ITEMS.map((item) => {
            const selected = answers[item.id];
            const isCorrect = checked && selected === item.answer;
            const isWrong = checked && selected && selected !== item.answer;

            return (
              <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.prompt}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Link2 className="h-3.5 w-3.5" />
                    选择最贴近的职责
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <select
                    value={selected ?? ''}
                    onChange={(event) =>
                      setAnswers((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="">请选择</option>
                    {item.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {isCorrect && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      正确
                    </span>
                  )}
                  {isWrong && (
                    <span className="inline-flex items-center gap-1 text-xs text-rose-600">
                      <XCircle className="h-4 w-4" />
                      再检查
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">提示：{item.hint}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            清空选择
          </button>
          <button type="button"
            onClick={handleCheck}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white"
          >
            检查匹配
          </button>
        </div>
      </div>
    </div>
  );
}
