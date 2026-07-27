import { getMessageContent, toLegacyMessage, type IncomingMessage } from '@/lib/ai-message-compat';
import type { Message } from '@/types/ai-message';

const TOOL_CALL_TAG = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/giu;
const DEEPSEEK_TOOL_CALL = /<｜tool▁call▁begin｜>\s*([\w.-]+)\s*<｜tool▁sep｜>\s*([\s\S]*?)\s*<｜tool▁call▁end｜>/gu;
const DSML_INVOKE_TOOL_CALL = /<｜DSML｜tool_calls>\s*<｜DSML｜invoke name="([\w.-]{1,128})">\s*<｜DSML｜parameter name="arguments" string="false">\s*([\s\S]*?)\s*<\/｜DSML｜parameter>\s*<\/｜DSML｜invoke>\s*<\/｜DSML｜tool_calls>/gu;
const SUSPICIOUS_STRUCTURED_SYNTAX = /<(?:\/?tool_call\b|｜tool▁(?:calls?|call)▁(?:begin|end)｜|\/?｜DSML｜(?:tool_calls|invoke|parameter)\b)/iu;
const CODE_FENCE = /```[\s\S]*?```/gu;
const MALFORMED_ENVELOPE_MARKER = '\u0000konling-malformed-envelope\u0000';
const KONLING_STRUCTURED_FAILURE_TEXT = '结构化操作未能安全完成，请重新生成建议。';
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
  let messageId = '';
  const nativeCalls: KonlingNormalizedToolCall[] = [];
  const privateActionCallIds = new Set<string>();
  const availableCallIds = new Set<string>();
  const malformedFragmentIds = new Set<string>();
  const fragmentedInputs = new Map<string, { name: string; inputText: string }>();
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
      if (chunk?.type === 'text-start' || chunk?.type === 'text-end') {
        if (!textPartId && typeof chunk.id === 'string') textPartId = chunk.id;
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
          const fallbackCalls = dedupeToolCalls([...availableCalls, ...fragmentedCalls])
            .filter((call) =>
              fragmentedCalls.some((fragmented) => sameToolCall(fragmented, call))
              && !availableCalls.some((available) => sameToolCall(available, call)));
          input.state.toolCalls = dedupeToolCalls([
            ...availableCalls,
            ...fragmentedCalls,
            ...normalized.toolCalls,
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
            } catch {
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
                ? '工具调用格式未能安全解析，正在尝试修正。'
                : '');
          enqueueKonlingTextPart(controller, textPartId || messageId, visibleText);
          for (const call of normalized.toolCalls) {
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
        }
        controller.enqueue(chunk);
        return;
      }
      if (!textPartId && typeof chunk.id === 'string') textPartId = chunk.id;
      textBuffer += chunk.delta;
    },
    flush(controller) {
      if (!textBuffer) return;
      const normalized = normalizeKonlingStructuredText(textBuffer);
      const visibleText = normalized.text
        || (normalized.withheldMalformedSyntax
          ? '工具调用格式未能安全解析，正在尝试修正。'
          : '');
      enqueueKonlingTextPart(controller, textPartId || messageId, visibleText);
      input.state.toolCalls = dedupeToolCalls([...nativeCalls, ...normalized.toolCalls]);
      input.state.withheldMalformedSyntax ||= normalized.withheldMalformedSyntax;
      if (normalized.withheldMalformedSyntax) input.state.withheldText = textBuffer;
    },
  }));
}

function enqueueKonlingTextPart(
  controller: TransformStreamDefaultController<any>,
  id: string,
  text: string,
) {
  if (!id || !text) return;
  controller.enqueue({ type: 'text-start', id });
  controller.enqueue({ type: 'text-delta', id, delta: text });
  controller.enqueue({ type: 'text-end', id });
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
    } catch {
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
    throw new Error('structured-tool-not-permitted');
  }
  const parsed = typeof scopedTool.inputSchema?.safeParse === 'function'
    ? scopedTool.inputSchema.safeParse(input.call.input)
    : { success: true, data: input.call.input };
  if (!parsed.success) throw new Error('structured-tool-input-invalid');
  return scopedTool.execute(parsed.data, {
    toolCallId: input.call.id,
    messages: input.messages ?? [],
    abortSignal: input.abortSignal,
  });
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
