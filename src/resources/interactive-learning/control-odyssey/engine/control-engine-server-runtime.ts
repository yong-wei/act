import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  initSync,
  compute_simulation_step,
} from '@/resources/control-system/wasm/control_engine/index.js';

import type { RustSimulationRequest, RustSimulationResult } from './rust-runtime-adapter';

let ready = false;

export const preloadControlOdysseyServerRuntime = () => {
  if (ready) return;

  const wasmPath = path.join(
    process.cwd(),
    'src/resources/control-system/wasm/control_engine/index_bg.wasm',
  );
  initSync(readFileSync(wasmPath));
  ready = true;
};

export const computeControlOdysseyServerStep = (request: RustSimulationRequest): RustSimulationResult => {
  preloadControlOdysseyServerRuntime();
  return JSON.parse(compute_simulation_step(JSON.stringify(request))) as RustSimulationResult;
};
