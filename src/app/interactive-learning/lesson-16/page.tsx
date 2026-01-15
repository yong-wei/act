'use client';

/**
 * Lesson-16 非线性系统与描述函数基础 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Shuffle,
  BookOpen,
  Compass,
  Waves,
  ClipboardCheck,
  Sparkles,
  Clock,
} from 'lucide-react';
import { LESSON_16_CONFIG } from '@/resources/interactive-learning/lesson-16/manifest';

const NonlinearPrecheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-16/nonlinear-precheck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载前测..." /> }
);

const NonlinearKnowledgeDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-16/nonlinear-knowledge-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const NonlinearFeatureMatch = dynamic(
  () => import('@/resources/interactive-learning/lesson-16/nonlinear-feature-match'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载特性识别..." /> }
);

const HarmonicLinearizationGuide = dynamic(
  () => import('@/resources/interactive-learning/lesson-16/harmonic-linearization-guide'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载谐波线性化..." /> }
);

const NonlinearExitQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-16/nonlinear-exit-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-16/summary-card'),
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
    id: 'nonlinear-precheck',
    title: '前测：非线性速判',
    description: '快速检查非线性系统的核心概念。',
    icon: <Shuffle className="h-6 w-6" />,
    duration: '10分钟',
    component: 'NonlinearPrecheck',
  },
  {
    id: 'nonlinear-knowledge-deck',
    title: '知识卡片：非线性与描述函数',
    description: '8 张卡片串起非线性现象与描述函数定义。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '20分钟',
    component: 'NonlinearKnowledgeDeck',
  },
  {
    id: 'nonlinear-feature-match',
    title: '互动：非线性特性识别',
    description: '将工程现象映射到典型非线性环节。',
    icon: <Compass className="h-6 w-6" />,
    duration: '18分钟',
    component: 'NonlinearFeatureMatch',
  },
  {
    id: 'harmonic-linearization-guide',
    title: '互动：谐波线性化导航',
    description: '掌握描述函数推导的关键四步。',
    icon: <Waves className="h-6 w-6" />,
    duration: '14分钟',
    component: 'HarmonicLinearizationGuide',
  },
  {
    id: 'nonlinear-exit-quiz',
    title: '后测：描述函数要点',
    description: '用 3 道题巩固非线性基础。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '8分钟',
    component: 'NonlinearExitQuiz',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '回顾非线性系统与描述函数核心框架。',
    icon: <Sparkles className="h-6 w-6" />,
    duration: '4分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson16Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_16_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'nonlinear-precheck':
        return <NonlinearPrecheck />;
      case 'nonlinear-knowledge-deck':
        return <NonlinearKnowledgeDeck />;
      case 'nonlinear-feature-match':
        return <NonlinearFeatureMatch />;
      case 'harmonic-linearization-guide':
        return <HarmonicLinearizationGuide />;
      case 'nonlinear-exit-quiz':
        return <NonlinearExitQuiz />;
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
    <div className="min-h-screen bg-gradient-to-b from-rose-950 to-slate-900">
      <header className="border-b border-rose-700/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3 text-rose-100">
            <Shuffle className="h-6 w-6" />
            <div>
              <h1 className="text-2xl font-bold">{metadata.title}</h1>
              <p className="text-sm text-rose-200">{metadata.subtitle}</p>
            </div>
          </div>
          <Link href="/interactive-learning" className="text-sm text-rose-200 hover:text-white">
            返回互动学习
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 text-rose-100">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div>
            <p className="text-rose-200 text-sm">{metadata.description}</p>
            <div className="mt-4 grid gap-3">
              {metadata.learningObjectives.map((item) => (
                <div key={item} className="rounded-xl border border-rose-700/40 bg-rose-900/40 px-4 py-3 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-rose-700/40 bg-rose-900/40 p-5">
            <div className="flex items-center gap-2 text-sm text-rose-200">
              <Clock className="h-4 w-4" />
              课程时长 {metadata.duration} 分钟
            </div>
            <div className="mt-4 space-y-2 text-sm text-rose-200">
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
              className="rounded-2xl border border-rose-700/40 bg-rose-900/40 p-5 text-left transition hover:border-rose-500/60"
            >
              <div className="flex items-center gap-3 text-rose-100">
                <div className="rounded-xl bg-rose-500/20 p-2 text-rose-200">{module.icon}</div>
                <div>
                  <h3 className="text-lg font-semibold">{module.title}</h3>
                  <p className="text-xs text-rose-200">{module.duration}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-rose-200">{module.description}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
