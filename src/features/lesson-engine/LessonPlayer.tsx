'use client';

/**
 * 课程播放器主控制器
 * Lesson Player - Main Controller Component
 *
 * 功能:
 * - 读取 LessonManifest 并渲染课程
 * - 提供进度导航条 (Timeline Scrubber)
 * - 根据 step 的 layout 属性决定渲染容器结构
 * - 支持教师/学生模式切换
 */

import { useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Users,
  User,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';

import { useLessonStore } from './lesson-store';
import { ResourceRenderer } from './ResourceRenderer';
import { ContextInjector } from './ContextInjector';
import type { LessonManifest, Resource, LayoutType } from '@/types/schema';

// ===== 组件属性 =====

interface LessonPlayerProps {
  /** 课程清单 */
  manifest: LessonManifest;

  /** 资源映射表 */
  resources: Record<string, Resource>;

  /** 是否为教师模式 */
  isTeacherMode?: boolean;

  /** 步骤变化回调（用于广播同步） */
  onStepChange?: (stepIndex: number) => void;

  /** 自定义类名 */
  className?: string;
}

// ===== 进度条组件 =====

interface TimelineScrubberProps {
  currentIndex: number;
  totalSteps: number;
  stepTitles: string[];
  onStepClick: (index: number) => void;
  isTeacherMode: boolean;
}

function TimelineScrubber({
  currentIndex,
  totalSteps,
  stepTitles,
  onStepClick,
  isTeacherMode,
}: TimelineScrubberProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-2 py-1">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        const isAccessible = isTeacherMode || index <= currentIndex;

        return (
          <button
            key={index}
            onClick={() => isAccessible && onStepClick(index)}
            disabled={!isAccessible}
            className={`group relative flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-all ${
              isActive
                ? 'bg-amber-500 text-slate-900'
                : isCompleted
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : isAccessible
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'cursor-not-allowed bg-slate-800 text-slate-600'
            }`}
            title={stepTitles[index] || `步骤 ${index + 1}`}
          >
            {index + 1}
            {/* Tooltip */}
            <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
              {stepTitles[index] || `步骤 ${index + 1}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ===== 布局容器组件 =====

interface LayoutContainerProps {
  layout: LayoutType;
  children: React.ReactNode;
  sideContent?: React.ReactNode;
}

function LayoutContainer({ layout, children, sideContent }: LayoutContainerProps) {
  switch (layout) {
    case 'split-left':
      return (
        <div className="flex h-full">
          <div className="w-1/3 border-r border-slate-700 p-4">{sideContent}</div>
          <div className="flex-1 p-4">{children}</div>
        </div>
      );

    case 'split-right':
      return (
        <div className="flex h-full">
          <div className="flex-1 p-4">{children}</div>
          <div className="w-1/3 border-l border-slate-700 p-4">{sideContent}</div>
        </div>
      );

    case 'drawer':
      return (
        <div className="relative h-full">
          <div className="h-full p-4">{children}</div>
          {sideContent && (
            <div className="absolute bottom-0 left-0 right-0 max-h-1/3 overflow-y-auto border-t border-slate-700 bg-slate-900/95 p-4 backdrop-blur">
              {sideContent}
            </div>
          )}
        </div>
      );

    case 'full':
    default:
      return <div className="h-full p-4">{children}</div>;
  }
}

// ===== 主组件 =====

export function LessonPlayer({
  manifest,
  resources,
  isTeacherMode = false,
  onStepChange,
  className = '',
}: LessonPlayerProps) {
  // 从 store 获取状态和操作
  const {
    currentStepIndex,
    totalSteps,
    currentStep,
    currentResource,
    isPlaying,
    isPaused,
    isFollowMode,
    progress,
    loadLesson,
    goToStep,
    nextStep,
    prevStep,
    setTeacherMode,
    setFollowMode,
    play,
    pause,
    markStepCompleted,
  } = useLessonStore();

  // 初始化课程
  useEffect(() => {
    loadLesson(manifest, resources);
    setTeacherMode(isTeacherMode);
  }, [manifest, resources, isTeacherMode, loadLesson, setTeacherMode]);

  // 步骤变化时通知外部
  useEffect(() => {
    onStepChange?.(currentStepIndex);
  }, [currentStepIndex, onStepChange]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextStep, prevStep]);

  // 获取步骤标题列表
  const stepTitles = manifest.steps.map((step, index) => {
    const resource = resources[step.resourceId];
    return step.context.titleOverride || resource?.title || `步骤 ${index + 1}`;
  });

  // 处理资源完成
  const handleResourceComplete = useCallback(
    (score?: number) => {
      if (currentStep) {
        markStepCompleted(currentStep.id, score);
        // 自动前进到下一步
        nextStep();
      }
    },
    [currentStep, markStepCompleted, nextStep]
  );

  // 获取当前布局
  const currentLayout: LayoutType = currentStep?.layout || 'full';

  // 渲染引导语作为侧边内容
  const guideContent = currentStep?.context.descriptionOverride ? (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-amber-400">教师引导</h3>
      <p className="text-sm text-slate-300">{currentStep.context.descriptionOverride}</p>
    </div>
  ) : null;

  if (!currentStep || !currentResource) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        正在加载课程...
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col bg-slate-950 ${className}`}>
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        {/* 左侧：课程信息 */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500">
            <span className="text-sm font-bold">{currentStepIndex + 1}</span>
          </div>
          <div>
            <h1 className="text-sm font-medium text-white">
              {stepTitles[currentStepIndex]}
            </h1>
            <p className="text-xs text-slate-500">
              {manifest.title} · 步骤 {currentStepIndex + 1}/{totalSteps}
            </p>
          </div>
        </div>

        {/* 中间：进度条 */}
        <div className="hidden flex-1 justify-center md:flex">
          <TimelineScrubber
            currentIndex={currentStepIndex}
            totalSteps={totalSteps}
            stepTitles={stepTitles}
            onStepClick={goToStep}
            isTeacherMode={isTeacherMode}
          />
        </div>

        {/* 右侧：控制按钮 */}
        <div className="flex items-center gap-2">
          {/* 模式指示器 */}
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
              isTeacherMode
                ? 'bg-violet-500/20 text-violet-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            {isTeacherMode ? (
              <>
                <Users className="h-3 w-3" />
                <span>教师</span>
              </>
            ) : (
              <>
                <User className="h-3 w-3" />
                <span>学生</span>
              </>
            )}
          </div>

          {/* 跟随模式切换（仅学生） */}
          {!isTeacherMode && (
            <button
              onClick={() => setFollowMode(!isFollowMode)}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors ${
                isFollowMode
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-slate-700 text-slate-400'
              }`}
              title={isFollowMode ? '点击切换为自由探索' : '点击切换为跟随模式'}
            >
              {isFollowMode ? (
                <>
                  <LinkIcon className="h-3 w-3" />
                  <span>跟随</span>
                </>
              ) : (
                <>
                  <Unlink className="h-3 w-3" />
                  <span>自由</span>
                </>
              )}
            </button>
          )}

          {/* 进度百分比 */}
          <div className="text-xs text-slate-500">{progress}%</div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="relative flex-1 overflow-hidden">
        <LayoutContainer layout={currentLayout} sideContent={guideContent}>
          <ContextInjector step={currentStep}>
            <ResourceRenderer
              step={currentStep}
              resource={currentResource}
              onComplete={handleResourceComplete}
            />
          </ContextInjector>
        </LayoutContainer>
      </main>

      {/* 底部控制栏 */}
      <footer className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
        {/* 左侧：播放控制 */}
        <div className="flex items-center gap-2">
          <button
            onClick={isPaused ? play : pause}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700"
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        </div>

        {/* 中间：移动端进度指示 */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">
            {currentStepIndex + 1}/{totalSteps}
          </span>
        </div>

        {/* 右侧：导航按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevStep}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">上一步</span>
          </button>

          <button
            onClick={nextStep}
            disabled={currentStepIndex === totalSteps - 1}
            className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="hidden sm:inline">下一步</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}

export default LessonPlayer;
