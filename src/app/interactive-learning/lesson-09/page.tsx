'use client';

/**
 * Lesson-09 校正与时域综合 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Sliders,
  ShieldCheck,
  Workflow,
  ClipboardList,
  Clock,
  Ship,
} from 'lucide-react';
import { LESSON_09_CONFIG } from '@/resources/interactive-learning/lesson-09/manifest';

const CorrectionPrecheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-09/correction-precheck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载校正前测..." /> }
);

const CorrectionStrategy = dynamic(
  () => import('@/resources/interactive-learning/lesson-09/correction-strategy'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载校正手段速览..." /> }
);

const TimeDomainSynthesis = dynamic(
  () => import('@/resources/interactive-learning/lesson-09/time-domain-synthesis'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载时域综合流程..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-09/summary-card'),
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
    id: 'correction-precheck',
    title: '前测：校正与时域基础',
    description: '掌握 PD、输出反馈与补偿的基础概念。',
    icon: <ShieldCheck className="h-6 w-6" />,
    duration: '8分钟',
    component: 'CorrectionPrecheck',
  },
  {
    id: 'correction-strategy',
    title: '校正手段速览',
    description: '比较串联校正、输出反馈、前馈与扰动补偿。',
    icon: <Sliders className="h-6 w-6" />,
    duration: '10分钟',
    component: 'CorrectionStrategy',
  },
  {
    id: 'time-domain-synthesis',
    title: '时域综合分析流程',
    description: '从稳定范围到场景验证的系统化步骤。',
    icon: <Workflow className="h-6 w-6" />,
    duration: '10分钟',
    component: 'TimeDomainSynthesis',
  },
  {
    id: 'lesson-summary',
    title: '总结与复盘',
    description: '梳理校正方案与时域验证的核心结论。',
    icon: <ClipboardList className="h-6 w-6" />,
    duration: '5分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson09Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_09_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'correction-precheck':
        return <CorrectionPrecheck />;
      case 'correction-strategy':
        return <CorrectionStrategy />;
      case 'time-domain-synthesis':
        return <TimeDomainSynthesis />;
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
          <div className="p-4 bg-amber-500/10 rounded-2xl">
            <Ship className="h-12 w-12 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-amber-400 mb-1">
              Lesson 09 · {metadata.subtitle}
            </p>
            <h1 className="text-3xl font-bold text-white mb-2">{metadata.title}</h1>
            <p className="text-slate-400 max-w-2xl">{metadata.description}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {metadata.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="px-3 py-1 rounded-full text-xs bg-amber-500/10 text-amber-300"
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
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-left transition hover:border-amber-500/60"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 text-amber-400">
                  {module.icon}
                  <h3 className="text-lg font-semibold text-white">{module.title}</h3>
                </div>
                <span className="text-xs text-slate-400">{module.duration}</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">{module.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
