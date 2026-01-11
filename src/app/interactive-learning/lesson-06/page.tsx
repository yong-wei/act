'use client';

/**
 * Lesson-06 控制奥德赛·指标裁判席 页面入口
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Play,
  BookOpen,
  Target,
  Award,
  ChevronRight,
  Clock,
  Gauge,
  Ship,
} from 'lucide-react';
import { LESSON_06_CONFIG } from '@/resources/interactive-learning/lesson-06/manifest';

const MetricQuickCheck = dynamic(
  () => import('@/resources/interactive-learning/lesson-06/metric-quick-check'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载指标速判..." /> }
);

const MetricHandbookCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-06/metric-handbook'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载指标裁判手册..." /> }
);

const JudgeBenchSim = dynamic(
  () => import('@/resources/interactive-learning/lesson-06/judge-bench-sim'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载裁判席计分器..." /> }
);

const AssessmentProbe = dynamic(
  () => import('@/components/classroom').then(m => m.AssessmentProbe),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载评估模块..." /> }
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
    id: 'metric-quick-check',
    title: '前测：指标速判',
    description: '识别上升时间、峰值时间、调节时间与超调量',
    icon: <Target className="h-6 w-6" />,
    duration: '5分钟',
    component: 'MetricQuickCheck',
  },
  {
    id: 'metric-handbook',
    title: '指标裁判手册',
    description: '掌握时域性能指标的定义与判读方法',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '6分钟',
    component: 'MetricHandbookCard',
  },
  {
    id: 'judge-bench',
    title: '裁判席计分器',
    description: '调节阻尼比与响应速度，挑战裁判标准',
    icon: <Gauge className="h-6 w-6" />,
    duration: '15分钟',
    component: 'JudgeBenchSim',
  },
  {
    id: 'assessment',
    title: '后测评估',
    description: '提交控制参数，获取裁判评分与反馈',
    icon: <Award className="h-6 w-6" />,
    duration: '3分钟',
    component: 'AssessmentProbe',
  },
];

export default function Lesson06Page() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { metadata } = LESSON_06_CONFIG;

  const handleModuleSelect = useCallback((moduleId: string) => {
    setActiveModule(moduleId);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'metric-quick-check':
        return <MetricQuickCheck />;
      case 'metric-handbook':
        return <MetricHandbookCard />;
      case 'judge-bench':
        return <JudgeBenchSim />;
      case 'assessment':
        return (
          <AssessmentProbe
            config={LESSON_06_CONFIG.resources['quiz-judge-assessment'] as never}
            mode="play"
          />
        );
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
            <Ship className="h-12 w-12 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-emerald-400 mb-1">
              Lesson 06 · {metadata.subtitle}
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

        <div className="mt-8 p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-emerald-400" />
            <h2 className="font-semibold text-white">学习目标</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {metadata.learningObjectives.map((objective, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-sm flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-sm text-slate-300">{objective}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="text-lg font-semibold text-white mb-4">选择学习模块</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODULES.map((module) => (
            <button
              key={module.id}
              onClick={() => handleModuleSelect(module.id)}
              className="group p-5 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all text-left"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-slate-700/50 rounded-lg text-slate-400 group-hover:text-white group-hover:bg-emerald-500/20 transition-colors">
                  {module.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-white">{module.title}</h3>
                    <span className="text-xs text-slate-500">{module.duration}</span>
                  </div>
                  <p className="text-sm text-slate-400">{module.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-white transition-colors" />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/25">
            <Play className="h-5 w-5" />
            开始完整课程流程
          </button>
          <p className="mt-3 text-sm text-slate-500">
            按照 BOPPPS 教学设计顺序完成所有模块
          </p>
        </div>
      </div>
    </div>
  );
}
