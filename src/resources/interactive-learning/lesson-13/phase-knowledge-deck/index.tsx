'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'node-nyquist-definition',
    name: '开环幅相特性（奈奎斯特图）',
    nodeType: 'THEORY',
    description: '频率响应的幅值与相位在复平面形成的极坐标轨迹。',
    lessonId: 'lesson-13',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '将 G(jω)=|G(jω)|∠φ(ω) 作为向量，随 ω 从 0 到 ∞ 扫频得到轨迹；它就是开环幅相特性，也称 Nyquist 图。',
    formulaContinuous: 'G(jω) = |G(jω)| ∠ φ(ω)',
    applications: ['稳定性判据', '频域校正', '频响实验验证'],
  },
  {
    id: 'node-nyquist-start-end',
    name: '起点与终点',
    nodeType: 'THEORY',
    description: '低频段起点由 G(0) 决定，高频段终点由传函阶次决定。',
    lessonId: 'lesson-13',
    bloomLevel: 'REMEMBER',
    knowledgeDim: 'FACTUAL',
    explanation:
      '低频起点通常为 G(0)，高频终点随系统阶次趋向原点并呈现固定相角（每个高频极点贡献 -90°）。',
    formulaContinuous: 'lim_{ω→0} G(jω),  lim_{ω→∞} G(jω)',
    applications: ['概略绘制', '形状判断'],
  },
  {
    id: 'node-nyquist-crossing',
    name: '负实轴交点与穿越频率',
    nodeType: 'METHOD',
    description: '相位穿越与幅值穿越决定曲线是否接近 -1 点。',
    lessonId: 'lesson-13',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '负实轴交点对应 φ(ω) = -180° 的相位穿越频率；|G(jω)| = 1 对应幅值穿越频率。二者在 Bode 图上分别为相位曲线穿越 -180° 与幅频曲线穿越 0 dB。',
    formulaContinuous: 'φ(ω_c) = -180°,  |G(jω_g)| = 1',
    applications: ['稳定裕度', '对数判据'],
  },
  {
    id: 'node-nyquist-feature-points',
    name: '特征点求法',
    nodeType: 'METHOD',
    description: '通过实部/虚部方程锁定关键交点与转向趋势。',
    lessonId: 'lesson-13',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '先写出 G(jω) 的实部与虚部，求实轴或虚轴交点；再判断随 ω 增加时实虚部的符号变化，确定转向与弯折。',
    formulaContinuous: 'G(jω) = Re(ω) + j Im(ω)',
    applications: ['手工绘制', '近似判断'],
  },
  {
    id: 'node-nyquist-sketch-steps',
    name: '概略绘制步骤',
    nodeType: 'METHOD',
    description: '三步走：求频响 → 找特征点 → 概略连线。',
    lessonId: 'lesson-13',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '步骤一：求 G(jω)；步骤二：起点/终点/负实轴交点；步骤三：结合单调收缩、零点扭曲等规律完成草图。',
    formulaContinuous: 'Step 1: G(jω) · Step 2: key points · Step 3: sketch',
    applications: ['课堂推导', '快速判稳'],
  },
  {
    id: 'node-argument-principle',
    name: '幅角原理',
    nodeType: 'THEORY',
    description: '闭合曲线映射的转角变化量与零极点数量关联。',
    lessonId: 'lesson-13',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '当 s 平面曲线包围 Z 个零点与 P 个极点时，F(s) 的映射绕原点的圈数与 Z-P 成比例，这一关系构成 Nyquist 判据的理论基础。',
    formulaContinuous: 'Δarg F(s) = 2π(Z - P)',
    applications: ['稳定判据推导'],
  },
  {
    id: 'node-nyquist-criterion',
    name: '奈奎斯特稳定判据',
    nodeType: 'THEORY',
    description: '由开环曲线包围 -1 的次数判断闭环极点分布。',
    lessonId: 'lesson-13',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '令 N 为 Nyquist 曲线逆时针包围 -1 的次数，P 为右半平面开环极点数，则闭环右半平面极点数 Z = P - N。稳定要求 Z=0。',
    formulaContinuous: 'Z = P - N (N: CCW)',
    applications: ['判稳', '结构调整'],
  },
  {
    id: 'node-log-stability-criterion',
    name: '对数稳定判据',
    nodeType: 'METHOD',
    description: '用 Bode 图的 0 dB 与 -180° 穿越次数近似判稳。',
    lessonId: 'lesson-13',
    bloomLevel: 'EVALUATE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '将 Nyquist 判据转为对数坐标：幅频曲线穿越 0 dB 时，观察相位曲线穿越 -180° 的方向与次数，等价判定稳定性。',
    formulaContinuous: '|G(jω)| = 1 ↔ 0 dB,  φ(ω) = -180°',
    applications: ['工程快速判稳', '裕度分析'],
  },
];

interface PhaseKnowledgeDeckProps extends BaseWidgetProps {}

export default function PhaseKnowledgeDeck({ onComplete, onStateChange }: PhaseKnowledgeDeckProps) {
  const interactive = useOptionalInteractiveContext();
  const initialActiveId = KNOWLEDGE_CARDS[0]?.id ?? 'phase-nyquist-definition';
  const [activeId, setActiveId] = useState(initialActiveId);
  const [visited, setVisited] = useState<string[]>(() => [initialActiveId]);
  const publishedVisitedCountRef = useRef(0);

  const activeCard = useMemo(
    () => KNOWLEDGE_CARDS.find((card) => card.id === activeId) ?? KNOWLEDGE_CARDS[0],
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
    const progressValue = Math.round((nextVisited.length / KNOWLEDGE_CARDS.length) * 100);
    const snapshot = {
      progress: progressValue,
      data: { cardId: latestVisitedId, visitedCount: nextVisited.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
    interactive?.tracking.emit('interact', snapshot.data);

    if (nextVisited.length === KNOWLEDGE_CARDS.length && !interactive?.progress.isComplete) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: { visited: nextVisited, total: KNOWLEDGE_CARDS.length },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [initialActiveId, visited, interactive, onComplete, onStateChange]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">幅相特性知识卡片</h2>
        <p className="text-slate-600">8 张关键卡片贯通“幅相特性 → 判稳思维”</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            知识导航
          </div>
          <div className="mt-4 space-y-2">
            {KNOWLEDGE_CARDS.map((card, index) => (
              <button type="button"
                key={card.id}
                onClick={() => recordVisit(card.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeId === card.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {index + 1}. {card.name}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
            已浏览 {visited.length}/{KNOWLEDGE_CARDS.length}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Layers className="h-4 w-4" />
            先理解定义，再用判据推稳定。
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Target className="h-5 w-5 text-cyan-500" />
            <h3 className="text-xl font-semibold">{activeCard?.name}</h3>
          </div>
          <p className="mt-2 text-sm text-slate-600">{activeCard?.description}</p>
          {activeCard && (
            <div className="mt-5">
              <KnowledgeCard node={activeCard} defaultExpanded variant="inline" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
