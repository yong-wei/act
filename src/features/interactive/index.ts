/**
 * Interactive Framework - Public Exports
 *
 * 统一互动组件框架的公共 API
 */

// 主组件
export { InteractiveProvider } from './InteractiveProvider';
export { InteractiveHeader } from './InteractiveHeader';
export { InteractiveAIPanel } from './InteractiveAIPanel';

// 上下文
export { InteractiveContext, useInteractiveContext, useOptionalInteractiveContext } from './context';

// 钩子
export { useInteractiveTracking } from './hooks/useInteractiveTracking';
export { useInteractiveProgress } from './hooks/useInteractiveProgress';
export { useInteractiveAI } from './hooks/useInteractiveAI';

// 类型
export type {
  // 事件类型
  InteractiveEventType,
  InteractiveEvent,
  // 配置类型
  InteractiveConfig,
  InteractiveResourceConfig,
  InteractiveAIConfig,
  InteractiveTrackingConfig,
  InteractiveCompletionConfig,
  InteractiveLayoutConfig,
  // 上下文类型
  InteractiveContextValue,
  InteractiveAIContextValue,
  InteractiveTrackingContextValue,
  InteractiveProgressContextValue,
  InteractiveSessionContextValue,
  // 其他类型
  AIMessage,
  InteractiveProviderProps,
  InteractiveStateSnapshot,
} from './types';
