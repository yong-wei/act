import { IDENTITY_SCHEMA, type ControlEngineWasmExport } from './types';

export const CONTROL_ENGINE_IDENTITY_SCHEMA = IDENTITY_SCHEMA;
export const CONTROL_ENGINE_BUILD_HASH = '6386f25f7cd09b5a8dbcd9c5c899c100b581a032d13c7580b4f026c98f015e1a';
export const CONTROL_ENGINE_EXPORTS: readonly ControlEngineWasmExport[] = [
  'compute_analysis',
  'compute_nonlinear_analysis',
] as const;
export const CONTROL_ENGINE_FILE_HASHES = {
  'index.js': 'ec6d955f1afa9ef9f5111270c98a212904d7e516f3e16d987842082bde88f6a0',
  'index.d.ts': '774218a2bf97faed5aaac847e5bd76f41a013b029760aafaa6d5f5812df2494f',
  'index_bg.wasm': '12ef7e648d9b8890f6dfc3449594b7e1a534ae2c77209ced8f2a2867e707c3f8',
  'index_bg.wasm.d.ts': 'c496e2143f2ff72855f7bd648c387555494301c96fa0ee45f46a7f9f6a28c250',
} as const;
