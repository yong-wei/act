import { IDENTITY_SCHEMA, type ControlEngineWasmExport } from './types';

export const CONTROL_ENGINE_IDENTITY_SCHEMA = IDENTITY_SCHEMA;
export const CONTROL_ENGINE_BUILD_HASH = '4a83723a3fceabfb94a72569bd9bfe03c0fb711fb1922600002443692e51aedf';
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
  'index_bg.wasm': 'e29ee5c0abf4b8b22c73669bed6e5bb5f7610e392926b0bb5a788c94f015f527',
  'index_bg.wasm.d.ts': 'd1e94aaaba98f60ed33e00a6fd51db58b80f0305127ae2a31287218707aa8bef',
} as const;
