
'use client';

import React, { useCallback } from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { BookOpen, Link as LinkIcon } from 'lucide-react';
import { TeachingResource, KnowledgeNode } from '@prisma/client';
import { getRegisteredResource } from '@/lib/resource-registry';
import { useLessonContext } from './ContextInjector';
import type { WidgetState, WidgetResult } from '@/resources/widgets/widget-props';

interface ResourceRendererProps {
  resource?: TeachingResource | null;
  knowledgeNode?: KnowledgeNode | null;
  /** Callback when widget completes */
  onComplete?: (result?: WidgetResult) => void;
  /** Callback when widget state changes (for AI context) */
  onStateChange?: (state: WidgetState) => void;
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

export function ResourceRenderer({ resource, knowledgeNode, onComplete, onStateChange }: ResourceRendererProps) {
  // Get lesson context for AI integration
  const lessonContext = useLessonContext();

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

  if (knowledgeNode) {
    const rawResources = knowledgeNode.resources ?? [];
    const attachments = Array.isArray(rawResources) ? rawResources : [];

    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{knowledgeNode.name}</h2>
              <p className="text-xs text-slate-400">{knowledgeNode.nodeType}</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{knowledgeNode.description}</p>
          {attachments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-slate-500">附件与扩展</h3>
              <div className="space-y-2">
                {attachments.map((item, idx) => {
                  if (typeof item === 'string') {
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                        <LinkIcon className="h-3.5 w-3.5 text-slate-500" />
                        <span className="truncate">{item}</span>
                      </div>
                    );
                  }
                  if (item && typeof item === 'object') {
                    const label = (item as { title?: string; name?: string }).title
                      || (item as { title?: string; name?: string }).name
                      || '附件';
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                        <LinkIcon className="h-3.5 w-3.5 text-slate-500" />
                        <span className="truncate">{label}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!resource) return <div>No Resource</div>;

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
                  <img src={resource.content || ''} alt={resource.title} className="max-h-full max-w-full object-contain" />
              )}
          </div>
      );
  }

  // 3. Dynamic Components (Simulations, Interactive)
  if (['INTERACTIVE_COMP', 'SIMULATION_APP', 'ETHICS_SCENARIO'].includes(resource.type)) {
      if (!resource.registryId) return <div>Missing Registry ID</div>;

      const config = getRegisteredResource(resource.registryId);
      if (!config) return <div>Component Not Found: {resource.registryId}</div>;

      const Component = config.component;
      // Merge default config with resource config + lesson context
      const props = {
        ...(config.defaultConfig || {}),
        ...(resource.config as Record<string, unknown> || {}),
        // Inject lesson context and callbacks for AI integration
        embedded: true,
        lessonContext: {
          resourceTitle: lessonContext.title || resource.title,
          aiPersona: lessonContext.aiConfig?.persona,
          customPrompt: lessonContext.aiConfig?.systemPromptExtension,
        },
        onStateChange: handleStateChange,
        onComplete: handleComplete,
      };

      return (
          <div className="h-full w-full flex flex-col bg-slate-950">
              <Component {...props} />
          </div>
      );
  }

  return <div>Unknown Resource Type</div>;
}
