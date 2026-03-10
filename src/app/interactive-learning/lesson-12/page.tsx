'use client';

/**
 * Lesson-12 频率特性与伯德图 页面入口
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Radio,
  ListOrdered,
  TrendingUp,
  Eye,
  ClipboardCheck,
  BookOpen,
  Clock,
  Ship,
} from 'lucide-react';
import { LESSON_12_CONFIG } from '@/resources/interactive-learning/lesson-12/manifest';

const FrequencyPrecheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-12/frequency-precheck'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载频率响应速判..." /> }
);

const BodeStepSorter = dynamic(
  () => import('@/resources/interactive-learning/lesson-12/bode-step-sorter'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载绘制步骤排序..." /> }
);

const BodeSlopePuzzle = dynamic(
  () => import('@/resources/interactive-learning/lesson-12/bode-slope-puzzle'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载斜率叠加拼图..." /> }
);

const BodePlotRecognition = dynamic(
  () => import('@/resources/interactive-learning/lesson-12/bode-plot-recognition'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载伯德图识别..." /> }
);

const BodePostQuiz = dynamic(
  () => import('@/resources/interactive-learning/lesson-12/bode-post-quiz'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载后测小测..." /> }
);

const LessonSummaryCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-12/summary-card'),
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
    id: 'frequency-precheck',
    title: '前测：频率响应速判',
    description: '检查频率响应、dB 与典型斜率的基础掌握。',
    icon: <Radio className="h-6 w-6" />,
    duration: '10分钟',
    component: 'FrequencyPrecheck',
  },
  {
    id: 'bode-step-sorter',
    title: '绘制步骤排序',
    description: '梳理伯德图绘制流程并建立顺序感。',
    icon: <ListOrdered className="h-6 w-6" />,
    duration: '10分钟',
    component: 'BodeStepSorter',
  },
  {
    id: 'bode-slope-puzzle',
    title: '斜率叠加拼图',
    description: '拖拽斜率卡片，完成转折频率分段叠加。',
    icon: <TrendingUp className="h-6 w-6" />,
    duration: '15分钟',
    component: 'BodeSlopePuzzle',
  },
  {
    id: 'bode-plot-recognition',
    title: '伯德图识别',
    description: '根据幅频曲线识别典型环节与谐振峰。',
    icon: <Eye className="h-6 w-6" />,
    duration: '12分钟',
    component: 'BodePlotRecognition',
  },
  {
    id: 'bode-post-quiz',
    title: '后测：关键步骤复盘',
    description: '用 3 道题快速验证绘图要点。',
    icon: <ClipboardCheck className="h-6 w-6" />,
    duration: '6分钟',
    component: 'BodePostQuiz',
  },
  {
    id: 'lesson-summary',
    title: '总结与拓展',
    description: '复盘频域分析关键词与课后思考。',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '5分钟',
    component: 'LessonSummaryCard',
  },
];

export default function Lesson12Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_12_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'frequency-precheck':
        return <FrequencyPrecheck />;
      case 'bode-step-sorter':
        return <BodeStepSorter />;
      case 'bode-slope-puzzle':
        return <BodeSlopePuzzle />;
      case 'bode-plot-recognition':
        return <BodePlotRecognition />;
      case 'bode-post-quiz':
        return <BodePostQuiz />;
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
            <Ship className="h-12 w-12 text-cyan-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-cyan-400 mb-1">
              Lesson 12 · {metadata.subtitle}
            </p>
            <h1 className="text-3xl font-bold text-white mb-2">{metadata.title}</h1>
            <p className="text-slate-400 max-w-2xl">{metadata.description}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {metadata.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="px-3 py-1 rounded-full text-xs bg-cyan-500/10 text-cyan-300"
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
              className="group rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-left transition-all hover:border-cyan-500/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 group-hover:bg-cyan-500/20">
                  {module.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{module.title}</h3>
                  <p className="text-xs text-slate-400">{module.duration}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-400">{module.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
