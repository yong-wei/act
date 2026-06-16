/**
 * 全局AI助手侧边栏
 *
 * 右侧边栏悬浮面板，集成Vercel AI SDK的useChat
 * 根据页面上下文动态构建系统提示词和可用工具
 */

'use client';

import { useChat, type Message } from '@/hooks/useLegacyChat';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { X, Send, Sparkles, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { KonlingAvatar } from './konling-avatar';
import { AIMessageContent } from './ai-message-content';
import { useAIThemeStyles, TRANSITION_CLASSES } from '@/lib/ai-theme-styles';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { Button } from '@/components/ui/button';
import { KONLING_BRAND, getQuickQuestions } from '@/lib/ai-branding';

export function GlobalAISidebar() {
  const styles = useAIThemeStyles();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerElementRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [sessionId] = useState(() => `global-${Date.now()}`);
  const [knowledgeInspectorAvoidanceActive, setKnowledgeInspectorAvoidanceActive] = useState(false);

  const {
    pageContext,
    userProfile,
    isOpen,
    closeSidebar,
    tools,
    systemPromptExtension,
    assistantEntryPoint,
    knowledgeWorkspaceHint,
    quickQuestions,
    clearUnread,
  } = useGlobalAI();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 构建请求体
  const chatBody = useMemo(() => ({
    pageContext,
    userProfile,
    sessionId,
    courseId: pageContext?.courseId,
    pageId: pageContext?.stepId || pageContext?.courseId,
    resourceId: assistantEntryPoint?.serverContext.resourceId,
    pathNodeId: assistantEntryPoint?.serverContext.pathNodeId,
    tools, // 传递可用工具列表，让后端过滤
    systemPromptExtension,
    teachingAssistantModeId: assistantEntryPoint?.mode,
    modeClientContextHints: assistantEntryPoint?.serverContext,
    knowledgeWorkspaceHint: knowledgeWorkspaceHint ?? assistantEntryPoint?.serverContext,
  }), [pageContext, userProfile, sessionId, tools, systemPromptExtension, assistantEntryPoint, knowledgeWorkspaceHint]);

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
    body: chatBody,
    onError: (err) => {
      console.error('Global AI chat error:', err);
    },
    onFinish: () => {
      if (assistantEntryPoint?.mode !== 'path-advisor') return;
      window.dispatchEvent(new CustomEvent('konling:adaptive-path-updated', {
        detail: {
          mode: assistantEntryPoint.mode,
          courseId: pageContext?.courseId ?? null,
          pageId: pageContext?.stepId ?? null,
        },
      }));
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
        closeSidebar();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, closeSidebar]);

  useEffect(() => {
    if (isOpen) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body) {
        openerElementRef.current = activeElement;
      }
      wasOpenRef.current = true;
      window.requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      return;
    }

    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    window.requestAnimationFrame(() => {
      const opener = openerElementRef.current;
      if (opener?.isConnected && opener.offsetParent !== null) {
        opener.focus();
        return;
      }
      document.querySelector<HTMLElement>('[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]')?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setKnowledgeInspectorAvoidanceActive(false);
      return;
    }

    const updateAvoidance = () => {
      const hasDesktopInspector = window.matchMedia('(min-width: 1024px)').matches
        && Boolean(document.querySelector('[data-knowledge-inspector="stable-rail"]'));
      setKnowledgeInspectorAvoidanceActive(hasDesktopInspector);
    };

    updateAvoidance();
    window.addEventListener('resize', updateAvoidance);
    const observer = new MutationObserver(updateAvoidance);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['data-knowledge-inspector'],
    });

    return () => {
      window.removeEventListener('resize', updateAvoidance);
      observer.disconnect();
    };
  }, [isOpen]);

  // 处理快捷问题
  const handleQuickQuestion = useCallback(
    (question: string) => {
      append({ role: 'user', content: question });
      clearUnread();
    },
    [append, clearUnread]
  );

  // 清空对话
  const handleClear = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  // 构建欢迎消息
  const welcomeMessage = useMemo(() => {
    if (!pageContext) {
      return KONLING_BRAND.welcomeMessages.default;
    }

    const { pageType, topic, courseTitle } = pageContext;
    switch (pageType) {
      case 'theory':
        return `你好，我是${KONLING_BRAND.name}。今天我们将探索「${topic || courseTitle}」，有任何问题随时问我。`;
      case 'practice':
        return `你好，我是${KONLING_BRAND.name}。让我协助你完成「${topic || courseTitle}」，遇到困难可以向我求助。`;
      case 'workspace':
        return `你好，我是${KONLING_BRAND.name}。我正在${topic || courseTitle}页面，有什么可以帮助你的吗？`;
      case 'quiz':
        return KONLING_BRAND.welcomeMessages.quiz;
      case 'reflection':
        return KONLING_BRAND.welcomeMessages.reflection;
      default:
        return KONLING_BRAND.welcomeMessages.default;
    }
  }, [pageContext]);

  const knowledgeWorkspaceContext = useMemo(() => {
    if (!pageContext || (pageContext.courseId !== 'knowledge' && pageContext.stepId !== '/knowledge')) return null;
    const status = knowledgeWorkspaceHint?.status ?? 'no-selection';
    if (status === 'selected-node') {
      return {
        status,
        label: '已选知识节点',
        description: '当前选中的知识节点已进入控灵上下文。',
      };
    }
    if (status === 'degraded') {
      return {
        status,
        label: '节点未解析',
        description: '请求的知识节点暂不可用，控灵将仅使用当前筛选与视图状态。',
      };
    }
    return {
      status,
      label: '未选择节点',
      description: '控灵仅接收图谱筛选与视图状态。',
    };
  }, [knowledgeWorkspaceHint, pageContext]);

  if (!mounted) return null;

  return (
    <>
      {/* 遮罩层 - 仅在移动端显示 */}
      {isOpen && (
        <div aria-label="关闭 AI 侧栏" tabIndex={0} role="button" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200 sm:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* 侧边栏面板 */}
      <div
        ref={panelRef}
        tabIndex={-1}
        style={knowledgeInspectorAvoidanceActive ? {
          top: '7rem',
          right: 'calc(1.5rem + clamp(22.5rem, 30vw, 28.75rem))',
          height: 'calc(100vh - 8rem)',
        } : undefined}
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
        `}
        data-global-ai-sidebar={isOpen ? 'open' : 'closed'}
        data-konling-assistant-surface="global-sidebar"
        data-konling-inspector-avoidance={knowledgeInspectorAvoidanceActive ? 'active' : 'inactive'}
        data-knowledge-mobile-inspector-policy={
          pageContext?.courseId === 'knowledge' || pageContext?.stepId === '/knowledge'
            ? 'suspend'
            : undefined
        }
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
              onClick={closeSidebar}
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
                    <p className="text-sm leading-relaxed">{welcomeMessage}</p>
                    {knowledgeWorkspaceContext && (
                      <div
                        className={`mt-3 rounded-lg border px-3 py-2 text-xs ${styles.border} ${styles.text.secondary}`}
                        data-konling-knowledge-context={knowledgeWorkspaceContext.status}
                      >
                        <p className={`font-medium ${styles.text.primary}`}>知识图谱上下文 · {knowledgeWorkspaceContext.label}</p>
                        <p className="mt-1">{knowledgeWorkspaceContext.description}</p>
                      </div>
                    )}
                    {pageContext?.learningObjectives && pageContext.learningObjectives.length > 0 && (
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
                <MessageBubble key={message.id || index} message={message} styles={styles} />
              ))}
              {isLoading && (
                <div className={`flex items-center gap-2 text-sm ${styles.text.muted}`}>
                  <Loader2 className="h-4 w-4 animate-spin" />
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
              name="global-ai-sidebar-input"
              aria-label="全局 AI 问题输入框"
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
                {tool.toolName === 'get_workspace_status' && '🎮 工作区状态'}
                {tool.toolName === 'analyze_design' && '🔍 设计分析'}
                {tool.toolName === 'get_hints' && '💡 提示'}
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

export default GlobalAISidebar;
