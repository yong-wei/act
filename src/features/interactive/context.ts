'use client';

import { createContext, useContext } from 'react';
import type { InteractiveContextValue } from './types';

/**
 * Interactive Context
 *
 * 为所有单页互动组件提供统一的上下文
 */
export const InteractiveContext = createContext<InteractiveContextValue | null>(null);

/**
 * 获取互动上下文的钩子
 *
 * @throws 如果在 InteractiveProvider 外部使用会抛出错误
 */
export function useInteractiveContext(): InteractiveContextValue {
  const context = useContext(InteractiveContext);

  if (!context) {
    throw new Error(
      'useInteractiveContext must be used within an InteractiveProvider. ' +
      'Make sure your component is wrapped with <InteractiveProvider>.'
    );
  }

  return context;
}

/**
 * 安全获取互动上下文的钩子（可选）
 *
 * 如果不在 Provider 内部，返回 null 而不是抛出错误
 */
export function useOptionalInteractiveContext(): InteractiveContextValue | null {
  return useContext(InteractiveContext);
}
