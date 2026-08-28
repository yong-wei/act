import { IDENTITY_SCHEMA, type ControlEngineWasmExport } from './types';

export const CONTROL_ENGINE_IDENTITY_SCHEMA = IDENTITY_SCHEMA;
export const CONTROL_ENGINE_BUILD_HASH = '62182913d2c24a3ade83d9155413f05e6647949cece8d19b323ca0a6824ba797';
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
  'index_bg.wasm': 'eb6e48215b412c8682d597f540a2b3653b32225b5d9838ac78ba19f8557d5109',
  'index_bg.wasm.d.ts': '53fbffe06bcff31b3c038bc9750fc9bf8b0dda579b294499e4687023e376ca09',
} as const;
