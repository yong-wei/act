'use client';

/**
 * Lesson-05 方框图、信号流图与梅森公式 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Workflow,
  GitBranch,
  Sigma,
  Sparkles,
  Clock,
} from 'lucide-react';
import { LESSON_05_CONFIG } from '@/resources/interactive-learning/lesson-05/manifest';

const BlockDiagramPrecheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-05/block-diagram-precheck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载前测..." /> }
);

const StructureKnowledgeDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-05/structure-knowledge-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const BlockDiagramWorkshop = dynamic(
  () => import('@/resources/interactive-learning/lesson-05/block-diagram-workshop'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载结构图工作坊..." /> }
);

const SignalFlowLab = dynamic(
  () => import('@/resources/interactive-learning/lesson-05/signal-flow-lab'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载信号流图练习..." /> }
);

const MasonLoopChallenge = dynamic(
  () => import('@/resources/interactive-learning/lesson-05/mason-loop-challenge'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载梅森公式挑战..." /> }
);

const StructureExitQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-05/structure-exit-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-05/summary-card'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载课程总结..." /> }
);

function LoadingPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex h-64 items-center justify-center bg-slate-100 rounded-xl">
      <div className="flex items-center gap-3 text-slate-500">
        <div className="h-5 w-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        <span>{text}</span>
      </div>
    </div>
  );
}

interface ModuleOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  duration: string;
  component: string;
}

const MODULES: ModuleOption[] = [
  {
    id: 'block-diagram-precheck',
    title: '前测：结构图元素速判',
    description: '确认信号线、引出点、综合点与等效法则。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '10分钟',
    component: 'BlockDiagramPrecheck',
  },
  {
    id: 'structure-knowledge-deck',
    title: '知识卡片：结构图与拓扑',
    description: '13 张卡片串起结构图、信号流图与梅森公式。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '12分钟',
    component: 'StructureKnowledgeDeck',
  },
  {
    id: 'block-diagram-workshop',
    title: '互动：结构图化简路线',
    description: '找典型、解交叉、由内向外完成化简。',
    icon: <Workflow className="h-6 w-6" />,
    duration: '10分钟',
    component: 'BlockDiagramWorkshop',
  },
  {
    id: 'signal-flow-lab',
    title: '互动：信号流图速练',
    description: '节点类型、前向通路与支路增益快速确认。',
    icon: <GitBranch className="h-6 w-6" />,
    duration: '9分钟',
    component: 'SignalFlowLab',
  },
  {
    id: 'mason-loop-challenge',
    title: '互动：梅森公式数圈圈',
    description: '数回路、找互不接触回路，计算 Delta。',
    icon: <Sigma className="h-6 w-6" />,
    duration: '9分钟',
    component: 'MasonLoopChallenge',
  },
  {
    id: 'structure-exit-quiz',
    title: '后测：结构图与梅森公式',
    description: '3 道题检验移位规则、节点概念与 Delta_k。',
    icon: <ClipboardList className="h-6 w-6" />,
    duration: '8分钟',
    component: 'StructureExitQuiz',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '回顾拓扑主线与后续学习建议。',
    icon: <Sparkles className="h-6 w-6" />,
    duration: '6分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson05Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_05_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'block-diagram-precheck':
        return <BlockDiagramPrecheck />;
      case 'structure-knowledge-deck':
        return <StructureKnowledgeDeck />;
      case 'block-diagram-workshop':
        return <BlockDiagramWorkshop />;
      case 'signal-flow-lab':
        return <SignalFlowLab />;
      case 'mason-loop-challenge':
        return <MasonLoopChallenge />;
      case 'structure-exit-quiz':
        return <StructureExitQuiz />;
      case 'lesson-summary':
        return <LessonSummaryCard />;
      default:
        return null;
    }
  };

  if (activeModule) {
    const currentModule = MODULES.find((module) => module.id === activeModule);

    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              返回模块列表
            </button>
            <div className="text-center">
              <h1 className="font-semibold text-slate-900">{currentModule?.title}</h1>
            </div>
            <div className="w-20" />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6">
          {renderActiveModule()}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-950 to-slate-900">
      <header className="border-b border-teal-700/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/interactive-learning"
            className="flex items-center gap-2 text-sm text-teal-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回互动学习
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-teal-200">
              <Clock className="h-4 w-4" />
              <span>{metadata.duration} 分钟</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-start gap-6">
          <div className="p-4 bg-teal-500/10 rounded-2xl">
            <BookOpen className="h-8 w-8 text-teal-200" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{metadata.title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-teal-200/80">{metadata.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {metadata.keywords.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-teal-500/10 px-3 py-1 text-xs text-teal-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {MODULES.map((module) => (
            <button
              key={module.id}
              onClick={() => handleModuleSelect(module.id)}
              className="group rounded-2xl border border-teal-500/20 bg-white/5 p-5 text-left transition-all hover:border-teal-400/60 hover:bg-white/10"
            >
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-teal-500/20 p-3 text-teal-200">
                  {module.icon}
                </div>
                <span className="text-xs text-teal-200/70">{module.duration}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{module.title}</h3>
              <p className="mt-2 text-sm text-teal-200/70">{module.description}</p>
              <div className="mt-4 text-xs text-teal-200/60">点击进入</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
