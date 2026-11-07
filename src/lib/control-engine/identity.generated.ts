import { IDENTITY_SCHEMA, type ControlEngineWasmExport } from './types';

export const CONTROL_ENGINE_IDENTITY_SCHEMA = IDENTITY_SCHEMA;
export const CONTROL_ENGINE_BUILD_HASH = '4745497295af5c8cb26525a06efcc6ce11aec7a692f2becb39affcd86efbe8ed';
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
  'index_bg.wasm': 'c67f8efa24b7cf61d03f6f46e63608b17a17725c942975411362a4ea5709c749',
  'index_bg.wasm.d.ts': '53fbffe06bcff31b3c038bc9750fc9bf8b0dda579b294499e4687023e376ca09',
} as const;
