import { describe, expect, it } from 'vitest';

import { getControlEngineWasmPath } from '../evaluation/control-analysis-service';

describe('default Arena control analysis service', () => {
  it('resolves the WASM module to a filesystem path string for Next.js server runtime', () => {
    const wasmPath = getControlEngineWasmPath();

    expect(typeof wasmPath).toBe('string');
    expect(wasmPath).toContain('src/resources/control-system/wasm/control_engine/index_bg.wasm');
    expect(wasmPath).not.toBeInstanceOf(URL);
  });
});
