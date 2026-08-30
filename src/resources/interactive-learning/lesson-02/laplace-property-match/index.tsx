'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, Link2 } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

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
    id: 'linearity',
    title: '线性定理',
    prompt: 'L{a f(t) + b g(t)} = ?',
    options: ['aF(s) + bG(s)', 'F(s)G(s)', 'F(s) + G(s) + ab'],
    answer: 'aF(s) + bG(s)',
    hint: '线性组合直接变成 s 域线性组合。',
  },
  {
    id: 'derivative',
    title: '微分定理',
    prompt: 'L{f\'(t)} = ?',
    options: ['sF(s) - f(0)', 'F(s)/s', 's^2F(s)'],
    answer: 'sF(s) - f(0)',
    hint: '导数在 s 域乘 s，并减去初值。',
  },
  {
    id: 'integral',
    title: '积分定理',
    prompt: 'L{∫_0^t f(τ)dτ} = ?',
    options: ['F(s)/s', 'sF(s)', 'F(s) - f(0)'],
    answer: 'F(s)/s',
    hint: '积分在 s 域相当于除以 s。',
  },
  {
    id: 'shift',
    title: '位移定理',
    prompt: 'L{e^{-at} f(t)} = ?',
    options: ['F(s+a)', 'F(s-a)', 'e^{-as}F(s)'],
    answer: 'F(s+a)',
    hint: '时域指数衰减对应 s 平面右移。',
  },
  {
    id: 'convolution',
    title: '卷积定理',
    prompt: 'L{f*g} = ?',
    options: ['F(s)G(s)', 'F(s)+G(s)', 'F(s)/G(s)'],
    answer: 'F(s)G(s)',
    hint: '时域卷积等于 s 域乘积。',
  },
];

interface LaplacePropertyMatchProps extends BaseWidgetProps {}

export default function LaplacePropertyMatch({ onComplete, onStateChange }: LaplacePropertyMatchProps) {
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
  }, [answers, correctCount, interactive, onStateChange, progress]);

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
            <p className="text-sm text-slate-500">参与式 · 拉氏定理速配</p>
            <h2 className="text-2xl font-bold text-slate-900">把时域操作映射到 s 域</h2>
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
                    选择对应的 s 域表达
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
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs text-white"
          >
            检查匹配
          </button>
          {checked && correctCount === MATCH_ITEMS.length ? (
            <PathResourceContinueAction
              enabled
              result={{ success: true, score: 100, data: { answers, correctCount, total: MATCH_ITEMS.length } }}
              onComplete={onComplete}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
