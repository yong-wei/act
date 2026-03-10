'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ChevronRight } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface ChallengeOption {
  id: string;
  label: string;
}

interface ChallengeItem {
  id: string;
  title: string;
  prompt: string;
  diagram?: string;
  options: ChallengeOption[];
  answerIds: string[];
  multiSelect: boolean;
  explanation: string;
}

const CHALLENGE_ITEMS: ChallengeItem[] = [
  {
    id: 'forward-paths',
    title: '找前向通路',
    prompt: '下面哪些是从 R 到 C 的前向通路？',
    diagram: 'R -> G1 -> G2 -> C\n      \\-> G3 ----/',
    options: [
      { id: 'p1', label: 'R -> G1 -> G2 -> C' },
      { id: 'p2', label: 'R -> G1 -> G3 -> C' },
      { id: 'l1', label: 'G2 -> H -> G2' },
      { id: 'p3', label: 'R -> G2 -> C' },
    ],
    answerIds: ['p1', 'p2'],
    multiSelect: true,
    explanation: '前向通路必须从输入到输出且不重复节点，回路不算前向通路。',
  },
  {
    id: 'loops',
    title: '数回路',
    prompt: '以下哪些是回路增益？',
    diagram: 'L1: x1 -> x2 -> x1\nL2: x3 -> x4 -> x3\nL3: x2 -> x5 -> x2',
    options: [
      { id: 'l1', label: 'L1 = x1 -> x2 -> x1' },
      { id: 'l2', label: 'L2 = x3 -> x4 -> x3' },
      { id: 'l3', label: 'L3 = x2 -> x5 -> x2' },
      { id: 'p1', label: 'P1 = R -> x1 -> x2 -> C' },
    ],
    answerIds: ['l1', 'l2', 'l3'],
    multiSelect: true,
    explanation: '回路是从节点出发再回到该节点的闭合路径。',
  },
  {
    id: 'non-touching',
    title: '互不接触回路',
    prompt: '下列哪一对回路互不接触？',
    diagram: 'L1: x1-x2-x1\nL2: x3-x4-x3\nL3: x2-x5-x2',
    options: [
      { id: 'pair1', label: 'L1 & L3' },
      { id: 'pair2', label: 'L1 & L2' },
      { id: 'pair3', label: 'L2 & L3' },
    ],
    answerIds: ['pair2'],
    multiSelect: false,
    explanation: 'L1 与 L2 没有共享节点，因此互不接触。',
  },
  {
    id: 'delta',
    title: '特征式 Delta',
    prompt: '只有两个互不接触回路 L1、L2 时，Delta 正确表达式是？',
    options: [
      { id: 'delta1', label: 'Δ = 1 - (L1 + L2) + L1L2' },
      { id: 'delta2', label: 'Δ = 1 + (L1 + L2) + L1L2' },
      { id: 'delta3', label: 'Δ = 1 - (L1 + L2) - L1L2' },
      { id: 'delta4', label: 'Δ = (L1 + L2) - L1L2' },
    ],
    answerIds: ['delta1'],
    multiSelect: false,
    explanation: '特征式符号交替：1 - 回路和 + 非接触回路乘积。',
  },
];

interface MasonLoopChallengeProps extends BaseWidgetProps {}

export default function MasonLoopChallenge({ onComplete, onStateChange }: MasonLoopChallengeProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const current = CHALLENGE_ITEMS[currentIndex];
  const isLast = currentIndex === CHALLENGE_ITEMS.length - 1;

  const handleOptionToggle = useCallback(
    (optionId: string) => {
      if (checked) return;
      if (current.multiSelect) {
        setSelectedIds((prev) =>
          prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
        );
      } else {
        setSelectedIds([optionId]);
      }
    },
    [checked, current.multiSelect]
  );

  const handleCheck = useCallback(() => {
    if (selectedIds.length === 0) return;
    if (!checked) {
      const sortedSelected = [...selectedIds].sort();
      const sortedAnswer = [...current.answerIds].sort();
      const isCorrect =
        sortedSelected.length === sortedAnswer.length &&
        sortedSelected.every((value, index) => value === sortedAnswer[index]);
      if (isCorrect) {
        setScore((prev) => prev + 1);
      }
      setChecked(true);
      const nextScore = isCorrect ? score + 1 : score;
      const answeredCount = currentIndex + 1;
      const progressValue = Math.round((answeredCount / CHALLENGE_ITEMS.length) * 100);
      const snapshot = {
        progress: progressValue,
        data: { questionId: current.id, selectedIds, isCorrect, score: nextScore },
        timestamp: Date.now(),
      };
      onStateChange?.(snapshot);
      interactive?.progress.setProgress(progressValue);
      interactive?.tracking.emit('submit', snapshot.data);
      if (isLast) {
        const result: WidgetResult = {
          success: true,
          score: Math.round((nextScore / CHALLENGE_ITEMS.length) * 100),
          data: { correct: nextScore, total: CHALLENGE_ITEMS.length },
        };
        interactive?.progress.markComplete(result);
        onComplete?.(result);
      }
    }
  }, [selectedIds, checked, current.answerIds, current.id, currentIndex, isLast, onComplete, onStateChange, score, interactive]);

  const handleNext = useCallback(() => {
    if (!checked) return;
    setChecked(false);
    setSelectedIds([]);
    setCurrentIndex((prev) => Math.min(prev + 1, CHALLENGE_ITEMS.length - 1));
    interactive?.tracking.emit('interact', { action: 'next', nextIndex: currentIndex + 1 });
  }, [checked, currentIndex, interactive]);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setSelectedIds([]);
    setChecked(false);
    setScore(0);
    onStateChange?.({
      progress: 0,
      data: { action: 'reset' },
      timestamp: Date.now(),
    });
    interactive?.progress.reset();
  }, [interactive, onStateChange]);

  const progressText = useMemo(
    () => `第 ${currentIndex + 1} / ${CHALLENGE_ITEMS.length} 关`,
    [currentIndex]
  );

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">梅森公式数圈圈挑战</h2>
          <p className="text-sm text-slate-500">前向通路、回路与 Delta 一次确认</p>
        </div>
        <div className="text-sm text-slate-500">{progressText}</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">{current.title}</h3>
          <p className="text-sm text-slate-500">{current.prompt}</p>
        </div>

        {current.diagram && (
          <pre className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            {current.diagram}
          </pre>
        )}

        <div className="space-y-3">
          {current.options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            const isCorrect = checked && current.answerIds.includes(option.id);
            const isWrong = checked && isSelected && !current.answerIds.includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => handleOptionToggle(option.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                } ${isCorrect ? 'border-emerald-500 bg-emerald-50' : ''} ${
                  isWrong ? 'border-rose-500 bg-rose-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{option.label}</span>
                  {isCorrect && checked && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {isWrong && <XCircle className="h-4 w-4 text-rose-500" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>
          <div className="flex items-center gap-3">
            {!checked ? (
              <button
                onClick={handleCheck}
                disabled={selectedIds.length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                确认答案
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={isLast}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                下一关
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {checked && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {current.explanation}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        当前得分：<span className="font-semibold text-slate-900">{score}</span> / {CHALLENGE_ITEMS.length}
      </div>
    </div>
  );
}
