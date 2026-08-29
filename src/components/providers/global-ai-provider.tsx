/**
 * 全局AI助手Provider
 *
 * 管理全局AI助手的状态和上下文解析
 * 监听路由变化，自动解析页面上下文
 */

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { usePathname } from 'next/navigation';
import type { PageContext, UserProfile } from '@/types/ai-context';
import type { KonlingKnowledgeWorkspaceHint, KonlingTeachingAssistantEntryPoint } from '@/lib/konling-agent-runtime';
import {
  resolveAIContext,
  resolveRegisteredAIContextFromPath,
  isPathExcluded,
  type ResolvedContext,
} from '@/lib/ai-context-resolver';
import { useSession } from 'next-auth/react';

export interface PendingAssistantRequest {
  id: number;
  entryPoint: KonlingTeachingAssistantEntryPoint;
  message: string;
}

interface GlobalAIContextValue {
  /** 当前页面上下文 */
  pageContext: PageContext | null;
  /** 用户画像 */
  userProfile: UserProfile | null;
  /** 是否启用AI助手 */
  enabled: boolean;
  /** 是否显示侧边栏 */
  isOpen: boolean;
  /** 未读消息数 */
  unreadCount: number;
  /** 可用工具列表 */
  tools: string[];
  /** 系统提示词扩展 */
  systemPromptExtension?: string;
  /** 当前显式教学助理入口 */
  assistantEntryPoint?: KonlingTeachingAssistantEntryPoint | null;
  /** 当前页面提供的知识工作区上下文提示 */
  knowledgeWorkspaceHint?: KonlingKnowledgeWorkspaceHint | null;
  /** 快捷问题列表 */
  quickQuestions: Array<{ label: string; question: string }>;
  /** 打开侧边栏 */
  openSidebar: () => void;
  /** 关闭侧边栏 */
  closeSidebar: () => void;
  /** 切换侧边栏 */
  toggleSidebar: () => void;
  /** 增加未读计数 */
  incrementUnread: () => void;
  /** 清除未读计数 */
  clearUnread: () => void;
  /** 更新页面上下文（用于课程页面动态切换） */
  updatePageContext: (context: Partial<PageContext> & {
    tools?: string[];
    quickQuestions?: Array<{ label: string; question: string }>;
    systemPromptExtension?: string;
    assistantEntryPoint?: KonlingTeachingAssistantEntryPoint | null;
    knowledgeWorkspaceHint?: KonlingKnowledgeWorkspaceHint | null;
  }) => void;
  /** 清除同一路由内卸载组件留下的动态上下文 */
  clearDynamicPageContext: () => void;
  /** 打开指定教学助理模式 */
  openAssistantEntryPoint: (entryPoint: KonlingTeachingAssistantEntryPoint) => void;
  pendingAssistantRequest: PendingAssistantRequest | null;
  startAssistantConversation: (entryPoint: KonlingTeachingAssistantEntryPoint, message: string) => Promise<void>;
  completeAssistantRequest: (requestId: number) => void;
  failAssistantRequest: (requestId: number, cause: unknown) => void;
  /** 当前路径名 */
  pathname: string;
  /** 是否应该显示AI按钮 */
  shouldShowButton: boolean;
}

const GlobalAIContext = createContext<GlobalAIContextValue | null>(null);

export function useGlobalAI() {
  const context = useContext(GlobalAIContext);
  if (!context) {
    throw new Error('useGlobalAI must be used within GlobalAIProvider');
  }
  return context;
}

interface GlobalAIProviderProps {
  children?: React.ReactNode;
}

export function GlobalAIProvider({ children }: GlobalAIProviderProps) {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();

  // 状态
  const [resolvedContext, setResolvedContext] = useState<ResolvedContext>({
    pageContext: null,
    enabled: false,
    tools: [],
    quickQuestions: [],
  });
  const [dynamicContext, setDynamicContext] = useState<{
    pageContext: Partial<PageContext> | null;
    tools: string[];
    quickQuestions: Array<{ label: string; question: string }>;
    systemPromptExtension?: string;
    assistantEntryPoint?: KonlingTeachingAssistantEntryPoint | null;
    knowledgeWorkspaceHint?: KonlingKnowledgeWorkspaceHint | null;
  }>({
    pageContext: null,
    tools: [],
    quickQuestions: [],
    assistantEntryPoint: null,
    knowledgeWorkspaceHint: null,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [pendingAssistantRequest, setPendingAssistantRequest] = useState<PendingAssistantRequest | null>(null);
  const assistantRequestIdRef = useRef(0);
  const assistantRequestCallbacksRef = useRef(new Map<number, {
    resolve: () => void;
    reject: (cause: unknown) => void;
  }>());

  // 解析用户画像
  const userProfile = useMemo<UserProfile | null>(() => {
    if (!session?.user) return null;

    return {
      id: session.user.id || 'unknown',
      name: session.user.name || session.user.email || '学生',
    };
  }, [session]);

  // 解析页面上下文
  useEffect(() => {
    setMounted(true);

    // 解析当前路径的AI上下文
    const resolved = resolveAIContext(pathname);
    const registeredContext = resolveRegisteredAIContextFromPath(pathname);
    const persistentConversationEnabled = Boolean(registeredContext)
      || pathname === '/teacher/smart-prep';
    setResolvedContext(persistentConversationEnabled
      ? resolved
      : { ...resolved, enabled: false });
    if (!persistentConversationEnabled) setIsOpen(false);
    setDynamicContext({
      pageContext: null,
      tools: [],
      quickQuestions: [],
      systemPromptExtension: undefined,
      assistantEntryPoint: null,
      knowledgeWorkspaceHint: null,
    });

    // 路由变化时关闭侧边栏（可选，根据UX需求决定）
    // 保持开启可能更好，让用户可以在不同页面间保持对话上下文
  }, [pathname]);

  // 操作函数
  const openSidebar = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0); // 打开时清除未读
  }, []);

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0); // 打开时清除未读
      return next;
    });
  }, []);

  const incrementUnread = useCallback(() => {
    setUnreadCount((prev) => prev + 1);
  }, []);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // 更新页面上下文（用于课程页面动态切换）
  const updatePageContext = useCallback((
    context: Partial<PageContext> & {
      tools?: string[];
      quickQuestions?: Array<{ label: string; question: string }>;
      systemPromptExtension?: string;
      assistantEntryPoint?: KonlingTeachingAssistantEntryPoint | null;
      knowledgeWorkspaceHint?: KonlingKnowledgeWorkspaceHint | null;
    }
  ) => {
    setDynamicContext({
      pageContext: context,
      tools: context.tools || [],
      quickQuestions: context.quickQuestions || [],
      systemPromptExtension: context.systemPromptExtension,
      assistantEntryPoint: context.assistantEntryPoint ?? null,
      knowledgeWorkspaceHint: context.knowledgeWorkspaceHint ?? null,
    });
  }, []);

  const clearDynamicPageContext = useCallback(() => {
    setDynamicContext({
      pageContext: null,
      tools: [],
      quickQuestions: [],
      systemPromptExtension: undefined,
      assistantEntryPoint: null,
      knowledgeWorkspaceHint: null,
    });
  }, []);

  const openAssistantEntryPoint = useCallback((entryPoint: KonlingTeachingAssistantEntryPoint) => {
    setDynamicContext((current) => ({
      ...current,
      assistantEntryPoint: entryPoint,
      systemPromptExtension: entryPoint.promptContext,
    }));
    setIsOpen(true);
    setUnreadCount(0);
  }, []);

  const startAssistantConversation = useCallback((
    entryPoint: KonlingTeachingAssistantEntryPoint,
    message: string,
  ) => {
    const id = assistantRequestIdRef.current + 1;
    assistantRequestIdRef.current = id;
    openAssistantEntryPoint(entryPoint);
    setPendingAssistantRequest({ id, entryPoint, message });
    return new Promise<void>((resolve, reject) => {
      assistantRequestCallbacksRef.current.set(id, { resolve, reject });
    });
  }, [openAssistantEntryPoint]);

  const completeAssistantRequest = useCallback((requestId: number) => {
    const callbacks = assistantRequestCallbacksRef.current.get(requestId);
    if (!callbacks) return;
    assistantRequestCallbacksRef.current.delete(requestId);
    setPendingAssistantRequest((current) => current?.id === requestId ? null : current);
    callbacks.resolve();
  }, []);

  const failAssistantRequest = useCallback((requestId: number, cause: unknown) => {
    const callbacks = assistantRequestCallbacksRef.current.get(requestId);
    if (!callbacks) return;
    assistantRequestCallbacksRef.current.delete(requestId);
    setPendingAssistantRequest((current) => current?.id === requestId ? null : current);
    callbacks.reject(cause);
  }, []);

  // 合并基础上下文和动态上下文
  const mergedPageContext = useMemo<PageContext | null>(() => {
    if (!resolvedContext.pageContext) return null;
    if (!dynamicContext.pageContext) return resolvedContext.pageContext;

    return {
      ...resolvedContext.pageContext,
      ...dynamicContext.pageContext,
    };
  }, [resolvedContext.pageContext, dynamicContext.pageContext]);

  // 合并工具列表
  const mergedTools = useMemo(() => {
    const baseTools = resolvedContext.tools || [];
    const dynamicTools = dynamicContext.tools || [];
    return Array.from(new Set([...baseTools, ...dynamicTools]));
  }, [resolvedContext.tools, dynamicContext.tools]);

  // 合并快捷问题
  const mergedQuickQuestions = useMemo(() => {
    return dynamicContext.quickQuestions?.length > 0
      ? dynamicContext.quickQuestions
      : resolvedContext.quickQuestions || [];
  }, [dynamicContext.quickQuestions, resolvedContext.quickQuestions]);

  // 合并系统提示词扩展
  const mergedSystemPromptExtension = useMemo(() => {
    return dynamicContext.systemPromptExtension || resolvedContext.systemPromptExtension;
  }, [dynamicContext.systemPromptExtension, resolvedContext.systemPromptExtension]);

  // 是否应该显示AI按钮
  const shouldShowButton = useMemo(() => {
    if (!mounted) return false;
    if (isPathExcluded(pathname)) return false;
    if (sessionStatus !== 'authenticated' || !session?.user) return false;
    return resolvedContext.enabled;
  }, [mounted, pathname, resolvedContext.enabled, session?.user, sessionStatus]);

  // 上下文值
  const contextValue: GlobalAIContextValue = {
    pageContext: mergedPageContext,
    userProfile,
    enabled: resolvedContext.enabled,
    isOpen,
    unreadCount,
    tools: mergedTools,
    systemPromptExtension: mergedSystemPromptExtension,
    assistantEntryPoint: dynamicContext.assistantEntryPoint,
    knowledgeWorkspaceHint: dynamicContext.knowledgeWorkspaceHint,
    quickQuestions: mergedQuickQuestions,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    incrementUnread,
    clearUnread,
    updatePageContext,
    clearDynamicPageContext,
    openAssistantEntryPoint,
    pendingAssistantRequest,
    startAssistantConversation,
    completeAssistantRequest,
    failAssistantRequest,
    pathname,
    shouldShowButton,
  };

  return (
    <GlobalAIContext.Provider value={contextValue}>
      {children}
    </GlobalAIContext.Provider>
  );
}

export default GlobalAIProvider;
