'use client';

/**
 * Lesson-07 衰减振荡·欠阻尼二阶系统 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  BookOpen,
  Target,
  Activity,
  Gauge,
  Award,
  ClipboardList,
  Clock,
  Waves,
} from 'lucide-react';
import { LESSON_07_CONFIG } from '@/resources/interactive-learning/lesson-07/manifest';

const DampingQuickCheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-07/damping-quick-check'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载欠阻尼速判..." /> }
);

const SecondOrderTheoryDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-07/theory-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载标准型知识卡..." /> }
);

const ResponseExplorer = dynamic(
  () => import('@/resources/interactive-learning/lesson-07/response-explorer'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载衰减振荡实验室..." /> }
);

const ParameterChallenge = dynamic(
  () => import('@/resources/interactive-learning/lesson-07/parameter-challenge'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载参数挑战..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-07/summary-card'),
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
    id: 'damping-quick-check',
    title: '前测：欠阻尼速判',
    description: '用 6 个问题快速检测标准型与欠阻尼概念。',
    icon: <Target className="h-6 w-6" />,
    duration: '10分钟',
    component: 'DampingQuickCheck',
  },
  {
    id: 'second-order-theory',
    title: '二阶系统标准型',
    description: '掌握标准型、极点几何与性能指标公式。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '25分钟',
    component: 'SecondOrderTheoryDeck',
  },
  {
    id: 'response-explorer',
    title: '衰减振荡实验室',
    description: '拖动阻尼比与自然频率观察响应曲线变化。',
    icon: <Activity className="h-6 w-6" />,
    duration: '30分钟',
    component: 'ResponseExplorer',
  },
  {
    id: 'parameter-challenge',
    title: '参数匹配挑战',
    description: '根据目标指标调整参数并提交评分。',
    icon: <Award className="h-6 w-6" />,
    duration: '8分钟',
    component: 'ParameterChallenge',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '复盘关键公式与课后思考。',
    icon: <ClipboardList className="h-6 w-6" />,
    duration: '5分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson07Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_07_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'damping-quick-check':
        return <DampingQuickCheck />;
      case 'second-order-theory':
        return <SecondOrderTheoryDeck />;
      case 'response-explorer':
        return <ResponseExplorer />;
      case 'parameter-challenge':
        return <ParameterChallenge />;
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
          <div className="p-4 bg-emerald-500/10 rounded-2xl">
            <Waves className="h-12 w-12 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-emerald-400 mb-1">
              Lesson 07 · {metadata.subtitle}
            </p>
            <h1 className="text-3xl font-bold text-white mb-2">{metadata.title}</h1>
            <p className="text-slate-400 max-w-2xl">{metadata.description}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {metadata.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="px-2.5 py-1 bg-slate-800/50 rounded-full text-xs text-slate-300"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white mb-3">课程导航</h2>
            <div className="space-y-3">
              {MODULES.map((module) => (
                <button
                  key={module.id}
                  onClick={() => handleModuleSelect(module.id)}
                  className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-emerald-500/60 hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        {module.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{module.title}</p>
                        <p className="text-xs text-slate-400">{module.description}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{module.duration}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">课堂目标</h2>
            <ul className="space-y-3 text-sm text-slate-300">
              {metadata.learningObjectives.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Gauge className="h-4 w-4 text-emerald-400 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
