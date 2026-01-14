'use client';

/**
 * Lesson-04 传递函数与控制系统数学模型 页面入口
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
  Sliders,
  Sparkles,
  Clock,
} from 'lucide-react';
import { LESSON_04_CONFIG } from '@/resources/interactive-learning/lesson-04/manifest';

const TransferPrecheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-04/transfer-precheck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载前测..." /> }
);

const TransferKnowledgeDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-04/transfer-knowledge-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const TransferDerivationLab = dynamic(
  () => import('@/resources/interactive-learning/lesson-04/transfer-derivation-lab'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载推导演练..." /> }
);

const TransferElementWorkshop = dynamic(
  () => import('@/resources/interactive-learning/lesson-04/transfer-element-workshop'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载环节工作坊..." /> }
);

const TransferExitQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-04/transfer-exit-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-04/summary-card'),
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
    id: 'transfer-precheck',
    title: '前测：传递函数概念速判',
    description: '快速检查定义、阶次与典型环节理解。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '10分钟',
    component: 'TransferPrecheck',
  },
  {
    id: 'transfer-knowledge-deck',
    title: '知识卡片：传递函数核心概念',
    description: '10 张卡片串起定义、零极点、系统阶次与典型环节。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '24分钟',
    component: 'TransferKnowledgeDeck',
  },
  {
    id: 'transfer-derivation-lab',
    title: '互动：传函推导演练',
    description: '从微分方程出发推导 RLC、机械、电机系统的传函。',
    icon: <Workflow className="h-6 w-6" />,
    duration: '20分钟',
    component: 'TransferDerivationLab',
  },
  {
    id: 'transfer-element-workshop',
    title: '互动：典型环节工作坊',
    description: '根据传函形式识别比例、积分、一阶惯性与二阶振荡。',
    icon: <Sliders className="h-6 w-6" />,
    duration: '20分钟',
    component: 'TransferElementWorkshop',
  },
  {
    id: 'transfer-exit-quiz',
    title: '后测：传函速测',
    description: '用 3 道题巩固零极点与 MATLAB 工具使用。',
    icon: <ClipboardList className="h-6 w-6" />,
    duration: '10分钟',
    component: 'TransferExitQuiz',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '回顾传递函数主线与后续学习建议。',
    icon: <Sparkles className="h-6 w-6" />,
    duration: '6分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson04Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_04_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'transfer-precheck':
        return <TransferPrecheck />;
      case 'transfer-knowledge-deck':
        return <TransferKnowledgeDeck />;
      case 'transfer-derivation-lab':
        return <TransferDerivationLab />;
      case 'transfer-element-workshop':
        return <TransferElementWorkshop />;
      case 'transfer-exit-quiz':
        return <TransferExitQuiz />;
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
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-slate-900">
      <header className="border-b border-blue-700/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/interactive-learning"
            className="flex items-center gap-2 text-sm text-blue-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回互动学习
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-blue-200">
              <Clock className="h-4 w-4" />
              <span>{metadata.duration} 分钟</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-start gap-6">
          <div className="p-4 bg-blue-500/10 rounded-2xl">
            <BookOpen className="h-8 w-8 text-blue-200" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{metadata.title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-blue-200/80">{metadata.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {metadata.keywords.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-200"
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
              className="group rounded-2xl border border-blue-500/20 bg-white/5 p-5 text-left transition-all hover:border-blue-400/60 hover:bg-white/10"
            >
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-blue-500/20 p-3 text-blue-200">
                  {module.icon}
                </div>
                <span className="text-xs text-blue-200/70">{module.duration}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{module.title}</h3>
              <p className="mt-2 text-sm text-blue-200/70">{module.description}</p>
              <div className="mt-4 text-xs text-blue-200/60">点击进入</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
