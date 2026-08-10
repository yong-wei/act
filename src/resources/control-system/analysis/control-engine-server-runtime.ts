import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  compute_analysis,
  initSync,
} from '@/resources/control-system/wasm/control_engine/index.js';

import type { ControlAnalysisRequest, ControlAnalysisResult } from './types';

let ready = false;

function preloadControlAnalysisServerRuntime() {
  if (ready) return;
  const wasmPath = path.join(
    process.cwd(),
    'src/resources/control-system/wasm/control_engine/index_bg.wasm',
  );
  initSync({ module: readFileSync(wasmPath) });
  ready = true;
}

export function computeControlAnalysisServer(
  request: ControlAnalysisRequest,
): ControlAnalysisResult {
  preloadControlAnalysisServerRuntime();
  return JSON.parse(compute_analysis(JSON.stringify(request))) as ControlAnalysisResult;
}
