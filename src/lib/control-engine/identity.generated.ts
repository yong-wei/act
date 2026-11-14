import { IDENTITY_SCHEMA, type ControlEngineWasmExport } from './types';

export const CONTROL_ENGINE_IDENTITY_SCHEMA = IDENTITY_SCHEMA;
export const CONTROL_ENGINE_BUILD_HASH = '94e5fed43521e56e63c796a00a2d86463e3380eb9a196e907379f3067cc9574e';
export const CONTROL_ENGINE_EXPORTS: readonly ControlEngineWasmExport[] = [
  'compute_analysis',
  'compute_nonlinear_analysis',
  'compute_rl_training',
  'compute_simulation_step',
  'compute_virtual_simulation_step',
  'VesselSimulationSession',
] as const;
export const CONTROL_ENGINE_FILE_HASHES = {
  'index.js': '22992fc1957d5c06fb7e8df6875c4fe497cd4e525fb3a48dc8156159a5dae750',
  'index.d.ts': 'a5cc8155bb2cd31e326c9dee57047d43afcb9a6134733449e72f37fa17403d4c',
  'index_bg.wasm': '8a1b5f6caefd43a80fcba8076fc30a0db646708b7705d5b63fd7f2f01bd485a5',
  'index_bg.wasm.d.ts': 'd1e94aaaba98f60ed33e00a6fd51db58b80f0305127ae2a31287218707aa8bef',
} as const;
