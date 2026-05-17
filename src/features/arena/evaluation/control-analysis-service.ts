import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  ControlAnalysisRequest,
  ControlAnalysisResult,
} from '@/resources/control-system/analysis/types';

type ControlEngineModule = typeof import('@/resources/control-system/wasm/control_engine/index.js');

export interface ControlAnalysisService {
  compute(request: ControlAnalysisRequest): Promise<ControlAnalysisResult>;
}

let controlEnginePromise: Promise<ControlEngineModule> | null = null;

export function getControlEngineWasmPath() {
  return path.join(
    process.cwd(),
    'src',
    'resources',
    'control-system',
    'wasm',
    'control_engine',
    'index_bg.wasm',
  );
}

async function loadControlEngine(): Promise<ControlEngineModule> {
  if (!controlEnginePromise) {
    controlEnginePromise = (async () => {
      const controlEngine = await import('@/resources/control-system/wasm/control_engine/index.js');
      const wasmBytes = await readFile(getControlEngineWasmPath());
      controlEngine.initSync({ module: wasmBytes });
      return controlEngine;
    })();
  }
  return controlEnginePromise;
}

export const defaultControlAnalysisService: ControlAnalysisService = {
  async compute(request) {
    const controlEngine = await loadControlEngine();
    return JSON.parse(controlEngine.compute_analysis(JSON.stringify(request))) as ControlAnalysisResult;
  },
};
