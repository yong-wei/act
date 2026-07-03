'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { AIMessageContent } from './ai-message-content';
import { KonlingCitationPanel, extractKonlingCitationMetadata } from './konling-citation-presentation';
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

export const konlingPromptInputClassName = 'flex-[0_1_75%] min-w-0';

type KonlingChatRendererStyles = ReturnType<typeof useAIThemeStyles>;

export function KonlingChatMessageList({
  messages,
  styles,
}: {
  messages: readonly KonlingRenderableMessage[];
  styles?: KonlingChatRendererStyles;
}) {
  return (
    <div className="space-y-4" data-konling-chat-renderer="shared">
      {messages.map((message, index) => (
        <KonlingMessageBubble
          key={message.id ?? index}
          message={message}
          styles={styles}
        />
      ))}
    </div>
  );
}

export function KonlingMessageBubble({
  message,
  styles,
}: {
  message: KonlingRenderableMessage;
  styles?: KonlingChatRendererStyles;
}) {
  const isUser = message.role === 'user';
  const tools = message.toolInvocations ?? [];
  const userClassName = styles?.message.user ?? 'bg-amber-600 text-white';
  const assistantClassName = styles?.message.assistant ?? 'bg-slate-800 text-slate-200';

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
        {!isUser && tools.length > 0 ? (
          <KonlingToolDisclosure tools={tools} styles={styles} />
        ) : null}
        {message.content ? (
          <div className="text-sm leading-relaxed" data-konling-message-content>
            <AIMessageContent content={message.content} sanitizeContent={!isUser} />
            {!isUser ? <KonlingCitationPanel metadata={extractKonlingCitationMetadata(message.metadata)} /> : null}
          </div>
        ) : null}
      </div>
    </div>
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
        <span>{`called ${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}`}</span>
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
        <span>{`called ${tool.toolName}`}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open ? (
        <div className={`border-t border-slate-700/60 px-2 py-1 text-xs ${mutedClassName}`} data-konling-tool-result>
          <p>{summarizeAiToolResult(tool.toolName)}</p>
          {tool.state === 'result' ? (
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-950/70 p-2">
              {sanitizeKonlingToolResultPreview(tool.result)}
            </pre>
          ) : null}
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

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).slice(0, 20).map(([key, item]) => [
      key,
      shouldRedactToolKey(key) ? '[redacted]' : redactToolResult(item, depth + 1),
    ]),
  );
}

function shouldRedactToolKey(key: string): boolean {
  return /(email|phone|token|secret|password|session|userId|studentId|targetUserId|classId|courseId|pageId|pathNodeId|resourceId|goalId|prepPackId|selectedNodeId|requestedNodeId|agentSessionId|registryId|assetId|rubricId|assignmentId|classReportId|citation|provider|payload|raw|private|diagnostic|context|memory)/i.test(key);
}
