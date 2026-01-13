'use client';

/**
 * Lesson-14 稳定裕度与三频段 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Shield,
  BookOpen,
  Sliders,
  Radio,
  Eye,
  ClipboardCheck,
  Sparkles,
  Clock,
} from 'lucide-react';
import { LESSON_14_CONFIG } from '@/resources/interactive-learning/lesson-14/manifest';

const MarginQuickCheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-14/margin-quick-check'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载前测..." /> }
);

const MarginKnowledgeDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-14/margin-knowledge-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const MarginTradeoffLab = dynamic(
  () => import('@/resources/interactive-learning/lesson-14/margin-tradeoff-lab'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载稳定裕度实验室..." /> }
);

const ThreeBandStudio = dynamic(
  () => import('@/resources/interactive-learning/lesson-14/three-band-studio'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载三频段工作台..." /> }
);

const BodePlotRecognition = dynamic(
  () => import('@/resources/interactive-learning/lesson-12/bode-plot-recognition'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载伯德图判读..." /> }
);

const MarginExitQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-14/margin-exit-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-14/summary-card'),
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
    id: 'margin-quick-check',
    title: '前测：稳定裕度速判',
    description: '检查相角/幅值裕度与穿越频率概念。',
    icon: <Shield className="h-6 w-6" />,
    duration: '10分钟',
    component: 'MarginQuickCheck',
  },
  {
    id: 'margin-knowledge-deck',
    title: '知识卡片：稳定裕度与三频段',
    description: '8 张卡片贯通稳定裕度与三频段分工。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '18分钟',
    component: 'MarginKnowledgeDeck',
  },
  {
    id: 'margin-tradeoff-lab',
    title: '互动：稳定裕度策略实验室',
    description: '为不同任务配置相角/幅值裕度目标。',
    icon: <Sliders className="h-6 w-6" />,
    duration: '15分钟',
    component: 'MarginTradeoffLab',
  },
  {
    id: 'three-band-studio',
    title: '互动：三频段调优工作台',
    description: '低/中/高频段分配，匹配性能诉求。',
    icon: <Radio className="h-6 w-6" />,
    duration: '15分钟',
    component: 'ThreeBandStudio',
  },
  {
    id: 'bode-plot-recognition',
    title: '复用：伯德图判读',
    description: '用幅频曲线识别典型环节与穿越点。',
    icon: <Eye className="h-6 w-6" />,
    duration: '12分钟',
    component: 'BodePlotRecognition',
  },
  {
    id: 'margin-exit-quiz',
    title: '后测：裕度与三频段测验',
    description: '用 3 道题复盘稳定裕度与频段分工。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '8分钟',
    component: 'MarginExitQuiz',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '复盘稳定裕度与宽备窄用的频域视角。',
    icon: <Sparkles className="h-6 w-6" />,
    duration: '4分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson14Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_14_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'margin-quick-check':
        return <MarginQuickCheck />;
      case 'margin-knowledge-deck':
        return <MarginKnowledgeDeck />;
      case 'margin-tradeoff-lab':
        return <MarginTradeoffLab />;
      case 'three-band-studio':
        return <ThreeBandStudio />;
      case 'bode-plot-recognition':
        return <BodePlotRecognition />;
      case 'margin-exit-quiz':
        return <MarginExitQuiz />;
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
    <div className="min-h-screen bg-gradient-to-b from-amber-950 to-slate-900">
      <header className="border-b border-amber-700/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/interactive-learning"
            className="flex items-center gap-2 text-sm text-amber-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回互动学习
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-amber-200">
              <Clock className="h-4 w-4" />
              <span>{metadata.duration} 分钟</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-start gap-6">
          <div className="p-4 bg-amber-500/10 rounded-2xl">
            <Shield className="h-12 w-12 text-amber-300" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-amber-300 mb-1">
              Lesson 14 · {metadata.subtitle}
            </p>
            <h1 className="text-4xl font-bold text-white mb-3">{metadata.title}</h1>
            <p className="text-amber-100/80 max-w-2xl">{metadata.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {metadata.keywords.map((tag: string) => (
                <span key={tag} className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
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
              className="group rounded-2xl border border-amber-500/20 bg-amber-950/40 p-6 text-left transition hover:border-amber-300/60 hover:bg-amber-950/60"
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
