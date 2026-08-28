import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  compute_analysis,
  compute_nonlinear_analysis,
  compute_rl_training,
  compute_simulation_step,
  compute_virtual_simulation_step,
  initSync,
} from '@/resources/control-system/wasm/control_engine/index.js';

import { ControlEngineFailure } from './envelope';
import { GENERATED_PACKAGE_DIR } from './types';

let ready = false;

export function getControlEngineWasmPath(cwd = process.cwd()): string {
  return path.join(cwd, GENERATED_PACKAGE_DIR, 'index_bg.wasm');
}

export function preloadServerControlEngine(cwd = process.cwd()): void {
  if (ready) return;
  try {
    initSync({ module: readFileSync(getControlEngineWasmPath(cwd)) });
    ready = true;
  } catch (error) {
    ready = false;
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'wasm-init',
      message: error instanceof Error ? error.message : 'Control engine server WASM could not initialize.',
      retryable: false,
    });
  }
}

export function invokeServerWasm(
  exportName:
    | 'compute_analysis'
    | 'compute_nonlinear_analysis'
    | 'compute_rl_training'
    | 'compute_simulation_step'
    | 'compute_virtual_simulation_step',
  requestJson: string,
  cwd = process.cwd(),
): string {
  preloadServerControlEngine(cwd);
  switch (exportName) {
    case 'compute_analysis':
      return compute_analysis(requestJson);
    case 'compute_nonlinear_analysis':
      return compute_nonlinear_analysis(requestJson);
    case 'compute_rl_training':
      return compute_rl_training(requestJson);
    case 'compute_simulation_step':
      return compute_simulation_step(requestJson);
    case 'compute_virtual_simulation_step':
      return compute_virtual_simulation_step(requestJson);
    default: {
      const exhaustive: never = exportName;
      throw new ControlEngineFailure({
        state: 'unavailable',
        category: 'missing-export',
        message: `Control engine export is not available: ${String(exhaustive)}`,
        retryable: false,
      });
    }
  }
}
