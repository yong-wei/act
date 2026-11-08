import { IDENTITY_SCHEMA, type ControlEngineWasmExport } from './types';

export const CONTROL_ENGINE_IDENTITY_SCHEMA = IDENTITY_SCHEMA;
export const CONTROL_ENGINE_BUILD_HASH = '204fb0216e800f65beb27b6a628c4f66628a2fc9cd21a8266416629570943098';
export const CONTROL_ENGINE_EXPORTS: readonly ControlEngineWasmExport[] = [
  'compute_analysis',
  'compute_nonlinear_analysis',
  'compute_rl_training',
  'compute_simulation_step',
  'compute_virtual_simulation_step',
] as const;
export const CONTROL_ENGINE_FILE_HASHES = {
  'index.js': 'f034d1b247fc4aac06748c041144f1f7aa40c4e06efe4384bacebf229e3c7bfe',
  'index.d.ts': '8760847ef56477d823a4038d166252c79267f4cec9d87f17fb7c7c83ccf6e84f',
  'index_bg.wasm': '0d132fa77f6820783d35f2298101858d78117664b84977f8326d284925da52b3',
  'index_bg.wasm.d.ts': '53fbffe06bcff31b3c038bc9750fc9bf8b0dda579b294499e4687023e376ca09',
} as const;
