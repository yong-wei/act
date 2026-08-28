import { computeAnalysisBrowser } from './client';

self.onmessage = async (event: MessageEvent<{ id: string; requestJson: string }>) => {
  const { id, requestJson } = event.data;
  try {
    const request = JSON.parse(requestJson) as Parameters<typeof computeAnalysisBrowser>[0];
    const envelope = await computeAnalysisBrowser(request, { executor: 'worker', requestId: id });
    self.postMessage({
      id,
      ok: true,
      resultJson: JSON.stringify(envelope.result),
      envelope,
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : '控制分析 Worker 执行失败',
      state: error && typeof error === 'object' && 'state' in error ? error.state : 'error',
    });
  }
};
