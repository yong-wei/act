'use client';

/**
 * Analogy Mapper Widget
 *
 * AI-integrated widget for mapping mechanical-electrical system analogies.
 * Supports both standalone and embedded (BOPPPS) modes.
 */

import { useState, useCallback, useEffect } from 'react';
import { Link2, CheckCircle2, Lightbulb, Bot, Sparkles } from 'lucide-react';
import { useLessonContext } from '@/features/lesson-engine/ContextInjector';
import { useLessonAI } from '@/hooks/useLessonAI';
import {
  ANALOGY_MAPPINGS,
  type AnalogyMapping,
} from '@/resources/interactive-learning/physics-modeling/types';
import type { AnalogyMapperWidgetProps, WidgetState } from '@/resources/widgets/widget-props';

/** Mapping Card Component */
function MappingCard({
  mapping,
  isCompleted,
  onConnect,
}: {
  mapping: AnalogyMapping;
  isCompleted: boolean;
  onConnect: () => void;
}) {
  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        isCompleted
          ? 'border-green-500/50 bg-green-500/10'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Mechanical Side */}
        <div className="flex-1 rounded-lg bg-slate-900/50 p-3">
          <div className="text-center">
            <div
              className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${mapping.color}20` }}
            >
              <span
                className="font-mono text-xl font-bold"
                style={{ color: mapping.color }}
              >
                {mapping.mechanical.symbol}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-300">
              {mapping.mechanical.name}
            </p>
            <p className="text-xs text-slate-500">{mapping.mechanical.unit}</p>
          </div>
        </div>

        {/* Connection Button */}
        <div className="flex flex-col items-center">
          {isCompleted ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          ) : (
            <button
              onClick={onConnect}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 transition-all hover:scale-110 hover:bg-amber-500/30"
            >
              <Link2 className="h-4 w-4" />
            </button>
          )}
          <div
            className={`my-1 h-1 w-16 rounded ${
              isCompleted ? 'bg-green-500' : 'bg-slate-700'
            }`}
            style={isCompleted ? { backgroundColor: mapping.color } : undefined}
          />
          <p className="text-xs text-slate-500">{mapping.meaning}</p>
        </div>

        {/* Electrical Side */}
        <div className="flex-1 rounded-lg bg-slate-900/50 p-3">
          <div className="text-center">
            <div
              className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${mapping.color}20` }}
            >
              <span
                className="font-mono text-xl font-bold"
                style={{ color: mapping.color }}
              >
                {mapping.electrical.symbol}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-300">
              {mapping.electrical.name}
            </p>
            <p className="text-xs text-slate-500">{mapping.electrical.unit}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalogyMapperWidget({
  leftEq = "m*x'' + f*x' + k*x = F",
  rightEq = "L*q'' + R*q' + (1/C)*q = E",
  completedMappings: initialCompleted = [],
  requiredMappings,
  embedded = false,
  onStateChange,
  onComplete,
  lessonContext: externalContext,
  className = '',
}: AnalogyMapperWidgetProps) {
  // Get lesson context - handle both LessonContext (embedded) and LessonContextValue (standalone)
  const internalContext = useLessonContext();
  // Extract persona from either context type
  const aiPersona = externalContext?.aiPersona || internalContext?.aiConfig?.persona || 'tutor';

  // AI integration
  const { sendMessage, isLoading: aiLoading } = useLessonAI({
    persona: aiPersona as 'tutor' | 'critic' | 'analyst',
  });

  // Local state
  const [completedMappings, setCompletedMappings] = useState<string[]>(initialCompleted);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  // Calculate required mappings
  const required = requiredMappings || ANALOGY_MAPPINGS.map((m) => m.id);
  const allCompleted = required.every((id) => completedMappings.includes(id));

  // Handle mapping completion
  const handleMappingComplete = useCallback(
    (mappingId: string) => {
      if (completedMappings.includes(mappingId)) return;

      const newCompleted = [...completedMappings, mappingId];
      setCompletedMappings(newCompleted);

      // Emit state change
      const state: WidgetState = {
        phase: 'analogy',
        progress: Math.round((newCompleted.length / ANALOGY_MAPPINGS.length) * 100),
        data: {
          completedMappings: newCompleted,
          totalMappings: ANALOGY_MAPPINGS.length,
        },
        timestamp: Date.now(),
      };
      onStateChange?.(state);

      // Check if all required mappings are complete
      if (required.every((id) => newCompleted.includes(id))) {
        onComplete?.({
          success: true,
          score: 100,
          data: { completedMappings: newCompleted },
        });
      }
    },
    [completedMappings, required, onStateChange, onComplete]
  );

  // Generate contextual AI hints
  useEffect(() => {
    if (!embedded) return;

    if (completedMappings.length === 0) {
      setAiHint('点击连接按钮，将左侧机械量与右侧电气量配对。思考：为什么质量对应电感？');
    } else if (completedMappings.length < 3) {
      setAiHint('继续探索更多映射关系。注意观察单位的对应规律。');
    } else if (!allCompleted) {
      setAiHint('还差一点！完成所有映射以理解机电系统的统一性。');
    } else {
      setAiHint(null);
    }
  }, [completedMappings.length, allCompleted, embedded]);

  // Ask AI for explanation
  const askAI = async (mappingId?: string) => {
    setShowAIPanel(true);
    setAiResponse(null);

    let prompt = '请解释机械系统与电气系统之间的相似性原理。';
    if (mappingId) {
      const mapping = ANALOGY_MAPPINGS.find((m) => m.id === mappingId);
      if (mapping) {
        prompt = `请解释为什么机械系统中的"${mapping.mechanical.name}"(${mapping.mechanical.symbol})与电气系统中的"${mapping.electrical.name}"(${mapping.electrical.symbol})是相似的？它们在物理上有什么共同点？`;
      }
    }

    try {
      const response = await sendMessage(prompt);
      setAiResponse(response);
    } catch {
      setAiResponse('AI 响应失败，请稍后重试。');
    }
  };

  return (
    <div className={`relative flex h-full w-full flex-col bg-slate-950 ${className}`}>
      {/* Header */}
      {!embedded && (
        <div className="border-b border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 text-violet-500">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">机电相似映射</h2>
                <p className="text-sm text-slate-400">
                  发现机械与电气系统的数学相似性
                </p>
              </div>
            </div>

            <div className="text-sm text-slate-400">
              完成进度:{' '}
              <span className="font-mono text-amber-500">
                {completedMappings.length}/{ANALOGY_MAPPINGS.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* AI Hint Banner (embedded mode) */}
      {embedded && aiHint && (
        <div className="flex-shrink-0 border-b border-slate-800 bg-violet-500/10 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-violet-300">
            <Lightbulb className="h-4 w-4" />
            <span>{aiHint}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Instructions */}
          <div className="rounded-xl border border-slate-700 bg-gradient-to-r from-violet-500/10 to-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-violet-400" />
              <div>
                <p className="text-sm text-slate-300">
                  点击中间的连接按钮，将左侧机械量与右侧电气量配对。
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  无论外表是钢铁还是电子，数学灵魂是相通的。这就是二阶系统的普遍性。
                </p>
              </div>
            </div>
          </div>

          {/* Mapping Cards */}
          <div className="grid gap-4">
            {ANALOGY_MAPPINGS.map((mapping) => (
              <MappingCard
                key={mapping.id}
                mapping={mapping}
                isCompleted={completedMappings.includes(mapping.id)}
                onConnect={() => handleMappingComplete(mapping.id)}
              />
            ))}
          </div>

          {/* Completion Message */}
          {allCompleted && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-medium text-green-400">
                    恭喜！你已掌握机电相似原理
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    现在你可以用统一的数学语言描述机械和电气系统了。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Assistant Button */}
      {embedded && (
        <button
          onClick={() => askAI()}
          disabled={aiLoading}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-violet-500/50 bg-violet-500/10 px-4 py-2 text-sm text-violet-300 shadow-lg transition hover:bg-violet-500/20 disabled:opacity-50"
        >
          <Bot className="h-4 w-4" />
          {aiLoading ? '思考中...' : '请教 AI'}
        </button>
      )}

      {/* AI Response Panel */}
      {showAIPanel && (
        <div className="absolute bottom-16 right-4 z-20 w-80 max-h-60 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-violet-400">AI 助手</span>
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
              <div className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
              <span>正在分析...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
