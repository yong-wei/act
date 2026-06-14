/**
 * 控灵侧边栏面板组件
 *
 * 右侧边栏悬浮的AI对话面板
 */

'use client';

import { useChat, type Message } from '@/hooks/useLegacyChat';
import { useRef, useEffect, useState, useCallback } from 'react';
import { X, Send, Sparkles, MessageSquare, Trash2 } from 'lucide-react';
import { KonlingAvatar } from './konling-avatar';
import { AIMessageContent } from './ai-message-content';
import { KONLING_BRAND, getQuickQuestions } from '@/lib/ai-branding';
import { useAIThemeStyles, TRANSITION_CLASSES } from '@/lib/ai-theme-styles';
import type { PageContext, UserProfile } from '@/types/ai-context';
import { Button } from '@/components/ui/button';

interface KonlingSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pageContext?: PageContext;
  userProfile?: UserProfile | null;
  sessionId?: string;
  className?: string;
}

export function KonlingSidebar({
  isOpen,
  onClose,
  pageContext,
  userProfile,
  sessionId,
  className = '',
}: KonlingSidebarProps) {
  const styles = useAIThemeStyles();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
    append,
    setMessages,
  } = useChat({
    api: '/api/ai/chat',
    body: {
      pageContext,
      userProfile,
      sessionId,
      courseId: pageContext?.courseId,
      pageId: pageContext?.stepId,
    },
    onError: (err) => {
      console.error('Konling chat error:', err);
    },
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ESC键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleQuickQuestion = useCallback(
    (question: string) => {
      append({ role: 'user', content: question });
    },
    [append]
  );

  const handleClear = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const quickQuestions = pageContext?.courseId
    ? getQuickQuestions(pageContext.courseId)
    : KONLING_BRAND.quickQuestions.simulation;

  if (!mounted) return null;

  return (
    <>
      {/* 遮罩层 - 仅在移动端显示 */}
      {isOpen && (
        <div aria-label="关闭控灵侧栏" tabIndex={0} role="button" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm sm:hidden"
          onClick={onClose}
        />
      )}

      {/* 侧边栏面板 */}
      <div
        className={`
          fixed right-0 top-0 z-50 flex flex-col
          h-screen w-screen
          sm:w-[380px]
          lg:w-[420px]
          ${styles.container}
          ${TRANSITION_CLASSES.panel}
          ${isOpen
            ? 'translate-x-0 opacity-100'
            : 'translate-x-full opacity-0 pointer-events-none'
          }
          shadow-2xl
          ${className}
        `}
      >
        {/* 头部 */}
        <div className={`flex items-center justify-between border-b px-4 py-3 ${styles.header}`}>
          <div className="flex items-center gap-3">
            <KonlingAvatar size="md" />
            <div>
              <h3 className={`font-semibold ${styles.text.primary}`}>
                {KONLING_BRAND.name}
              </h3>
              <p className={`text-xs ${styles.text.secondary}`}>
                {pageContext?.topic
                  ? `当前: ${pageContext.topic.slice(0, 15)}${pageContext.topic.length > 15 ? '...' : ''}`
                  : KONLING_BRAND.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button type="button"
                onClick={handleClear}
                className={`rounded p-2 transition-colors ${styles.text.muted} hover:bg-slate-700/30`}
                title="清空对话"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button type="button"
              onClick={onClose}
              className={`rounded p-2 transition-colors ${styles.text.muted} hover:bg-slate-700/30`}
              title="关闭 (ESC)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-6">
              {/* 欢迎信息 */}
              <div className={`rounded-xl p-5 ${styles.message.assistant}`}>
                <div className="flex items-start gap-3">
                  <KonlingAvatar size="sm" />
                  <div>
                    <p className="text-sm leading-relaxed">
                      {pageContext
                        ? `你好，我是${KONLING_BRAND.name}。${
                            pageContext.pageType === 'theory'
                              ? `今天我们将探索「${pageContext.topic}」。`
                              : pageContext.pageType === 'practice'
                              ? `让我协助你完成「${pageContext.topic}」。`
                              : '有什么可以帮助你的吗？'
                          }`
                        : KONLING_BRAND.welcomeMessages.default}
                    </p>
                    {pageContext?.learningObjectives && (
                      <div className="mt-3">
                        <p className={`text-xs font-medium ${styles.text.secondary}`}>
                          学习目标:
                        </p>
                        <ul className={`mt-1 space-y-1 text-xs ${styles.text.muted}`}>
                          {pageContext.learningObjectives.slice(0, 2).map((obj, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 快捷问题 */}
              <div className="space-y-3">
                <p className={`text-xs ${styles.text.muted} flex items-center gap-1`}>
                  <MessageSquare className="h-3 w-3" />
                  你可以问我:
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickQuestions.map((q, i) => (
                    <button type="button"
                      key={i}
                      onClick={() => handleQuickQuestion(q.question)}
                      className={`
                        rounded-lg px-3 py-2 text-left text-xs transition-all
                        ${styles.buttonSecondary}
                        border
                        hover:border-amber-500/50
                      `}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <MessageBubble key={index} message={message} styles={styles} />
              ))}
              {isLoading && (
                <div className={`flex items-center gap-2 text-sm ${styles.text.muted}`}>
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>控灵正在思考...</span>
                </div>
              )}
              {error && (
                <div className="rounded-lg bg-red-900/30 p-3 text-sm text-red-300">
                  <p>出错了: {error.message}</p>
                  <Button size="sm" variant="ghost" onClick={() => reload()} className="mt-2 text-red-300">
                    重试
                  </Button>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <form onSubmit={handleSubmit} className={`border-t p-4 ${styles.border}`}>
          <div className="flex gap-2">
            <input
              type="text"
              name="konling-sidebar-input"
              aria-label="控灵 AI 问题输入框"
              value={input}
              onChange={handleInputChange}
              placeholder="请输入你的问题..."
              className={`
                flex-1 rounded-lg border px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2
                ${styles.input}
              `}
              disabled={isLoading}
            />
            {isLoading ? (
              <Button
                type="button"
                onClick={stop}
                variant="secondary"
                size="icon"
                className="h-10 w-10"
              >
                <span className="sr-only">停止</span>
                <div className="h-3 w-3 rounded-full bg-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                size="icon"
                className={`h-10 w-10 ${styles.button}`}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className={`mt-2 text-center text-xs ${styles.text.muted}`}>
            按 Enter 发送，ESC 关闭面板
          </p>
        </form>
      </div>
    </>
  );
}

/**
 * 消息气泡组件
 */
function MessageBubble({
  message,
  styles,
}: {
  message: Message;
  styles: ReturnType<typeof useAIThemeStyles>;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex max-w-[85%] gap-2">
        {!isUser && <KonlingAvatar size="sm" className="mt-0.5 shrink-0 self-start" />}
        <div
          className={`
            rounded-2xl px-4 py-2.5 text-sm leading-relaxed
            ${isUser ? styles.message.user : styles.message.assistant}
          `}
        >
          {/* 工具调用结果 */}
          {message.toolInvocations?.map((tool, index) => (
            <div key={index} className="mb-2 rounded-lg border border-slate-600/30 bg-slate-900/50 p-2">
              <div className={`mb-1 text-xs ${styles.text.secondary}`}>
                {tool.toolName === 'get_simulation_status' && '📊 仿真状态'}
                {tool.toolName === 'set_simulation_params' && '⚙️ 参数修改'}
                {tool.toolName === 'analyze_result' && '📈 结果分析'}
              </div>
              {tool.state === 'result' && (
                <pre className={`overflow-x-auto text-xs ${styles.text.muted}`}>
                  {JSON.stringify(tool.result, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {/* 文本消息 */}
          {message.content && (
            <AIMessageContent content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}
