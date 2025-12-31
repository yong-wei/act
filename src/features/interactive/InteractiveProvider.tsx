'use client';

import React, { useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { InteractiveContext } from './context';
import { InteractiveHeader } from './InteractiveHeader';
import { InteractiveAIPanel } from './InteractiveAIPanel';
import { useInteractiveTracking } from './hooks/useInteractiveTracking';
import { useInteractiveProgress } from './hooks/useInteractiveProgress';
import { useInteractiveAI } from './hooks/useInteractiveAI';
import type {
  InteractiveProviderProps,
  InteractiveContextValue,
  InteractiveStateSnapshot,
} from './types';

/**
 * InteractiveProvider - 统一互动组件包装器
 *
 * 为所有单页互动组件提供：
 * - AI 上下文集成
 * - 交互级别埋点追踪
 * - 进度记录与数据库同步
 * - 基础 UI 框架（头部、AI 面板）
 */
export function InteractiveProvider({
  children,
  config,
  showAIPanel: showAIPanelProp,
  showHeader: showHeaderProp,
  embedded = false,
  sessionId,
  userId: userIdProp,
  onComplete,
  onStateChange,
}: InteractiveProviderProps) {
  const { data: session } = useSession();

  // 确定用户 ID
  const userId = userIdProp || session?.user?.id;
  const isAuthenticated = !!session?.user;

  // 从配置中读取布局选项
  const layoutConfig = config.config.layout;
  const showHeader = showHeaderProp ?? layoutConfig?.showHeader ?? !embedded;
  const showAIPanel = showAIPanelProp ?? layoutConfig?.showAIPanel ?? true;
  const aiPanelPosition = layoutConfig?.aiPanelPosition ?? 'right';

  // 初始化追踪钩子
  const tracking = useInteractiveTracking({
    resourceId: config.resourceId,
    userId,
    sessionId,
    syncInterval: config.config.tracking?.syncInterval,
  });

  // 初始化进度钩子
  const progress = useInteractiveProgress({
    onComplete: (result) => {
      tracking.emit('complete', { result });
      onComplete?.(result);
    },
    onProgressChange: (value) => {
      // 可选：追踪进度变化
      if (value > 0 && value < 100) {
        // 避免频繁追踪，只在关键点追踪
      }
    },
  });

  // 初始化 AI 钩子
  const ai = useInteractiveAI({
    config,
    persona: config.config.ai?.persona,
    contextData: {
      progress: progress.current,
      isComplete: progress.isComplete,
    },
    onMessage: (message) => {
      if (message.role === 'user') {
        tracking.emit('ai_query', { question: message.content });
      }
    },
  });

  // 组装会话上下文
  const sessionContext = useMemo(() => ({
    sessionId,
    userId,
    isEmbedded: embedded,
    isAuthenticated,
  }), [sessionId, userId, embedded, isAuthenticated]);

  // 组装完整上下文
  const contextValue: InteractiveContextValue = useMemo(() => ({
    config,
    ai,
    tracking,
    progress,
    session: sessionContext,
  }), [config, ai, tracking, progress, sessionContext]);

  // 状态变化回调
  const emitStateChange = useCallback(() => {
    if (!onStateChange) return;

    const snapshot: InteractiveStateSnapshot = {
      progress: progress.current,
      isComplete: progress.isComplete,
      events: tracking.getHistory(),
      timestamp: Date.now(),
    };
    onStateChange(snapshot);
  }, [onStateChange, progress, tracking]);

  // 监听状态变化
  useEffect(() => {
    emitStateChange();
  }, [progress.current, progress.isComplete, emitStateChange]);

  // 组件挂载时发送 view 事件
  useEffect(() => {
    tracking.emit('view', {
      title: config.title,
      registryId: config.registryId,
      embedded,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 渲染布局
  return (
    <InteractiveContext.Provider value={contextValue}>
      <div className="flex flex-col h-full bg-slate-950">
        {/* 头部 */}
        {showHeader && (
          <InteractiveHeader
            title={config.title}
            progress={progress.current}
            showAIToggle={showAIPanel && ai.isEnabled}
            isAIPanelOpen={ai.isPanelOpen}
            onToggleAIPanel={ai.togglePanel}
            embedded={embedded}
          />
        )}

        {/* 主内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 互动内容 */}
          <div className={`flex-1 overflow-auto ${ai.isPanelOpen && showAIPanel ? '' : 'w-full'}`}>
            {children}
          </div>

          {/* AI 面板 */}
          {showAIPanel && ai.isPanelOpen && (
            <InteractiveAIPanel
              ai={ai}
              title={`AI 助手 - ${config.title}`}
              onClose={ai.togglePanel}
              position={aiPanelPosition}
            />
          )}
        </div>
      </div>
    </InteractiveContext.Provider>
  );
}
