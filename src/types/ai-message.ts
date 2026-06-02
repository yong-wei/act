import type { UIMessage } from 'ai';

export interface ToolInvocation {
  toolName: string;
  state: 'call' | 'partial-call' | 'result';
  result?: unknown;
}

export type Message = UIMessage & {
  content: string;
  toolInvocations?: ToolInvocation[];
};
