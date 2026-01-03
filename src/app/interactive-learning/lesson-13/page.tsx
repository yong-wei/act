'use client';

/**
 * Lesson-13 柔性之海 页面入口
 *
 * 提供课程的独立访问入口，支持单模块学习和完整流程播放。
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Ship,
  Play,
  BookOpen,
  Target,
  Beaker,
  Wine,
  Award,
  ChevronRight,
  Clock,
  Users,
} from 'lucide-react';
import { LESSON_13_CONFIG } from '@/resources/interactive-learning/lesson-13/manifest';

// 动态导入组件以减少初始加载时间
const PhysicsBuilderSimple = dynamic(
  () => import('@/resources/interactive-learning/lesson-13/physics-builder-simple'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载物理工坊..." /> }
);

const ISO2631MappingCard = dynamic(
  () => import('@/resources/interactive-learning/lesson-13/iso2631-mapping'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载知识卡片..." /> }
);

const CruiseTyphoonSim = dynamic(
  () => import('@/resources/interactive-learning/lesson-13/cruise-typhoon-sim'),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载仿真环境..." /> }
);

const AssessmentProbe = dynamic(
  () => import('@/components/classroom').then(m => m.AssessmentProbe),
  { ssr: false, loading: () => <LoadingPlaceholder text="加载评估模块..." /> }
);

// 加载占位符
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

// 模块选择项
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
    id: 'physics-builder',
    title: '前测：阻尼调节器',
    description: '通过弹簧-阻尼-质量系统理解阻尼比对响应的影响',
    icon: <Beaker className="h-6 w-6" />,
    duration: '5分钟',
    component: 'PhysicsBuilderSimple',
  },
  {
    id: 'iso-mapping',
    title: 'ISO 2631 指标映射',
    description: '理解控制指标与用户体验的对应关系',
    icon: <BookOpen className="h-6 w-6" />,
    duration: '5分钟',
    component: 'ISO2631MappingCard',
  },
  {
    id: 'typhoon-sim',
    title: '香槟塔保卫战',
    description: '在台风避障场景中完成30°紧急转向，保护香槟塔不倒',
    icon: <Wine className="h-6 w-6" />,
    duration: '15分钟',
    component: 'CruiseTyphoonSim',
  },
  {
    id: 'assessment',
    title: '后测评估',
    description: '提交你的控制参数设计，获得系统评分',
    icon: <Award className="h-6 w-6" />,
    duration: '3分钟',
    component: 'AssessmentProbe',
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

  // 渲染活动模块
  const renderActiveModule = () => {
    switch (activeModule) {
      case 'physics-builder':
        return <PhysicsBuilderSimple />;
      case 'iso-mapping':
        return <ISO2631MappingCard showHints />;
      case 'typhoon-sim':
        return <CruiseTyphoonSim embedded showMissionPanel showChampagnePIP />;
      case 'assessment':
        return (
          <AssessmentProbe
            config={LESSON_13_CONFIG.resources['quiz-design-verify'] as never}
            mode="play"
          />
        );
      default:
        return null;
    }
  };

  // 模块详情页
  if (activeModule) {
    const currentModule = MODULES.find((m) => m.id === activeModule);

    return (
      <div className="min-h-screen bg-slate-50">
        {/* 顶部导航 */}
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
            <div className="w-20" /> {/* Spacer */}
          </div>
        </header>

        {/* 模块内容 */}
        <main className="mx-auto max-w-7xl px-4 py-6">
          {renderActiveModule()}
        </main>
      </div>
    );
  }

  // 课程概览页
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* 顶部导航 */}
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

      {/* 课程标题区 */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-start gap-6">
          <div className="p-4 bg-blue-500/10 rounded-2xl">
            <Ship className="h-12 w-12 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-blue-400 mb-1">
              Lesson 13 · {metadata.vessel.name}
            </p>
            <h1 className="text-3xl font-bold text-white mb-2">{metadata.title}</h1>
            <p className="text-slate-400 max-w-2xl">{metadata.description}</p>

            {/* 标签 */}
            <div className="flex flex-wrap gap-2 mt-4">
              {metadata.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="px-2.5 py-1 bg-slate-700/50 rounded-full text-xs text-slate-300"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 学习目标概览 */}
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

      {/* 模块选择 */}
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
                <div className="p-3 bg-slate-700/50 rounded-lg text-slate-400 group-hover:text-white group-hover:bg-blue-500/20 transition-colors">
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

        {/* 开始完整流程按钮 */}
        <div className="mt-8 text-center">
          <button className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/25">
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
