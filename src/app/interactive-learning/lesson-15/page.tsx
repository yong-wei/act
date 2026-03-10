'use client';

/**
 * Lesson-15 串联校正与滞后超前 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Sliders,
  BookOpen,
  Compass,
  Workflow,
  Eye,
  ClipboardCheck,
  Sparkles,
  Clock,
} from 'lucide-react';
import { LESSON_15_CONFIG } from '@/resources/interactive-learning/lesson-15/manifest';

const SeriesPrecheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-15/series-precheck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载前测..." /> }
);

const SeriesKnowledgeDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-15/series-knowledge-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const SeriesStrategyLab = dynamic(
  () => import('@/resources/interactive-learning/lesson-15/series-strategy-lab'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载策略实验室..." /> }
);

const LagLeadWorkshop = dynamic(
  () => import('@/resources/interactive-learning/lesson-15/lag-lead-workshop'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载流程拼图..." /> }
);

const BodePlotRecognition = dynamic(
  () => import('@/resources/interactive-learning/lesson-12/bode-plot-recognition'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载伯德图判读..." /> }
);

const SeriesExitQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-15/series-exit-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-15/summary-card'),
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
    id: 'series-precheck',
    title: '前测：串联校正速判',
    description: '检查超前/滞后/联合校正的基础概念。',
    icon: <Sliders className="h-6 w-6" />,
    duration: '10分钟',
    component: 'SeriesPrecheck',
  },
  {
    id: 'series-knowledge-deck',
    title: '知识卡片：串联校正与滞后超前',
    description: '8 张卡片串起超前、滞后与联合设计。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '20分钟',
    component: 'SeriesKnowledgeDeck',
  },
  {
    id: 'series-strategy-lab',
    title: '互动：校正策略实验室',
    description: '根据场景选择超前/滞后/联合校正方案。',
    icon: <Compass className="h-6 w-6" />,
    duration: '18分钟',
    component: 'SeriesStrategyLab',
  },
  {
    id: 'lag-lead-workshop',
    title: '互动：滞后-超前流程拼图',
    description: '按正确顺序拼接联合设计流程。',
    icon: <Workflow className="h-6 w-6" />,
    duration: '18分钟',
    component: 'LagLeadWorkshop',
  },
  {
    id: 'bode-plot-recognition',
    title: '复用：伯德图判读',
    description: '识别穿越频率与幅相变化，为校正做准备。',
    icon: <Eye className="h-6 w-6" />,
    duration: '12分钟',
    component: 'BodePlotRecognition',
  },
  {
    id: 'series-exit-quiz',
    title: '后测：滞后超前速测',
    description: '用 3 道题复盘串联校正关键点。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '8分钟',
    component: 'SeriesExitQuiz',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '回顾串联校正的设计主线与注意事项。',
    icon: <Sparkles className="h-6 w-6" />,
    duration: '4分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson15Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_15_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'series-precheck':
        return <SeriesPrecheck />;
      case 'series-knowledge-deck':
        return <SeriesKnowledgeDeck />;
      case 'series-strategy-lab':
        return <SeriesStrategyLab />;
      case 'lag-lead-workshop':
        return <LagLeadWorkshop />;
      case 'bode-plot-recognition':
        return <BodePlotRecognition />;
      case 'series-exit-quiz':
        return <SeriesExitQuiz />;
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-slate-900">
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
            <Sliders className="h-12 w-12 text-emerald-300" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-emerald-300 mb-1">
              Lesson 15 · {metadata.subtitle}
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
              className="group rounded-2xl border border-emerald-500/20 bg-emerald-950/40 p-6 text-left transition hover:border-emerald-300/60 hover:bg-emerald-950/60"
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
