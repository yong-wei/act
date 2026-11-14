import { IDENTITY_SCHEMA, type ControlEngineWasmExport } from './types';

export const CONTROL_ENGINE_IDENTITY_SCHEMA = IDENTITY_SCHEMA;
export const CONTROL_ENGINE_BUILD_HASH = 'e87feed98ec8a1be111a78e237e8d6e0b7d46512a61723352481687e1d290a28';
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
  'index_bg.wasm': '365fdaf93ee79d6d5061bca4d3bbd886175cce9111ddada3f9dc4882969ef70e',
  'index_bg.wasm.d.ts': 'eaa832d510eac4c6714a51ef8ba3f6edc57a6629e8b4d6794ba6d60e814eb5fc',
} as const;
