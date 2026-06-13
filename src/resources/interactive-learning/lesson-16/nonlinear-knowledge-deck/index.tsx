'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'node-nonlinear-ubiquity',
    name: '非线性系统的普遍性',
    nodeType: 'THEORY',
    description: '实际系统普遍存在饱和、死区、摩擦、间隙等非线性。',
    lessonId: 'lesson-16',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '工程系统中的执行机构、传感器与结构件往往具有工作区间与物理极限，导致“线性模型”只是局部近似。',
    applications: ['执行机构约束', '工程建模', '系统辨识'],
  },
  {
    id: 'node-nonlinear-special-properties',
    name: '非线性系统的特殊性质',
    nodeType: 'THEORY',
    description: '不满足叠加原理，稳定性与初始条件、外作用密切相关。',
    lessonId: 'lesson-16',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '非线性系统可能存在多个平衡点与自持振荡，输入幅值改变会引发跃变与高次谐波。',
    applications: ['稳定性分析', '非线性控制', '故障诊断'],
  },
  {
    id: 'node-harmonic-linearization',
    name: '谐波线性化',
    nodeType: 'METHOD',
    description: '用输出基波近似非线性响应，将问题转化为等效频域分析。',
    lessonId: 'lesson-16',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '将非线性环节在正弦输入下的输出展开为傅里叶级数，只保留基波分量作为近似。',
    formulaContinuous: 'y(t) \approx Y_1 \sin(\omega t + \varphi_1)',
    applications: ['描述函数法', '近似稳定性评估'],
  },
  {
    id: 'node-describing-function-definition',
    name: '描述函数定义',
    nodeType: 'METHOD',
    description: '描述函数是输出基波与输入正弦之间的复数比。',
    lessonId: 'lesson-16',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '对输入 x(t)=A\sin(\omega t)，输出基波为 Y_1 \sin(\omega t+\varphi_1)，描述函数记作 N(A)=Y_1/A ∠ \varphi_1。',
    formulaContinuous: 'N(A)=\frac{Y_1}{A}\angle\varphi_1',
    applications: ['频域等效', '自振判别'],
  },
  {
    id: 'node-ideal-relay-describing',
    name: '理想继电器描述函数',
    nodeType: 'METHOD',
    description: '理想继电器的描述函数为幅值相关的实函数。',
    lessonId: 'lesson-16',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '理想继电器输出为 ±M，基波幅值与输入 A 成反比，因此 N(A) 随 A 增大而减小。',
    formulaContinuous: 'N(A)=\frac{4M}{\pi A}',
    applications: ['继电控制', '自振分析'],
  },
  {
    id: 'node-saturation-describing',
    name: '饱和特性描述函数',
    nodeType: 'METHOD',
    description: '饱和环节的描述函数与饱和幅值 a、斜率 k 相关。',
    lessonId: 'lesson-16',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '当输入幅值超过饱和值时，输出被限幅，N(A) 呈现幅值递减趋势。',
    formulaContinuous: 'N(A)=\frac{2k}{\pi}\left(\arcsin\frac{a}{A}+\frac{a}{A}\sqrt{1-\frac{a^2}{A^2}}\right)',
    applications: ['执行器限幅', '稳态自振估计'],
  },
  {
    id: 'node-dead-zone-describing',
    name: '死区特性描述函数',
    nodeType: 'METHOD',
    description: '死区使得小幅输入无法产生输出，描述函数随 A 增大而上升。',
    lessonId: 'lesson-16',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '死区导致输出基波削弱，N(A) 与 A 的关系体现了“有效输入区间”。',
    formulaContinuous: 'N(A)=\frac{2k}{\pi}\left(\frac{\pi}{2}-\arcsin\frac{a}{A}-\frac{a}{A}\sqrt{1-\frac{a^2}{A^2}}\right)',
    applications: ['测量死区补偿', '低幅响应评估'],
  },
  {
    id: 'node-hysteresis-backlash',
    name: '滞环与间隙特性',
    nodeType: 'METHOD',
    description: '滞环/间隙导致描述函数出现复数相位滞后。',
    lessonId: 'lesson-16',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '非单值特性导致 A1 不为零，N(A) 包含虚部，体现输出对输入的相位滞后。',
    applications: ['齿隙补偿', '继电滞环分析'],
  },
];

interface NonlinearKnowledgeDeckProps extends BaseWidgetProps {}

export default function NonlinearKnowledgeDeck({ onComplete, onStateChange }: NonlinearKnowledgeDeckProps) {
  const interactive = useOptionalInteractiveContext();
  const initialActiveId = KNOWLEDGE_CARDS[0]?.id ?? 'node-nonlinear-ubiquity';
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
        <h2 className="text-2xl font-bold text-slate-900">非线性系统知识卡片</h2>
        <p className="text-slate-600">从系统特性到描述函数的 8 张核心卡片</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            知识导航
          </div>
          <div className="mt-4 space-y-2">
            {KNOWLEDGE_CARDS.map((card, index) => (
              <button
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
            先理解现象，再进入方法。
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Target className="h-5 w-5 text-amber-500" />
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
