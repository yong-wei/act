'use client';

/**
 * Lesson-01 反馈：控制原理的核心思想 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Anchor,
  Compass,
  BookOpen,
  Shuffle,
  Layers,
  ClipboardCheck,
  Sparkles,
  Flag,
  Clock,
} from 'lucide-react';
import { LESSON_01_CONFIG } from '@/resources/interactive-learning/lesson-01/manifest';

const FeedbackBridgeIntro = dynamic(
  () => import('@/resources/interactive-learning/lesson-01/bridge-intro'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载导入..." /> }
);

const FeedbackObjectiveCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-01/objective-card'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载学习目标..." /> }
);

const FeedbackPrecheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-01/feedback-precheck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载前测..." /> }
);

const FeedbackKnowledgeDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-01/feedback-knowledge-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const ComponentRoleMatch = dynamic(
  () => import('@/resources/interactive-learning/lesson-01/component-role-match'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载组件匹配..." /> }
);

const LoopScenarioLab = dynamic(
  () => import('@/resources/interactive-learning/lesson-01/loop-scenario-lab'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载场景实验..." /> }
);

const FeedbackExitQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-01/feedback-exit-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测..." /> }
);

const FeedbackSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-01/summary-card'),
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
    id: 'feedback-bridge',
    title: '导入：烧水的控制语言',
    description: '从生活场景识别反馈动作。',
    icon: <Compass className="h-6 w-6" />,
    duration: '5分钟',
    component: 'FeedbackBridgeIntro',
  },
  {
    id: 'feedback-objective',
    title: '目标：反馈核心能力',
    description: '确认本节课学习目标。',
    icon: <Flag className="h-6 w-6" />,
    duration: '3分钟',
    component: 'FeedbackObjectiveCard',
  },
  {
    id: 'feedback-precheck',
    title: '前测：基础概念速判',
    description: '快速检验反馈与闭环基础。',
    icon: <Anchor className="h-6 w-6" />,
    duration: '8分钟',
    component: 'FeedbackPrecheck',
  },
  {
    id: 'feedback-knowledge',
    title: '知识卡片：反馈要素',
    description: '4 张卡片串起控制语言。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '18分钟',
    component: 'FeedbackKnowledgeDeck',
  },
  {
    id: 'feedback-component-match',
    title: '互动：组件职责匹配',
    description: '对象、控制器、执行器与传感器。',
    icon: <Shuffle className="h-6 w-6" />,
    duration: '18分钟',
    component: 'ComponentRoleMatch',
  },
  {
    id: 'feedback-loop-lab',
    title: '互动：场景分类实验',
    description: '识别开环与闭环系统。',
    icon: <Layers className="h-6 w-6" />,
    duration: '18分钟',
    component: 'LoopScenarioLab',
  },
  {
    id: 'feedback-exit-quiz',
    title: '后测：反馈核心要点',
    description: '检验误差与反馈价值。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '12分钟',
    component: 'FeedbackExitQuiz',
  },
  {
    id: 'feedback-summary',
    title: '总结与拓展',
    description: '回顾反馈控制的核心思想。',
    icon: <Sparkles className="h-6 w-6" />,
    duration: '8分钟',
    component: 'FeedbackSummaryCard',
  },
];

export default function Lesson01Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_01_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'feedback-bridge':
        return <FeedbackBridgeIntro />;
      case 'feedback-objective':
        return <FeedbackObjectiveCard />;
      case 'feedback-precheck':
        return <FeedbackPrecheck />;
      case 'feedback-knowledge':
        return <FeedbackKnowledgeDeck />;
      case 'feedback-component-match':
        return <ComponentRoleMatch />;
      case 'feedback-loop-lab':
        return <LoopScenarioLab />;
      case 'feedback-exit-quiz':
        return <FeedbackExitQuiz />;
      case 'feedback-summary':
        return <FeedbackSummaryCard />;
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-slate-900 to-emerald-950">
      <header className="border-b border-emerald-700/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/interactive-learning"
            className="flex items-center gap-2 text-sm text-emerald-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回互动学习
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-emerald-200">
              <Clock className="h-4 w-4" />
              <span>{metadata.duration} 分钟</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-start gap-6">
          <div className="p-4 bg-emerald-500/10 rounded-2xl">
            <Anchor className="h-12 w-12 text-emerald-300" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-emerald-300 mb-1">
              Lesson 01 · {metadata.subtitle}
            </p>
            <h1 className="text-4xl font-bold text-white mb-3">{metadata.title}</h1>
            <p className="text-emerald-100/80 max-w-2xl">{metadata.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {metadata.keywords.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200"
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
              className="group rounded-2xl border border-emerald-500/20 bg-slate-950/50 p-6 text-left transition hover:border-emerald-300/60 hover:bg-slate-950/70"
            >
              <div className="flex items-center gap-3 text-emerald-200">
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-200">
                  {module.icon}
                </div>
                <div className="text-sm text-emerald-100/70">{module.duration}</div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-emerald-200">
                {module.title}
              </h3>
              <p className="mt-2 text-sm text-emerald-100/70">{module.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
