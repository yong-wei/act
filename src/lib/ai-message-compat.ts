import { convertToModelMessages, type ModelMessage, type UIMessage } from 'ai';
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
  return convertToModelMessages(messages.map(toUIMessage));
}
