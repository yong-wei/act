'use client';

import { useState, useCallback } from 'react';
import type { WidgetResult } from '@/resources/widgets/widget-props';
import type { InteractiveProgressContextValue } from '../types';

interface UseInteractiveProgressOptions {
  initialProgress?: number;
  onComplete?: (result?: WidgetResult) => void | Promise<void>;
  onProgressChange?: (progress: number) => void;
}

/**
 * 互动进度钩子
 *
 * 管理互动组件的进度状态
 */
export function useInteractiveProgress(
  options: UseInteractiveProgressOptions = {}
): InteractiveProgressContextValue {
  const { initialProgress = 0, onComplete, onProgressChange } = options;

  const [progress, setProgressState] = useState(initialProgress);
  const [isComplete, setIsComplete] = useState(false);

  // 设置进度
  const setProgress = useCallback((value: number) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    setProgressState(clampedValue);
    onProgressChange?.(clampedValue);
  }, [onProgressChange]);

  // 标记完成
  const markComplete = useCallback(async (result?: WidgetResult) => {
    await onComplete?.(result);
    setIsComplete(true);
    setProgressState(100);
  }, [onComplete]);

  // 重置
  const reset = useCallback(() => {
    setProgressState(initialProgress);
    setIsComplete(false);
  }, [initialProgress]);

  return {
    current: progress,
    setProgress,
    isComplete,
    markComplete,
    reset,
  };
}
