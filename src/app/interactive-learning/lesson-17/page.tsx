'use client';

/**
 * Lesson-17 描述函数分析法与自振判别 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Shuffle,
  BookOpen,
  Compass,
  GitBranch,
  ClipboardCheck,
  Sparkles,
  Clock,
} from 'lucide-react';
import { LESSON_17_CONFIG } from '@/resources/interactive-learning/lesson-17/manifest';

const DfPrecheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-17/df-precheck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载前测..." /> }
);

const DfKnowledgeDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-17/df-knowledge-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const NegativeInverseWorkshop = dynamic(
  () => import('@/resources/interactive-learning/lesson-17/negative-inverse-workshop'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载负倒工作坊..." /> }
);

const LimitCycleLab = dynamic(
  () => import('@/resources/interactive-learning/lesson-17/limit-cycle-lab'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载自振实验室..." /> }
);

const DfExitQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-17/df-exit-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-17/summary-card'),
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
    id: 'df-precheck',
    title: '前测：判别要点速查',
    description: '复习描述函数分析的结构与判别前提。',
    icon: <Shuffle className="h-6 w-6" />,
    duration: '10分钟',
    component: 'DfPrecheck',
  },
  {
    id: 'df-knowledge-deck',
    title: '知识卡片：交点判别',
    description: '7 张卡片贯通负倒描述函数与自振分析。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '20分钟',
    component: 'DfKnowledgeDeck',
  },
  {
    id: 'negative-inverse-workshop',
    title: '互动：负倒描述函数工作坊',
    description: '掌握典型非线性特性的 -1/N(A) 形态。',
    icon: <GitBranch className="h-6 w-6" />,
    duration: '14分钟',
    component: 'NegativeInverseWorkshop',
  },
  {
    id: 'limit-cycle-lab',
    title: '互动：自振判别实验室',
    description: '用交点与扰动判断自振稳定性。',
    icon: <Compass className="h-6 w-6" />,
    duration: '16分钟',
    component: 'LimitCycleLab',
  },
  {
    id: 'df-exit-quiz',
    title: '后测：自振判别速测',
    description: '巩固交点判别与参数求解逻辑。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '8分钟',
    component: 'DfExitQuiz',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '复盘描述函数分析法的关键流程。',
    icon: <Sparkles className="h-6 w-6" />,
    duration: '4分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson17Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_17_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'df-precheck':
        return <DfPrecheck />;
      case 'df-knowledge-deck':
        return <DfKnowledgeDeck />;
      case 'negative-inverse-workshop':
        return <NegativeInverseWorkshop />;
      case 'limit-cycle-lab':
        return <LimitCycleLab />;
      case 'df-exit-quiz':
        return <DfExitQuiz />;
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
    <div className="min-h-screen bg-gradient-to-b from-fuchsia-950 to-slate-900">
      <header className="border-b border-fuchsia-700/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3 text-fuchsia-100">
            <Shuffle className="h-6 w-6" />
            <div>
              <h1 className="text-2xl font-bold">{metadata.title}</h1>
              <p className="text-sm text-fuchsia-200">{metadata.subtitle}</p>
            </div>
          </div>
          <Link href="/interactive-learning" className="text-sm text-fuchsia-200 hover:text-white">
            返回互动学习
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 text-fuchsia-100">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div>
            <p className="text-fuchsia-200 text-sm">{metadata.description}</p>
            <div className="mt-4 grid gap-3">
              {metadata.learningObjectives.map((item) => (
                <div key={item} className="rounded-xl border border-fuchsia-700/40 bg-fuchsia-900/40 px-4 py-3 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-fuchsia-700/40 bg-fuchsia-900/40 p-5">
            <div className="flex items-center gap-2 text-sm text-fuchsia-200">
              <Clock className="h-4 w-4" />
              课程时长 {metadata.duration} 分钟
            </div>
            <div className="mt-4 space-y-2 text-sm text-fuchsia-200">
              <div>难度：{metadata.difficulty}</div>
              <div>前置课程：{metadata.prerequisites.join('、')}</div>
              <div>关键词：{metadata.keywords.join('、')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="grid gap-4 md:grid-cols-2">
          {MODULES.map((module) => (
            <button
              key={module.id}
              onClick={() => handleModuleSelect(module.id)}
              className="rounded-2xl border border-fuchsia-700/40 bg-fuchsia-900/40 p-5 text-left transition hover:border-fuchsia-500/60"
            >
              <div className="flex items-center gap-3 text-fuchsia-100">
                <div className="rounded-xl bg-fuchsia-500/20 p-2 text-fuchsia-200">{module.icon}</div>
                <div>
                  <h3 className="text-lg font-semibold">{module.title}</h3>
                  <p className="text-xs text-fuchsia-200">{module.duration}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-fuchsia-200">{module.description}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
