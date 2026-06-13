'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'node-block-diagram-elements',
    name: '方框图四元素',
    nodeType: 'THEORY',
    description: '信号线、引出点、综合点、方框构成结构图语言。',
    lessonId: 'lesson-05',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '信号线表示方向，引出点复制同一信号，综合点执行代数运算，方框承载传递函数。掌握元素语义是读图与化简的第一步。',
    applications: ['结构图阅读', '系统分析', '课堂推导'],
  },
  {
    id: 'node-block-diagram-causal-chain',
    name: '由微分方程到结构图',
    nodeType: 'THEORY',
    description: '先做拉氏变换，再按因果顺序连接信号链。',
    lessonId: 'lesson-05',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '把微分方程变成 s 域代数式后，按变量传递顺序绘制动态结构图，常借助中间变量把复杂关系拆成串联模块。',
    applications: ['结构图建立', '建模流程', '系统等效'],
  },
  {
    id: 'node-block-diagram-equivalents',
    name: '串并联与反馈等效',
    nodeType: 'THEORY',
    description: '串联相乘，并联相加，负反馈闭环为 G/(1+GH)。',
    lessonId: 'lesson-05',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '三类典型结构是化简基石：串联乘积、并联求和、反馈闭环。遇到复杂结构先回到这三类典型。',
    formulaContinuous: 'G_{eq}=G_1G_2,\;G_{eq}=G_1+G_2,\;G_{cl}=\frac{G}{1+GH}',
    applications: ['结构图化简', '传递函数求解'],
  },
  {
    id: 'node-block-diagram-move-points',
    name: '引出点与综合点移位',
    nodeType: 'THEORY',
    description: '移位时需乘或除所跨越的传递函数，信号不变。',
    lessonId: 'lesson-05',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '引出点前移需除以跨越的环节，后移需乘以跨越的环节；综合点移位规则相反。相邻同类节点可互换。',
    applications: ['解交叉', '结构图整理'],
  },
  {
    id: 'node-block-diagram-simplify-strategy',
    name: '结构图化简策略',
    nodeType: 'THEORY',
    description: '找典型、解交叉、由内向外是化简路线。',
    lessonId: 'lesson-05',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '先识别串并联反馈，再用移位解除交叉，最后从内部子环节逐层合并，保证每一步都可回到典型结构。',
    applications: ['复杂结构图化简', '课堂推导'],
  },
  {
    id: 'node-signal-flow-basics',
    name: '信号流图节点与支路',
    nodeType: 'THEORY',
    description: '节点表示变量，支路表示变量间传递关系。',
    lessonId: 'lesson-05',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '信号流图用有向图表达变量关系，支路增益写在箭头上，强调拓扑结构与变量流向。',
    applications: ['拓扑建模', '系统结构表达'],
  },
  {
    id: 'node-signal-flow-node-types',
    name: '输入/输出/混合节点',
    nodeType: 'THEORY',
    description: '只出不入为输入，只入不出为输出，出入兼具为混合节点。',
    lessonId: 'lesson-05',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '节点类型帮助定位信号源与信号阱，确保前向通路从输入到输出。',
    applications: ['节点标注', '拓扑检查'],
  },
  {
    id: 'node-signal-flow-paths-loops',
    name: '前向通路与回路增益',
    nodeType: 'THEORY',
    description: '前向通路从输入到输出且不重复节点，回路从节点出发再回到自身。',
    lessonId: 'lesson-05',
    bloomLevel: 'APPLY',
    knowledgeDim: 'CONCEPTUAL',
    explanation:
      '前向通路增益是沿路径乘积，回路增益是闭合路径乘积，是梅森公式的核心输入。',
    applications: ['梅森公式', '路径计算'],
  },
  {
    id: 'node-signal-flow-conversion',
    name: '结构图转信号流图',
    nodeType: 'THEORY',
    description: '标变量、定出入、列节点、连支路。',
    lessonId: 'lesson-05',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '把结构图的比较点与引出点转成节点与支路，保持信号因果顺序，支路上标明增益符号。',
    applications: ['拓扑转换', '图形化建模'],
  },
  {
    id: 'node-signal-flow-equation',
    name: '由方程组绘制信号流图',
    nodeType: 'THEORY',
    description: '代数式、拉氏变换与初始条件可直接转成支路。',
    lessonId: 'lesson-05',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '先把微分方程化为 s 域代数式，按因果排列变量，初始条件作为输入节点。',
    applications: ['方程建模', '非零初始条件处理'],
  },
  {
    id: 'node-mason-formula',
    name: '梅森增益公式',
    nodeType: 'THEORY',
    description: '整体传递函数由前向通路与特征式共同决定。',
    lessonId: 'lesson-05',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '梅森公式将复杂信号流图化为公式计算：总增益是前向通路增益与余子式加权求和。',
    formulaContinuous: 'T=\frac{\sum_k P_k\Delta_k}{\Delta}',
    applications: ['传递函数求解', '复杂拓扑计算'],
  },
  {
    id: 'node-mason-delta',
    name: '特征式与互不接触回路',
    nodeType: 'THEORY',
    description: 'Delta 由回路增益与互不接触回路乘积交替相加减。',
    lessonId: 'lesson-05',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '计算 Delta 要先数出所有回路，再找互不接触回路对、三元组等，符号按加减交替。',
    formulaContinuous: '\\Delta=1-\sum L_i+\sum L_iL_j-\sum L_iL_jL_k+\cdots',
    applications: ['回路计数', '公式代入'],
  },
  {
    id: 'node-mason-cofactor',
    name: '余子式 Delta_k',
    nodeType: 'THEORY',
    description: '剔除与前向通路相接触回路后的特征式。',
    lessonId: 'lesson-05',
    bloomLevel: 'ANALYZE',
    knowledgeDim: 'PROCEDURAL',
    explanation:
      '每条前向通路对应一个余子式 Delta_k，用于屏蔽与该通路相接触的回路。',
    applications: ['梅森公式应用', '误差检查'],
  },
];

interface StructureKnowledgeDeckProps extends BaseWidgetProps {}

export default function StructureKnowledgeDeck({ onComplete, onStateChange }: StructureKnowledgeDeckProps) {
  const interactive = useOptionalInteractiveContext();
  const initialActiveId = KNOWLEDGE_CARDS[0]?.id ?? 'node-block-diagram-elements';
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
        <h2 className="text-2xl font-bold text-slate-900">结构图与信号流图核心知识卡片</h2>
        <p className="text-slate-600">13 张卡片串起结构图、拓扑与梅森公式</p>
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
            拓扑不变，结构可简。
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
