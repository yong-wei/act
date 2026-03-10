'use client';

/**
 * Lesson-03 微分方程与控制系统基础模型 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Atom,
  BookOpen,
  Compass,
  Workflow,
  ClipboardCheck,
  Sparkles,
  Clock,
} from 'lucide-react';
import { LESSON_03_CONFIG } from '@/resources/interactive-learning/lesson-03/manifest';

const DiffPrecheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-03/diff-precheck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载前测..." /> }
);

const DiffKnowledgeDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-03/diff-knowledge-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const ModelingScenarioLab = dynamic(
  () => import('@/resources/interactive-learning/lesson-03/modeling-scenario-lab'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载建模场景..." /> }
);

const ModelingWorkflowPuzzle = dynamic(
  () => import('@/resources/interactive-learning/lesson-03/modeling-workflow-puzzle'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载建模流程..." /> }
);

const DiffExitQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-03/diff-exit-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-03/summary-card'),
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
    id: 'diff-precheck',
    title: '前测：微分方程速判',
    description: '检查建模步骤、模型类型与线性化概念。',
    icon: <Atom className="h-6 w-6" />,
    duration: '10分钟',
    component: 'DiffPrecheck',
  },
  {
    id: 'diff-knowledge-deck',
    title: '知识卡片：微分方程建模',
    description: '8 张卡片串起建模方法与典型案例。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '18分钟',
    component: 'DiffKnowledgeDeck',
  },
  {
    id: 'modeling-scenario-lab',
    title: '互动：建模场景决策',
    description: '根据场景选择机理建模或系统辨识。',
    icon: <Compass className="h-6 w-6" />,
    duration: '16分钟',
    component: 'ModelingScenarioLab',
  },
  {
    id: 'modeling-workflow-puzzle',
    title: '互动：建模流程拼图',
    description: '按正确顺序完成微分方程建模流程。',
    icon: <Workflow className="h-6 w-6" />,
    duration: '16分钟',
    component: 'ModelingWorkflowPuzzle',
  },
  {
    id: 'diff-exit-quiz',
    title: '后测：基础模型速测',
    description: '用 3 道题复盘建模重点。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '8分钟',
    component: 'DiffExitQuiz',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '回顾微分方程建模的核心链路。',
    icon: <Sparkles className="h-6 w-6" />,
    duration: '4分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson03Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_03_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'diff-precheck':
        return <DiffPrecheck />;
      case 'diff-knowledge-deck':
        return <DiffKnowledgeDeck />;
      case 'modeling-scenario-lab':
        return <ModelingScenarioLab />;
      case 'modeling-workflow-puzzle':
        return <ModelingWorkflowPuzzle />;
      case 'diff-exit-quiz':
        return <DiffExitQuiz />;
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
    <div className="min-h-screen bg-gradient-to-b from-sky-950 to-slate-900">
      <header className="border-b border-sky-700/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/interactive-learning"
            className="flex items-center gap-2 text-sm text-sky-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回互动学习
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-sky-200">
              <Clock className="h-4 w-4" />
              <span>{metadata.duration} 分钟</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-start gap-6">
          <div className="p-4 bg-sky-500/10 rounded-2xl">
            <Atom className="h-12 w-12 text-sky-300" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-sky-300 mb-1">
              Lesson 03 · {metadata.subtitle}
            </p>
            <h1 className="text-4xl font-bold text-white mb-3">{metadata.title}</h1>
            <p className="text-sky-100/80 max-w-2xl">{metadata.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {metadata.keywords.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module) => (
            <button
              key={module.id}
              onClick={() => handleModuleSelect(module.id)}
              className="group rounded-2xl border border-sky-500/20 bg-sky-950/40 p-6 text-left transition hover:border-sky-300/60 hover:bg-sky-950/60"
            >
              <div className="flex items-center gap-3 text-sky-200">
                <div className="rounded-xl bg-sky-500/10 p-2 text-sky-200">
                  {module.icon}
                </div>
                <div className="text-sm text-sky-100/70">{module.duration}</div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-sky-200">
                {module.title}
              </h3>
              <p className="mt-2 text-sm text-sky-100/70">{module.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
