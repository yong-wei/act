import { IDENTITY_SCHEMA, type ControlEngineWasmExport } from './types';

export const CONTROL_ENGINE_IDENTITY_SCHEMA = IDENTITY_SCHEMA;
export const CONTROL_ENGINE_BUILD_HASH = 'd6171358ac64170de922034fdae7b55978c41366834d7b1a99c2d41f6c8d8452';
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
  'index_bg.wasm': '297255e26424131a33f354e31384a73d7a71a83ebdae0d388d74f7a7ed619d1f',
  'index_bg.wasm.d.ts': '53fbffe06bcff31b3c038bc9750fc9bf8b0dda579b294499e4687023e376ca09',
} as const;
