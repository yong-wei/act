'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Compass,
  GitBranch,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

type WorkshopVariant = 'overview' | 'challenge';

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

const OVERVIEW_SECTIONS: WorkshopSection[] = [
  {
    id: 'start-end',
    title: '大局：起点与终点',
    summary: '先确认根轨迹的“出发地”和“目的地”。',
    hint: '根轨迹描绘闭环极点随增益变化的轨迹。',
    question: '根轨迹的起点与终点是什么？',
    options: [
      { id: 'A', text: '起点为闭环极点，终点为闭环零点。' },
      { id: 'B', text: '起点为开环极点，终点为开环零点或无穷远零点。' },
      { id: 'C', text: '起点为开环零点，终点为开环极点。' },
      { id: 'D', text: '起点为虚轴交点，终点为左半平面。' },
    ],
    answerIds: ['B'],
    explanation: '根轨迹从开环极点出发，终止于开环零点；零点不足时，其余分支趋向无穷远零点。',
  },
  {
    id: 'real-axis',
    title: '法则：实轴段判别',
    summary: '实轴上“右侧奇数”法则。',
    hint: '统计该点右侧的开环极点+零点数量。',
    question: '极点位于 -1、-4、-7，零点位于 -3。实轴上哪两段属于根轨迹？',
    options: [
      { id: 'A', text: '(-∞, -7)' },
      { id: 'B', text: '(-7, -4)' },
      { id: 'C', text: '(-4, -3)' },
      { id: 'D', text: '(-3, -1)' },
      { id: 'E', text: '(-1, +∞)' },
    ],
    answerIds: ['B', 'D'],
    multiSelect: true,
    explanation: '右侧极点/零点个数为奇数的实轴段才属于根轨迹，因此 (-7,-4) 与 (-3,-1) 合格。',
  },
  {
    id: 'asymptote',
    title: '法则：渐近线角度',
    summary: '分支多于零点时，轨迹趋向无穷远。',
    hint: '角度公式：\u03b8_k = (2k+1)180°/(n-m)。',
    question: '开环有 4 个极点、1 个零点，渐近线角度为？',
    options: [
      { id: 'A', text: '60°、180°、300°' },
      { id: 'B', text: '45°、135°、225°、315°' },
      { id: 'C', text: '0°、120°、240°' },
      { id: 'D', text: '90°、270°' },
    ],
    answerIds: ['A'],
    explanation: 'n-m=3，因此角度为 60°、180°、300°。',
  },
  {
    id: 'departure',
    title: '细节：出射/入射角',
    summary: '复共轭极点/零点的轨迹转向。',
    hint: '关键是“零点角度减极点角度”。',
    question: '下列哪一项是复极点出射角计算式（忽略该极点本身）？',
    options: [
      { id: 'A', text: 'φ = 180° + \u2211θ_p - \u2211θ_z' },
      { id: 'B', text: 'φ = 180° + \u2211θ_z - \u2211θ_p' },
      { id: 'C', text: 'φ = \u2211θ_z - \u2211θ_p' },
      { id: 'D', text: 'φ = (2k+1)180°/(n-m)' },
    ],
    answerIds: ['B'],
    explanation: '出射角通常使用 φ = 180° + Σθ_z - Σθ_p。',
  },
];

const CHALLENGE_SECTIONS: WorkshopSection[] = [
  {
    id: 'magnitude',
    title: '挑战：模值条件',
    summary: '用模值条件判断增益范围。',
    hint: '闭环特征方程 1 + K G(s) = 0。',
    question: '根轨迹在候选点 s 上的模值条件是？',
    options: [
      { id: 'A', text: '|1 + K G(s)| = 0' },
      { id: 'B', text: '|K G(s)| = 1' },
      { id: 'C', text: '|G(s)| = 1' },
      { id: 'D', text: '|K + G(s)| = 1' },
    ],
    answerIds: ['B'],
    explanation: '根轨迹模值条件为 |K G(s)| = 1。',
  },
  {
    id: 'centroid',
    title: '挑战：渐近线中心',
    summary: '计算渐近线交点位置。',
    hint: 'σ_a = (Σp - Σz)/(n-m)。',
    question: '极点在 -1、-3、-5、-7，零点在 -2，则渐近线中心为？',
    options: [
      { id: 'A', text: '-3' },
      { id: 'B', text: '-4.67' },
      { id: 'C', text: '-5' },
      { id: 'D', text: '-6' },
    ],
    answerIds: ['B'],
    explanation: 'Σp=-16, Σz=-2, n-m=3，所以中心为 (-16+2)/3=-4.67。',
  },
  {
    id: 'breakaway',
    title: '挑战：分离点判据',
    summary: '判断分离点成立的必要条件。',
    hint: '既要满足方程，又要落在轨迹上。',
    question: '实轴分离点成立的必要条件是？',
    options: [
      { id: 'A', text: 'dK/ds = 0 且位于根轨迹上' },
      { id: 'B', text: '模值条件成立即可' },
      { id: 'C', text: '在实轴上任意点均可' },
      { id: 'D', text: '与虚轴交点重合' },
    ],
    answerIds: ['A'],
    explanation: '分离点需满足 dK/ds = 0 且该点属于根轨迹。',
  },
];

interface RootLocusWorkshopProps extends BaseWidgetProps {
  variant?: WorkshopVariant;
}

function RootLocusMap() {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs text-slate-500">示意：开环极点/零点</div>
      <svg viewBox="0 0 420 140" className="mt-3 h-32 w-full">
        <rect width="420" height="140" rx="16" fill="#0f172a" />
        <line x1="40" y1="70" x2="380" y2="70" stroke="#334155" strokeWidth="2" />
        <line x1="210" y1="20" x2="210" y2="120" stroke="#334155" strokeWidth="2" strokeDasharray="6 6" />
        <text x="360" y="60" fill="#64748b" fontSize="10">Re</text>
        <text x="220" y="30" fill="#64748b" fontSize="10">Im</text>
        <circle cx="110" cy="70" r="6" fill="#f97316" />
        <circle cx="160" cy="70" r="6" fill="#f97316" />
        <circle cx="260" cy="70" r="6" fill="#f97316" />
        <circle cx="300" cy="70" r="6" fill="#38bdf8" />
        <text x="96" y="95" fill="#94a3b8" fontSize="10">p</text>
        <text x="146" y="95" fill="#94a3b8" fontSize="10">p</text>
        <text x="246" y="95" fill="#94a3b8" fontSize="10">p</text>
        <text x="294" y="95" fill="#94a3b8" fontSize="10">z</text>
      </svg>
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          极点
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          零点
        </div>
      </div>
    </div>
  );
}

export default function RootLocusWorkshop({
  variant = 'overview',
  onComplete,
  onStateChange,
}: RootLocusWorkshopProps) {
  const interactive = useOptionalInteractiveContext();
  const sections = useMemo(
    () => (variant === 'challenge' ? CHALLENGE_SECTIONS : OVERVIEW_SECTIONS),
    [variant]
  );
  const [activeId, setActiveId] = useState(sections[0]?.id ?? 'start-end');
  const [selectedMap, setSelectedMap] = useState<Record<string, string[]>>({});
  const [statusMap, setStatusMap] = useState<Record<string, 'idle' | 'wrong' | 'correct'>>({});
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeId) ?? sections[0],
    [sections, activeId]
  );

  const progressValue = useMemo(
    () => Math.round((completedIds.length / Math.max(sections.length, 1)) * 100),
    [completedIds.length, sections.length]
  );

  useEffect(() => {
    if (!sections.length) return;
    const snapshot = {
      progress: progressValue,
      data: { completed: completedIds, total: sections.length, variant },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
  }, [completedIds, interactive, onStateChange, progressValue, sections.length, variant]);

  const toggleOption = useCallback(
    (sectionId: string, optionId: string, multiSelect?: boolean) => {
      setSelectedMap((prev) => {
        const current = prev[sectionId] ?? [];
        let next: string[];
        if (multiSelect) {
          next = current.includes(optionId)
            ? current.filter((item) => item !== optionId)
            : [...current, optionId];
        } else {
          next = [optionId];
        }
        return { ...prev, [sectionId]: next };
      });
      interactive?.tracking.emit('interact', { sectionId, optionId, variant });
    },
    [interactive, variant]
  );

  const handleCheck = useCallback(
    (sectionId: string) => {
      const section = sections.find((item) => item.id === sectionId);
      if (!section) return;
      const selected = selectedMap[sectionId] ?? [];
      const expected = section.answerIds;
      const correct = selected.length === expected.length && selected.every((id) => expected.includes(id));
      setStatusMap((prev) => ({ ...prev, [sectionId]: correct ? 'correct' : 'wrong' }));
      if (correct && !completedIds.includes(sectionId)) {
        const nextCompleted = [...completedIds, sectionId];
        setCompletedIds(nextCompleted);
      }
      interactive?.tracking.emit(correct ? 'complete' : 'interact', {
        sectionId,
        correct,
        selected,
      });
    },
    [sections, selectedMap, completedIds, interactive]
  );

  const selectedOptions = selectedMap[activeId] ?? [];
  const status = statusMap[activeId] ?? 'idle';
  const completed = completedIds.includes(activeId);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">参与式学习 · 根轨迹规则工作坊</p>
          <h2 className="text-2xl font-bold text-slate-900">
            {variant === 'challenge' ? '根轨迹挑战站' : '根轨迹规则工作坊'}
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
          <GitBranch className="h-4 w-4 text-violet-500" />
          已完成 {completedIds.length}/{sections.length}
        </div>
          <PathResourceContinueAction
            enabled={completedIds.length === sections.length}
            result={{ success: true, score: 100, data: { completed: completedIds, total: sections.length, variant } }}
            onComplete={onComplete}
          />

      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Compass className="h-4 w-4 text-emerald-500" />
              学习路线
            </div>
            <div className="mt-3 space-y-2">
              {sections.map((section) => {
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
          <RootLocusMap />
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
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              检查答案
            </button>
            {status === 'correct' && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                回答正确
              </div>
            )}
            {status === 'wrong' && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                再检查一次
              </div>
            )}
          </div>

          {(completed || status === 'correct') && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
              {activeSection.explanation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
