import type { UIMessage } from 'ai';

import type {
  KonlingAssignedCitation,
} from '@/lib/konling-citation-protocol';
import type {
  KonlingCitationVerificationStatus,
} from '@/lib/konling-citation-repair';

export type KonlingMessageRevision = {
  messageId: string;
  revision: number;
  body: string;
  citations: KonlingAssignedCitation[];
  status: KonlingCitationVerificationStatus;
  userNotice: '部分引用未能核验' | '引用未能核验' | null;
  metadata: Record<string, unknown>;
};

export type KonlingOptimizationStatus = {
  messageId: string;
  active: boolean;
};

export function createKonlingMessageRevisionStream(input: {
  stream: ReadableStream<any>;
  hasPendingOptimization?: () => boolean;
  finalize: (input: {
    messageId: string;
    body: string;
  }) => Promise<Omit<KonlingMessageRevision, 'messageId' | 'revision'>>;
  finalizeOptimization?: (input: {
    messageId: string;
    revision: KonlingMessageRevision;
  }) => Promise<KonlingMessageRevision | null>;
}) {
  let messageId = '';
  let body = '';
  let optimizationStatusSent = false;
  let optimizationStatusClosed = false;
  const statusChunk = (active: boolean) => ({
    type: 'data-konling-optimization-status',
    id: messageId,
    transient: true,
    data: {
      messageId,
      active,
    } satisfies KonlingOptimizationStatus,
  });
  return input.stream.pipeThrough(new TransformStream<any, any>({
    async transform(chunk, controller) {
      if (chunk?.type === 'start' && typeof chunk.messageId === 'string') {
        messageId = chunk.messageId;
      }
      if (chunk?.type === 'text-delta' && typeof chunk.delta === 'string') {
        body += chunk.delta;
      }
      controller.enqueue(chunk);
      if (
        messageId
        && !optimizationStatusSent
        && input.hasPendingOptimization?.()
      ) {
        optimizationStatusSent = true;
        controller.enqueue(statusChunk(true));
      }
      if (chunk?.type !== 'finish' || !messageId || !body.trim()) return;
      const finalized = await input.finalize({ messageId, body });
      const revision = {
        ...finalized,
        messageId,
        revision: 1,
      } satisfies KonlingMessageRevision;
      controller.enqueue({
        type: 'data-konling-message-revision',
        id: messageId,
        transient: true,
        data: revision,
      });
      if (optimizationStatusSent && input.finalizeOptimization) {
        const optimized = await input.finalizeOptimization({
          messageId,
          revision,
        }).catch(() => null);
        if (optimized) {
          controller.enqueue({
            type: 'data-konling-message-revision',
            id: messageId,
            transient: true,
            data: optimized,
          });
        }
      }
      if (optimizationStatusSent) {
        optimizationStatusClosed = true;
        controller.enqueue(statusChunk(false));
      }
    },
    flush(controller) {
      if (optimizationStatusSent && !optimizationStatusClosed) {
        controller.enqueue(statusChunk(false));
      }
    },
  }));
}

export function applyKonlingMessageRevision<UI_MESSAGE extends UIMessage>(
  messages: readonly UI_MESSAGE[],
  revision: KonlingMessageRevision,
): UI_MESSAGE[] {
  return messages.map((message) => {
    if (message.id !== revision.messageId) return message;
    const currentRevision = readMessageRevision(message.metadata);
    if (revision.revision <= currentRevision) return message;
    return {
      ...message,
      metadata: {
        ...(isRecord(message.metadata) ? message.metadata : {}),
        ...revision.metadata,
        konlingMessageRevision: {
          revision: revision.revision,
          status: revision.status,
          userNotice: revision.userNotice,
        },
      },
      parts: [
        { type: 'text' as const, text: revision.body },
        ...message.parts.filter((part) => part.type !== 'text'),
      ],
    };
  });
}

export function applyKonlingOptimizationStatus<UI_MESSAGE extends UIMessage>(
  messages: readonly UI_MESSAGE[],
  status: KonlingOptimizationStatus,
): UI_MESSAGE[] {
  return messages.map((message) => message.id === status.messageId
    ? {
        ...message,
        metadata: {
          ...(isRecord(message.metadata) ? message.metadata : {}),
          konlingOptimizationActive: status.active,
        },
      }
    : message);
}

export function readMessageRevision(metadata: unknown) {
  if (!isRecord(metadata) || !isRecord(metadata.konlingMessageRevision)) return 0;
  const revision = metadata.konlingMessageRevision.revision;
  return Number.isInteger(revision) && Number(revision) >= 0 ? Number(revision) : 0;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
