/**
 * Interactive Framework - Type Definitions
 *
 * 为所有单页互动组件提供统一的类型定义
 */

import type { WidgetResult } from '@/resources/widgets/widget-props';

// ========== 事件类型 ==========

/** 互动事件类型 */
export type InteractiveEventType =
  | 'view'         // 组件加载/查看
  | 'interact'     // 用户交互（点击、拖拽等）
  | 'param_change' // 参数调整
  | 'submit'       // 提交答案/结果
  | 'ai_query'     // AI 查询
  | 'complete'     // 完成任务
  | 'error';       // 错误发生

/** 互动事件 */
export interface InteractiveEvent {
  id: string;
  type: InteractiveEventType;
  resourceId?: string | null;
  userId?: string;
  sessionId?: string;
  timestamp: number;
  data: Record<string, unknown>;
}

// ========== 配置类型 ==========

/** AI 配置 */
export interface InteractiveAIConfig {
  enabled?: boolean;
  persona?: 'tutor' | 'critic' | 'analyst';
  hints?: string;
  proactive?: boolean;
}

/** 追踪配置 */
export interface InteractiveTrackingConfig {
  events?: InteractiveEventType[];
  syncInterval?: number; // 同步间隔 (ms)
}

/** 完成标准配置 */
export interface InteractiveCompletionConfig {
  requiredInteractions?: string[];
  minProgress?: number;
  minTimeSpent?: number; // 秒
}

/** 布局配置 */
export interface InteractiveLayoutConfig {
  showHeader?: boolean;
  showAIPanel?: boolean;
  aiPanelPosition?: 'right' | 'bottom' | 'floating';
}

/** 资源配置（从数据库读取） */
export interface InteractiveResourceConfig {
  props?: Record<string, unknown>;
  ai?: InteractiveAIConfig;
  tracking?: InteractiveTrackingConfig;
  completion?: InteractiveCompletionConfig;
  layout?: InteractiveLayoutConfig;
}

/** 互动配置（传递给 Provider） */
export interface InteractiveConfig {
  resourceId: string;
  registryId: string;
  title: string;
  description?: string;
  aiHints?: string;
  config: InteractiveResourceConfig;
}

// ========== 上下文类型 ==========

/** AI 上下文值 */
export interface InteractiveAIContextValue {
  isEnabled: boolean;
  isPanelOpen: boolean;
  togglePanel: () => void;
  sendMessage: (content: string) => Promise<string>;
  messages: AIMessage[];
  isLoading: boolean;
  error: Error | null;
}

/** AI 消息 */
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: unknown;
}

/** 追踪上下文值 */
export interface InteractiveTrackingContextValue {
  emit: (type: InteractiveEventType, data?: Record<string, unknown>) => void;
  getHistory: () => InteractiveEvent[];
  clearHistory: () => void;
}

/** 进度上下文值 */
export interface InteractiveProgressContextValue {
  current: number;
  setProgress: (value: number) => void;
  isComplete: boolean;
  markComplete: (result?: WidgetResult) => void;
  reset: () => void;
}

/** 会话上下文值 */
export interface InteractiveSessionContextValue {
  sessionId?: string;
  userId?: string;
  isEmbedded: boolean;
  isAuthenticated: boolean;
}

/** 完整上下文值 */
export interface InteractiveContextValue {
  config: InteractiveConfig;
  ai: InteractiveAIContextValue;
  tracking: InteractiveTrackingContextValue;
  progress: InteractiveProgressContextValue;
  session: InteractiveSessionContextValue;
}

// ========== Provider Props ==========

/** InteractiveProvider 组件属性 */
export interface InteractiveProviderProps {
  children: React.ReactNode;
  config: InteractiveConfig;

  /** 是否显示 AI 面板 */
  showAIPanel?: boolean;

  /** 是否显示头部（标题、进度条） */
  showHeader?: boolean;

  /** 是否嵌入模式（在课堂播放器中） */
  embedded?: boolean;

  /** 课堂会话 ID */
  sessionId?: string;

  /** 用户 ID（从 session 获取） */
  userId?: string;

  /** 完成回调 */
  onComplete?: (result?: WidgetResult) => void;

  /** 状态变化回调 */
  onStateChange?: (state: InteractiveStateSnapshot) => void;
}

/** 状态快照（用于 AI 上下文和回调） */
export interface InteractiveStateSnapshot {
  progress: number;
  isComplete: boolean;
  events: InteractiveEvent[];
  timestamp: number;
}
