import initControlEngine, * as controlEngine from '../wasm/control_engine/index.js';

let initPromise: Promise<void> | null = null;

async function ensureEngine() {
  if (!initPromise) {
    initPromise = initControlEngine().then(() => undefined);
  }
  return initPromise;
}

self.onmessage = async (event: MessageEvent<{ id: string; requestJson: string }>) => {
  const { id, requestJson } = event.data;
  try {
    await ensureEngine();
    const request = JSON.parse(requestJson) as { runtimeMode?: string };
    const nonlinearCompute = (controlEngine as typeof controlEngine & {
      compute_nonlinear_analysis?: (request: string) => string;
    }).compute_nonlinear_analysis;
    const resultJson =
      request.runtimeMode === 'nonlinear_analysis' && typeof nonlinearCompute === 'function'
        ? nonlinearCompute(requestJson)
        : controlEngine.compute_analysis(requestJson);
    self.postMessage({ id, ok: true, resultJson });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : '控制分析 Worker 执行失败',
    });
  }
};
