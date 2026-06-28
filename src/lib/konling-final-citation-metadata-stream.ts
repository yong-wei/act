type UIMessageChunkLike = {
  type?: string;
  delta?: unknown;
};

export function appendFinalCitationGuardMetadata(
  stream: ReadableStream,
  buildFinalMetadata: (assistantContent: string) => unknown,
) {
  let assistantContent = '';
  return stream.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      if (isUiMessageChunkLike(chunk) && chunk.type === 'text-delta' && typeof chunk.delta === 'string') {
        assistantContent += chunk.delta;
      }
      controller.enqueue(chunk);
      if (isUiMessageChunkLike(chunk) && chunk.type === 'finish') {
        controller.enqueue({
          type: 'message-metadata',
          messageMetadata: {
            konlingCitationGuard: buildFinalMetadata(assistantContent),
          },
        });
      }
    },
  }));
}

function isUiMessageChunkLike(value: unknown): value is UIMessageChunkLike {
  return Boolean(value && typeof value === 'object' && 'type' in value);
}
