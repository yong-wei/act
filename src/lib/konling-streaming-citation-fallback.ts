type StreamingCitationGuard = {
  status: string;
  missingCitationClasses: string[];
  lowConfidenceReasons: string[];
  citations: Array<{
    id: string;
    displayTitle?: string;
    evidenceBasis: string;
  }>;
};

export function buildStreamingCitationFallbackNotice(guard: StreamingCitationGuard | null) {
  if (!guard || guard.status === 'verified') return null;
  const sources = guard.citations
    .slice(0, 3)
    .map((citation) => citation.displayTitle || citation.evidenceBasis || citation.id)
    .filter(Boolean);
  const sourceText = sources.length > 0 ? `可核验来源：${sources.join('、')}。` : '';
  const missingText = guard.missingCitationClasses.length > 0
    ? `缺少证据类型：${guard.missingCitationClasses.join('、')}。`
    : '';
  const confidenceText = guard.lowConfidenceReasons.length > 0
    ? `低置信原因：${guard.lowConfidenceReasons.join('；')}。`
    : '';
  return `【控灵证据提示】本次流式回答尚未完成最终引用核验。${sourceText}${missingText}${confidenceText}\n\n`;
}

export function insertStreamingCitationFallbackNotice(stream: ReadableStream<any>, notice: string | null) {
  if (!notice) return stream;
  let inserted = false;
  const textId = 'konling-citation-fallback';

  function enqueueNotice(controller: TransformStreamDefaultController<any>) {
    controller.enqueue({ type: 'text-start', id: textId });
    controller.enqueue({ type: 'text-delta', id: textId, delta: notice });
    controller.enqueue({ type: 'text-end', id: textId });
  }

  return stream.pipeThrough(new TransformStream<any, any>({
    transform(chunk, controller) {
      if (inserted) {
        controller.enqueue(chunk);
        return;
      }
      inserted = true;
      if (chunk?.type === 'start') {
        controller.enqueue(chunk);
        enqueueNotice(controller);
        return;
      }
      enqueueNotice(controller);
      controller.enqueue(chunk);
    },
  }));
}
