import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  initSync,
  compute_virtual_simulation_step,
} from '@/resources/control-system/wasm/control_engine/index.js';

let ready = false;

export const preloadVirtualSimulationServerRuntime = () => {
  if (ready) {
    return;
  }

  const wasmPath = path.join(
    process.cwd(),
    'src/resources/control-system/wasm/control_engine/index_bg.wasm',
  );
  initSync(readFileSync(wasmPath));
  ready = true;
};

export const computeVirtualSimulationServerStep = <TResult>(request: unknown): TResult => {
  preloadVirtualSimulationServerRuntime();
  return JSON.parse(compute_virtual_simulation_step(JSON.stringify(request))) as TResult;
};
