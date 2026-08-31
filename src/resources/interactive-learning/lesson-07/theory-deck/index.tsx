'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, Compass, Sigma, Target, Activity } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface TheorySection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  formula?: string;
}

const SECTIONS: TheorySection[] = [
  {
    id: 'standard-form',
    title: '二阶系统标准型',
    summary: '用阻尼比 ζ 与自然频率 ω_n 描述二阶系统的核心动态。',
    bullets: [
      '标准型：G(s) = ω_n^2 / (s^2 + 2ζω_n s + ω_n^2)',
      '欠阻尼：0 < ζ < 1（响应有振荡且逐步衰减）',
      '临界阻尼：ζ = 1（最快无振荡）',
      '过阻尼：ζ > 1（无振荡但响应慢）',
    ],
    formula: 's^2 + 2ζω_n s + ω_n^2 = 0',
  },
  {
    id: 'pole-geometry',
    title: '极点与阻尼比',
    summary: '共轭复极点位置决定振荡频率与衰减速度。',
    bullets: [
      '欠阻尼极点：s = -ζω_n ± j ω_n√(1-ζ^2)',
      '实部越大（更负），衰减越快；虚部越大，振荡越快',
      '等阻尼线是从原点出发的射线，ζ 为夹角余弦',
    ],
    formula: 'ω_d = ω_n√(1-ζ^2)',
  },
  {
    id: 'step-response',
    title: '单位阶跃响应',
    summary: '衰减振荡响应由指数衰减与正弦项共同决定。',
    bullets: [
      'y(t) = 1 - (1/√(1-ζ^2)) e^{-ζω_n t} sin(ω_d t + φ)',
      'φ = arccos(ζ)，决定起始相位',
      '阻尼比越小，振荡更明显；ω_n 越大，响应更快',
    ],
    formula: 't_p = π / ω_d',
  },
  {
    id: 'performance-metrics',
    title: '性能指标速记',
    summary: '用几个关键时间指标描述响应品质。',
    bullets: [
      '超调量：M_p = exp(-ζπ/√(1-ζ^2)) × 100%',
      '调节时间（2%）：t_s ≈ 4 / (ζ ω_n)',
      '上升时间近似：t_r ≈ (π - φ) / ω_d',
      '峰值时间：t_p = π / ω_d',
    ],
    formula: 't_s ≈ 4 / (ζ ω_n)',
  },
  {
    id: 'gain-effect',
    title: '增益与形态变化',
    summary: '增益改变闭环极点位置，影响速度与超调。',
    bullets: [
      '增益提高通常使极点远离原点，响应更快',
      '同时可能降低阻尼比，引起超调增大',
      '工程上需在速度、超调与稳定性之间折中',
    ],
    formula: 'ζ = -Re(s) / |s|',
  },
];

interface SecondOrderTheoryDeckProps extends BaseWidgetProps {}

function PoleDiagram({ dampingRatio }: { dampingRatio: number }) {
  const angle = Math.acos(Math.max(0.05, Math.min(0.95, dampingRatio)));
  const radius = 40;
  const center = { x: 60, y: 60 };
  const pole = {
    x: center.x - radius * Math.cos(angle),
    y: center.y - radius * Math.sin(angle),
  };
  const poleMirror = {
    x: pole.x,
    y: center.y + (center.y - pole.y),
  };

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <rect width="120" height="120" rx="14" fill="#0f172a" />
      <line x1="10" y1="60" x2="110" y2="60" stroke="#1f2937" strokeWidth="2" />
      <line x1="60" y1="10" x2="60" y2="110" stroke="#1f2937" strokeWidth="2" />
      <line
        x1={center.x}
        y1={center.y}
        x2={pole.x}
        y2={pole.y}
        stroke="#38bdf8"
        strokeWidth="2"
      />
      <line
        x1={center.x}
        y1={center.y}
        x2={poleMirror.x}
        y2={poleMirror.y}
        stroke="#38bdf8"
        strokeWidth="2"
      />
      <circle cx={pole.x} cy={pole.y} r="5" fill="#f97316" />
      <circle cx={poleMirror.x} cy={poleMirror.y} r="5" fill="#f97316" />
      <text x="72" y="18" fill="#64748b" fontSize="10">jω</text>
      <text x="98" y="72" fill="#64748b" fontSize="10">σ</text>
    </svg>
  );
}

export default function SecondOrderTheoryDeck({ onComplete, onStateChange }: SecondOrderTheoryDeckProps) {
  const interactive = useOptionalInteractiveContext();
  const initialActiveId = SECTIONS[0]?.id ?? 'standard-form';
  const [activeId, setActiveId] = useState(initialActiveId);
  const [visited, setVisited] = useState<string[]>(() => [initialActiveId]);
  const publishedVisitedCountRef = useRef(0);

  const activeSection = useMemo(
    () => SECTIONS.find((section) => section.id === activeId) ?? SECTIONS[0],
    [activeId]
  );

  const recordVisit = useCallback((nextActiveId: string) => {
    setActiveId(nextActiveId);
    setVisited((current) =>
      current.includes(nextActiveId) ? current : [...current, nextActiveId]
    );
  }, []);

  useEffect(() => {
    if (publishedVisitedCountRef.current >= visited.length) return;
    publishedVisitedCountRef.current = visited.length;
    const nextVisited = visited;
    const latestVisitedId = nextVisited[nextVisited.length - 1] ?? initialActiveId;
    const progressValue = Math.round((nextVisited.length / SECTIONS.length) * 100);
    const snapshot = {
      progress: progressValue,
      data: { sectionId: latestVisitedId, visitedCount: nextVisited.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
    interactive?.tracking.emit('interact', snapshot.data);
  }, [initialActiveId, visited, interactive, onStateChange]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">二阶系统核心知识卡</h2>
        <p className="text-slate-600">从标准型到性能指标，建立欠阻尼系统的完整认知</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            知识导航
          </div>
          <div className="mt-4 space-y-2">
            {SECTIONS.map((section) => (
              <button type="button"
                key={section.id}
                onClick={() => recordVisit(section.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeId === section.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
            已浏览 {visited.length}/{SECTIONS.length}
          </div>
          <PathResourceContinueAction
            enabled={visited.length === SECTIONS.length}
            result={{ success: true, score: 100, data: { visited, total: SECTIONS.length } }}
            onComplete={onComplete}
          />

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-700">
                <Compass className="h-5 w-5 text-emerald-500" />
                <h3 className="text-xl font-semibold">{activeSection.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{activeSection.summary}</p>
            </div>
            <div className="w-32 h-32">
              <PoleDiagram dampingRatio={0.6} />
            </div>
          </div>

          {activeSection.formula && (
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 font-mono">
              {activeSection.formula}
            </div>
          )}

          <div className="mt-4 grid gap-3">
            {activeSection.bullets.map((item, index) => (
              <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="mt-1 h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs font-semibold">
                  {index + 1}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Activity className="h-4 w-4" />
                动态响应
              </div>
              <p className="mt-2">观察阻尼比变化对超调与振荡频率的影响。</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Sigma className="h-4 w-4" />
                指标速记
              </div>
              <p className="mt-2">记住 t_s ≈ 4/(ζ ω_n)，快速估算响应时间。</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Target className="h-4 w-4" />
                工程权衡
              </div>
              <p className="mt-2">稳定、速度、超调三者需要综合权衡。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { SecondOrderTheoryDeck };
