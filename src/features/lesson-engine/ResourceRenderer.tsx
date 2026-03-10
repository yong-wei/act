'use client';

/**
 * 资源渲染器
 * Resource Renderer - Factory Component
 *
 * 根据资源类型渲染具体内容的工厂组件
 * - concept: 使用 MDXViewer 加载 MDX 内容
 * - widget: 动态加载组件库中的交互组件
 * - quiz: 使用 QuizEngine 渲染测验
 * - video: 使用 VideoPlayer 播放视频
 */

import { Suspense, lazy, useMemo, memo } from 'react';
import {
  BookOpen,
  Puzzle,
  HelpCircle,
  PlayCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

import type { Resource, LessonStep, WidgetResource } from '@/types/schema';

// ===== 组件属性 =====

interface ResourceRendererProps {
  /** 当前步骤 */
  step: LessonStep;

  /** 资源数据 */
  resource: Resource;

  /** 完成回调 */
  onComplete?: (score?: number) => void;

  /** 自定义类名 */
  className?: string;
}

// ===== 加载占位符 =====

function LoadingFallback({ type }: { type: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">正在加载 {type}...</p>
    </div>
  );
}

// ===== 错误占位符 =====

function ErrorFallback({
  type,
  message,
}: {
  type: string;
  message?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-red-500/30 bg-red-500/10 p-8">
      <AlertTriangle className="h-12 w-12 text-red-500" />
      <div className="text-center">
        <p className="font-medium text-red-400">加载 {type} 失败</p>
        {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
      </div>
    </div>
  );
}

// ===== 概念卡片渲染器 =====

interface ConceptViewerProps {
  contentPath: string;
  extraContext?: Record<string, unknown>;
  onComplete?: () => void;
}

function ConceptViewer({ contentPath, extraContext, onComplete }: ConceptViewerProps) {
  // TODO: 使用 next-mdx-remote 加载 MDX 内容
  // 当前使用占位符实现
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
            <BookOpen className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">概念卡片</h3>
            <p className="text-xs text-slate-500">{contentPath}</p>
          </div>
        </div>

        <div className="prose prose-invert prose-sm max-w-none">
          <p className="text-slate-400">
            MDX 内容将从 <code className="text-amber-400">{contentPath}</code> 加载。
          </p>
          {extraContext && (
            <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-800 p-4 text-xs">
              {JSON.stringify(extraContext, null, 2)}
            </pre>
          )}
        </div>

        {onComplete && (
          <button
            onClick={() => onComplete()}
            className="mt-6 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400"
          >
            已阅读完毕
          </button>
        )}
      </div>
    </div>
  );
}

// ===== 组件注册表 =====

// 动态组件加载器映射
// 实际使用时，这里应该注册所有可用的交互组件
const ComponentRegistry: Record<
  string,
  React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>
> = {
  // 示例：PhysicsBuilder 组件
  // PhysicsBuilder: lazy(() => import('@/resources/interactive-learning/physics-modeling/physics-builder/physics-builder-canvas').then(m => ({ default: m.PhysicsBuilder }))),

  // 占位符组件（用于演示）
  PlaceholderWidget: lazy(
    () =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              default: ({ title, mode }: { title?: string; mode?: string }) => (
                <div className="flex h-full items-center justify-center">
                  <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-8 text-center">
                    <Puzzle className="mx-auto mb-4 h-12 w-12 text-violet-400" />
                    <h3 className="text-lg font-semibold text-white">
                      {title || '交互组件'}
                    </h3>
                    {mode && (
                      <p className="mt-2 text-sm text-slate-500">
                        当前模式: <span className="text-amber-400">{mode}</span>
                      </p>
                    )}
                    <p className="mt-4 text-xs text-slate-600">
                      组件占位符 - 等待实际组件注册
                    </p>
                  </div>
                </div>
              ),
            } as { default: React.ComponentType<Record<string, unknown>> }),
          500
        )
      )
  ),
};

// ===== 交互组件渲染器 =====

interface WidgetViewerProps {
  resource: WidgetResource;
  propsOverride?: Record<string, unknown>;
  onComplete?: (score?: number) => void;
}

function WidgetViewer({ resource, propsOverride, onComplete }: WidgetViewerProps) {
  // 合并默认 Props 和覆盖 Props
  const finalProps = useMemo<Record<string, unknown>>(
    () => ({
      ...resource.defaultProps,
      ...propsOverride,
      onComplete,
    }),
    [resource.defaultProps, propsOverride, onComplete]
  );

  // 从注册表获取组件
  const Widget = ComponentRegistry[resource.componentName];

  if (!Widget) {
    // 未注册的组件使用占位符
    const PlaceholderWidget = ComponentRegistry['PlaceholderWidget'];
    // 从 propsOverride 或 defaultProps 获取 mode
    const mode = (propsOverride?.mode ?? resource.defaultProps?.mode) as string | undefined;
    return (
      <Suspense fallback={<LoadingFallback type="组件" />}>
        <PlaceholderWidget
          title={resource.title}
          mode={mode}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback type={resource.componentName} />}>
      <Widget {...finalProps} />
    </Suspense>
  );
}

// ===== 测验渲染器 =====

interface QuizViewerProps {
  questions: Array<{
    id: string;
    stem: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }>;
  passingScore?: number;
  onComplete?: (score: number) => void;
}

function QuizViewer({ questions, passingScore = 60, onComplete }: QuizViewerProps) {
  // TODO: 实现完整的测验引擎
  // 当前使用简化版实现
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
            <HelpCircle className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">知识探针</h3>
            <p className="text-xs text-slate-500">
              共 {questions.length} 题 · 及格分数 {passingScore}%
            </p>
          </div>
        </div>

        {questions.map((q, index) => (
          <div
            key={q.id}
            className="rounded-xl border border-slate-700 bg-slate-900/50 p-4"
          >
            <p className="mb-3 font-medium text-white">
              <span className="mr-2 text-amber-500">{index + 1}.</span>
              {q.stem}
            </p>
            <div className="space-y-2">
              {q.options.map((option, optIndex) => (
                <button
                  key={optIndex}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700"
                >
                  <span className="mr-2 text-slate-500">
                    {String.fromCharCode(65 + optIndex)}.
                  </span>
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}

        {onComplete && (
          <button
            onClick={() => onComplete(100)} // 简化：直接满分
            className="w-full rounded-lg bg-green-500 py-3 font-medium text-white hover:bg-green-400"
          >
            提交答案
          </button>
        )}
      </div>
    </div>
  );
}

// ===== 视频渲染器 =====

interface VideoViewerProps {
  videoUrl: string;
  duration: number;
  onComplete?: () => void;
}

function VideoViewer({ videoUrl, duration, onComplete }: VideoViewerProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-slate-700 bg-black">
        {/* 视频占位符 */}
        <div className="relative aspect-video bg-slate-900">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <PlayCircle className="h-16 w-16 text-slate-600" />
            <p className="text-sm text-slate-500">{videoUrl}</p>
            <p className="text-xs text-slate-600">
              时长: {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </p>
          </div>
        </div>
      </div>

      {onComplete && (
        <button
          onClick={() => onComplete()}
          className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400"
        >
          视频已看完
        </button>
      )}
    </div>
  );
}

// ===== 主渲染器组件 =====

export const ResourceRenderer = memo(function ResourceRenderer({
  step,
  resource,
  onComplete,
  className = '',
}: ResourceRendererProps) {
  // 合并的 Props（用于 widget 类型）
  const propsOverride = step.context.propsOverride;

  // 根据资源类型分发渲染
  const renderContent = () => {
    switch (resource.type) {
      case 'concept':
        return (
          <ConceptViewer
            contentPath={resource.contentPath}
            extraContext={propsOverride}
            onComplete={onComplete}
          />
        );

      case 'widget':
        return (
          <WidgetViewer
            resource={resource}
            propsOverride={propsOverride}
            onComplete={onComplete}
          />
        );

      case 'quiz':
        return (
          <QuizViewer
            questions={resource.questions}
            passingScore={resource.passingScore}
            onComplete={onComplete}
          />
        );

      case 'video':
        return (
          <VideoViewer
            videoUrl={resource.videoUrl}
            duration={resource.duration}
            onComplete={onComplete}
          />
        );

      default:
        return (
          <ErrorFallback
            type="资源"
            message={`未知的资源类型: ${(resource as Resource).type}`}
          />
        );
    }
  };

  return <div className={`h-full ${className}`}>{renderContent()}</div>;
});

export default ResourceRenderer;
