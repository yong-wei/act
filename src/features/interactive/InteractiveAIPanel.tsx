'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, X, Sparkles } from 'lucide-react';
import { KonlingChatMessageList, konlingPromptInputClassName } from '@/components/ai/konling-chat-renderer';
import type { InteractiveAIContextValue } from './types';

interface InteractiveAIPanelProps {
  ai: InteractiveAIContextValue;
  title?: string;
  onClose?: () => void;
  position?: 'right' | 'bottom' | 'floating';
}

/**
 * AI 助手面板
 *
 * 提供对话界面，支持流式响应
 */
export function InteractiveAIPanel({
  ai,
  title = 'AI 学习助手',
  onClose,
  position = 'right',
}: InteractiveAIPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ai.messages]);

  // 发送消息
  const handleSend = async () => {
    const content = input.trim();
    if (!content || ai.isLoading) return;

    setInput('');
    try {
      await ai.sendMessage(content);
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 位置样式
  const positionStyles = {
    right: 'w-80 h-full border-l border-slate-700',
    bottom: 'w-full h-64 border-t border-slate-700',
    floating: 'w-96 h-[500px] rounded-lg shadow-2xl border border-slate-700',
  };

  if (!ai.isEnabled) {
    return null;
  }

  return (
    <div
      className={`flex flex-col bg-slate-900/95 backdrop-blur ${positionStyles[position]}`}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-medium text-white">{title}</span>
        </div>
        {onClose && (
          <button type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {ai.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
            <Bot className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">我是你的 AI 学习助手</p>
            <p className="text-xs mt-1 text-slate-500">有任何问题都可以问我</p>
          </div>
        ) : (
          <KonlingChatMessageList messages={ai.messages} />
        )}
        {ai.isLoading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">正在思考...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 错误提示 */}
      {ai.error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-xs text-red-400">{ai.error.message}</p>
        </div>
      )}

      {/* 输入区域 */}
      <div className="p-3 border-t border-slate-700">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            name="interactive-ai-input"
            aria-label="AI 问题输入框"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题..."
            rows={1}
            className={`${konlingPromptInputClassName} resize-none bg-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button type="button"
            onClick={handleSend}
            disabled={!input.trim() || ai.isLoading}
            className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
