'use client';

/**
 * Physics Builder Widget
 *
 * AI-integrated wrapper for the PhysicsBuilder component.
 * Supports both standalone and embedded (BOPPPS) modes.
 */

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Lightbulb, Bot } from 'lucide-react';
import { useLessonContext } from '@/features/lesson-engine/ContextInjector';
import { useLessonAI } from '@/hooks/useLessonAI';
import type { PhysicsBuilderWidgetProps, WidgetState } from '@/resources/widgets/widget-props';

// Dynamic import to avoid SSR issues with React Flow
const PhysicsBuilder = dynamic(
  () =>
    import(
      '@/resources/interactive-learning/physics-modeling/physics-builder/physics-builder-canvas'
    ).then((mod) => mod.PhysicsBuilder),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="text-slate-400">Loading Physics Builder...</div>
      </div>
    ),
    ssr: false,
  }
);

export default function PhysicsBuilderWidget({
  mode = 'mechanical',
  items,
  targetEquation,
  showEquation = true,
  enableAIHints = true,
  embedded = false,
  onStateChange,
  onComplete,
  lessonContext: externalContext,
  className = '',
}: PhysicsBuilderWidgetProps) {
  // Get lesson context - handle both LessonContext (embedded) and LessonContextValue (standalone)
  const internalContext = useLessonContext();
  // Extract persona from either context type
  const aiPersona = externalContext?.aiPersona || internalContext?.aiConfig?.persona || 'tutor';

  // AI integration
  const { sendMessage, isLoading: aiLoading } = useLessonAI({
    persona: aiPersona as 'tutor' | 'critic' | 'analyst',
  });

  // Local state
  const [nodeCount, setNodeCount] = useState(0);
  const [equation, setEquation] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  // Handle model changes
  const handleModelChange = useCallback(
    (nodes: unknown[], edges: unknown[]) => {
      setNodeCount(nodes.length);

      // Emit state for AI context
      const state: WidgetState = {
        phase: mode,
        progress: isComplete ? 100 : Math.min(nodes.length * 15, 80),
        data: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          equation,
          mode,
        },
        timestamp: Date.now(),
      };
      onStateChange?.(state);
    },
    [mode, equation, isComplete, onStateChange]
  );

  // Handle equation changes
  const handleEquationChange = useCallback(
    (eq: string, complete: boolean) => {
      setEquation(eq);
      setIsComplete(complete);

      if (complete) {
        onComplete?.({
          success: true,
          score: 100,
          data: { equation: eq, mode },
        });
      }
    },
    [mode, onComplete]
  );

  // Generate contextual AI hints
  useEffect(() => {
    if (!enableAIHints || !embedded) return;

    if (nodeCount === 0) {
      setAiHint(
        mode === 'mechanical'
          ? '从左侧拖入元件开始构建。质量块代表惯性，弹簧代表弹性，阻尼器代表阻尼。'
          : '从左侧拖入元件开始构建。电感代表惯性，电容代表能量存储，电阻代表耗散。'
      );
    } else if (nodeCount < 3) {
      setAiHint('继续添加元件以构建完整的动态系统。');
    } else if (!isComplete) {
      setAiHint('检查连接是否正确，确保系统方程完整。');
    } else {
      setAiHint(null);
    }
  }, [nodeCount, isComplete, mode, enableAIHints, embedded]);

  // Ask AI for help
  const askAI = async () => {
    setShowAIPanel(true);
    setAiResponse(null);

    const prompt =
      mode === 'mechanical'
        ? `我正在构建一个机械系统模型，当前有 ${nodeCount} 个元件，生成的方程是: ${equation || '尚未生成'}。请帮我分析当前模型是否正确，并给出改进建议。`
        : `我正在构建一个电路模型，当前有 ${nodeCount} 个元件，生成的方程是: ${equation || '尚未生成'}。请帮我分析当前模型是否正确，并给出改进建议。`;

    try {
      const response = await sendMessage(prompt);
      setAiResponse(response);
    } catch (err) {
      setAiResponse('AI 响应失败，请稍后重试。');
    }
  };

  return (
    <div className={`relative flex h-full w-full flex-col bg-slate-950 ${className}`}>
      {/* AI Hint Banner (only in embedded mode) */}
      {embedded && enableAIHints && aiHint && (
        <div className="flex-shrink-0 border-b border-slate-800 bg-blue-500/10 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-blue-300">
            <Lightbulb className="h-4 w-4" />
            <span>{aiHint}</span>
          </div>
        </div>
      )}

      {/* Main Physics Builder */}
      <div className="flex-1 min-h-0">
        <PhysicsBuilder
          mode={mode}
          targetEquation={targetEquation}
          onModelChange={handleModelChange}
          onEquationChange={handleEquationChange}
          embedded={embedded}
          showEquation={showEquation}
        />
      </div>

      {/* AI Assistant Button (embedded mode) */}
      {embedded && enableAIHints && (
        <button
          onClick={askAI}
          disabled={aiLoading}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 shadow-lg transition hover:bg-cyan-500/20 disabled:opacity-50"
        >
          <Bot className="h-4 w-4" />
          {aiLoading ? '思考中...' : '请教 AI'}
        </button>
      )}

      {/* AI Response Panel */}
      {showAIPanel && (
        <div className="absolute bottom-16 right-4 z-20 w-80 max-h-60 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-cyan-400">AI 助手</span>
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
              <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
              <span>正在分析...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
