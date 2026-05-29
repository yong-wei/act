
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
}

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
}: ResourceRendererProps) {
  // Get lesson context for AI integration
  const lessonContext = useLessonContext();
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
                  <video src={resource.content} controls className="max-h-full max-w-full" />
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
