'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, Layers, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-card';
import type { LessonKnowledgeCard } from '@/resources/interactive-learning/shared/knowledge-cards-data';

const KNOWLEDGE_CARDS: LessonKnowledgeCard[] = [
  {
    id: 'node-transfer-function-definition',
    name: '传递函数定义',
    nodeType: 'THEORY',
    description: '零初始条件下输出拉氏变换与输入拉氏变换之比。',
    lessonId: 'lesson-04',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation: '传递函数是线性定常系统的 s 域描述，强调输入输出之间的关系。',
    formulaContinuous: 'G(s)=Y(s)/U(s)',
    applications: ['系统建模', '控制器设计', '频域分析'],
  },
  {
    id: 'node-zero-initial-condition',
    name: '零初始条件',
    nodeType: 'THEORY',
    description: '传递函数定义的前提假设。',
    lessonId: 'lesson-04',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation: '零初始条件保证拉氏变换后不带初始项，便于直接求 Y(s)/U(s)。',
    applications: ['模型简化', '响应分解'],
  },
  {
    id: 'node-differential-to-transfer',
    name: '微分方程→传递函数',
    nodeType: 'THEORY',
    description: '拉氏变换并整理为输入/输出比值。',
    lessonId: 'lesson-04',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation: '步骤：确定输入/输出 → 拉氏变换 → 零初始代入 → 整理为 Y/U。',
    formulaContinuous: 'a_n s^n Y(s)+\cdots+a_0 Y(s)=b_m s^m U(s)+\cdots+b_0 U(s)',
    applications: ['系统建模', '工程推导'],
  },
  {
    id: 'node-pole-zero-form',
    name: '零极点形式',
    nodeType: 'THEORY',
    description: '传函可写成零点与极点的乘积形式。',
    lessonId: 'lesson-04',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation: '零点来自分子根，极点来自分母根，极点位置决定稳定性与响应形态。',
    formulaContinuous: 'G(s)=K\frac{\prod (s-z_i)}{\prod (s-p_i)}',
    applications: ['稳定性判断', '根轨迹', '频域分析'],
  },
  {
    id: 'node-characteristic-polynomial',
    name: '特征多项式与系统阶次',
    nodeType: 'THEORY',
    description: '分母多项式阶次即系统阶次。',
    lessonId: 'lesson-04',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'CONCEPTUAL',
    explanation: '特征多项式根对应系统特征根，与自然响应和稳定性直接相关。',
    applications: ['阶次判断', '动态特性分析'],
  },
  {
    id: 'node-transfer-function-properties',
    name: '传递函数性质',
    nodeType: 'THEORY',
    description: '线性定常系统可串并联/反馈组合。',
    lessonId: 'lesson-04',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation: '串联传函相乘、并联相加，负反馈可用闭环公式快速化简。',
    applications: ['结构图化简', '系统组合'],
  },
  {
    id: 'node-typical-elements',
    name: '典型环节',
    nodeType: 'THEORY',
    description: '比例、积分、微分、一阶惯性、二阶振荡等标准形式。',
    lessonId: 'lesson-04',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation: '识别典型环节有助于快速判断系统动态特征。',
    formulaContinuous: 'G(s)=K,\;K/s,\;Ks,\;1/(Ts+1),\;\omega_n^2/(s^2+2\zeta\omega_n s+\omega_n^2)',
    applications: ['系统辨识', '结构匹配'],
  },
  {
    id: 'node-rlc-transfer-example',
    name: 'RLC 电路示例',
    nodeType: 'THEORY',
    description: '从 KVL 方程得到二阶传函。',
    lessonId: 'lesson-04',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation: 'RLC 串联电路在 s 域表现为二阶振荡，参数决定阻尼比与固有频率。',
    applications: ['电路建模', '滤波器设计'],
  },
  {
    id: 'node-mechanical-motor-transfer',
    name: '机械/电机系统示例',
    nodeType: 'THEORY',
    description: '弹簧-阻尼与电机系统可统一为标准传函。',
    lessonId: 'lesson-04',
    bloomLevel: 'APPLY',
    knowledgeDim: 'PROCEDURAL',
    explanation: '机械系统常呈二阶形式，电机系统常见一阶或二阶模型。',
    applications: ['机电系统建模', '伺服控制'],
  },
  {
    id: 'node-matlab-transfer-toolbox',
    name: 'MATLAB 传递函数工具',
    nodeType: 'METHOD',
    description: '用 tf/zpk/step/bode 快速建模与分析。',
    lessonId: 'lesson-04',
    bloomLevel: 'UNDERSTAND',
    knowledgeDim: 'PROCEDURAL',
    explanation: 'MATLAB 提供标准函数构建传函并绘制时域与频域响应。',
    applications: ['快速仿真', '课堂演示'],
  },
];

interface TransferKnowledgeDeckProps extends BaseWidgetProps {}

export default function TransferKnowledgeDeck({ onComplete, onStateChange }: TransferKnowledgeDeckProps) {
  const interactive = useOptionalInteractiveContext();
  const initialActiveId = KNOWLEDGE_CARDS[0]?.id ?? 'node-transfer-function-definition';
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
        <h2 className="text-2xl font-bold text-slate-900">传递函数知识卡片</h2>
        <p className="text-slate-600">10 张卡片串起“定义 → 推导 → 零极点 → 典型环节”</p>
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
            从定义到典型环节，建立直觉。
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Target className="h-5 w-5 text-blue-500" />
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
