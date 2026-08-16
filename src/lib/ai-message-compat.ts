import { convertToModelMessages, isToolUIPart, type ModelMessage, type UIMessage } from 'ai';
import type { Message, ToolInvocation } from '@/types/ai-message';

export type IncomingMessage = Partial<UIMessage> & {
  id?: string;
  role: UIMessage['role'];
  content?: string;
};

export function getMessageContent(message: Pick<UIMessage, 'parts'> | { content?: string }): string {
  if ('parts' in message && Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');
  }

  return 'content' in message ? message.content ?? '' : '';
}

function getToolInvocations(message: UIMessage): ToolInvocation[] {
  return message.parts
    .filter((part) => part.type.startsWith('tool-') || part.type === 'dynamic-tool')
    .map((part) => {
      if (part.type === 'dynamic-tool') {
        return {
          toolName: part.toolName,
          state: part.state === 'output-available' ? 'result' : 'call',
          result: part.output,
        };
      }

      const toolPart = part as Extract<UIMessage['parts'][number], { type: `tool-${string}` }>;
      return {
        toolName: toolPart.type.replace(/^tool-/, ''),
        state: toolPart.state === 'output-available' ? 'result' : 'call',
        result: toolPart.output,
      };
    });
}

export function toUIMessage(message: IncomingMessage): UIMessage {
  if (Array.isArray(message.parts)) {
    return message as UIMessage;
  }

  return {
    ...message,
    id: message.id ?? crypto.randomUUID(),
    role: message.role,
    parts: [{ type: 'text', text: message.content ?? '' }],
  };
}

export function toLegacyMessage(message: IncomingMessage): Message {
  const uiMessage = toUIMessage(message);
  return {
    ...uiMessage,
    content: getMessageContent(uiMessage),
    toolInvocations: getToolInvocations(uiMessage),
  };
}

export async function toModelMessages(messages: IncomingMessage[]): Promise<ModelMessage[]> {
  const providerMessages = messages.flatMap((message) => {
    // Konling persists page-context and assistant-binding records as system
    // messages for audit and restoration. Providers only accept the single
    // server-owned system prompt from streamText, so exclude them here.
    if (message.role === 'system') return [];
    const uiMessage = toUIMessage(message);
    // Persisted streams may end after a tool call but before its result. Replaying
    // that orphaned call makes the next provider request invalid, so retain only
    // terminal tool parts and preserve the message's ordinary context.
    const parts = uiMessage.parts.filter((part) => {
      if (!isToolUIPart(part)) return true;
      return part.state === 'output-available'
        || part.state === 'output-error'
        || part.state === 'output-denied';
    });
    return parts.length ? [{ ...uiMessage, parts }] : [];
  });
  return convertToModelMessages(providerMessages);
}
