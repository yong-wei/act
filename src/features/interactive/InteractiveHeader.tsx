'use client';

import React from 'react';
import { ArrowLeft, Bot, X } from 'lucide-react';
import Link from 'next/link';

interface InteractiveHeaderProps {
  title: string;
  progress: number;
  showAIToggle?: boolean;
  isAIPanelOpen?: boolean;
  onToggleAIPanel?: () => void;
  backLink?: string;
  embedded?: boolean;
}

/**
 * 互动组件头部
 *
 * 显示标题、进度条和 AI 开关
 */
export function InteractiveHeader({
  title,
  progress,
  showAIToggle = true,
  isAIPanelOpen = false,
  onToggleAIPanel,
  backLink = '/interactive-learning',
  embedded = false,
}: InteractiveHeaderProps) {
  if (embedded) {
    // 嵌入模式下使用简化头部
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-700">
        <h2 className="text-sm font-medium text-slate-200 truncate">{title}</h2>
        <div className="flex items-center gap-3">
          {/* 进度指示器 */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-slate-400">{Math.round(progress)}%</span>
          </div>
          {/* AI 开关 */}
          {showAIToggle && onToggleAIPanel && (
            <button
              onClick={onToggleAIPanel}
              className={`p-1.5 rounded-md transition-colors ${
                isAIPanelOpen
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
              title={isAIPanelOpen ? '关闭 AI 助手' : '打开 AI 助手'}
            >
              {isAIPanelOpen ? <X className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 独立模式下的完整头部
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-700">
      <div className="flex items-center gap-4">
        {/* 返回链接 */}
        <Link
          href={backLink}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回</span>
        </Link>
        {/* 标题 */}
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* 进度条 */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">进度</span>
          <div className="h-2 w-32 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-slate-200">{Math.round(progress)}%</span>
        </div>

        {/* AI 开关 */}
        {showAIToggle && onToggleAIPanel && (
          <button
            onClick={onToggleAIPanel}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              isAIPanelOpen
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-600'
            }`}
          >
            <Bot className="h-4 w-4" />
            <span className="text-sm">{isAIPanelOpen ? '关闭助手' : 'AI 助手'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
