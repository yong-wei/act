import initControlEngine, { compute_simulation_step } from '@/resources/control-system/wasm/control_engine/index.js';

import type { RustSimulationRequest, RustSimulationResult } from './rust-runtime-adapter';

let initPromise: Promise<void> | null = null;
let ready = false;

export const preloadControlOdysseyRuntime = () => {
  if (!initPromise) {
    initPromise = initControlEngine().then(() => {
      ready = true;
    });
  }
  return initPromise;
};

export const isControlOdysseyRuntimeReady = () => ready;

export const computeRustSimulationStep = (request: RustSimulationRequest): RustSimulationResult => {
  if (!ready) {
    throw new Error('控制奥德赛 Rust 仿真内核尚未加载完成。');
  }
  return JSON.parse(compute_simulation_step(JSON.stringify(request))) as RustSimulationResult;
};
