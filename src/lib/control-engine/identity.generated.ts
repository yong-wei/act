import { IDENTITY_SCHEMA, type ControlEngineWasmExport } from './types';

export const CONTROL_ENGINE_IDENTITY_SCHEMA = IDENTITY_SCHEMA;
export const CONTROL_ENGINE_BUILD_HASH = '1d8080199945db75e2241c4e79105e4f5ae7c59121d234337656ecf4e21fd0c2';
export const CONTROL_ENGINE_EXPORTS: readonly ControlEngineWasmExport[] = [
  'compute_analysis',
  'compute_nonlinear_analysis',
  'compute_rl_training',
  'compute_simulation_step',
  'compute_virtual_simulation_step',
  'VesselSimulationSession',
] as const;
export const CONTROL_ENGINE_FILE_HASHES = {
  'index.js': 'e51d5ee2a9af6d3e89f1555ca65f5030e5e449c52c8b51fe24aebc52bc7e0efa',
  'index.d.ts': '0b1eac114507da23593dd0f505949cc823e17b87c4b424acf65c460b59df55eb',
  'index_bg.wasm': '712ecb06a577beec297dc2ffcc1b7fe42058929a67ad5dc38fcb19e53c201454',
  'index_bg.wasm.d.ts': 'eaa832d510eac4c6714a51ef8ba3f6edc57a6629e8b4d6794ba6d60e814eb5fc',
} as const;
