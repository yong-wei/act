'use client';

/**
 * Lesson-13 幅相特性与稳定判据 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Radar,
  BookOpen,
  Eye,
  Shield,
  ClipboardCheck,
  Sparkles,
  Clock,
} from 'lucide-react';
import { LESSON_13_CONFIG } from '@/resources/interactive-learning/lesson-13/manifest';

const PhaseConceptQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-13/phase-concept-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载概念速判..." /> }
);

const PhaseKnowledgeDeck = dynamic(
  () => import('@/resources/interactive-learning/lesson-13/phase-knowledge-deck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const BodePlotRecognition = dynamic(
  () => import('@/resources/interactive-learning/lesson-12/bode-plot-recognition'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载伯德图判读..." /> }
);

const NyquistStabilityScenario = dynamic(
  () => import('@/resources/interactive-learning/lesson-13/nyquist-stability-scenario'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载判稳场景..." /> }
);

const PhaseStabilityExitQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-13/phase-stability-exit-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-13/summary-card'),
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
    id: 'phase-concept-quiz',
    title: '前测：幅相概念速判',
    description: '快速检查 Nyquist 图与穿越频率的基础理解。',
    icon: <Radar className="h-6 w-6" />,
    duration: '10分钟',
    component: 'PhaseConceptQuiz',
  },
  {
    id: 'phase-knowledge-deck',
    title: '知识卡片：幅相特性核心',
    description: '8 张卡片梳理幅相特性与稳定判据要点。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '20分钟',
    component: 'PhaseKnowledgeDeck',
  },
  {
    id: 'bode-plot-recognition',
    title: '互动：伯德图判读',
    description: '用幅频曲线识别典型环节与相位变化趋势。',
    icon: <Eye className="h-6 w-6" />,
    duration: '12分钟',
    component: 'BodePlotRecognition',
  },
  {
    id: 'nyquist-stability-scenario',
    title: '互动：Nyquist 判稳场景',
    description: '结合包围次数与右半平面极点数判断稳定。',
    icon: <Shield className="h-6 w-6" />,
    duration: '18分钟',
    component: 'NyquistStabilityScenario',
  },
  {
    id: 'phase-stability-exit-quiz',
    title: '后测：对数判据速测',
    description: '用 3 道题复盘对数判据与判稳结论。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '8分钟',
    component: 'PhaseStabilityExitQuiz',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '复盘 Nyquist 判据的频域逻辑与课后思考。',
    icon: <Sparkles className="h-6 w-6" />,
    duration: '6分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson13Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_13_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'phase-concept-quiz':
        return <PhaseConceptQuiz />;
      case 'phase-knowledge-deck':
        return <PhaseKnowledgeDeck />;
      case 'bode-plot-recognition':
        return <BodePlotRecognition />;
      case 'nyquist-stability-scenario':
        return <NyquistStabilityScenario />;
      case 'phase-stability-exit-quiz':
        return <PhaseStabilityExitQuiz />;
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
          <div className="p-4 bg-cyan-500/10 rounded-2xl">
            <Radar className="h-12 w-12 text-cyan-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-cyan-400 mb-1">
              Lesson 13 · {metadata.subtitle}
            </p>
            <h1 className="text-4xl font-bold text-white mb-3">{metadata.title}</h1>
            <p className="text-slate-300 max-w-2xl">{metadata.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {metadata.keywords.map((tag: string) => (
                <span key={tag} className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
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
              className="group rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-left transition hover:border-cyan-400/60 hover:bg-slate-900"
            >
              <div className="flex items-center gap-3 text-cyan-300">
                <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300">
                  {module.icon}
                </div>
                <div className="text-sm text-slate-400">{module.duration}</div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-cyan-200">
                {module.title}
              </h3>
              <p className="mt-2 text-sm text-slate-400">{module.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
