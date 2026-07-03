'use client';

/**
 * AI Copilot 页面
 *
 * 独立的 AI 助教页面，提供完整的聊天界面
 * 使用控灵品牌
 */

import { useChat } from '@/hooks/useLegacyChat';
import { useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { KonlingAvatar } from '@/components/ai/konling-avatar';
import { KonlingChatMessageList, konlingPromptInputClassName } from '@/components/ai/konling-chat-renderer';
import { KONLING_BRAND } from '@/lib/ai-branding';
import { usePageAIContext } from '@/hooks/usePageAIContext';
import { useSearchParams } from 'next/navigation';
import { ActionStatusPanel } from '@/components/platform/action-status';
import {
  buildAiAuditTaskState,
  buildPortfolioReflectionDraft,
  getAiAuditTaskContract,
} from '@/lib/ai-task-boundary-contracts';

export default function CopilotPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const context = searchParams.get('context');
  const source = searchParams.get('source') ?? '当前学习证据';
  const assignment = searchParams.get('assignment') ?? undefined;
  const taskIntent = searchParams.get('intent') ?? context ?? undefined;
  const localTaskMode = context === 'portfolio-reflection' || context === 'evidence';
  const evidenceSummary = useMemo(() => (
    context === 'evidence'
      ? {
        source,
        focus: '学习证据复盘',
        weakPoint: '请围绕证据来源、薄弱点和下一步练习给出建议。',
        nextStep: '先说明证据可见来源，再给出一条可执行的补强练习。',
      }
      : null
  ), [context, source]);
  const reflectionDraft = useMemo(
    () => context === 'portfolio-reflection'
      ? buildPortfolioReflectionDraft(source, { assignment, intent: taskIntent })
      : null,
    [assignment, context, source, taskIntent]
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
      return buildAiAuditTaskState({
        taskType: 'evidence-copilot',
        status: 'pending',
        message: '证据上下文已转换为学生可读摘要，内部诊断不会显示在回答中。',
        nextAction: '围绕证据来源、薄弱点和下一步练习继续提问',
      });
    }
    return null;
  }, [context, reflectionDraft?.id]);
  const taskContract = context === 'portfolio-reflection'
    ? getAiAuditTaskContract('portfolio-reflection')
    : context === 'evidence'
      ? getAiAuditTaskContract('evidence-copilot')
      : null;

  // 获取页面上下文和用户画像
  const { pageContext, userProfile } = usePageAIContext({
    courseId: 'general',
    courseTitle: 'AI-OBE智能学习平台',
    topic: '通用学习辅助',
    pageType: 'workspace',
  });
  const copilotPageContext = useMemo(() => {
    if (!evidenceSummary) return pageContext;
    return {
      ...pageContext,
      topic: `证据 Copilot：${evidenceSummary.source}`,
      learningObjectives: [
        ...pageContext.learningObjectives,
        `证据来源：${evidenceSummary.source}`,
        evidenceSummary.weakPoint,
        evidenceSummary.nextStep,
      ],
    };
  }, [evidenceSummary, pageContext]);

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
      pageContext: copilotPageContext,
      userProfile,
      taskContext: evidenceSummary,
    },
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearLocalConversation = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  // 快捷问题
  const quickQuestions = useMemo(() => {
    if (context === 'portfolio-reflection') {
      return [
        { label: '整理目标', question: '请把本次 AI 协作的任务目标和输出对象整理成反思草稿。' },
        { label: '保留疑问', question: '请列出本次 AI 建议中仍需要我验证的疑问。' },
        { label: '下一步', question: '请把下一步验证行动写成作品集反思候选。' },
      ];
    }
    if (context === 'evidence') {
      return [
        { label: '证据来源', question: '请先说明当前证据来源，再给出下一步练习建议。' },
        { label: '薄弱点', question: '请根据当前证据摘要指出一个最需要补强的薄弱点。' },
        { label: '练习计划', question: '请把补强建议转成一个候选练习计划，不要写入档案。' },
      ];
    }
    return [
      { label: '仿真状态', question: '请获取当前的仿真状态' },
      { label: 'PID原理', question: '请解释PID控制器的工作原理' },
      { label: '诺莫托模型', question: '什么是诺莫托船舶模型？参数K和T代表什么？' },
      { label: '调参建议', question: '我的航迹误差较大，应该如何调整PID参数？' },
      { label: '安全规范', question: '根据CCS规范，舵角速度的安全限制是多少？' },
      { label: '海况影响', question: '不同海况等级对船舶控制有什么影响？' },
    ];
  }, [context]);

  return (
    <div
      className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 to-slate-900"
      data-ai-local-task-surface={localTaskMode ? `copilot-${context}` : undefined}
      data-ai-task-focus-mode={localTaskMode ? 'local-first' : undefined}
      data-task-workspace-archetype={localTaskMode ? 'ai-local-task' : undefined}
    >
      <FeaturePageNav title={KONLING_BRAND.name} backHref="/ai" backLabel="返回AI工坊" />
      {/* 头部 */}
      <header className="border-b border-slate-800 bg-slate-950/80 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600">
              <KonlingAvatar size="md" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{KONLING_BRAND.name}</h1>
              <p className="text-sm text-amber-400">{KONLING_BRAND.subtitle}</p>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        <div className="mx-auto flex h-full max-w-4xl flex-col p-6 pb-[calc(env(safe-area-inset-bottom,0px)+8rem)] md:pb-6">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            {taskState ? <ActionStatusPanel state={taskState} className="mb-4" /> : null}
            {taskContract ? (
              <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-xs text-slate-300">
                <span>任务类型：{taskContract.taskType}</span>
                <span className="ml-3">输出目标：{taskContract.outputTarget}</span>
                <span className="ml-3">写回：{taskContract.writebackBehavior}</span>
              </div>
            ) : null}
            {evidenceSummary ? (
              <div className="mb-4 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-sm text-cyan-100" data-ai-task-boundary="evidence-copilot-summary">
                <div className="font-medium">证据摘要：{evidenceSummary.source}</div>
                <p className="mt-1 text-cyan-100/80">{evidenceSummary.weakPoint}</p>
                <p className="mt-1 text-xs text-cyan-100/70">下一步：{evidenceSummary.nextStep}</p>
              </div>
            ) : null}
            {reflectionDraft ? (
              <div className="mb-4 rounded-xl border border-violet-500/40 bg-violet-500/10 p-4 text-sm text-violet-100">
                <div className="font-medium">{reflectionDraft.title}</div>
                <p className="mt-1 text-violet-100/80">{reflectionDraft.detail}</p>
                <div className="mt-2 rounded border border-violet-400/40 px-2 py-1 text-xs text-violet-100/70">
                  来源：{reflectionDraft.source} · 任务：{reflectionDraft.assignment ?? 'portfolio-reflection'} · 意图：{reflectionDraft.intent} · 输出：{reflectionDraft.outputTarget}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={portfolioReflectionHref} className="rounded bg-violet-500 px-3 py-1.5 text-xs text-white">
                    打开作品集候选预览
                  </a>
                  <span className="rounded border border-violet-400/50 px-3 py-1.5 text-xs">状态：{reflectionDraft.status}</span>
                </div>
              </div>
            ) : null}
            {messages.length === 0 ? (
              <div className="space-y-6">
                {/* 欢迎信息 */}
                <div className="rounded-xl bg-gradient-to-br from-amber-900/30 to-orange-900/20 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <KonlingAvatar size="md" />
                    <h2 className="text-lg font-semibold text-amber-300">欢迎使用 {KONLING_BRAND.name}</h2>
                  </div>
                  <p className="text-slate-300">
                    我是你的AI学习伴侣{KONLING_BRAND.name}，专门负责自动控制原理的教学与答疑工作。
                    我可以帮助您：
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-400">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      查看和分析仿真器状态
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      指导 PID 参数调整
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      解释船舶控制原理
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      根据 CCS 规范审核您的设计
                    </li>
                  </ul>
                </div>

                {/* 快捷问题 */}
                <div>
                  <p className="mb-3 text-sm text-slate-500">快捷问题</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {quickQuestions.map((q, i) => (
                      <button type="button"
                        key={i}
                        onClick={() => append({ role: 'user', content: q.question })}
                        className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:border-amber-600 hover:bg-slate-800"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <KonlingChatMessageList messages={messages} />
                {isLoading && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>{KONLING_BRAND.name}正在思考...</span>
                  </div>
                )}
                {error && (
                  <div className="rounded-lg bg-red-900/30 p-4 text-red-300">
                    <p className="text-sm">出错了: {error.message}</p>
                    <Button size="sm" variant="ghost" onClick={() => reload()} className="mt-2">
                      重试
                    </Button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* 输入区 */}
          <form onSubmit={handleSubmit} className="mt-4" data-task-workspace-zone="local-primary-input">
            <div className="flex gap-3">
              <input aria-label="请输入您的问题，例如：如何减少航迹误差？"
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="请输入您的问题，例如：如何减少航迹误差？"
                data-primary-task-input={localTaskMode ? 'copilot-local-task' : undefined}
                className={`${konlingPromptInputClassName} rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20`}
                disabled={isLoading}
              />
              {messages.length > 0 ? (
                <Button type="button" onClick={clearLocalConversation} size="lg" variant="outline" className="px-4">
                  清空
                </Button>
              ) : null}
              {isLoading ? (
                <Button type="button" onClick={stop} size="lg" variant="secondary" className="px-6">
                  停止
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  disabled={!input.trim()}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 hover:from-amber-600 hover:to-orange-600"
                >
                  发送
                </Button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
