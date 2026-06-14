'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Compass,
  Target,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface WorkshopSection {
  id: string;
  title: string;
  summary: string;
  hint: string;
  question: string;
  options: { id: string; text: string }[];
  answerIds: string[];
  multiSelect?: boolean;
  explanation: string;
}

const SECTIONS: WorkshopSection[] = [
  {
    id: 'equivalent-loop',
    title: '等效开环变换',
    summary: '把参数写成等效增益 K_eq。',
    hint: '目标是把特征方程改写为 1 + K_eq G_eq(s) = 0。',
    question: '以下哪一步最符合“等效开环变换”的核心？',
    options: [
      { id: 'A', text: '直接把参数项当作系统零点处理' },
      { id: 'B', text: '整理方程，使参数以乘法形式出现' },
      { id: 'C', text: '把参数项移到左边并忽略' },
      { id: 'D', text: '将系统改为正反馈' },
    ],
    answerIds: ['B'],
    explanation: '等效开环的关键是把参数整理成“等效增益”乘以等效开环传函。',
  },
  {
    id: 'real-axis',
    title: '实轴轨迹判别',
    summary: '右侧奇数法则依旧成立。',
    hint: '统计该点右侧开环极点与零点数量。',
    question: '哪一条判断根轨迹实轴段的原则是正确的？',
    options: [
      { id: 'A', text: '右侧极点与零点数量为偶数' },
      { id: 'B', text: '右侧极点与零点数量为奇数' },
      { id: 'C', text: '左侧极点与零点数量为奇数' },
      { id: 'D', text: '只要在实轴上就属于根轨迹' },
    ],
    answerIds: ['B'],
    explanation: '实轴轨迹判别仍然是“右侧极点+零点数为奇数”。',
  },
  {
    id: 'imag-axis',
    title: '稳定范围边界',
    summary: '虚轴交点决定稳定区间。',
    hint: '虚轴交点可通过劳斯判据或代入求解。',
    question: '要确定参数稳定范围，必须找到哪一种信息？',
    options: [
      { id: 'A', text: '渐近线角度' },
      { id: 'B', text: '虚轴交点对应的参数值' },
      { id: 'C', text: '出射角大小' },
      { id: 'D', text: '零点位置' },
    ],
    answerIds: ['B'],
    explanation: '虚轴交点是稳定边界，交点对应的参数值决定区间。',
  },
  {
    id: 'dominant-pole',
    title: '主导极点选择',
    summary: '先选极点，再反推参数。',
    hint: '阻尼比由极点角度决定，速度由距离决定。',
    question: '主导极点选择的首要依据是？',
    options: [
      { id: 'A', text: '极点距离原点的角度与距离' },
      { id: 'B', text: '零点的数量' },
      { id: 'C', text: '实轴段长度' },
      { id: 'D', text: '系统阶次' },
    ],
    answerIds: ['A'],
    explanation: '主导极点位置与阻尼比/自然频率直接相关，是性能落点的依据。',
  },
  {
    id: 'validation',
    title: '仿真验证',
    summary: '从根轨迹回到响应曲线。',
    hint: '常见流程是选 K_eq -> 构造闭环 -> 观察阶跃响应。',
    question: '为什么需要仿真验证？',
    options: [
      { id: 'A', text: '根轨迹只能给出趋势，指标需用响应验证' },
      { id: 'B', text: '根轨迹无法用于稳定性判断' },
      { id: 'C', text: '根轨迹不包含极点信息' },
      { id: 'D', text: '仿真能直接给出理论公式' },
    ],
    answerIds: ['A'],
    explanation: '根轨迹给出极点趋势，但超调、调节时间需结合响应曲线验证。',
  },
];

interface GraphicalThinkingWorkshopProps extends BaseWidgetProps {}

function ProcessGuide() {
  const steps = [
    '识别参数 p，写出闭环特征方程',
    '构造等效开环 G_eq(s) 与 K_eq',
    '用根轨迹规则判断稳定范围',
    '选定主导极点，反推参数',
    '仿真验证响应与性能指标',
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Compass className="h-4 w-4 text-emerald-500" />
        图形化流程
      </div>
      <ol className="mt-3 space-y-2 text-sm text-slate-600">
        {steps.map((step, idx) => (
          <li key={step} className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-700">
              {idx + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function GraphicalThinkingWorkshop({ onComplete, onStateChange }: GraphicalThinkingWorkshopProps) {
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(SECTIONS[0]?.id ?? 'equivalent-loop');
  const [selectedMap, setSelectedMap] = useState<Record<string, string[]>>({});
  const [statusMap, setStatusMap] = useState<Record<string, 'idle' | 'wrong' | 'correct'>>({});
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const activeSection = useMemo(
    () => SECTIONS.find((section) => section.id === activeId) ?? SECTIONS[0],
    [activeId]
  );

  const progressValue = useMemo(
    () => Math.round((completedIds.length / Math.max(SECTIONS.length, 1)) * 100),
    [completedIds.length]
  );

  useEffect(() => {
    if (!SECTIONS.length) return;
    const snapshot = {
      progress: progressValue,
      data: { completed: completedIds, total: SECTIONS.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);

    if (completedIds.length === SECTIONS.length && !interactive?.progress.isComplete) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: { completed: completedIds, total: SECTIONS.length },
      };
      interactive?.progress.markComplete(result);
      interactive?.tracking.emit('complete', { total: SECTIONS.length });
      onComplete?.(result);
    }
  }, [completedIds, interactive, onComplete, onStateChange, progressValue]);

  const toggleOption = useCallback(
    (sectionId: string, optionId: string, multiSelect?: boolean) => {
      setSelectedMap((prev) => {
        const current = prev[sectionId] ?? [];
        const next = multiSelect
          ? current.includes(optionId)
            ? current.filter((item) => item !== optionId)
            : [...current, optionId]
          : [optionId];
        return { ...prev, [sectionId]: next };
      });
      interactive?.tracking.emit('interact', { sectionId, optionId });
    },
    [interactive]
  );

  const handleCheck = useCallback(
    (sectionId: string) => {
      const section = SECTIONS.find((item) => item.id === sectionId);
      if (!section) return;
      const selected = selectedMap[sectionId] ?? [];
      const expected = section.answerIds;
      const correct = selected.length === expected.length && selected.every((id) => expected.includes(id));
      setStatusMap((prev) => ({ ...prev, [sectionId]: correct ? 'correct' : 'wrong' }));
      if (correct && !completedIds.includes(sectionId)) {
        setCompletedIds((prev) => [...prev, sectionId]);
      }
      interactive?.tracking.emit(correct ? 'complete' : 'interact', {
        sectionId,
        correct,
        selected,
      });
    },
    [selectedMap, completedIds, interactive]
  );

  const selectedOptions = selectedMap[activeId] ?? [];
  const status = statusMap[activeId] ?? 'idle';
  const completed = completedIds.includes(activeId);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">参与式学习 · 图形化思考</p>
          <h2 className="text-2xl font-bold text-slate-900">参数根轨迹思维工作坊</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
          <GitBranch className="h-4 w-4 text-violet-500" />
          已完成 {completedIds.length}/{SECTIONS.length}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Compass className="h-4 w-4 text-emerald-500" />
              问题路线
            </div>
            <div className="mt-3 space-y-2">
              {SECTIONS.map((section) => {
                const sectionCompleted = completedIds.includes(section.id);
                return (
                  <button type="button"
                    key={section.id}
                    onClick={() => setActiveId(section.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      activeId === section.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{section.title}</span>
                    {sectionCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Circle className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <ProcessGuide />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-700">
                <Target className="h-5 w-5 text-amber-500" />
                <h3 className="text-xl font-semibold">{activeSection.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{activeSection.summary}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {activeSection.multiSelect ? '多选题' : '单选题'}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            {activeSection.question}
            <div className="mt-2 text-xs text-slate-500">提示：{activeSection.hint}</div>
          </div>

          <div className="mt-4 grid gap-3">
            {activeSection.options.map((option) => {
              const selected = selectedOptions.includes(option.id);
              return (
                <button type="button"
                  key={option.id}
                  onClick={() => toggleOption(activeId, option.id, activeSection.multiSelect)}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    selected
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {selected ? (
                    <CheckCircle2 className="h-4 w-4 text-violet-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-400" />
                  )}
                  {option.text}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button"
              onClick={() => handleCheck(activeId)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs text-white"
            >
              检查答案
            </button>
            {status === 'correct' && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                回答正确，继续下一题。
              </div>
            )}
            {status === 'wrong' && (
              <div className="flex items-center gap-2 text-sm text-rose-600">
                <AlertTriangle className="h-4 w-4" />
                再想一想，查看提示。
              </div>
            )}
            {completed && (
              <div className="text-xs text-slate-500">该题已完成</div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center gap-2 text-slate-700">
              <GitBranch className="h-4 w-4 text-violet-500" />
              解析
            </div>
            <p className="mt-2">{activeSection.explanation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
