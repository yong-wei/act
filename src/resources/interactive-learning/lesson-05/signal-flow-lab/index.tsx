'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ChevronRight } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface LabOption {
  id: string;
  label: string;
}

interface LabItem {
  id: string;
  title: string;
  prompt: string;
  diagram?: string;
  options: LabOption[];
  answerId: string;
  explanation: string;
}

const LAB_ITEMS: LabItem[] = [
  {
    id: 'node-type',
    title: '节点类型辨识',
    prompt: '只出不入的节点叫做？',
    options: [
      { id: 'input', label: '输入节点' },
      { id: 'output', label: '输出节点' },
      { id: 'mixed', label: '混合节点' },
      { id: 'sum', label: '综合节点' },
    ],
    answerId: 'input',
    explanation: '输入节点只有输出支路，没有输入支路。',
  },
  {
    id: 'forward-path',
    title: '前向通路',
    prompt: '下列哪个是从 R 到 C 的前向通路？',
    diagram: 'R -> G1 -> G2 -> C\n     ^      |\n     |--H---|',
    options: [
      { id: 'p1', label: 'R -> G1 -> G2 -> C' },
      { id: 'l1', label: 'G2 -> H -> G2' },
      { id: 'p2', label: 'R -> G1 -> H -> G2' },
      { id: 'p3', label: 'R -> G2 -> C' },
    ],
    answerId: 'p1',
    explanation: '前向通路从输入到输出且不重复节点。',
  },
  {
    id: 'branch-gain',
    title: '支路增益',
    prompt: '综合点的负号在信号流图中如何体现？',
    options: [
      { id: 'arrow', label: '箭头方向反转' },
      { id: 'gain', label: '在支路增益中写负号' },
      { id: 'node', label: '节点改为方框' },
      { id: 'none', label: '无需体现' },
    ],
    answerId: 'gain',
    explanation: '信号流图用支路增益表达符号，负号写在增益中。',
  },
  {
    id: 'conversion-order',
    title: '转换步骤',
    prompt: '结构图转信号流图的第一步应是？',
    options: [
      { id: 'mark', label: '标变量并确定输入/输出' },
      { id: 'connect', label: '直接连支路' },
      { id: 'combine', label: '化简结构图' },
      { id: 'formula', label: '写出传递函数' },
    ],
    answerId: 'mark',
    explanation: '先标变量与出入节点，才能列节点并连接支路。',
  },
];

interface SignalFlowLabProps extends BaseWidgetProps {}

export default function SignalFlowLab({ onComplete, onStateChange }: SignalFlowLabProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const current = LAB_ITEMS[currentIndex];
  const isLast = currentIndex === LAB_ITEMS.length - 1;

  const handleCheck = useCallback(() => {
    if (!selected) return;
    if (!checked) {
      const isCorrect = selected === current.answerId;
      if (isCorrect) {
        setScore((prev) => prev + 1);
      }
      setChecked(true);
      const nextScore = isCorrect ? score + 1 : score;
      const answeredCount = currentIndex + 1;
      const progressValue = Math.round((answeredCount / LAB_ITEMS.length) * 100);
      const snapshot = {
        progress: progressValue,
        data: { questionId: current.id, selected, isCorrect, score: nextScore },
        timestamp: Date.now(),
      };
      onStateChange?.(snapshot);
      interactive?.progress.setProgress(progressValue);
      interactive?.tracking.emit('submit', snapshot.data);
      if (isLast) {
        const result: WidgetResult = {
          success: true,
          score: Math.round((nextScore / LAB_ITEMS.length) * 100),
          data: { correct: nextScore, total: LAB_ITEMS.length },
        };
        interactive?.progress.markComplete(result);
        onComplete?.(result);
      }
    }
  }, [selected, checked, current.answerId, current.id, currentIndex, isLast, onComplete, onStateChange, score, interactive]);

  const handleNext = useCallback(() => {
    if (!checked) return;
    setChecked(false);
    setSelected(null);
    setCurrentIndex((prev) => Math.min(prev + 1, LAB_ITEMS.length - 1));
    interactive?.tracking.emit('interact', { action: 'next', nextIndex: currentIndex + 1 });
  }, [checked, currentIndex, interactive]);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setSelected(null);
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
    () => `第 ${currentIndex + 1} / ${LAB_ITEMS.length} 题`,
    [currentIndex]
  );

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">信号流图速练</h2>
          <p className="text-sm text-slate-500">节点、支路与前向通路快速确认</p>
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
            const isSelected = selected === option.id;
            const isCorrect = checked && option.id === current.answerId;
            const isWrong = checked && isSelected && option.id !== current.answerId;
            return (
              <button type="button"
                key={option.id}
                onClick={() => !checked && setSelected(option.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                } ${isCorrect ? 'border-emerald-500 bg-emerald-50' : ''} ${
                  isWrong ? 'border-rose-500 bg-rose-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{option.label}</span>
                  {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {isWrong && <XCircle className="h-4 w-4 text-rose-500" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button type="button"
            onClick={handleReset}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>
          <div className="flex items-center gap-3">
            {!checked ? (
              <button type="button"
                onClick={handleCheck}
                disabled={!selected}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                确认答案
              </button>
            ) : (
              <button type="button"
                onClick={handleNext}
                disabled={isLast}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                下一题
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
        当前得分：<span className="font-semibold text-slate-900">{score}</span> / {LAB_ITEMS.length}
      </div>
    </div>
  );
}
