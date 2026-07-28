import type { UIMessage } from 'ai';
import type { KonlingMessageRevision } from '@/lib/konling-message-revision-stream';
import type { KonlingOptimizationStatus } from '@/lib/konling-message-revision-stream';

export interface ToolInvocation {
  toolName: string;
  state: 'call' | 'partial-call' | 'result';
  result?: unknown;
}

export type KonlingUIMessage = UIMessage<
  unknown,
  {
    'konling-message-revision': KonlingMessageRevision;
    'konling-optimization-status': KonlingOptimizationStatus;
  }
>;

export type Message = UIMessage & {
  content: string;
  toolInvocations?: ToolInvocation[];
};
