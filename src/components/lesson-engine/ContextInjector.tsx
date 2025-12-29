'use client';

/**
 * 上下文注入器
 * Context Injector - Higher Order Component
 *
 * 将 step.context 中的信息注入到 UI 外围:
 * - 显示 descriptionOverride (引导语)
 * - 向全局 AIProvider 推送 aiAgentConfig
 * - 提供步骤相关的上下文
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { Bot, MessageSquare, Sparkles } from 'lucide-react';

import type { LessonStep, AIAgentConfig, StepContext } from '@/types/schema';

// ===== Context 定义 =====

interface LessonContextValue {
  /** 当前步骤 */
  step: LessonStep | null;

  /** 步骤上下文 */
  context: StepContext | null;

  /** AI 配置 */
  aiConfig: AIAgentConfig | null;

  /** 标题（覆盖后） */
  title: string | null;

  /** 描述（覆盖后） */
  description: string | null;
}

const LessonContext = createContext<LessonContextValue>({
  step: null,
  context: null,
  aiConfig: null,
  title: null,
  description: null,
});

/**
 * 使用课程上下文 Hook
 */
export function useLessonContext() {
  return useContext(LessonContext);
}

// ===== AI 角色配置 =====

const AI_PERSONA_CONFIG: Record<
  string,
  {
    name: string;
    icon: React.ReactNode;
    color: string;
    systemPrompt: string;
  }
> = {
  tutor: {
    name: '导师',
    icon: <Bot className="h-4 w-4" />,
    color: 'blue',
    systemPrompt:
      '你是一位耐心细致的导师，善于用简单易懂的语言解释复杂概念，循序渐进地引导学生学习。',
  },
  critic: {
    name: '评论家',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'red',
    systemPrompt:
      '你是一位严格的评论家，善于发现问题和漏洞，用批判性思维帮助学生提升。',
  },
  analyst: {
    name: '分析师',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'violet',
    systemPrompt:
      '你是一位专业的分析师，注重数据和逻辑，用精确的分析帮助学生理解系统。',
  },
};

// ===== AI 状态指示器组件 =====

interface AIStatusIndicatorProps {
  config: AIAgentConfig;
}

function AIStatusIndicator({ config }: AIStatusIndicatorProps) {
  const personaConfig = AI_PERSONA_CONFIG[config.persona];

  if (!personaConfig) return null;

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    violet: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${colorClasses[personaConfig.color]}`}
    >
      {personaConfig.icon}
      <span>AI {personaConfig.name}</span>
      {config.proactive && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
    </div>
  );
}

// ===== 引导语面板组件 =====

interface GuidePanelProps {
  description: string;
  aiConfig?: AIAgentConfig;
}

function GuidePanel({ description, aiConfig }: GuidePanelProps) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="mb-1 text-xs font-medium text-amber-400">教师引导</h4>
          <p className="text-sm text-slate-300">{description}</p>
        </div>
        {aiConfig && (
          <div className="flex-shrink-0">
            <AIStatusIndicator config={aiConfig} />
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 主组件属性 =====

interface ContextInjectorProps {
  /** 当前步骤 */
  step: LessonStep;

  /** 子组件 */
  children: ReactNode;

  /** 是否显示引导面板 */
  showGuidePanel?: boolean;

  /** 自定义类名 */
  className?: string;
}

// ===== 主组件 =====

export function ContextInjector({
  step,
  children,
  showGuidePanel = true,
  className = '',
}: ContextInjectorProps) {
  const { context } = step;

  // 计算上下文值
  const contextValue = useMemo<LessonContextValue>(
    () => ({
      step,
      context,
      aiConfig: context.aiAgentConfig || null,
      title: context.titleOverride || null,
      description: context.descriptionOverride || null,
    }),
    [step, context]
  );

  // 当 AI 配置变化时，可以向全局 AIProvider 推送配置
  // 这里使用 useEffect 来处理副作用
  useEffect(() => {
    if (context.aiAgentConfig) {
      const personaConfig = AI_PERSONA_CONFIG[context.aiAgentConfig.persona];
      const systemPrompt = [
        personaConfig?.systemPrompt,
        context.aiAgentConfig.systemPromptExtension,
      ]
        .filter(Boolean)
        .join('\n\n');

      // TODO: 向全局 AI Provider 推送配置
      // 示例: aiProvider.setSystemPrompt(systemPrompt);
      console.log('[ContextInjector] AI 配置已更新:', {
        persona: context.aiAgentConfig.persona,
        proactive: context.aiAgentConfig.proactive,
        systemPromptLength: systemPrompt.length,
      });
    }
  }, [context.aiAgentConfig]);

  // 检查是否有引导语需要显示
  const hasGuide = context.descriptionOverride || context.aiAgentConfig;

  return (
    <LessonContext.Provider value={contextValue}>
      <div className={`flex h-full flex-col ${className}`}>
        {/* 引导面板 */}
        {showGuidePanel && hasGuide && (
          <div className="flex-shrink-0 p-4 pb-0">
            <GuidePanel
              description={context.descriptionOverride || ''}
              aiConfig={context.aiAgentConfig}
            />
          </div>
        )}

        {/* 主内容 */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </LessonContext.Provider>
  );
}

// ===== 导出工具函数 =====

/**
 * 获取 AI 角色的系统提示
 */
export function getAISystemPrompt(config: AIAgentConfig): string {
  const personaConfig = AI_PERSONA_CONFIG[config.persona];
  return [personaConfig?.systemPrompt, config.systemPromptExtension]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * 获取 AI 角色配置
 */
export function getAIPersonaConfig(persona: string) {
  return AI_PERSONA_CONFIG[persona] || null;
}

export default ContextInjector;
