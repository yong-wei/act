'use client';

/**
 * Argument Principle Widget
 *
 * AI-integrated wrapper for the ArgumentPrincipleSystem component.
 * Supports both standalone and embedded (BOPPPS) modes.
 */

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Lightbulb, Bot, Circle } from 'lucide-react';
import { useLessonContext } from '@/features/lesson-engine/ContextInjector';
import { useLessonAI } from '@/hooks/useLessonAI';
import type { ArgumentPrincipleWidgetProps, WidgetState } from '@/resources/widgets/widget-props';

// Dynamic import to avoid SSR issues with canvas
const ArgumentPrincipleSystem = dynamic(
  () =>
    import(
      '@/resources/interactive-learning/argument-principle/argument-principle-system'
    ).then((mod) => mod.ArgumentPrincipleSystem),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="text-slate-400">Loading Argument Principle Tool...</div>
      </div>
    ),
    ssr: false,
  }
);

export default function ArgumentPrincipleWidget({
  initialFunction,
  initialContour,
  showControls = true,
  targetWindingNumber,
  embedded = false,
  onStateChange,
  onComplete,
  lessonContext: externalContext,
  className = '',
}: ArgumentPrincipleWidgetProps) {
  // Get lesson context - handle both LessonContext (embedded) and LessonContextValue (standalone)
  const internalContext = useLessonContext();
  // Extract persona from either context type
  const aiPersona = externalContext?.aiPersona || internalContext?.aiConfig?.persona || 'tutor';

  // AI integration
  const { sendMessage, isLoading: aiLoading } = useLessonAI({
    persona: aiPersona as 'tutor' | 'critic' | 'analyst',
  });

  // Local state
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Track user interaction
  const handleInteraction = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);

      // Emit state change
      const state: WidgetState = {
        phase: 'argument-principle',
        progress: 50,
        data: {
          hasInteracted: true,
        },
        timestamp: Date.now(),
      };
      onStateChange?.(state);
    }
  }, [hasInteracted, onStateChange]);

  // Generate contextual AI hints
  useEffect(() => {
    if (!embedded) return;

    if (!hasInteracted) {
      setAiHint('尝试修改传递函数的极点和零点位置，观察 Nyquist 图的变化。');
    } else {
      setAiHint('观察轮廓映射后对原点的包围次数，这与系统稳定性直接相关。');
    }
  }, [hasInteracted, embedded]);

  // Ask AI for help
  const askAI = async () => {
    setShowAIPanel(true);
    setAiResponse(null);

    const prompt = `请解释辐角原理（Argument Principle）在控制系统稳定性分析中的应用。
特别是：
1. 什么是 Nyquist 稳定性判据？
2. 如何通过观察 Nyquist 图判断系统稳定性？
3. 为什么包围次数与不稳定极点数量有关？`;

    try {
      const response = await sendMessage(prompt);
      setAiResponse(response);
    } catch {
      setAiResponse('AI 响应失败，请稍后重试。');
    }
  };

  return (
    <div
      className={`relative flex h-full w-full flex-col bg-slate-950 ${className}`}
      onClick={handleInteraction}
    >
      {/* AI Hint Banner (embedded mode) */}
      {embedded && aiHint && (
        <div className="flex-shrink-0 border-b border-slate-800 bg-emerald-500/10 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <Lightbulb className="h-4 w-4" />
            <span>{aiHint}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <ArgumentPrincipleSystem />
      </div>

      {/* AI Assistant Button */}
      {embedded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            askAI();
          }}
          disabled={aiLoading}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 shadow-lg transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          <Bot className="h-4 w-4" />
          {aiLoading ? '思考中...' : '请教 AI'}
        </button>
      )}

      {/* AI Response Panel */}
      {showAIPanel && (
        <div className="absolute bottom-16 right-4 z-20 w-80 max-h-60 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-400">AI 助手</span>
            <button
              onClick={() => setShowAIPanel(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          </div>
          {aiResponse ? (
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{aiResponse}</p>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span>正在分析...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
