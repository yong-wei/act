'use client';

/**
 * Lesson-02 拉氏变换：工程直觉的数学实现 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Waves,
  Compass,
  BookOpen,
  Shuffle,
  FlaskConical,
  ClipboardCheck,
  Sparkles,
  Flag,
  Clock,
} from 'lucide-react';
import { UnifiedTopBar } from '@/components/shared/unified-top-bar';
import { LESSON_02_CONFIG } from '@/resources/interactive-learning/lesson-02/manifest';

const LaplaceBridgeIntro = dynamic(
  () => import('@/resources/interactive-learning/lesson-02/bridge-intro'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载导入..." /> }
);

const LaplaceObjectiveCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-02/objective-card'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载学习目标..." /> }
);

const LaplacePrecheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-02/laplace-precheck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载前测..." /> }
);

const LaplaceKnowledgeDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-02/laplace-knowledge-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const LaplacePropertyMatch = dynamic(
  () => import('@/resources/interactive-learning/lesson-02/laplace-property-match'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载定理匹配..." /> }
);

const LaplaceInverseLab = dynamic(
  () => import('@/resources/interactive-learning/lesson-02/laplace-inverse-lab'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载反变换实验..." /> }
);

const LaplaceExitQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-02/laplace-exit-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测..." /> }
);

const LaplaceSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-02/summary-card'),
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
    id: 'laplace-bridge',
    title: '导入：捷径从哪里来？',
    description: '从 RLC 微分方程出发寻找工程捷径。',
    icon: <Compass className="h-6 w-6" />,
    duration: '5分钟',
    component: 'LaplaceBridgeIntro',
  },
  {
    id: 'laplace-objective',
    title: '目标：s 域直觉清单',
    description: '确认本节课的工程能力目标。',
    icon: <Flag className="h-6 w-6" />,
    duration: '3分钟',
    component: 'LaplaceObjectiveCard',
  },
  {
    id: 'laplace-precheck',
    title: '前测：拉氏直觉自查',
    description: '投票 + 3 题快速诊断。',
    icon: <Waves className="h-6 w-6" />,
    duration: '8分钟',
    component: 'LaplacePrecheck',
  },
  {
    id: 'laplace-knowledge',
    title: '知识卡片：直觉与定理',
    description: '4 张卡片串起核心概念。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '18分钟',
    component: 'LaplaceKnowledgeDeck',
  },
  {
    id: 'laplace-property-match',
    title: '互动：定理速配',
    description: '把时域操作映射到 s 域表达。',
    icon: <Shuffle className="h-6 w-6" />,
    duration: '18分钟',
    component: 'LaplacePropertyMatch',
  },
  {
    id: 'laplace-inverse-lab',
    title: '互动：反变换路线',
    description: '选择最合适的逆变换方法。',
    icon: <FlaskConical className="h-6 w-6" />,
    duration: '18分钟',
    component: 'LaplaceInverseLab',
  },
  {
    id: 'laplace-exit-quiz',
    title: '后测：定理出口检测',
    description: '检验初值/终值与位移定理。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '12分钟',
    component: 'LaplaceExitQuiz',
  },
  {
    id: 'laplace-summary',
    title: '总结与拓展',
    description: '回顾拉氏变换与工程直觉的合流。',
    icon: <Sparkles className="h-6 w-6" />,
    duration: '8分钟',
    component: 'LaplaceSummaryCard',
  },
];

export default function Lesson02Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_02_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'laplace-bridge':
        return <LaplaceBridgeIntro />;
      case 'laplace-objective':
        return <LaplaceObjectiveCard />;
      case 'laplace-precheck':
        return <LaplacePrecheck />;
      case 'laplace-knowledge':
        return <LaplaceKnowledgeDeck />;
      case 'laplace-property-match':
        return <LaplacePropertyMatch />;
      case 'laplace-inverse-lab':
        return <LaplaceInverseLab />;
      case 'laplace-exit-quiz':
        return <LaplaceExitQuiz />;
      case 'laplace-summary':
        return <LaplaceSummaryCard />;
      default:
        return null;
    }
  };

  if (activeModule) {
    const currentModule = MODULES.find((module) => module.id === activeModule);

    return (
      <div className="surface-page min-h-screen">
        <UnifiedTopBar
          title={currentModule?.title ?? 'Lesson-02'}
          backHref="/interactive-learning/lesson-02"
          backLabel="返回模块列表"
          subtitle="Lesson 02 Module"
          onBackClick={() => setActiveModule(null)}
          rightSlot={
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground">
              <Clock className="h-3.5 w-3.5" />
              {currentModule?.duration}
            </div>
          }
        />

        <main className="mx-auto max-w-7xl px-4 py-6">
          {renderActiveModule()}
        </main>
      </div>
    );
  }

  return (
    <div className="surface-page min-h-screen">
      <UnifiedTopBar
        title={metadata.title}
        backHref="/interactive-learning"
        backLabel="返回互动学习"
        subtitle={`Lesson 02 · ${metadata.subtitle}`}
        rightSlot={
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground">
            <Clock className="h-3.5 w-3.5" />
            {metadata.duration} 分钟
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="surface-card flex items-start gap-6 p-8">
          <div className="rounded-2xl bg-amber-500/10 p-4">
            <Waves className="h-12 w-12 text-amber-500 dark:text-amber-300" />
          </div>
          <div className="flex-1">
            <p className="mb-1 text-sm uppercase tracking-widest text-amber-600 dark:text-amber-300">
              Lesson 02 · {metadata.subtitle}
            </p>
            <h1 className="mb-3 text-4xl font-bold text-foreground">{metadata.title}</h1>
            <p className="max-w-2xl text-subtle">{metadata.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {metadata.keywords.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-700 dark:text-amber-200"
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
              className="group rounded-2xl border border-amber-500/20 bg-slate-950/50 p-6 text-left transition hover:border-amber-300/60 hover:bg-slate-950/70"
            >
              <div className="flex items-center gap-3 text-amber-200">
                <div className="rounded-xl bg-amber-500/10 p-2 text-amber-200">
                  {module.icon}
                </div>
                <div className="text-sm text-amber-100/70">{module.duration}</div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-amber-200">
                {module.title}
              </h3>
              <p className="mt-2 text-sm text-amber-100/70">{module.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
