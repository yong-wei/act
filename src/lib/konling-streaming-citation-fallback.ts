type StreamingCitationGuard = {
  status: string;
  missingCitationClasses: string[];
  lowConfidenceReasons: string[];
  diagnosticReasons?: string[];
  missingContext?: string[];
  personalizationAvailability?: {
    status: string;
    missingCitationClasses: string[];
    lowConfidenceReasons: string[];
  };
  retrievalSources?: Array<{
    id?: string;
    sourceType: string;
    displayTitle?: string;
    evidenceBasis: string;
    confidence?: string;
  }>;
  citations: Array<{
    id: string;
    displayTitle?: string;
    evidenceBasis: string;
  }>;
};

type StreamingCitationFallbackNoticeOptions = {
  nodeEnv?: string;
  debugInjectionOverride?: boolean;
};

function readDebugInjectionOverride(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return null;
}

export function shouldInjectStreamingCitationFallbackNotice(
  options: StreamingCitationFallbackNoticeOptions = {},
) {
  const explicit = options.debugInjectionOverride ?? readDebugInjectionOverride(
    process.env.KONLING_STREAMING_CITATION_DEBUG_INJECTION,
  );
  if (explicit !== null) return explicit;
  return (options.nodeEnv ?? process.env.NODE_ENV) !== 'production';
}

export function buildStreamingCitationFallbackNotice(
  guard: StreamingCitationGuard | null,
  options: StreamingCitationFallbackNoticeOptions = {},
) {
  if (!guard) return null;
  if (!shouldInjectStreamingCitationFallbackNotice(options)) return null;
  const hasDiagnostics = guard.status !== 'verified'
    || guard.missingCitationClasses.length > 0
    || guard.lowConfidenceReasons.length > 0
    || (guard.diagnosticReasons?.length ?? 0) > 0
    || (guard.missingContext?.length ?? 0) > 0
    || guard.personalizationAvailability?.status === 'limited';
  if (!hasDiagnostics) return null;
  const sources = (guard.retrievalSources ?? guard.citations)
    .slice(0, 3)
    .map((citation) => citation.displayTitle || citation.evidenceBasis || citation.id)
    .filter(Boolean);
  const sourceText = sources.length > 0 ? `可核验来源：${sources.join('、')}。` : '';
  const missingText = guard.missingCitationClasses.length > 0
    ? `缺少证据类型：${guard.missingCitationClasses.join('、')}。`
    : '';
  const missingContextText = (guard.missingContext?.length ?? 0) > 0
    ? `缺少上下文：${guard.missingContext?.join('、')}。`
    : '';
  const confidenceText = guard.lowConfidenceReasons.length > 0
    ? `低置信原因：${guard.lowConfidenceReasons.join('；')}。`
    : '';
  const diagnosticText = (guard.diagnosticReasons?.length ?? 0) > 0
    ? `诊断原因：${guard.diagnosticReasons?.join('；')}。`
    : '';
  const personalizationText = guard.personalizationAvailability?.status === 'limited'
    ? `个性化状态：limited；缺少 ${guard.personalizationAvailability.missingCitationClasses.join('、') || '无'}；原因 ${guard.personalizationAvailability.lowConfidenceReasons.join('；') || '无'}。`
    : '';
  return `【控灵证据提示】本次流式回答尚未完成最终引用核验。${sourceText}${missingText}${missingContextText}${confidenceText}${diagnosticText}${personalizationText}\n\n`;
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
