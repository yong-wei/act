/**
 * 全局AI助手侧边栏
 *
 * 右侧边栏悬浮面板，集成Vercel AI SDK的useChat
 * 根据页面上下文动态构建系统提示词和可用工具
 */

'use client';

import { useChat } from '@/hooks/useLegacyChat';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Check,
  History,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { KonlingAvatar } from './konling-avatar';
import {
  KonlingChatMessageList,
  konlingPromptInputClassName,
  type KonlingStructuredActionRequest,
  type KonlingStructuredActionResult,
} from './konling-chat-renderer';
import { useAIThemeStyles, TRANSITION_CLASSES } from '@/lib/ai-theme-styles';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import { Button } from '@/components/ui/button';
import { KONLING_BRAND, getQuickQuestions } from '@/lib/ai-branding';
import {
  useKonlingConversationLibrary,
  visibleKonlingMessages,
} from '@/hooks/useKonlingConversationLibrary';
import { resolveRegisteredAIContextFromPath } from '@/lib/ai-context-resolver';
import { platformLayerStyle } from '@/components/platform/platform-layers';
import { useOptionalPageFloatingControls } from '@/components/shared/page-floating-controls';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const MOBILE_HISTORY_QUERY = '(max-width: 767px)';

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((item) => !item.hasAttribute('disabled') && !item.closest('[inert]') && item.offsetParent !== null);
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener('change', updateMatches);
    return () => mediaQuery.removeEventListener('change', updateMatches);
  }, [query]);

  return matches;
}

export function GlobalAISidebar() {
  const styles = useAIThemeStyles();
  const panelRef = useRef<HTMLDivElement>(null);
  const maximizeControlRef = useRef<HTMLButtonElement>(null);
  const historyControlRef = useRef<HTMLButtonElement>(null);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const openerElementRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handledPathSelectionToolCallsRef = useRef(new Set<string>());
  const [mounted, setMounted] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [knowledgeInspectorAvoidanceActive, setKnowledgeInspectorAvoidanceActive] = useState(false);
  const [actionStatus, setActionStatus] = useState('控灵侧栏已就绪。');
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [smartPrepContext, setSmartPrepContext] = useState<Record<string, string> | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const floatingControls = useOptionalPageFloatingControls();
  const isNarrowViewport = useMediaQuery(MOBILE_HISTORY_QUERY);
  const isMobileHistoryDrawerOpen = isMaximized && isNarrowViewport && libraryOpen;

  const {
    pageContext,
    userProfile,
    enabled,
    isOpen,
    closeSidebar,
    tools,
    systemPromptExtension,
    assistantEntryPoint,
    knowledgeWorkspaceHint,
    quickQuestions,
    clearUnread,
    pathname,
    pendingAssistantRequest,
    completeAssistantRequest,
    failAssistantRequest,
  } = useGlobalAI();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 构建请求体
  const effectiveServerContext = smartPrepContext ?? assistantEntryPoint?.serverContext;
  const requestedAssistantBinding = useMemo(() => assistantEntryPoint ? {
    teachingAssistantModeId: assistantEntryPoint.mode,
    modeClientContextHints: effectiveServerContext ?? {},
  } : null, [assistantEntryPoint, effectiveServerContext]);
  const conversationPageId = useMemo(() => {
    const registeredRoute = resolveRegisteredAIContextFromPath(pathname);
    return registeredRoute?.courseId === pageContext?.courseId
      ? pathname
      : pageContext?.stepId || pageContext?.courseId;
  }, [pageContext?.courseId, pageContext?.stepId, pathname]);
  const {
    conversations,
    activeConversationId,
    activeConversation,
    activeAssistantBinding,
    search,
    setSearch,
    isLoading: isConversationLoading,
    isMutating: isConversationMutating,
    error: conversationError,
    refreshConversations,
    refreshActiveConversation,
    createConversation,
    ensureConversation,
    selectConversation,
    renameConversation,
    setConversationPinned,
    deleteConversation,
  } = useKonlingConversationLibrary({
    enabled: mounted && enabled,
    courseId: pageContext?.courseId,
    pageId: conversationPageId,
    pageContext: pageContext ?? undefined,
    classId: effectiveServerContext?.classId,
    resourceId: effectiveServerContext?.resourceId,
    pathNodeId: effectiveServerContext?.pathNodeId,
    assistantBinding: requestedAssistantBinding,
  });
  const agentSessionStorageKey = useMemo(() => {
    if (assistantEntryPoint?.mode !== 'prep-coauthor') return null;
    return `konling:agent-session:smart-prep:${effectiveServerContext?.smartTaskId ?? 'bootstrap'}`;
  }, [assistantEntryPoint?.mode, effectiveServerContext?.smartTaskId]);

  useEffect(() => {
    setSmartPrepContext(null);
  }, [assistantEntryPoint]);

  useEffect(() => {
    if (!agentSessionStorageKey) {
      setAgentSessionId(null);
      return;
    }
    setAgentSessionId(window.localStorage.getItem(agentSessionStorageKey));
  }, [agentSessionStorageKey]);

  useEffect(() => {
    const handleConfirmed = (event: Event) => {
      const detail = (event as CustomEvent<{ taskId?: string; taskRevision?: number }>).detail;
      if (!detail?.taskId) return;
      const nextContext = { smartTaskId: detail.taskId, smartTaskRevision: String(detail.taskRevision ?? 1) };
      setSmartPrepContext(nextContext);
    };
    window.addEventListener('konling:smart-task-confirmed', handleConfirmed);
    return () => window.removeEventListener('konling:smart-task-confirmed', handleConfirmed);
  }, []);

  const handleChatResponse = useCallback((response: Response) => {
    const nextAgentSessionId = response.headers.get('X-Konling-Agent-Session-Id');
    if (!nextAgentSessionId) return;
    setAgentSessionId(nextAgentSessionId);
    if (agentSessionStorageKey) window.localStorage.setItem(agentSessionStorageKey, nextAgentSessionId);
  }, [agentSessionStorageKey]);

  async function handleStructuredAction(
    action: KonlingStructuredActionRequest,
  ): Promise<KonlingStructuredActionResult> {
    if (action.action === 'refresh') {
      try {
        await refreshActiveConversation();
        if (action.taskId) {
          window.dispatchEvent(new CustomEvent('konling:smart-task-refresh-requested', {
            detail: { taskId: action.taskId },
          }));
        }
        setActionStatus('已刷新任务和会话状态。');
        return { state: 'failed', message: '已刷新任务和会话状态。' };
      } catch {
        setActionStatus('刷新失败，请重新打开备课任务。');
        return { state: 'failed', message: '刷新失败，请重新打开备课任务。' };
      }
    }
    if (action.action === 'regenerate') {
      await append({
        role: 'user',
        content: '请基于当前最新备课任务状态重新生成一条可确认的建议。',
      });
      setActionStatus('正在重新生成建议。');
      return { state: 'failed', message: '正在重新生成建议。' };
    }
    const url = action.action === 'ignore'
      ? `/api/teacher/smart-lesson-tasks/konling-suggestions/${encodeURIComponent(action.suggestionId)}/ignore`
      : action.operation === 'bootstrap'
        ? `/api/teacher/smart-lesson-tasks/konling-suggestions/${encodeURIComponent(action.suggestionId)}/confirm`
        : `/api/teacher/smart-lesson-tasks/${encodeURIComponent(action.taskId ?? '')}/konling-suggestions/${encodeURIComponent(action.suggestionId)}/confirm`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await response.json();
    const conversationRefreshed = await refreshActiveConversation().then(() => true).catch(() => false);
    if (response.ok && action.action === 'ignore') {
      setActionStatus('已忽略控灵建议。');
      return { state: 'ignored', message: '已忽略此建议。' };
    }
    if (response.ok && payload.task?.id) {
      const detail = {
        taskId: payload.task.id,
        taskRevision: payload.task.revision,
        affectedStageId: payload.affectedStageId ?? 'topic-goals',
        task: payload.task,
      };
      if (agentSessionId) {
        window.localStorage.setItem(`konling:agent-session:smart-prep:${payload.task.id}`, agentSessionId);
      }
      window.dispatchEvent(new CustomEvent('konling:smart-task-confirmed', { detail }));
      const message = conversationRefreshed
        ? action.operation === 'bootstrap' ? '已创建备课任务。' : '建议已应用到备课任务。'
        : '建议已应用；会话刷新失败，可使用“刷新任务”恢复显示。';
      setActionStatus(message);
      return { state: 'applied', message, refreshRecovery: !conversationRefreshed };
    }
    const code = typeof payload?.error?.code === 'string' ? payload.error.code : '';
    const conflict = response.status === 409 || code.includes('conflict') || code.includes('revision');
    const message = conflict
      ? '任务已发生变化，此建议无法继续应用。'
      : '操作未完成，请刷新任务或重新生成建议。';
    setActionStatus(message);
    return { state: conflict ? 'conflict' : 'failed', message };
  }

  const chatBody = useMemo(() => ({
    pageContext,
    userProfile,
    conversationId: activeConversationId ?? undefined,
    courseId: pageContext?.courseId,
    pageId: conversationPageId,
    resourceId: activeAssistantBinding?.modeClientContextHints.resourceId,
    pathNodeId: activeAssistantBinding?.modeClientContextHints.pathNodeId,
    tools, // 传递可用工具列表，让后端过滤
    systemPromptExtension,
    teachingAssistantModeId: activeAssistantBinding?.teachingAssistantModeId,
    agentSessionId: agentSessionId ?? undefined,
    modeClientContextHints: activeAssistantBinding?.modeClientContextHints,
    knowledgeWorkspaceHint: knowledgeWorkspaceHint ?? activeAssistantBinding?.modeClientContextHints,
  }), [pageContext, userProfile, activeConversationId, conversationPageId, tools, systemPromptExtension, activeAssistantBinding, knowledgeWorkspaceHint, agentSessionId]);

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
      void Promise.all([
        refreshConversations(),
        refreshActiveConversation(),
      ]).catch(() => undefined);
      if (activeAssistantBinding?.teachingAssistantModeId === 'path-advisor') {
        window.dispatchEvent(new CustomEvent('konling:adaptive-path-updated', {
          detail: {
            mode: activeAssistantBinding.teachingAssistantModeId,
            courseId: pageContext?.courseId ?? null,
            pageId: pageContext?.stepId ?? null,
          },
        }));
      }
    },
    onResponse: handleChatResponse,
  });

  useEffect(() => {
    if (activeAssistantBinding?.teachingAssistantModeId !== 'path-advisor') return;
    for (const message of messages) {
      for (const invocation of message.toolInvocations ?? []) {
        if (invocation.toolName !== 'select_learning_path' || invocation.state !== 'result') continue;
        const result = recordValue(invocation.result);
        if (result.status !== 'selected') continue;
        const pathId = stringValue(result.pathId);
        const batchId = stringValue(result.batchId);
        const candidateId = stringValue(result.candidateId);
        const selectedOptionId = stringValue(result.selectedOptionId);
        const selectedStyleId = stringValue(result.selectedStyleId);
        const idempotencyKey = stringValue(result.idempotencyKey);
        const toolRunId = stringValue(result.toolRunId);
        if (!pathId || !batchId || !candidateId || !selectedOptionId || !selectedStyleId || !idempotencyKey || !toolRunId) continue;
        const key = `${batchId}:${candidateId}:${idempotencyKey}`;
        if (handledPathSelectionToolCallsRef.current.has(key)) continue;
        handledPathSelectionToolCallsRef.current.add(key);
        void fetch(`/api/learning-paths/${encodeURIComponent(pathId)}/choices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'selection',
            batchId,
            candidateId,
            selectedOptionId,
            selectedStyleId,
            idempotencyKey,
            toolRunId,
          }),
        }).then(async (response) => {
          if (!response.ok) throw new Error('路径选择同步失败');
          window.dispatchEvent(new CustomEvent('konling:adaptive-path-updated', {
            detail: { mode: 'path-advisor', batchId, candidateId, pathId, source: 'candidate-selection' },
          }));
          setActionStatus('路径选择已同步，等待你开始学习。');
        }).catch(() => {
          handledPathSelectionToolCallsRef.current.delete(key);
          setActionStatus('路径选择未能同步，请重试。');
        });
      }
    }
  }, [activeAssistantBinding?.teachingAssistantModeId, messages]);

  useEffect(() => {
    if (assistantEntryPoint?.mode !== 'path-advisor') return;
    const handlePathGenerationStatus = (event: Event) => {
      const detail = (event as CustomEvent<{
        message?: unknown;
        requestId?: unknown;
        status?: unknown;
      }>).detail;
      if (
        !detail ||
        typeof detail.message !== 'string' ||
        detail.message.length === 0 ||
        typeof detail.requestId !== 'string' ||
        typeof detail.status !== 'string'
      ) return;
      const statusMessage = detail.message;
      const messageId = `path-generation:${detail.requestId}:${detail.status}`;
      setMessages((current) => {
        const existingMessage = current.find((message) => message.id === messageId);
        if (existingMessage) {
          return current.map((message) => message.id === messageId
            ? {
                ...message,
                content: statusMessage,
                parts: [{ type: 'text', text: statusMessage }],
              }
            : message);
        }
        return [...current, {
            id: messageId,
            role: 'assistant',
            content: statusMessage,
            parts: [{ type: 'text', text: statusMessage }],
          }];
      });
    };
    window.addEventListener('konling:path-generation-status', handlePathGenerationStatus);
    return () => window.removeEventListener('konling:path-generation-status', handlePathGenerationStatus);
  }, [assistantEntryPoint?.mode, setMessages]);

  const handledAssistantRequestIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!pendingAssistantRequest || handledAssistantRequestIdRef.current === pendingAssistantRequest.id) return;
    if (assistantEntryPoint !== pendingAssistantRequest.entryPoint) return;
    handledAssistantRequestIdRef.current = pendingAssistantRequest.id;

    void (async () => {
      try {
        const binding = {
          teachingAssistantModeId: pendingAssistantRequest.entryPoint.mode,
          modeClientContextHints: pendingAssistantRequest.entryPoint.serverContext,
        };
        const conversation = await createConversation(binding);
        setMessages([]);
        await append(
          { role: 'user', content: pendingAssistantRequest.message },
          {
            ...chatBody,
            conversationId: conversation.id,
            teachingAssistantModeId: pendingAssistantRequest.entryPoint.mode,
            modeClientContextHints: pendingAssistantRequest.entryPoint.serverContext,
          },
        );
        completeAssistantRequest(pendingAssistantRequest.id);
      } catch (cause) {
        failAssistantRequest(pendingAssistantRequest.id, cause);
      }
    })();
  }, [
    append,
    assistantEntryPoint,
    chatBody,
    completeAssistantRequest,
    createConversation,
    failAssistantRequest,
    pendingAssistantRequest,
    setMessages,
  ]);

  useEffect(() => {
    if (!activeConversation || activeConversation.id !== activeConversationId) return;
    setMessages(visibleKonlingMessages(activeConversation.messages));
  }, [activeConversation, activeConversationId, setMessages]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRestore = useCallback(() => {
    setLibraryOpen(false);
    setIsMaximized(false);
    window.requestAnimationFrame(() => maximizeControlRef.current?.focus());
  }, []);

  const closeMobileHistoryDrawer = useCallback(() => {
    setLibraryOpen(false);
    window.requestAnimationFrame(() => historyControlRef.current?.focus());
  }, []);

  const handleClose = useCallback(() => {
    setLibraryOpen(false);
    setIsMaximized(false);
    closeSidebar();
  }, [closeSidebar]);

  useEffect(() => {
    if (isOpen) return;
    setIsMaximized(false);
    setLibraryOpen(false);
  }, [isOpen]);

  // ESC键按当前呈现层级关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isOpen) return;
      if (isMobileHistoryDrawerOpen) {
        closeMobileHistoryDrawer();
        return;
      }
      if (isMaximized) {
        handleRestore();
        return;
      }
      handleClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [closeMobileHistoryDrawer, handleClose, handleRestore, isMaximized, isMobileHistoryDrawerOpen, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panel.contains(document.activeElement) || document.activeElement === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    panel.addEventListener('keydown', handleTab);
    return () => panel.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body) {
        openerElementRef.current = activeElement;
      }
      wasOpenRef.current = true;
      const focusPanel = () => {
        const panel = panelRef.current;
        if (!panel) return;
        if (panel.contains(document.activeElement)) return;
        getFocusableElements(panel)[0]?.focus() ?? panel.focus();
      };
      const focusFrame = window.requestAnimationFrame(focusPanel);
      const focusRetry = window.setTimeout(focusPanel, 120);
      return () => {
        window.cancelAnimationFrame(focusFrame);
        window.clearTimeout(focusRetry);
      };
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
    if (!isOpen || isMaximized) {
      setKnowledgeInspectorAvoidanceActive(false);
      return;
    }

    const updateAvoidance = () => {
      const hasDesktopInspector = window.matchMedia('(min-width: 1024px)').matches
        && Boolean(document.querySelector('[data-knowledge-inspector="floating-right-edge"]'));
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
  }, [isMaximized, isOpen]);

  useEffect(() => {
    if (!isOpen || !isMaximized || !floatingControls) return;
    return floatingControls.setWorkspaceDockSuppressed(true);
  }, [floatingControls, isMaximized, isOpen]);

  useEffect(() => {
    if (!isOpen || !isMobileHistoryDrawerOpen) return;
    const frame = window.requestAnimationFrame(() => librarySearchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isMobileHistoryDrawerOpen, isOpen]);

  // 处理快捷问题
  const handleQuickQuestion = useCallback(
    async (question: string) => {
      if (isLoading || isConversationLoading || isConversationMutating) return;
      try {
        const conversation = await ensureConversation();
        await append(
          { role: 'user', content: question },
          { ...chatBody, conversationId: conversation.id },
        );
        clearUnread();
      } catch (cause) {
        setActionStatus(cause instanceof Error ? cause.message : '无法发送控灵问题。');
      }
    },
    [append, chatBody, clearUnread, ensureConversation, isConversationLoading, isConversationMutating, isLoading]
  );

  const handleConversationSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading || isConversationLoading || isConversationMutating) return;
    try {
      const conversation = await ensureConversation();
      await handleSubmit(undefined, { ...chatBody, conversationId: conversation.id });
      clearUnread();
    } catch (cause) {
      setActionStatus(cause instanceof Error ? cause.message : '无法发送控灵问题。');
    }
  }, [chatBody, clearUnread, ensureConversation, handleSubmit, isConversationLoading, isConversationMutating, isLoading]);

  const handleNewConversation = useCallback(async () => {
    try {
      await createConversation(null);
      setMessages([]);
      setEditingConversationId(null);
      setActionStatus('已新建空白对话。');
    } catch (cause) {
      setActionStatus(cause instanceof Error ? cause.message : '新建控灵会话失败。');
    }
  }, [createConversation, setMessages]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    if (isLoading) return;
    selectConversation(conversationId);
    setMessages([]);
    setEditingConversationId(null);
    setLibraryOpen(false);
    setActionStatus('已恢复所选对话。');
  }, [isLoading, selectConversation, setMessages]);

  const handleRenameConversation = useCallback(async (conversationId: string) => {
    try {
      await renameConversation(conversationId, editingTitle);
      setEditingConversationId(null);
      setEditingTitle('');
      setActionStatus('对话标题已更新。');
    } catch (cause) {
      setActionStatus(cause instanceof Error ? cause.message : '对话重命名失败。');
    }
  }, [editingTitle, renameConversation]);

  const handleToggleConversationPinned = useCallback(async (conversationId: string, pinned: boolean) => {
    try {
      await setConversationPinned(conversationId, pinned);
      setActionStatus(pinned ? '对话已置顶。' : '已取消对话置顶。');
    } catch (cause) {
      setActionStatus(cause instanceof Error ? cause.message : '更新对话置顶状态失败。');
    }
  }, [setConversationPinned]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    if (isLoading || !window.confirm('确认删除此对话？此操作无法撤销。')) return;
    try {
      const deletedActiveConversation = await deleteConversation(conversationId);
      if (deletedActiveConversation) {
        await createConversation(null);
        setMessages([]);
        setLibraryOpen(false);
        setActionStatus('当前对话已删除，已进入新的空白对话。');
      } else {
        setActionStatus('对话已删除。');
      }
    } catch (cause) {
      setActionStatus(cause instanceof Error ? cause.message : '删除控灵会话失败。');
    }
  }, [createConversation, deleteConversation, isLoading, setMessages]);

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
      {isOpen && !isMaximized && (
        <div aria-label="关闭 AI 侧栏" tabIndex={0} role="button" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200 sm:hidden"
          style={platformLayerStyle('overlay')}
          onClick={handleClose}
        />
      )}

      {/* 侧边栏面板 */}
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          ...platformLayerStyle(isMaximized ? 'konlingWorkspace' : 'konlingSide'),
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          ...(knowledgeInspectorAvoidanceActive ? {
            top: '7rem',
            right: 'calc(1.5rem + clamp(22.5rem, 30vw, 28.75rem))',
            height: 'calc(100vh - 8rem)',
          } : {}),
        }}
        className={`
          fixed flex min-h-0 flex-col overflow-hidden
          ${isMaximized
            ? 'inset-0 h-[100dvh] w-screen'
            : 'right-0 top-0 h-[100dvh] w-screen sm:w-[380px] lg:w-[420px]'
          }
          ${styles.container}
          ${TRANSITION_CLASSES.panel}
          motion-reduce:transition-none
          ${isOpen
            ? 'visible translate-x-0 opacity-100'
            : 'invisible translate-x-0 opacity-0 pointer-events-none'
          }
          shadow-2xl
        `}
        data-global-ai-sidebar={isOpen ? 'open' : 'closed'}
        data-konling-assistant-surface="global-sidebar"
        data-konling-presentation-mode={isMaximized ? 'maximized' : 'side'}
        data-platform-layer={isMaximized ? 'konlingWorkspace' : 'konlingSide'}
        data-konling-motion-policy="geometry motion-reduce"
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen ? 'true' : undefined}
        aria-hidden={isOpen ? undefined : 'true'}
        inert={!isOpen}
        aria-label="控灵全局 AI 侧栏"
        data-konling-inspector-avoidance={knowledgeInspectorAvoidanceActive ? 'active' : 'inactive'}
        data-knowledge-mobile-inspector-policy={
          !isMaximized && (pageContext?.courseId === 'knowledge' || pageContext?.stepId === '/knowledge')
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
            <button
              ref={historyControlRef}
              type="button"
              onClick={() => setLibraryOpen((current) => !current)}
              aria-label="打开控灵会话库"
              aria-expanded={libraryOpen}
              className={`rounded p-2 transition-colors ${styles.text.muted} hover:bg-slate-700/30 ${isMaximized ? 'md:hidden' : ''}`}
              title="会话库"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleNewConversation()}
              aria-label="新建控灵对话"
              disabled={isLoading || isConversationMutating}
              className={`rounded p-2 transition-colors ${styles.text.muted} hover:bg-slate-700/30 disabled:opacity-40`}
              title="新建对话"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              ref={maximizeControlRef}
              type="button"
              onClick={() => {
                if (isMaximized) {
                  handleRestore();
                  return;
                }
                setLibraryOpen(false);
                setIsMaximized(true);
              }}
              aria-label={isMaximized ? '恢复控灵侧栏' : '最大化控灵工作区'}
              className={`rounded p-2 transition-colors ${styles.text.muted} hover:bg-slate-700/30`}
              title={isMaximized ? '恢复侧栏' : '最大化'}
              data-konling-presentation-control={isMaximized ? 'restore' : 'maximize'}
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button type="button"
              onClick={handleClose}
              aria-label="关闭 AI 侧栏"
              className={`rounded p-2 transition-colors ${styles.text.muted} hover:bg-slate-700/30`}
              title="关闭 (ESC)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          className={`relative flex min-h-0 flex-1 overflow-hidden ${isMaximized ? '' : 'flex-col'}`}
          data-konling-workspace-body
        >
        {isMobileHistoryDrawerOpen && (
          <button
            type="button"
            aria-label="关闭控灵会话库"
            className="absolute inset-0 z-10 bg-black/30 md:hidden"
            onClick={closeMobileHistoryDrawer}
          />
        )}
        {(libraryOpen || isMaximized) && (
          <section
            aria-label="控灵会话库"
            className={[
              `p-3 ${styles.border}`,
              isMaximized
                ? `absolute inset-y-0 left-0 z-20 flex w-[min(86vw,20rem)] shrink-0 flex-col border-r shadow-2xl md:static md:z-auto md:flex md:w-80 md:shadow-none ${styles.container}`
                : 'w-full border-b',
              isMaximized && !libraryOpen ? 'hidden md:flex' : '',
            ].join(' ')}
            data-konling-conversation-library
            data-konling-conversation-library-mode={isMaximized ? 'workspace-rail' : 'side-disclosure'}
            data-konling-mobile-history-drawer={isMobileHistoryDrawerOpen ? 'open' : 'closed'}
          >
            <div className="relative">
              <Search
                aria-hidden="true"
                className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${styles.text.muted}`}
              />
              <input
                ref={librarySearchRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="搜索对话标题"
                placeholder="搜索对话标题"
                className={`w-full rounded-md border py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 ${styles.input}`}
              />
            </div>
            <div
              className={`mt-2 space-y-1 overflow-y-auto ${isMaximized ? 'min-h-0 flex-1' : 'max-h-52'}`}
              data-konling-conversation-list
            >
              {isConversationLoading && conversations.length === 0 ? (
                <p className={`px-2 py-3 text-center text-xs ${styles.text.muted}`}>正在加载会话...</p>
              ) : conversations.length === 0 ? (
                <p className={`px-2 py-3 text-center text-xs ${styles.text.muted}`}>没有匹配的对话</p>
              ) : conversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                const isEditing = conversation.id === editingConversationId;
                const actionsDisabled = isLoading || isConversationMutating;
                return (
                  <div
                    key={conversation.id}
                    className={[
                      'group flex items-center gap-1 rounded-lg border px-2 py-1.5',
                      isActive ? 'border-amber-500/50 bg-amber-500/10' : `${styles.border} bg-transparent`,
                    ].join(' ')}
                    data-konling-conversation-active={isActive ? 'true' : 'false'}
                  >
                    {isEditing ? (
                      <>
                        <input
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void handleRenameConversation(conversation.id);
                            if (event.key === 'Escape') setEditingConversationId(null);
                          }}
                          aria-label="编辑对话标题"
                          className={`min-w-0 flex-1 rounded border px-2 py-1 text-xs ${styles.input}`}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => void handleRenameConversation(conversation.id)}
                          disabled={!editingTitle.trim() || actionsDisabled}
                          aria-label="保存对话标题"
                          className={`rounded p-1.5 ${styles.text.secondary} disabled:opacity-40`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSelectConversation(conversation.id)}
                          disabled={actionsDisabled}
                          className={`min-w-0 flex-1 truncate text-left text-xs ${styles.text.primary} disabled:opacity-40`}
                          title={conversation.title}
                        >
                          {conversation.pinned && <Pin className="mr-1 inline h-3 w-3 fill-current" />}
                          {conversation.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingConversationId(conversation.id);
                            setEditingTitle(conversation.title);
                          }}
                          disabled={actionsDisabled}
                          aria-label={`重命名对话：${conversation.title}`}
                          className={`rounded p-1.5 ${styles.text.muted} hover:bg-slate-700/30 disabled:opacity-40`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleConversationPinned(conversation.id, !conversation.pinned)}
                          disabled={actionsDisabled}
                          aria-label={`${conversation.pinned ? '取消置顶' : '置顶'}对话：${conversation.title}`}
                          className={`rounded p-1.5 ${styles.text.muted} hover:bg-slate-700/30 disabled:opacity-40`}
                        >
                          <Pin className={`h-3.5 w-3.5 ${conversation.pinned ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteConversation(conversation.id)}
                          disabled={actionsDisabled}
                          aria-label={`删除对话：${conversation.title}`}
                          className="rounded p-1.5 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {conversationError && (
              <p className="mt-2 text-xs text-red-400" role="alert">{conversationError.message}</p>
            )}
          </section>
        )}

        <div
          className="flex min-w-0 flex-1 flex-col overflow-hidden"
          data-konling-active-conversation
          inert={isMobileHistoryDrawerOpen}
        >
        {/* 消息列表 */}
        <div
          className="min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4"
          data-konling-message-scroll-container
        >
          <div className="sr-only" role="status" aria-live="polite" data-ai-task-status="global-sidebar">
            {isLoading ? '控灵正在思考。' : error ? `AI 对话失败：${error.message}` : actionStatus}
          </div>
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
                      disabled={isLoading || isConversationLoading || isConversationMutating}
                      className={`
                        rounded-lg px-3 py-2 text-left text-xs transition-all
                        ${styles.buttonSecondary}
                        border
                        hover:border-amber-500/50 disabled:opacity-40
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
              <KonlingChatMessageList messages={messages} styles={styles} onStructuredAction={handleStructuredAction} />
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
        <form onSubmit={handleConversationSubmit} className={`shrink-0 border-t p-4 ${styles.border}`}>
          <div className="flex gap-2">
            <input
              type="text"
              name="global-ai-sidebar-input"
              aria-label="全局 AI 问题输入框"
              value={input}
              onChange={handleInputChange}
              placeholder="请输入你的问题..."
              className={`
                ${konlingPromptInputClassName} rounded-lg border px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2
                ${styles.input}
              `}
              disabled={isLoading || isConversationLoading || isConversationMutating}
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
                disabled={!input.trim() || isConversationLoading || isConversationMutating}
                size="icon"
                className={`h-10 w-10 ${styles.button}`}
              >
                <span className="sr-only">发送 AI 问题</span>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className={`mt-2 text-center text-xs ${styles.text.muted}`}>
            按 Enter 发送，ESC {isMaximized ? '恢复侧栏' : '关闭面板'}
          </p>
        </form>
        </div>
        </div>
      </div>
    </>
  );
}

export default GlobalAISidebar;
