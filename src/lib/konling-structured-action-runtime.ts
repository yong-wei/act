import { getMessageContent, toLegacyMessage, type IncomingMessage } from '@/lib/ai-message-compat';
import type { Message } from '@/types/ai-message';

const TOOL_CALL_TAG = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/giu;
const DEEPSEEK_TOOL_CALL = /<｜tool▁call▁begin｜>\s*([\w.-]+)\s*<｜tool▁sep｜>\s*([\s\S]*?)\s*<｜tool▁call▁end｜>/gu;
const DSML_INVOKE_TOOL_CALL = /<｜DSML｜tool_calls>\s*<｜DSML｜invoke name="([\w.-]{1,128})">\s*<｜DSML｜parameter name="arguments" string="false">\s*([\s\S]*?)\s*<\/｜DSML｜parameter>\s*<\/｜DSML｜invoke>\s*<\/｜DSML｜tool_calls>/gu;
const SUSPICIOUS_STRUCTURED_SYNTAX = /<(?:\/?tool_call\b|｜tool▁(?:calls?|call)▁(?:begin|end)｜|\/?｜DSML｜(?:tool_calls|invoke|parameter)\b)/iu;
const CODE_FENCE = /```[\s\S]*?```/gu;
const MALFORMED_ENVELOPE_MARKER = '\u0000konling-malformed-envelope\u0000';
const KONLING_STRUCTURED_FAILURE_TEXT = '结构化操作未能安全完成，请重新生成建议。';
const STRUCTURED_STREAM_OPENERS = [
  '<tool_call',
  '</tool_call',
  '<｜tool▁call▁begin｜>',
  '<｜tool▁call▁end｜>',
  '<｜tool▁calls▁begin｜>',
  '<｜tool▁calls▁end｜>',
  '<｜DSML｜tool_calls>',
  '</｜DSML｜tool_calls',
  '<｜DSML｜invoke',
  '</｜DSML｜invoke',
  '<｜DSML｜parameter',
  '</｜DSML｜parameter',
] as const;
export const KONLING_STRUCTURED_CORRECTION_LIMIT_MS = 2_500;

export type KonlingNormalizedToolCall = {
  id: string;
  name: string;
  input: unknown;
  source: 'native' | 'block' | 'dsml';
};

export type KonlingStructuredTextNormalization = {
  text: string;
  toolCalls: KonlingNormalizedToolCall[];
  withheldMalformedSyntax: boolean;
};

export type KonlingStructuredActionStreamState = {
  toolCalls: KonlingNormalizedToolCall[];
  executedToolResults: KonlingExecutedToolResult[];
  withheldMalformedSyntax: boolean;
  withheldText: string;
};

export type KonlingExecutedToolResult = {
  toolCallId: string;
  toolName: string;
  result?: unknown;
  errorText?: string;
};

type KonlingStructuredToolExecutionStage = 'input-schema' | 'scoped-execute';

class KonlingStructuredToolExecutionError extends Error {
  constructor(
    readonly diagnostic: {
      code: string;
      stage: KonlingStructuredToolExecutionStage;
      issues?: Array<{ path: Array<string | number>; code: string }>;
      scopeStatus?: number;
      scopeMessage?: string;
    },
  ) {
    super(diagnostic.code);
    this.name = 'KonlingStructuredToolExecutionError';
  }
}

export async function correctKonlingMalformedStructuredResponse(input: {
  generate: (abortSignal: AbortSignal) => Promise<string>;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.abortSignal?.addEventListener('abort', abort, { once: true });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const generated = await Promise.race([
      input.generate(controller.signal).catch(() => ''),
      new Promise<string>((resolve) => {
        timeout = setTimeout(() => {
          controller.abort();
          resolve('');
        }, input.timeoutMs ?? KONLING_STRUCTURED_CORRECTION_LIMIT_MS);
      }),
    ]);
    const normalized = normalizeKonlingStructuredText(generated);
    if (
      normalized.text
      && !normalized.withheldMalformedSyntax
      && normalized.toolCalls.length === 0
    ) {
      return { text: normalized.text, status: 'corrected' as const };
    }
    return {
      text: '结构化操作未能安全完成，请重新生成建议。',
      status: 'failed' as const,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    input.abortSignal?.removeEventListener('abort', abort);
  }
}

export function normalizeKonlingStructuredText(
  value: string,
): KonlingStructuredTextNormalization {
  const protectedCode: string[] = [];
  const protectedValue = value.replace(CODE_FENCE, (literal) => {
    const marker = `\u0000konling-code-${protectedCode.length}\u0000`;
    protectedCode.push(literal);
    return marker;
  });
  const toolCalls: KonlingNormalizedToolCall[] = [];
  let text = protectedValue.replace(TOOL_CALL_TAG, (envelope, payload: string) => {
    const parsed = parseDsmlToolPayload(payload, `dsml-${toolCalls.length + 1}`);
    if (!parsed) return isJsonLikePayload(payload) ? MALFORMED_ENVELOPE_MARKER : envelope;
    toolCalls.push(parsed);
    return '';
  });
  text = text.replace(DEEPSEEK_TOOL_CALL, (
    envelope,
    name: string,
    payload: string,
  ) => {
    const input = parseJsonObject(payload);
    if (input === null) return isJsonLikePayload(payload) ? MALFORMED_ENVELOPE_MARKER : envelope;
    toolCalls.push({
      id: `dsml-${toolCalls.length + 1}`,
      name,
      input,
      source: 'dsml',
    });
    return '';
  });
  text = text.replace(DSML_INVOKE_TOOL_CALL, (
    _envelope,
    name: string,
    payload: string,
  ) => {
    const input = parseJsonObject(payload);
    if (input === null) return MALFORMED_ENVELOPE_MARKER;
    toolCalls.push({
      id: `dsml-${toolCalls.length + 1}`,
      name,
      input,
      source: 'dsml',
    });
    return '';
  });
  text = text
    .replace(/<｜tool▁calls▁begin｜>/gu, '')
    .replace(/<｜tool▁calls▁end｜>/gu, '');

  const protectedLiterals: string[] = [];
  text = text.replace(
    /<tool_call>[\s\S]*?<\/tool_call>|<｜tool▁call▁begin｜>[\s\S]*?<｜tool▁call▁end｜>/giu,
    (literal) => {
      const marker = `\u0000konling-literal-${protectedLiterals.length}\u0000`;
      protectedLiterals.push(literal);
      return marker;
    },
  );
  const suspiciousSyntaxIndex = text.search(SUSPICIOUS_STRUCTURED_SYNTAX);
  const malformedEnvelopeIndex = text.indexOf(MALFORMED_ENVELOPE_MARKER);
  const suspiciousIndexes = [suspiciousSyntaxIndex, malformedEnvelopeIndex]
    .filter((index) => index >= 0);
  const suspiciousIndex = suspiciousIndexes.length ? Math.min(...suspiciousIndexes) : -1;
  const withheldMalformedSyntax = suspiciousIndex >= 0;
  if (withheldMalformedSyntax) text = text.slice(0, suspiciousIndex);
  text = restoreProtectedLiterals(text, protectedLiterals);
  text = restoreProtectedCode(text, protectedCode);

  return {
    text: normalizeVisibleText(text),
    toolCalls: dedupeToolCalls(toolCalls),
    withheldMalformedSyntax,
  };
}

function isJsonLikePayload(value: string) {
  return /^[\s\uFEFF]*[\[{"-]|^[\s\uFEFF]*(?:true|false|null|\d)/u.test(value);
}

export function normalizeKonlingAssistantMessage(
  incoming: IncomingMessage,
): {
  message: Message;
  toolCalls: KonlingNormalizedToolCall[];
  withheldMalformedSyntax: boolean;
} {
  const message = toLegacyMessage(incoming);
  const normalized = normalizeKonlingStructuredText(getMessageContent(message));
  const nativeCalls = collectNativeToolCalls(message.parts);
  const toolCalls = dedupeToolCalls([...nativeCalls, ...normalized.toolCalls]);
  const parts: Message['parts'] = message.parts
    .filter((part) => part.type !== 'text');
  if (normalized.text) parts.push({ type: 'text', text: normalized.text });
  for (const call of normalized.toolCalls) {
    if (nativeCalls.some((native) => sameToolCall(native, call))) continue;
    parts.push({
      type: 'dynamic-tool',
      toolCallId: call.id,
      toolName: call.name,
      state: 'input-available',
      input: call.input,
    } as Message['parts'][number]);
  }
  const actionMetadata = toolCalls.map((call) => ({
    actionId: call.id,
    toolName: call.name,
    source: call.source,
    terminalState: readToolCallState(message.parts, call.id),
  }));
  return {
    message: toLegacyMessage({
      ...message,
      content: normalized.text,
      parts,
      metadata: {
        ...(isRecord(message.metadata) ? message.metadata : {}),
        ...(actionMetadata.length > 0 ? { konlingStructuredActions: actionMetadata } : {}),
        ...(normalized.withheldMalformedSyntax ? {
          konlingStructuredCorrection: {
            status: 'withheld',
            attempts: 0,
          },
        } : {}),
      },
    }),
    toolCalls,
    withheldMalformedSyntax: normalized.withheldMalformedSyntax,
  };
}

export function createKonlingStructuredActionStream(input: {
  stream: ReadableStream<any>;
  state: KonlingStructuredActionStreamState;
  executeToolCall?: (call: KonlingNormalizedToolCall) => Promise<unknown>;
}) {
  let textBuffer = '';
  let textPartId = '';
  let outputTextPartId = '';
  let messageId = '';
  let textLifecycleStarted = false;
  const nativeCalls: KonlingNormalizedToolCall[] = [];
  const streamedDsmlCalls: KonlingNormalizedToolCall[] = [];
  const privateActionCallIds = new Set<string>();
  const availableCallIds = new Set<string>();
  const malformedFragmentIds = new Set<string>();
  const fragmentedInputs = new Map<string, { name: string; inputText: string }>();
  const enqueueVisibleText = (
    controller: TransformStreamDefaultController<any>,
    text: string,
    sourcePartId?: unknown,
  ) => {
    if (!text) return;
    rememberTextPartId(sourcePartId);
    const id = outputTextPartId || textPartId || messageId;
    if (!id) return;
    if (!textLifecycleStarted) {
      controller.enqueue({ type: 'text-start', id });
      textLifecycleStarted = true;
      outputTextPartId = id;
    }
    controller.enqueue({ type: 'text-delta', id: outputTextPartId, delta: text });
  };
  const closeVisibleText = (controller: TransformStreamDefaultController<any>) => {
    if (!textLifecycleStarted) return;
    controller.enqueue({ type: 'text-end', id: outputTextPartId });
    textLifecycleStarted = false;
  };
  const rememberTextPartId = (value: unknown) => {
    if (textPartId) return;
    if (typeof value === 'string' && value) {
      textPartId = value;
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      textPartId = String(value);
    }
  };
  return input.stream.pipeThrough(new TransformStream<any, any>({
    async transform(chunk, controller) {
      if (chunk?.type === 'start' && typeof chunk.messageId === 'string') {
        messageId = chunk.messageId;
      }
      if (chunk?.type === 'tool-input-start') {
        if (
          typeof chunk.toolCallId === 'string'
          && typeof chunk.toolName === 'string'
          && isBoundedToolName(chunk.toolName)
        ) {
          fragmentedInputs.set(chunk.toolCallId, {
            name: chunk.toolName,
            inputText: '',
          });
          if (chunk.toolName === 'propose_smart_lesson_task_change') {
            privateActionCallIds.add(chunk.toolCallId);
            return;
          }
        } else if (typeof chunk.toolCallId === 'string') {
          malformedFragmentIds.add(chunk.toolCallId);
        }
        controller.enqueue(chunk);
        return;
      }
      if (chunk?.type === 'tool-input-delta') {
        const fragmented = typeof chunk.toolCallId === 'string'
          ? fragmentedInputs.get(chunk.toolCallId)
          : undefined;
        if (fragmented && typeof chunk.inputTextDelta === 'string') {
          fragmented.inputText += chunk.inputTextDelta;
        } else if (typeof chunk.toolCallId === 'string') {
          malformedFragmentIds.add(chunk.toolCallId);
        }
        if (typeof chunk.toolCallId === 'string' && privateActionCallIds.has(chunk.toolCallId)) return;
        controller.enqueue(chunk);
        return;
      }
      const native = normalizeNativeUiToolChunk(chunk);
      if (native) {
        nativeCalls.push(native);
        availableCallIds.add(native.id);
        malformedFragmentIds.delete(native.id);
        if (native.name === 'propose_smart_lesson_task_change') {
          privateActionCallIds.add(native.id);
          return;
        }
      }
      if (
        typeof chunk?.toolCallId === 'string'
        && privateActionCallIds.has(chunk.toolCallId)
        && (chunk.type === 'tool-output-available' || chunk.type === 'tool-output-error')
      ) return;
      if (chunk?.type === 'text-start') {
        rememberTextPartId(chunk.id);
        return;
      }
      if (chunk?.type === 'text-end') {
        rememberTextPartId(chunk.id);
        closeVisibleText(controller);
        return;
      }
      if (chunk?.type !== 'text-delta' || typeof chunk.delta !== 'string') {
        if (chunk?.type === 'finish') {
          const normalized = normalizeKonlingStructuredText(textBuffer);
          const fragmentedCalls: KonlingNormalizedToolCall[] = [];
          let fragmentedInputMalformed = malformedFragmentIds.size > 0;
          for (const [toolCallId, fragmented] of fragmentedInputs) {
            if (availableCallIds.has(toolCallId)) continue;
            const parsedInput = parseJsonObject(fragmented.inputText);
            if (parsedInput === null) {
              fragmentedInputMalformed = true;
              continue;
            }
            fragmentedCalls.push({
              id: toolCallId,
              name: fragmented.name,
              input: parsedInput,
              source: 'native',
            });
          }
          const availableCalls = dedupeToolCalls(nativeCalls);
          const normalizedCalls = dedupeToolCalls([
            ...streamedDsmlCalls,
            ...normalized.toolCalls,
          ]);
          const fallbackCalls = dedupeToolCalls([...availableCalls, ...fragmentedCalls])
            .filter((call) =>
              fragmentedCalls.some((fragmented) => sameToolCall(fragmented, call))
              && !availableCalls.some((available) => sameToolCall(available, call)));
          input.state.toolCalls = dedupeToolCalls([
            ...availableCalls,
            ...fragmentedCalls,
            ...normalizedCalls,
          ]);
          const executableCalls = input.state.toolCalls.filter((call) =>
            call.source === 'dsml'
            || fallbackCalls.some((fallback) => sameToolCall(fallback, call)));
          for (const call of executableCalls) {
            try {
              if (!input.executeToolCall) throw new Error('structured-tool-execution-unavailable');
              const result = await input.executeToolCall(call);
              input.state.executedToolResults.push({
                toolCallId: call.id,
                toolName: call.name,
                result,
              });
            } catch (error) {
              logKonlingStructuredToolExecutionFailure(call, error);
              input.state.executedToolResults.push({
                toolCallId: call.id,
                toolName: call.name,
                errorText: '结构化操作未能安全完成。',
              });
            }
          }
          input.state.withheldMalformedSyntax = normalized.withheldMalformedSyntax || fragmentedInputMalformed;
          input.state.withheldText = fragmentedInputMalformed
            ? [...fragmentedInputs.values()].map((fragmented) => fragmented.inputText).join('\n')
            : normalized.withheldMalformedSyntax ? textBuffer : '';
          const fallbackSucceeded = fallbackCalls.length > 0
            && !input.state.executedToolResults.some((item) =>
              item.errorText
              && fallbackCalls.some((fallback) => fallback.id === item.toolCallId));
          const normalizedVisibleText = fallbackSucceeded
            ? normalizeVisibleText(normalized.text.replaceAll(KONLING_STRUCTURED_FAILURE_TEXT, ''))
            : normalized.text;
          const visibleText = input.state.executedToolResults.some((item) => item.errorText)
            ? KONLING_STRUCTURED_FAILURE_TEXT
            : normalizedVisibleText
              || (input.state.withheldMalformedSyntax
                ? textLifecycleStarted ? '' : '工具调用格式未能安全解析，正在尝试修正。'
                : '');
          enqueueVisibleText(controller, visibleText);
          for (const call of normalizedCalls) {
            if ([...availableCalls, ...fragmentedCalls]
              .some((nativeCall) => sameToolCall(nativeCall, call))) continue;
            if (call.name === 'propose_smart_lesson_task_change') continue;
            controller.enqueue({
              type: 'tool-input-available',
              toolCallId: call.id,
              toolName: call.name,
              input: call.input,
              dynamic: true,
            });
            const execution = input.state.executedToolResults.find((item) => item.toolCallId === call.id);
            if (execution?.errorText) {
              controller.enqueue({
                type: 'tool-output-error',
                toolCallId: call.id,
                errorText: execution.errorText,
                dynamic: true,
              });
            } else if (execution) {
              controller.enqueue({
                type: 'tool-output-available',
                toolCallId: call.id,
                output: execution.result,
                dynamic: true,
              });
            }
          }
          for (const call of fallbackCalls) {
            if (call.name === 'propose_smart_lesson_task_change') continue;
            const execution = input.state.executedToolResults.find((item) => item.toolCallId === call.id);
            if (execution?.errorText) {
              controller.enqueue({
                type: 'tool-output-error',
                toolCallId: call.id,
                errorText: execution.errorText,
                dynamic: true,
              });
            } else if (execution) {
              controller.enqueue({
                type: 'tool-output-available',
                toolCallId: call.id,
                output: execution.result,
                dynamic: true,
              });
            }
          }
          textBuffer = '';
          closeVisibleText(controller);
        }
        if (chunk?.type === 'finish-step') closeVisibleText(controller);
        controller.enqueue(chunk);
        return;
      }
      rememberTextPartId(chunk.id);
      textBuffer += chunk.delta;
      const structuredTailIndex = findStructuredStreamTailIndex(
        textBuffer,
        fragmentedInputs.size > 0,
      );
      if (structuredTailIndex < 0) {
        enqueueVisibleText(controller, textBuffer, chunk.id);
        textBuffer = '';
        return;
      }
      if (structuredTailIndex > 0) {
        enqueueVisibleText(controller, textBuffer.slice(0, structuredTailIndex));
        textBuffer = textBuffer.slice(structuredTailIndex);
      }
      const normalizedTail = normalizeKonlingStructuredText(textBuffer);
      if (!normalizedTail.withheldMalformedSyntax && normalizedTail.toolCalls.length > 0) {
        streamedDsmlCalls.push(...normalizedTail.toolCalls);
        enqueueVisibleText(controller, normalizedTail.text);
        textBuffer = '';
      } else if (
        !normalizedTail.withheldMalformedSyntax
        && hasBalancedCodeFences(textBuffer)
      ) {
        enqueueVisibleText(controller, normalizedTail.text);
        textBuffer = '';
      }
    },
    flush(controller) {
      if (textBuffer) {
        const normalized = normalizeKonlingStructuredText(textBuffer);
        const visibleText = normalized.text
          || (normalized.withheldMalformedSyntax
            ? textLifecycleStarted ? '' : '工具调用格式未能安全解析，正在尝试修正。'
            : '');
        enqueueVisibleText(controller, visibleText);
        input.state.toolCalls = dedupeToolCalls([
          ...nativeCalls,
          ...streamedDsmlCalls,
          ...normalized.toolCalls,
        ]);
        input.state.withheldMalformedSyntax ||= normalized.withheldMalformedSyntax;
        if (normalized.withheldMalformedSyntax) input.state.withheldText = textBuffer;
      }
      closeVisibleText(controller);
    },
  }));
}

function hasBalancedCodeFences(value: string) {
  const fences = value.match(/```/gu);
  return Boolean(fences && fences.length % 2 === 0);
}

function findStructuredStreamTailIndex(
  value: string,
  retainFallbackFailureText: boolean,
): number {
  const lower = value.toLocaleLowerCase('en-US');
  const candidates = retainFallbackFailureText
    ? [...STRUCTURED_STREAM_OPENERS, KONLING_STRUCTURED_FAILURE_TEXT]
    : STRUCTURED_STREAM_OPENERS;
  let earliest = -1;
  for (let index = 0; index < lower.length; index += 1) {
    const suffix = lower.slice(index);
    if (candidates.some((opener) => {
      const normalizedOpener = opener.toLocaleLowerCase('en-US');
      return normalizedOpener.startsWith(suffix) || suffix.startsWith(normalizedOpener);
    })) {
      earliest = index;
      break;
    }
  }
  return earliest;
}

export async function executeKonlingDsmlToolCalls(input: {
  toolCalls: readonly KonlingNormalizedToolCall[];
  executeToolCall: (call: KonlingNormalizedToolCall) => Promise<unknown>;
}): Promise<KonlingExecutedToolResult[]> {
  const results: KonlingExecutedToolResult[] = [];
  for (const call of input.toolCalls.filter((candidate) => candidate.source === 'dsml')) {
    try {
      results.push({
        toolCallId: call.id,
        toolName: call.name,
        result: await input.executeToolCall(call),
      });
    } catch (error) {
      logKonlingStructuredToolExecutionFailure(call, error);
      results.push({
        toolCallId: call.id,
        toolName: call.name,
        errorText: '结构化操作未能安全完成。',
      });
    }
  }
  return results;
}

export async function executeKonlingScopedAiTool(input: {
  tools: Record<string, any>;
  call: KonlingNormalizedToolCall;
  abortSignal?: AbortSignal;
  messages?: unknown[];
}) {
  const scopedTool = input.tools[input.call.name];
  if (!scopedTool || typeof scopedTool.execute !== 'function') {
    throw new KonlingStructuredToolExecutionError({
      code: 'structured-tool-not-permitted',
      stage: 'scoped-execute',
    });
  }
  const parsed = typeof scopedTool.inputSchema?.safeParse === 'function'
    ? scopedTool.inputSchema.safeParse(input.call.input)
    : { success: true, data: input.call.input };
  if (!parsed.success) {
    throw new KonlingStructuredToolExecutionError({
      code: 'structured-tool-input-invalid',
      stage: 'input-schema',
      issues: safeZodIssues(parsed.error?.issues),
    });
  }
  try {
    return await scopedTool.execute(parsed.data, {
      toolCallId: input.call.id,
      messages: input.messages ?? [],
      abortSignal: input.abortSignal,
    });
  } catch (error) {
    if (error instanceof KonlingStructuredToolExecutionError) throw error;
    const scopeError = safeKonlingRuntimeScopeError(error);
    throw new KonlingStructuredToolExecutionError({
      code: scopeError ? 'structured-tool-scope-rejected' : 'structured-tool-execute-failed',
      stage: 'scoped-execute',
      ...(scopeError ? {
        scopeStatus: scopeError.status,
        scopeMessage: scopeError.message,
      } : {}),
    });
  }
}

function logKonlingStructuredToolExecutionFailure(
  call: KonlingNormalizedToolCall,
  error: unknown,
) {
  if (process.env.NODE_ENV === 'production') return;
  const diagnostic = error instanceof KonlingStructuredToolExecutionError
    ? error.diagnostic
    : {
        code: 'structured-tool-execute-failed',
        stage: 'scoped-execute' as const,
        ...safeKonlingRuntimeScopeError(error),
      };
  console.error('[konling-structured-tool-execution]', {
    toolName: call.name,
    source: call.source,
    ...diagnostic,
  });
}

function safeZodIssues(value: unknown): Array<{ path: Array<string | number>; code: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((issue) => {
    const record = isRecord(issue) ? issue : {};
    const path = Array.isArray(record.path)
      ? record.path.slice(0, 12).map((segment) =>
          typeof segment === 'number'
            ? segment
            : typeof segment === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(segment)
              ? segment
              : '[field]')
      : [];
    return {
      path,
      code: typeof record.code === 'string' && /^[a-z_]{1,64}$/u.test(record.code)
        ? record.code
        : 'validation_error',
    };
  });
}

function safeKonlingRuntimeScopeError(error: unknown): {
  status: number;
  message: string;
} | null {
  if (
    !isRecord(error)
    || error.name !== 'KonlingRuntimeScopeError'
    || ![400, 403, 404, 409].includes(Number(error.status))
  ) return null;
  const safeMessages = new Set([
    '智能备课建议必须来自已绑定的 prep-coauthor 会话。',
    '智能备课建议与当前会话阶段不匹配。',
    '智能备课建议绑定的任务修订已过期。',
    '智能备课建议的会话、对话轮次或任务绑定无效。',
    '智能备课建议不符合确认要求。',
    '智能备课建议引用了不可用的课程依据。',
    '智能备课建议引用了不属于所选课程依据的版本。',
    '智能备课会话没有可绑定的当前对话轮次。',
  ]);
  return {
    status: Number(error.status),
    message: typeof error.message === 'string' && safeMessages.has(error.message)
      ? error.message
      : 'Konling runtime scope rejected the tool execution.',
  };
}

export function attachKonlingExecutedToolResults(
  message: Message,
  results: readonly KonlingExecutedToolResult[],
): Message {
  if (results.length === 0) return message;
  const parts = message.parts.map((part) => {
    if (
      (part.type !== 'dynamic-tool' && !part.type.startsWith('tool-'))
      || !('toolCallId' in part)
    ) return part;
    const execution = results.find((item) => item.toolCallId === part.toolCallId);
    if (!execution) return part;
    return {
      ...part,
      state: execution.errorText ? 'output-error' : 'output-available',
      ...(execution.errorText
        ? { errorText: execution.errorText }
        : { output: execution.result }),
    } as Message['parts'][number];
  });
  return toLegacyMessage({ ...message, parts });
}

function parseDsmlToolPayload(
  payload: string,
  fallbackId: string,
): KonlingNormalizedToolCall | null {
  const parsed = parseJsonObject(payload);
  if (parsed === null) return null;
  const name = typeof parsed.name === 'string'
    ? parsed.name
    : typeof parsed.tool_name === 'string'
      ? parsed.tool_name
      : typeof parsed.function === 'string'
        ? parsed.function
        : null;
  if (!name) return null;
  const args = parsed.arguments ?? parsed.input ?? parsed.parameters ?? {};
  return {
    id: typeof parsed.id === 'string' ? parsed.id : fallbackId,
    name,
    input: typeof args === 'string' ? parseJsonObject(args) ?? args : args,
    source: 'dsml',
  };
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isBoundedToolName(value: string) {
  return /^[\w.-]{1,128}$/u.test(value);
}

function collectNativeToolCalls(parts: Message['parts']): KonlingNormalizedToolCall[] {
  return parts.flatMap((part): KonlingNormalizedToolCall[] => {
    if (part.type === 'dynamic-tool') {
      return [{
        id: part.toolCallId,
        name: part.toolName,
        input: part.input,
        source: 'native',
      }];
    }
    if (!part.type.startsWith('tool-')) return [];
    const toolPart = part as Extract<Message['parts'][number], { type: `tool-${string}` }>;
    return [{
      id: toolPart.toolCallId,
      name: toolPart.type.replace(/^tool-/, ''),
      input: toolPart.input,
      source: 'block',
    }];
  });
}

function normalizeNativeUiToolChunk(chunk: any): KonlingNormalizedToolCall | null {
  if (chunk?.type !== 'tool-input-available') return null;
  if (typeof chunk.toolCallId !== 'string' || typeof chunk.toolName !== 'string') return null;
  return {
    id: chunk.toolCallId,
    name: chunk.toolName,
    input: chunk.input ?? {},
    source: chunk.dynamic ? 'native' : 'block',
  };
}

function readToolCallState(parts: Message['parts'], toolCallId: string): string {
  const part = parts.find((candidate) =>
    (candidate.type === 'dynamic-tool' || candidate.type.startsWith('tool-'))
    && 'toolCallId' in candidate
    && candidate.toolCallId === toolCallId
  );
  return part && 'state' in part ? String(part.state) : 'input-available';
}

function dedupeToolCalls(
  calls: readonly KonlingNormalizedToolCall[],
): KonlingNormalizedToolCall[] {
  const seen = new Set<string>();
  return calls.filter((call) => {
    const identity = `${call.id}\u001f${call.name}\u001f${stableJson(call.input)}`;
    const semanticIdentity = `${call.name}\u001f${stableJson(call.input)}`;
    if (seen.has(identity) || seen.has(semanticIdentity)) return false;
    seen.add(identity);
    seen.add(semanticIdentity);
    return true;
  });
}

function sameToolCall(
  left: KonlingNormalizedToolCall,
  right: KonlingNormalizedToolCall,
) {
  return left.id === right.id
    || (left.name === right.name && stableJson(left.input) === stableJson(right.input));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function normalizeVisibleText(value: string): string {
  return value.replace(/[ \t]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
}

function restoreProtectedCode(value: string, protectedCode: readonly string[]) {
  return value.replace(/\u0000konling-code-(\d+)\u0000/gu, (_marker, index: string) =>
    protectedCode[Number(index)] ?? '');
}

function restoreProtectedLiterals(value: string, protectedLiterals: readonly string[]) {
  return value.replace(/\u0000konling-literal-(\d+)\u0000/gu, (_marker, index: string) =>
    protectedLiterals[Number(index)] ?? '');
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
