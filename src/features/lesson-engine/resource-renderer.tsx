
'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import Image from 'next/image';
import { Prisma, TeachingResource, KnowledgeNode } from '@prisma/client';
import { getRegisteredResource } from '@/lib/resource-registry';
import { useLessonContext } from './ContextInjector';
import { InteractiveProvider } from '@/features/interactive';
import type { InteractiveConfig, InteractiveResourceConfig } from '@/features/interactive';
import type { WidgetState, WidgetResult } from '@/resources/widgets/widget-props';
import { KnowledgeCard } from '@/features/knowledge/knowledge-card';
import { useResourceInteractionTracking } from '@/features/interactive/hooks/useResourceInteractionTracking';
import {
  buildResourceRendererLaunchContext,
  resolveInteractiveResourceConfig,
} from './resource-renderer-config';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import {
  GeneratedCoursewareResource,
  resolveGeneratedCoursewareResourceConfig,
} from './generated-courseware-resource';

interface ResourceRendererProps {
  resource?: TeachingResource | null;
  knowledgeNode?: KnowledgeNode | null;
  /** 课程环节级配置覆盖 */
  overrideConfig?: Prisma.JsonValue | null;
  /** Callback when widget completes */
  onComplete?: (result?: WidgetResult) => void;
  /** Callback when widget state changes (for AI context) */
  onStateChange?: (state: WidgetState) => void;
  /** 课堂会话 ID（用于埋点追踪） */
  sessionId?: string;
  /** 当前 LessonItem ID（用于课程资源启动上下文） */
  lessonItemId?: string;
  /** 当前 LessonPlan ID（用于课程资源启动上下文） */
  lessonPlanId?: string;
  /** 当前班级 ID（用于课程资源启动上下文） */
  classId?: string | null;
  /** 当前 BOPPPS 阶段 */
  stage?: string | null;
  /** 是否启用 AI 面板 */
  enableAIPanel?: boolean;
  /** 仅学生课堂运行态可以写入课堂作答。 */
  classroomActorRole?: 'student' | 'teacher';
}

// Temporary accessibility exception: legacy static media resources only store one content URL.
// Owner: lesson engine. Remove this placeholder when TeachingResource stores caption URLs.
const TEMPORARY_CAPTION_TRACK_SRC = 'data:text/vtt;charset=utf-8,WEBVTT%0A%0A00:00:00.000%20--%3E%2000:00:05.000%0A%E6%9A%82%E6%97%A0%E5%8F%AF%E7%94%A8%E5%AD%97%E5%B9%95%EF%BC%9B%E8%AF%B7%E6%95%99%E5%B8%88%E4%B8%BA%E6%AD%A3%E5%BC%8F%E5%AA%92%E4%BD%93%E8%A1%A5%E5%85%85%E5%AD%97%E5%B9%95%E8%B5%84%E4%BA%A7%E3%80%82';

// Simple Markdown + LaTeX Renderer
const SimpleMarkdown = ({ content }: { content: string }) => {
    if (!content) return null;

    // Split by newlines
    const lines = content.split('\n');
    return (
        <div className="space-y-4 text-slate-300">
            {lines.map((line, idx) => {
                // Headers
                if (line.startsWith('# ')) return <h1 key={idx} className="text-3xl font-bold text-white mb-4">{line.replace('# ', '')}</h1>;
                if (line.startsWith('## ')) return <h2 key={idx} className="text-2xl font-bold text-white mb-3">{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={idx} className="text-xl font-bold text-white mb-2">{line.replace('### ', '')}</h3>;
                
                // LaTeX Block $$...$$
                if (line.trim().startsWith('$$') && line.trim().endsWith('$$')) {
                    const math = line.trim().replace(/\$\$/g, '');
                    return <BlockMath key={idx} math={math} />;
                }

                // List items
                if (line.trim().startsWith('- ')) {
                    return <li key={idx} className="ml-4">{line.replace('- ', '')}</li>;
                }

                // Default paragraph
                if (line.trim() === '') return <br key={idx} />;
                
                return <p key={idx} className="leading-relaxed">{line}</p>;
            })}
        </div>
    );
};

export function ResourceRenderer({
  resource,
  knowledgeNode,
  overrideConfig,
  onComplete,
  onStateChange,
  sessionId,
  lessonItemId,
  lessonPlanId,
  classId,
  stage,
  enableAIPanel = true,
  classroomActorRole,
}: ResourceRendererProps) {
  // Get lesson context for AI integration
  const lessonContext = useLessonContext();
  const { updatePageContext } = useGlobalAI();
  const knowledgeTracker = useResourceInteractionTracking({
    resourceKey: knowledgeNode ? `knowledge-card:${knowledgeNode.id}` : 'resource-renderer',
    lessonKey: null,
    surface: knowledgeNode ? 'knowledge_card' : 'interactive_resource',
    pageType: knowledgeNode ? 'knowledge' : 'resource',
    targetType: knowledgeNode ? 'knowledge_card' : 'interactive_resource',
    targetId: knowledgeNode?.id ?? resource?.id ?? null,
    targetLabel: knowledgeNode?.name ?? resource?.title ?? null,
    resourceId: resource?.id ?? null,
    registryId: resource?.registryId ?? null,
    provider: 'resource-renderer',
  });

  // Handle state changes from widgets
  const handleStateChange = useCallback((state: WidgetState) => {
    // Log for debugging
    console.log('[ResourceRenderer] Widget state:', state);
    onStateChange?.(state);
  }, [onStateChange]);

  // Handle widget completion
  const handleComplete = useCallback((result?: WidgetResult) => {
    console.log('[ResourceRenderer] Widget complete:', result);
    onComplete?.(result);
  }, [onComplete]);

  useEffect(() => {
    if (!knowledgeNode) {
      return;
    }
    knowledgeTracker.trackKnowledgeCardOpen({
      resourceKey: `knowledge-card:${knowledgeNode.id}`,
      targetType: 'knowledge_card',
      targetId: knowledgeNode.id,
      targetLabel: knowledgeNode.name,
    });
  }, [knowledgeNode, knowledgeTracker]);

  useEffect(() => {
    if (!resource || !enableAIPanel) {
      updatePageContext({ assistantEntryPoint: null });
      return;
    }
    updatePageContext({
      courseId: lessonPlanId ?? sessionId ?? 'resource-runtime',
      courseTitle: lessonContext.title || resource.title,
      pageType: 'practice',
      stepId: resource.id,
      topic: resource.displayName || resource.title,
      learningObjectives: [],
      knowledgeType: 'X',
      assistantEntryPoint: {
        mode: 'resource-coach',
        promptContext: `resource:${resource.id};registry:${resource.registryId ?? 'none'}`,
        serverContext: {
          resourceId: resource.id,
          registryId: resource.registryId ?? '',
        },
      },
    });
  }, [enableAIPanel, lessonContext.title, lessonPlanId, resource, sessionId, updatePageContext]);

  if (knowledgeNode) {
    const rawResources = knowledgeNode.resources ?? [];
    const attachments = Array.isArray(rawResources) ? rawResources : [];
    const metadata = (knowledgeNode.metadata ?? {}) as Record<string, unknown>;
    const legacyContent = (knowledgeNode.content ?? {}) as Record<string, unknown>;
    const normalizedMetadata = {
      type: 'rich-text',
      content: (metadata.content as string)
        || (metadata.explanation as string)
        || (legacyContent.explanation as string)
        || knowledgeNode.description,
      formulas: {
        continuous: (metadata.formulas as { continuous?: string } | undefined)?.continuous
          || (metadata.formulaContinuous as string)
          || (legacyContent.formulaContinuous as string),
        discrete: (metadata.formulas as { discrete?: string } | undefined)?.discrete
          || (metadata.formulaDiscrete as string)
          || (legacyContent.formulaDiscrete as string),
      },
      applications: (metadata.applications as string[])
        || (legacyContent.applications as string[])
        || [],
    };

    return (
      <div className="max-w-[90%] mx-auto p-8">
        <KnowledgeCard
          name={knowledgeNode.name}
          description={knowledgeNode.description}
          nodeType={knowledgeNode.nodeType}
          bloomLevel={knowledgeNode.bloomLevel ?? undefined}
          knowledgeDim={knowledgeNode.knowledgeDim ?? undefined}
          metadata={normalizedMetadata}
          resources={attachments}
          className="border-slate-700/50 shadow-2xl bg-[#0F172A]"
        />
      </div>
    );
  }

  if (!resource) return <div>No Resource</div>;

  const rawOverride = (overrideConfig && typeof overrideConfig === 'object' && !Array.isArray(overrideConfig))
    ? (overrideConfig as Record<string, unknown>)
    : {};
  const titleOverride = typeof rawOverride.titleOverride === 'string' ? rawOverride.titleOverride : null;
  const descriptionOverride = typeof rawOverride.descriptionOverride === 'string' ? rawOverride.descriptionOverride : null;
  const effectiveTitle = titleOverride ?? resource.title;
  const effectiveDescription = descriptionOverride ?? resource.description;
  if (resource.generatedCoursewarePublicationId) {
    const generatedCoursewareConfig = resolveGeneratedCoursewareResourceConfig(resource.config);
    if (!generatedCoursewareConfig
      || generatedCoursewareConfig.publicationRevisionId !== resource.generatedCoursewarePublicationId) {
      return (
        <div
          className="flex h-full items-center justify-center bg-platform-canvas p-8 text-platform-fg-primary"
          data-generated-courseware-resource-integrity="invalid"
          role="alert"
        >
          互动课件资源完整性校验失败，请教师重新创建课堂。
        </div>
      );
    }
    return (
      <GeneratedCoursewareResource
        config={generatedCoursewareConfig}
        onComplete={onComplete}
        onStateChange={onStateChange}
        sessionId={sessionId}
        lessonItemId={lessonItemId}
        resourceId={resource.id}
        runtimeMode={classroomActorRole === 'student' ? 'student' : 'preview'}
      />
    );
  }

  // 1. Static Text (Markdown)
  if (resource.type === 'STATIC_TEXT') {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <SimpleMarkdown content={resource.content || ''} />
      </div>
    );
  }

  // 2. Static Media
  if (resource.type === 'STATIC_MEDIA') {
      return (
          <div className="flex items-center justify-center h-full bg-black">
              {/* Simplified media handling */}
              {resource.content?.endsWith('.mp4') ? (
                  <video aria-label={effectiveTitle} src={resource.content} controls className="max-h-full max-w-full">
                      <track kind="captions" srcLang="zh-CN" label="中文说明" src={TEMPORARY_CAPTION_TRACK_SRC} />
                  </video>
              ) : (
                  <div className="relative h-full w-full">
                      {resource.content ? (
                          <Image
                              src={resource.content}
                              alt={effectiveTitle}
                              fill
                              sizes="100vw"
                              className="object-contain"
                              unoptimized
                          />
                      ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-500">
                              Missing media source
                          </div>
                      )}
                  </div>
              )}
          </div>
      );
  }

  // 3. Dynamic Components (Simulations, Interactive)
  if (['INTERACTIVE_COMP', 'SIMULATION_APP', 'ETHICS_SCENARIO'].includes(resource.type)) {
      if (!resource.registryId) return <div>Missing Registry ID</div>;

      const registryConfig = getRegisteredResource(resource.registryId);
      if (!registryConfig) return <div>Component Not Found: {resource.registryId}</div>;

      const Component = registryConfig.component;

      const mergedConfig: InteractiveResourceConfig = resolveInteractiveResourceConfig({
        registryDefaultConfig: registryConfig.defaultConfig,
        resourceConfig: resource.config,
        overrideConfig,
      });
      const interactiveConfig: InteractiveConfig = {
        resourceId: resource.id,
        registryId: resource.registryId,
        title: effectiveTitle,
        description: effectiveDescription || undefined,
        aiHints: resource.aiHints || undefined,
        config: {
          props: mergedConfig.props ?? {},
          ai: {
            enabled: enableAIPanel,
            persona: lessonContext.aiConfig?.persona || mergedConfig.ai?.persona,
            hints: resource.aiHints || mergedConfig.ai?.hints,
            proactive: mergedConfig.ai?.proactive,
          },
          tracking: mergedConfig.tracking,
          completion: mergedConfig.completion,
          layout: {
            showHeader: false, // 嵌入模式下不显示头部
            showAIPanel: enableAIPanel,
            aiPanelPosition: mergedConfig.layout?.aiPanelPosition || 'right',
          },
        },
      };
      const launchContext = buildResourceRendererLaunchContext({
        resourceId: resource.id,
        registryId: resource.registryId,
        sessionId,
        lessonItemId,
        lessonPlanId,
        classId,
        stage,
      });

      // 组件 props（不包含 InteractiveProvider 管理的内容）
      const componentProps = {
        ...(mergedConfig.props || {}),
        embedded: true,
        resourceId: resource.id,
        registryId: resource.registryId,
        launchContext,
        lessonContext: {
          resourceTitle: lessonContext.title || effectiveTitle,
          aiPersona: lessonContext.aiConfig?.persona,
          customPrompt: lessonContext.aiConfig?.systemPromptExtension,
        },
      };

      return (
        <InteractiveProvider
          config={interactiveConfig}
          embedded={true}
          sessionId={sessionId}
          showHeader={false}
          showAIPanel={enableAIPanel}
          onComplete={handleComplete}
          onStateChange={(snapshot) => {
            handleStateChange({
              progress: snapshot.progress,
              data: { events: snapshot.events },
              timestamp: snapshot.timestamp,
            });
          }}
        >
          <div className="h-full w-full flex flex-col">
            <Component {...componentProps} />
          </div>
        </InteractiveProvider>
      );
  }

  return <div>Unknown Resource Type</div>;
}
