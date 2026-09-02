'use client';

/**
 * AI Copilot 页面
 *
 * 独立的 AI 助教页面，提供完整的聊天界面
 * 使用控灵品牌
 */

import { useChat } from '@/hooks/useLegacyChat';
import {
  useKonlingConversationLibrary,
  visibleKonlingMessages,
} from '@/hooks/useKonlingConversationLibrary';
import { KonlingChatFailureActions } from '@/components/ai/konling-chat-failure-actions';
import { normalizeKonlingChatFailure } from '@/lib/konling-chat-failure';
import { useRef, useEffect, useMemo, useCallback, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/platform/app-shell';
import { KonlingAvatar } from '@/components/ai/konling-avatar';
import { KonlingChatMessageList, konlingPromptInputClassName } from '@/components/ai/konling-chat-renderer';
import { KONLING_BRAND } from '@/lib/ai-branding';
import { usePageAIContext } from '@/hooks/usePageAIContext';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { ActionStatusPanel } from '@/components/platform/action-status';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import type { EvidenceCopilotProjection } from '@/lib/evidence-copilot-context';
import type { GovernedCopilotProfileProjection } from '@/lib/governed-copilot-profile-context';
import {
  buildAiAuditTaskState,
  buildPortfolioReflectionDraft,
  getAiAuditTaskContract,
} from '@/lib/ai-task-boundary-contracts';
import { getPlatformCockpitHref } from '@/lib/platform-role-navigation';
import { buildStandaloneCopilotEntryPresentation } from '@/lib/standalone-copilot-entry';

const STANDALONE_COPILOT_COURSE_ID = 'ai-assistant';
const STANDALONE_COPILOT_PAGE_ID = '/ai/copilot';
const STANDALONE_COPILOT_LOGIN_HREF = `/login?callbackUrl=${encodeURIComponent(STANDALONE_COPILOT_PAGE_ID)}`;

export default function CopilotPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionData = useSession();
  const searchParams = useSearchParams();
  const context = searchParams.get('context');
  const source = searchParams.get('source') ?? '当前学习证据';
  const assignment = searchParams.get('assignment') ?? undefined;
  const taskIntent = searchParams.get('intent') ?? context ?? undefined;
  const localTaskMode = context === 'portfolio-reflection' || context === 'evidence';
  const viewerRole = resolveCopilotViewerRole(sessionData.data?.user?.role);
  const authenticatedUserId = sessionData.data?.user?.id;
  const [evidenceProjection, setEvidenceProjection] = useState<EvidenceCopilotProjection | null>(null);
  const [evidenceProjectionError, setEvidenceProjectionError] = useState(false);
  const [copilotProfile, setCopilotProfile] = useState<GovernedCopilotProfileProjection | null>(null);
  const [copilotProfileError, setCopilotProfileError] = useState(false);
  const [libraryActionError, setLibraryActionError] = useState<string | null>(null);
  const reflectionDraft = useMemo(
    () =>
      context === 'portfolio-reflection'
        ? buildPortfolioReflectionDraft(source, {
            assignment,
            intent: taskIntent,
          })
        : null,
    [assignment, context, source, taskIntent],
  );
  const portfolioReflectionHref = useMemo(() => {
    const params = new URLSearchParams({
      category: 'reflection',
      intent: 'create',
      source,
    });
    if (assignment) params.set('assignment', assignment);
    if (taskIntent) params.set('taskIntent', taskIntent);
    return `/profile/portfolio?${params.toString()}`;
  }, [assignment, source, taskIntent]);
  const taskState = useMemo(() => {
    if (context === 'portfolio-reflection') {
      return buildAiAuditTaskState({
        taskType: 'portfolio-reflection',
        status: 'pending',
        message: '已创建作品集反思草稿候选。',
        nextAction: '打开作品集候选预览并继续整理',
        targetId: reflectionDraft?.id,
      });
    }
    if (context === 'evidence') {
      const status = evidenceProjection?.status;
      const unavailable = evidenceProjectionError || status === 'unavailable';
      const missing = status === 'missing';
      return buildAiAuditTaskState({
        taskType: 'evidence-copilot',
        status: unavailable ? 'failed' : missing ? 'blocked' : 'pending',
        message: unavailable
          ? '学习证据当前不可用。'
          : missing
            ? '当前暂无学习证据。'
            : evidenceProjection?.limitations[0]
              ?? '已加载服务端核对的学习证据，建议仅作参考。',
        nextAction: evidenceProjection?.nextAction.label ?? '去做一次自适应练习，补充学习证据',
      });
    }
    return null;
  }, [context, evidenceProjection, evidenceProjectionError, reflectionDraft?.id]);
  const taskContract =
    context === 'portfolio-reflection'
      ? getAiAuditTaskContract('portfolio-reflection')
      : context === 'evidence'
        ? getAiAuditTaskContract('evidence-copilot')
        : null;
  const portfolioReflectionTaskContext = useMemo(
    () =>
      context === 'portfolio-reflection' && reflectionDraft
        ? {
            taskType: 'portfolio-reflection' as const,
            source: reflectionDraft.source,
            assignment: reflectionDraft.assignment,
            intent: reflectionDraft.intent,
          }
        : undefined,
    [context, reflectionDraft],
  );

  const { pageContext } = usePageAIContext({
    courseId: STANDALONE_COPILOT_COURSE_ID,
    courseTitle: 'AI 助手',
    topic: '通用学习辅助',
    pageType: 'workspace',
  });
  const evidenceTaskContext = useMemo(
    () =>
      context === 'evidence'
        ? {
            taskType: 'evidence-copilot' as const,
            ...(source ? { source } : {}),
            ...(assignment ? { assignment } : {}),
            ...(taskIntent ? { intent: taskIntent } : {}),
          }
        : undefined,
    [assignment, context, source, taskIntent],
  );

  const {
    conversations,
    activeConversationId,
    activeConversation,
    isLoading: isConversationLoading,
    isMutating: isConversationMutating,
    error: conversationError,
    refreshConversations,
    refreshActiveConversation,
    createConversation,
    ensureConversation,
    selectConversation,
    deleteConversation,
  } = useKonlingConversationLibrary({
    enabled: Boolean(authenticatedUserId),
    courseId: STANDALONE_COPILOT_COURSE_ID,
    pageId: STANDALONE_COPILOT_PAGE_ID,
    pageContext,
  });

  useEffect(() => {
    if (context !== 'evidence') {
      setEvidenceProjection(null);
      setEvidenceProjectionError(false);
      return;
    }
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (assignment) params.set('assignment', assignment);
    if (taskIntent) params.set('intent', taskIntent);
    const query = params.toString();
    let cancelled = false;
    fetch(`/api/ai/evidence-copilot${query ? `?${query}` : ''}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('evidence unavailable');
        return response.json() as Promise<EvidenceCopilotProjection>;
      })
      .then((projection) => {
        if (!cancelled) {
          setEvidenceProjection(projection);
          setEvidenceProjectionError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvidenceProjection(null);
          setEvidenceProjectionError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assignment, context, source, taskIntent]);

  useEffect(() => {
    if (!authenticatedUserId) {
      setCopilotProfile(null);
      setCopilotProfileError(false);
      return;
    }
    let cancelled = false;
    fetch('/api/ai/copilot-profile')
      .then(async (response) => {
        if (!response.ok) throw new Error('profile unavailable');
        return response.json() as Promise<GovernedCopilotProfileProjection>;
      })
      .then((projection) => {
        if (!cancelled) {
          setCopilotProfile(projection);
          setCopilotProfileError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCopilotProfile(null);
          setCopilotProfileError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authenticatedUserId]);

  const chatBody = useMemo(() => ({
    pageContext,
    auditTaskContext: portfolioReflectionTaskContext ?? evidenceTaskContext,
    conversationId: activeConversationId ?? undefined,
    courseId: STANDALONE_COPILOT_COURSE_ID,
    pageId: STANDALONE_COPILOT_PAGE_ID,
  }), [activeConversationId, evidenceTaskContext, pageContext, portfolioReflectionTaskContext]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, reload, stop, append, setMessages } =
    useChat({
      api: '/api/ai/chat',
      body: chatBody,
      onFinish: () => {
        void Promise.all([
          refreshConversations(),
          refreshActiveConversation(),
        ]).catch(() => undefined);
      },
    });

  useEffect(() => {
    if (conversationError) return;
    if (!activeConversation || activeConversation.id !== activeConversationId) return;
    setMessages(visibleKonlingMessages(activeConversation.messages));
  }, [activeConversation, activeConversationId, conversationError, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const busy = isLoading || isConversationLoading || isConversationMutating;
  const recoveryFailed = Boolean(authenticatedUserId && conversationError);
  const chatFailure = error ? normalizeKonlingChatFailure(error) : null;
  const conversationStatus = !authenticatedUserId
    ? 'unauthenticated'
    : recoveryFailed
      ? 'recovery-failed'
      : isConversationLoading && messages.length === 0
        ? 'loading'
        : messages.length === 0
          ? 'empty'
          : 'ready';

  const handleConversationSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authenticatedUserId || busy || recoveryFailed) return;
    try {
      const conversation = await ensureConversation();
      setLibraryActionError(null);
      await handleSubmit(undefined, { ...chatBody, conversationId: conversation.id });
    } catch (cause) {
      setLibraryActionError(cause instanceof Error ? cause.message : '无法发送控灵问题。');
    }
  }, [authenticatedUserId, busy, chatBody, ensureConversation, handleSubmit, recoveryFailed]);

  const handleQuickQuestion = useCallback(async (question: string) => {
    if (!authenticatedUserId || busy || recoveryFailed) return;
    try {
      const conversation = await ensureConversation();
      setLibraryActionError(null);
      await append(
        { role: 'user', content: question },
        { ...chatBody, conversationId: conversation.id },
      );
    } catch (cause) {
      setLibraryActionError(cause instanceof Error ? cause.message : '无法发送控灵问题。');
    }
  }, [append, authenticatedUserId, busy, chatBody, ensureConversation, recoveryFailed]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    if (!conversationId || isLoading) return;
    stop();
    setLibraryActionError(null);
    selectConversation(conversationId);
    setMessages([]);
  }, [isLoading, selectConversation, setMessages, stop]);

  const handleNewConversation = useCallback(async () => {
    if (!authenticatedUserId || busy) return;
    try {
      stop();
      await createConversation(null);
      setMessages([]);
      setLibraryActionError(null);
    } catch (cause) {
      setLibraryActionError(cause instanceof Error ? cause.message : '新建控灵会话失败。');
    }
  }, [authenticatedUserId, busy, createConversation, setMessages, stop]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    if (!conversationId || busy || !window.confirm('确认删除此对话？此操作无法撤销。')) return;
    try {
      stop();
      const deletedActiveConversation = await deleteConversation(conversationId);
      if (deletedActiveConversation) {
        await createConversation(null);
        setMessages([]);
      }
      setLibraryActionError(null);
    } catch (cause) {
      setLibraryActionError(cause instanceof Error ? cause.message : '删除控灵会话失败。');
    }
  }, [busy, createConversation, deleteConversation, setMessages, stop]);

  const retryRecovery = useCallback(() => {
    setLibraryActionError(null);
    if (activeConversationId) {
      void refreshActiveConversation().catch(() => undefined);
      return;
    }
    void refreshConversations().catch(() => undefined);
  }, [activeConversationId, refreshActiveConversation, refreshConversations]);

  const entryPresentation = buildStandaloneCopilotEntryPresentation({
    context,
    evidenceStatus: evidenceProjection?.status ?? null,
    evidenceUnavailable: evidenceProjectionError,
    evidenceLimitations: evidenceProjection?.limitations,
    evidenceNextAction: evidenceProjection?.nextAction,
    portfolioHref: portfolioReflectionHref,
  });
  const quickQuestions = entryPresentation.suggestions;

  return (
    <AppShell
      viewerRole={viewerRole}
      activeHref="/ai/copilot"
      activeNavigationHref="/knowledge"
      accountHref={getPlatformCockpitHref(sessionData.data?.user?.role)}
      title={KONLING_BRAND.name}
      subtitle={KONLING_BRAND.subtitle}
      breadcrumbs={[{ label: '首页', href: '/' }, { label: 'AI工坊', href: '/ai' }, { label: KONLING_BRAND.name }]}
    >
      <div
        className="flex min-h-[calc(100dvh-11rem)] flex-col rounded-lg border border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100"
        data-ai-local-task-surface={localTaskMode ? `copilot-${context}` : undefined}
        data-ai-task-focus-mode={localTaskMode ? 'local-first' : undefined}
        data-task-workspace-archetype={localTaskMode ? 'ai-local-task' : undefined}
      >
        <div className="border-b border-slate-800 bg-slate-950/80 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600">
                <KonlingAvatar size="md" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{KONLING_BRAND.name}</h2>
                <p className="text-sm text-amber-400">{KONLING_BRAND.subtitle}</p>
              </div>
            </div>
            {authenticatedUserId ? (
              <div className="flex flex-wrap items-center gap-2" data-copilot-conversation-library>
                <label className="sr-only" htmlFor="copilot-conversation-select">选择会话</label>
                <select
                  id="copilot-conversation-select"
                  aria-label="选择会话"
                  data-copilot-conversation-select
                  value={activeConversationId ?? ''}
                  onChange={(event) => handleSelectConversation(event.target.value)}
                  disabled={busy}
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                >
                  {conversations.length === 0 ? (
                    <option value="">尚未选择会话</option>
                  ) : null}
                  {conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>
                      {conversation.title}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-copilot-new-conversation
                  onClick={() => void handleNewConversation()}
                  disabled={busy}
                >
                  新对话
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-copilot-delete-conversation
                  onClick={() => activeConversationId && void handleDeleteConversation(activeConversationId)}
                  disabled={busy || !activeConversationId}
                >
                  删除
                </Button>
              </div>
            ) : (
              <div
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                data-copilot-conversation-status="unauthenticated"
              >
                未登录时不会保存会话。
                <Link href={STANDALONE_COPILOT_LOGIN_HREF} className="ml-2 underline">
                  登录后恢复会话
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="mx-auto flex h-full max-w-4xl flex-col p-4 pb-[calc(env(safe-area-inset-bottom,0px)+8rem)] sm:p-6 md:pb-6">
            <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
              {taskState ? <ActionStatusPanel state={taskState} className="mb-4" /> : null}
              {authenticatedUserId ? (
                <div
                  className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
                  data-copilot-profile-status={
                    copilotProfileError ? 'unavailable' : copilotProfile?.status ?? 'pending'
                  }
                >
                  <div className="font-medium">
                    {copilotProfileError || copilotProfile?.status === 'unavailable'
                      ? '个性化画像不可用'
                      : copilotProfile?.status === 'missing'
                        ? '暂无受治理学习画像'
                        : copilotProfile?.status === 'stale'
                          ? '学习画像已过期'
                          : copilotProfile?.status === 'low-confidence'
                            ? '学习画像置信度较低'
                            : copilotProfile
                              ? '已核对的学习画像'
                              : '正在核对学习画像'}
                  </div>
                  {(copilotProfile?.limitations ?? []).map((limitation) => (
                    <p key={limitation} className="mt-1 text-amber-100/80">{limitation}</p>
                  ))}
                  {copilotProfileError ? (
                    <p className="mt-1 text-amber-100/80">学习画像服务当前不可用，仅提供通用课程辅导。</p>
                  ) : null}
                  <Link
                    href={copilotProfile?.nextAction.href ?? '/assessment/adaptive-practice?intent=practice'}
                    className="mt-2 inline-flex text-xs text-amber-100/90 underline"
                    data-copilot-profile-next-action
                  >
                    {copilotProfile?.nextAction.label ?? '去做一次自适应练习，补充学习证据'}
                  </Link>
                </div>
              ) : null}
              {taskContract ? (
                <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-xs text-slate-300">
                  <span>任务类型：{taskContract.taskType}</span>
                  <span className="ml-3">输出目标：{taskContract.outputTarget}</span>
                  <span className="ml-3">写回：{taskContract.writebackBehavior}</span>
                </div>
              ) : null}
              {context === 'evidence' ? (
                <div
                  className="mb-4 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-sm text-cyan-100"
                  data-ai-task-boundary="evidence-copilot-summary"
                  data-evidence-copilot-status={
                    evidenceProjectionError ? 'unavailable' : evidenceProjection?.status ?? 'pending'
                  }
                >
                  <div className="font-medium">
                    {evidenceProjectionError || evidenceProjection?.status === 'unavailable'
                      ? '学习证据不可用'
                      : evidenceProjection?.status === 'missing'
                        ? '暂无学习证据'
                        : evidenceProjection?.status === 'stale'
                          ? '学习证据已过期'
                          : evidenceProjection?.status === 'partial'
                            ? '学习证据不完整'
                            : evidenceProjection
                              ? '已核对的学习证据'
                              : '正在核对学习证据'}
                  </div>
                  {(evidenceProjection?.limitations ?? []).map((limitation) => (
                    <p key={limitation} className="mt-1 text-cyan-100/80">{limitation}</p>
                  ))}
                  {evidenceProjectionError ? (
                    <p className="mt-1 text-cyan-100/80">学习证据服务当前不可用。</p>
                  ) : null}
                  <Link
                    href={evidenceProjection?.nextAction.href ?? '/assessment/adaptive-practice?intent=practice'}
                    className="mt-2 inline-flex text-xs text-cyan-100/90 underline"
                    data-evidence-copilot-next-action
                  >
                    {evidenceProjection?.nextAction.label ?? '去做一次自适应练习，补充学习证据'}
                  </Link>
                </div>
              ) : null}
              {reflectionDraft ? (
                <div className="mb-4 rounded-xl border border-violet-500/40 bg-violet-500/10 p-4 text-sm text-violet-100">
                  <div className="font-medium">{reflectionDraft.title}</div>
                  <p className="mt-1 text-violet-100/80">{reflectionDraft.detail}</p>
                  <div className="mt-2 rounded border border-violet-400/40 px-2 py-1 text-xs text-violet-100/70">
                    来源：{reflectionDraft.source} · 任务：
                    {reflectionDraft.assignment ?? 'portfolio-reflection'} · 意图：{reflectionDraft.intent} · 输出：
                    {reflectionDraft.outputTarget}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={portfolioReflectionHref} className="rounded bg-violet-500 px-3 py-1.5 text-xs text-white">
                      打开作品集候选预览
                    </a>
                    <span className="rounded border border-violet-400/50 px-3 py-1.5 text-xs">
                      状态：{reflectionDraft.status}
                    </span>
                  </div>
                </div>
              ) : null}
              {authenticatedUserId && (conversationStatus === 'loading' || recoveryFailed || libraryActionError) ? (
              <div
                className="mb-4 text-sm"
                data-copilot-conversation-status={conversationStatus}
                role={recoveryFailed ? 'alert' : 'status'}
                aria-live="polite"
              >
                {conversationStatus === 'loading' ? (
                  <p className="text-slate-400">正在恢复会话…</p>
                ) : null}
                {recoveryFailed ? (
                  <div className="rounded-lg bg-red-900/30 p-4 text-red-300">
                    <p>会话恢复失败，不是空会话。</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={retryRecovery}>
                        重试
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleNewConversation()}>
                        新对话
                      </Button>
                    </div>
                  </div>
                ) : null}
                {libraryActionError ? (
                  <p className="text-red-300">{libraryActionError}</p>
                ) : null}
              </div>
              ) : null}
              {((conversationStatus === 'empty' && !recoveryFailed) || conversationStatus === 'unauthenticated') ? (
                <div className="space-y-6" data-copilot-entry-kind={entryPresentation.kind}>
                  <div className="rounded-xl bg-gradient-to-br from-amber-900/30 to-orange-900/20 p-6">
                    <div className="mb-3 flex items-center gap-3">
                      <KonlingAvatar size="md" />
                      <h2 className="text-lg font-semibold text-amber-300">欢迎使用 {KONLING_BRAND.name}</h2>
                    </div>
                    <p className="text-slate-300">{entryPresentation.description}</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-400">
                      {entryPresentation.capabilities.map((capability) => (
                        <li key={capability} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          {capability}
                        </li>
                      ))}
                    </ul>
                    {entryPresentation.limitations.map((limitation) => (
                      <p key={limitation} className="mt-3 text-sm text-amber-100/80">{limitation}</p>
                    ))}
                    {entryPresentation.adjacentActions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entryPresentation.adjacentActions.map((action) => (
                          <Link
                            key={`${action.href}:${action.label}`}
                            href={action.href}
                            className="rounded border border-amber-400/40 px-3 py-1.5 text-xs text-amber-100"
                            data-copilot-entry-action
                          >
                            {action.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <p className="mb-3 text-sm text-slate-500">快捷问题</p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {quickQuestions.map((q, i) => (
                        <button
                          type="button"
                          key={i}
                          onClick={() => void handleQuickQuestion(q.question)}
                          disabled={!authenticatedUserId || busy || recoveryFailed}
                          className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:border-amber-600 hover:bg-slate-800 disabled:opacity-50"
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : conversationStatus === 'ready' || isLoading ? (
                <div className="space-y-4">
                  <KonlingChatMessageList messages={messages} />
                  {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <div className="flex space-x-1">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" />
                        <div
                          className="h-2 w-2 animate-bounce rounded-full bg-amber-400"
                          style={{ animationDelay: '150ms' }}
                        />
                        <div
                          className="h-2 w-2 animate-bounce rounded-full bg-amber-400"
                          style={{ animationDelay: '300ms' }}
                          />
                      </div>
                      <span>{KONLING_BRAND.name}正在思考...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              ) : null}
              {chatFailure && (
                <div className="rounded-lg bg-red-900/30 p-4 text-red-300" role="alert">
                  <p className="text-sm">{chatFailure.message}</p>
                  <KonlingChatFailureActions
                    category={chatFailure.category}
                    onRetry={() => reload()}
                    onNewConversation={() => void handleNewConversation()}
                  />
                </div>
              )}
            </div>

            <form onSubmit={(event) => void handleConversationSubmit(event)} className="mt-4" data-task-workspace-zone="local-primary-input">
              <div className="flex gap-3">
                <input
                  aria-label={entryPresentation.inputAriaLabel}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder={entryPresentation.placeholder}
                  data-primary-task-input={localTaskMode ? 'copilot-local-task' : undefined}
                  className={`${konlingPromptInputClassName} rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20`}
                  disabled={!authenticatedUserId || isLoading || recoveryFailed}
                />
                {isLoading ? (
                  <Button type="button" onClick={stop} size="lg" variant="secondary" className="px-6">
                    停止
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="lg"
                    disabled={!authenticatedUserId || !input.trim() || busy || recoveryFailed}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 hover:from-amber-600 hover:to-orange-600"
                  >
                    发送
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function resolveCopilotViewerRole(role?: string | null): PlatformRole {
  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === 'admin') return 'admin';
  if (normalizedRole === 'teacher') return 'teacher';
  return 'student';
}
