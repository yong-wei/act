'use client';

/**
 * Lesson-11 参数根轨迹与图形化思考 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  GitBranch,
  Target,
  Compass,
  ClipboardList,
  Clock,
  Ship,
} from 'lucide-react';
import { LESSON_11_CONFIG } from '@/resources/interactive-learning/lesson-11/manifest';

const ParameterRootLocusDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-11/parameter-root-locus-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载参数根轨迹知识卡..." /> }
);

const GraphicalThinkingWorkshop = dynamic(
  () => import('@/resources/interactive-learning/lesson-11/graphical-thinking-workshop'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载图形化思考工作坊..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-11/summary-card'),
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
    id: 'parameter-root-locus-deck',
    title: '参数根轨迹知识卡',
    description: '掌握广义定义、等效开环与稳定范围判断。',
    icon: <GitBranch className="h-6 w-6" />,
    duration: '25分钟',
    component: 'ParameterRootLocusDeck',
  },
  {
    id: 'graphical-thinking-workshop',
    title: '图形化思考工作坊',
    description: '通过案例问题训练根轨迹分析流程。',
    icon: <Compass className="h-6 w-6" />,
    duration: '25分钟',
    component: 'GraphicalThinkingWorkshop',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '复盘关键结论与课后思考。',
    icon: <ClipboardList className="h-6 w-6" />,
    duration: '5分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson11Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_11_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'parameter-root-locus-deck':
        return <ParameterRootLocusDeck />;
      case 'graphical-thinking-workshop':
        return <GraphicalThinkingWorkshop />;
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      <header className="border-b border-slate-700/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/interactive-learning"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回互动学习
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="h-4 w-4" />
              <span>{metadata.duration} 分钟</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-start gap-6">
          <div className="p-4 bg-violet-500/10 rounded-2xl">
            <Ship className="h-12 w-12 text-violet-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-violet-400 mb-1">
              Lesson 11 · {metadata.subtitle}
            </p>
            <h1 className="text-3xl font-bold text-white mb-2">{metadata.title}</h1>
            <p className="text-slate-400 max-w-2xl">{metadata.description}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {metadata.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="px-3 py-1 rounded-full text-xs bg-violet-500/10 text-violet-300"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {MODULES.map((module) => (
            <button
              key={module.id}
              onClick={() => handleModuleSelect(module.id)}
              className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-left transition hover:border-violet-500/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                    {module.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white">{module.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{module.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-slate-700 px-3 py-1">{module.duration}</span>
                  <span className="inline-flex items-center gap-1 text-violet-300">
                    <Target className="h-3 w-3" />
                    开始
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
