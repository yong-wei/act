'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { AIMessageContent } from './ai-message-content';
import { KonlingCitationPanel, extractKonlingCitationMetadata } from './konling-citation-presentation';
import { CompanionResourceCards } from '@/features/ai/companion/companion-resource-cards';
import { summarizeAiToolResult } from '@/lib/ai-task-boundary-contracts';
import type { useAIThemeStyles } from '@/lib/ai-theme-styles';

type KonlingToolInvocation = {
  toolName: string;
  state?: string;
  result?: unknown;
};

export type KonlingRenderableMessage = {
  id?: string;
  role: string;
  content?: string;
  metadata?: unknown;
  toolInvocations?: KonlingToolInvocation[];
};

export type KonlingStructuredActionRequest = {
  suggestionId: string;
  taskId?: string;
  operation: 'bootstrap' | 'revise';
  action: 'apply' | 'ignore' | 'refresh' | 'regenerate';
};

export type KonlingStructuredActionResult = {
  state: 'applied' | 'ignored' | 'conflict' | 'failed';
  message: string;
  refreshRecovery?: boolean;
};

export const konlingPromptInputClassName = 'flex-[0_1_75%] min-w-0';

type KonlingChatRendererStyles = ReturnType<typeof useAIThemeStyles>;

export function KonlingChatMessageList({
  messages,
  styles,
  onStructuredAction,
}: {
  messages: readonly KonlingRenderableMessage[];
  styles?: KonlingChatRendererStyles;
  onStructuredAction?: (request: KonlingStructuredActionRequest) => Promise<KonlingStructuredActionResult>;
}) {
  return (
    <div className="space-y-4" data-konling-chat-renderer="shared">
      {messages.map((message, index) => (
        <KonlingMessageBubble
          key={message.id ?? index}
          message={message}
          styles={styles}
          onStructuredAction={onStructuredAction}
        />
      ))}
    </div>
  );
}

export function KonlingMessageBubble({
  message,
  styles,
  onStructuredAction,
}: {
  message: KonlingRenderableMessage;
  styles?: KonlingChatRendererStyles;
  onStructuredAction?: (request: KonlingStructuredActionRequest) => Promise<KonlingStructuredActionResult>;
}) {
  const isUser = message.role === 'user';
  const tools = message.toolInvocations ?? [];
  const disclosureTools = tools.filter((tool) => tool.toolName !== 'propose_smart_lesson_task_change');
  const userClassName = styles?.message.user ?? 'bg-amber-600 text-white';
  const assistantClassName = styles?.message.assistant ?? 'bg-slate-800 text-slate-200';
  const optimizationActive = isKonlingOptimizationActive(message.metadata);

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      data-konling-message-role={message.role}
    >
      <div
        className={[
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser ? 'max-w-[80%]' : 'w-full max-w-none',
          isUser ? userClassName : assistantClassName,
        ].join(' ')}
        data-konling-message-bubble={isUser ? 'user' : 'assistant'}
      >
        {!isUser && disclosureTools.length > 0 ? (
          <KonlingToolDisclosure tools={disclosureTools} styles={styles} />
        ) : null}
        {!isUser ? (
          <KonlingStructuredActionCards
            metadata={message.metadata}
            onAction={onStructuredAction}
          />
        ) : null}
        {message.content ? (
          <div className="text-sm leading-relaxed" data-konling-message-content>
            <AIMessageContent content={message.content} sanitizeContent={!isUser} />
            {!isUser ? <KonlingCitationPanel metadata={extractKonlingCitationMetadata(message.metadata)} /> : null}
          </div>
        ) : null}
        {!isUser ? <CompanionResourceCards message={message} /> : null}
        {!isUser && optimizationActive ? (
          <p
            className="mt-2 text-xs text-platform-evidence-context"
            role="status"
            data-konling-optimization-status
          >
            正在后台优化响应
          </p>
        ) : null}
      </div>
    </div>
  );
}

function KonlingStructuredActionCards({
  metadata,
  onAction,
}: {
  metadata: unknown;
  onAction?: (request: KonlingStructuredActionRequest) => Promise<KonlingStructuredActionResult>;
}) {
  const projectedActions = recordValue(metadata).konlingSmartPreparationActions;
  const actions = Array.isArray(projectedActions) ? projectedActions : [];
  return actions.map((value) => {
    const action = recordValue(value);
    if (
      typeof action.actionId !== 'string'
      || (action.operation !== 'bootstrap' && action.operation !== 'revise')
      || Object.keys(recordValue(action.proposal)).length === 0
    ) return null;
    return (
      <KonlingStructuredActionCard
        key={action.actionId}
        request={{
          suggestionId: action.actionId,
          taskId: typeof action.taskId === 'string' ? action.taskId : undefined,
          operation: action.operation,
          action: 'apply',
        }}
        proposedTask={recordValue(action.proposal)}
        persistedState={structuredActionState(action.state)}
        onAction={onAction}
      />
    );
  });
}

function KonlingStructuredActionCard({
  request,
  proposedTask,
  persistedState,
  onAction,
}: {
  request: Omit<KonlingStructuredActionRequest, 'action'> & { action: 'apply' };
  proposedTask: Record<string, unknown>;
  persistedState: KonlingStructuredActionResult['state'] | 'pending';
  onAction?: (request: KonlingStructuredActionRequest) => Promise<KonlingStructuredActionResult>;
}) {
  const [result, setResult] = useState<KonlingStructuredActionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const state = result?.state ?? persistedState;
  const statusText = result?.message ?? {
    applied: request.operation === 'bootstrap' ? '已创建备课任务。' : '建议已应用到备课任务。',
    ignored: '已忽略此建议。',
    conflict: '任务已发生变化，此建议无法继续应用。',
    failed: '操作未完成，请查看备课任务状态。',
    pending: '',
  }[state];
  const terminal = state !== 'pending';
  const summaryItems = [
    typeof proposedTask.topic === 'string' ? `主题：${proposedTask.topic}` : null,
    typeof proposedTask.audience === 'string' ? `授课对象：${proposedTask.audience}` : null,
    proposedTask.prerequisitesChanged === true
      ? `前置知识：${typeof proposedTask.prerequisites === 'string' && proposedTask.prerequisites ? proposedTask.prerequisites : '无'}`
      : null,
    typeof proposedTask.durationMinutes === 'number' ? `课时：${proposedTask.durationMinutes} 分钟` : null,
    proposedTask.outlineConfirmationRequiredChanged === true
      ? `大纲确认：${proposedTask.outlineConfirmationRequired === true ? '生成前需要确认' : '无需额外确认'}`
      : null,
    proposedTask.selectedClassChanged === true
      ? `班级学情：${typeof proposedTask.selectedClassLabel === 'string' ? proposedTask.selectedClassLabel : '已调整'}`
      : null,
  ].filter((item): item is string => Boolean(item));
  const textbookRanges = Array.isArray(proposedTask.textbookRanges) ? proposedTask.textbookRanges : [];
  const knowledgePoints = Array.isArray(proposedTask.knowledgePoints)
    ? proposedTask.knowledgePoints.filter((item): item is string => typeof item === 'string')
    : [];
  const goals = Array.isArray(proposedTask.goals)
    ? proposedTask.goals.filter((item): item is string => typeof item === 'string')
    : [];
  const sources = Array.isArray(proposedTask.sources)
    ? proposedTask.sources.filter((item): item is string => typeof item === 'string')
    : [];

  async function act(action: KonlingStructuredActionRequest['action']) {
    if (!onAction || submittingRef.current || (terminal && action !== 'refresh' && action !== 'regenerate')) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const next = await onAction({ ...request, action });
      if (action === 'apply' || action === 'ignore') setResult(next);
    } catch {
      setResult({ state: 'failed', message: '操作未完成，请刷新任务或重新生成建议。' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-3 rounded-lg border border-amber-400/40 bg-slate-950/30 p-3" data-konling-structured-action-card data-action-state={state}>
      <h3 className="text-sm font-medium text-amber-100">
        {request.operation === 'bootstrap' ? '控灵建议创建备课任务' : '控灵建议修订备课任务'}
      </h3>
      {summaryItems.length ? <ul className="mt-2 space-y-1 text-xs text-slate-200">{summaryItems.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      {typeof proposedTask.courseBasis === 'string' ? <p className="mt-2 text-xs text-slate-200">课程依据：{proposedTask.courseBasis}</p> : null}
      {sources.length ? <p className="mt-2 text-xs text-slate-200">资料来源：{sources.join('；')}</p> : null}
      {textbookRanges.length ? <p className="mt-2 text-xs text-slate-200">教材范围：{textbookRanges.map((value) => {
        const range = recordValue(value);
        return Array.isArray(range.structuralPath) && range.structuralPath.length
          ? range.structuralPath.join(' / ')
          : typeof range.level === 'string' ? range.level : '已调整';
      }).join('；')}</p> : null}
      {knowledgePoints.length ? <div className="mt-2 text-xs text-slate-200"><strong>知识点</strong><ul className="mt-1 list-disc space-y-0.5 pl-4">{knowledgePoints.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
      {goals.length ? <div className="mt-2 text-xs text-slate-200"><strong>教学目标</strong><ul className="mt-1 list-disc space-y-0.5 pl-4">{goals.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
      {statusText ? <p className="mt-2 text-xs" role="status">{statusText}</p> : null}
      {!terminal ? (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={!onAction || submitting} onClick={() => void act('apply')} className="rounded bg-amber-500 px-3 py-1.5 text-xs text-slate-950 disabled:opacity-50">应用</button>
          <button type="button" disabled={!onAction || submitting} onClick={() => void act('ignore')} className="rounded border border-slate-500 px-3 py-1.5 text-xs disabled:opacity-50">忽略</button>
        </div>
      ) : state === 'conflict' || state === 'failed' || result?.refreshRecovery ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!onAction || submitting} onClick={() => void act('refresh')} className="rounded border border-slate-500 px-3 py-1.5 text-xs disabled:opacity-50">刷新任务</button>
          {state === 'conflict' || state === 'failed' ? <button type="button" disabled={!onAction || submitting} onClick={() => void act('regenerate')} className="rounded bg-amber-500 px-3 py-1.5 text-xs text-slate-950 disabled:opacity-50">重新生成建议</button> : null}
        </div>
      ) : null}
    </section>
  );
}

function structuredActionState(value: unknown): KonlingStructuredActionResult['state'] | 'pending' {
  if (value === 'applied') return 'applied';
  if (value === 'ignored') return 'ignored';
  if (value === 'conflict') return 'conflict';
  if (value === 'failed') return 'failed';
  return 'pending';
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isKonlingOptimizationActive(metadata: unknown): boolean {
  return Boolean(
    metadata
    && typeof metadata === 'object'
    && !Array.isArray(metadata)
    && (metadata as Record<string, unknown>).konlingOptimizationActive === true,
  );
}

export function KonlingToolDisclosure({
  tools,
  styles,
}: {
  tools: readonly KonlingToolInvocation[];
  styles?: KonlingChatRendererStyles;
}) {
  const [open, setOpen] = useState(false);
  const textClassName = styles?.text.secondary ?? 'text-slate-300';

  return (
    <div className="mb-2 space-y-2" data-konling-tool-disclosure>
      <button
        type="button"
        className={`flex items-center gap-1 rounded border border-slate-600/40 px-2 py-1 text-xs ${textClassName} hover:border-amber-400 hover:text-amber-200`}
        aria-expanded={open}
        data-konling-tool-summary
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span>已调用 {tools.length} 项辅助能力</span>
      </button>
      {open ? (
        <div className="space-y-1" data-konling-tool-list>
          {tools.map((tool, index) => (
            <KonlingToolRow key={`${tool.toolName}:${index}`} tool={tool} styles={styles} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function KonlingToolRow({
  tool,
  styles,
}: {
  tool: KonlingToolInvocation;
  styles?: KonlingChatRendererStyles;
}) {
  const [open, setOpen] = useState(false);
  const mutedClassName = styles?.text.muted ?? 'text-slate-400';

  return (
    <div className="rounded border border-slate-700/60 bg-slate-950/40" data-konling-tool-row={tool.toolName}>
      <button
        type="button"
        className={`flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-xs ${mutedClassName} hover:text-amber-200`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{summarizeAiToolResult(tool.toolName)}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open ? (
        <div className={`border-t border-slate-700/60 px-2 py-1 text-xs ${mutedClassName}`} data-konling-tool-result>
          <p>{tool.state === 'result' ? '结果已安全用于当前回答。' : '正在处理当前请求。'}</p>
        </div>
      ) : null}
    </div>
  );
}

export function sanitizeKonlingToolResultPreview(value: unknown): string {
  const redacted = redactToolResult(value, 0);
  try {
    return JSON.stringify(redacted, null, 2).slice(0, 1200);
  } catch {
    return '工具结果已进入回答上下文，内部诊断已隐藏。';
  }
}

function redactToolResult(value: unknown, depth: number): unknown {
  if (depth > 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 8).map((item) => redactToolResult(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  const entries = Object.entries(value as Record<string, unknown>);
  const sortedEntries = [
    ...entries.filter(([key]) => !shouldRedactToolKey(key)),
    ...entries.filter(([key]) => shouldRedactToolKey(key)),
  ];
  return Object.fromEntries(
    sortedEntries.slice(0, 20).map(([key, item]) => [
      key,
      shouldRedactToolKey(key) ? '[redacted]' : redactToolResult(item, depth + 1),
    ]),
  );
}

function shouldRedactToolKey(key: string): boolean {
  return [
    /(^|[^a-z])id$/i,
    /[a-z](Id|ID)s?$/,
    /(email|phone|token|secret|password|session|citation|provider|payload|raw|private|diagnostic|context|memory)/i,
  ].some((pattern) => pattern.test(key));
}
