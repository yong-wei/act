import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ARENA_OFFICIAL_PROTOCOLS,
  FACADE_GENERATED_IMPORT_ALLOWLIST,
  R6_SERVER_LOADER_DELETION_CANDIDATES,
  SERVER_CONSUMER_CLASSES,
  SERVER_FACADE_IMPORT,
} from '@/lib/control-engine';

const repoRoot = process.cwd();

function readRepo(relative: string) {
  return readFileSync(path.join(repoRoot, relative), 'utf8');
}

describe('server control-engine consumers', () => {
  it('routes the four consumer classes and virtual-preview persistence through the server facade', () => {
    expect(SERVER_CONSUMER_CLASSES.map((item) => item.id)).toEqual([
      'generic-analysis',
      'simulation-virtual-runtime',
      'control-odyssey',
      'arena-analysis',
      'arena-virtual-preview-persistence',
    ]);
    expect(ARENA_OFFICIAL_PROTOCOLS).toEqual([
      'analysis-whitebox-v1',
      'template-whitebox-v1',
      'blackbox-official-v1',
    ]);

    for (const consumer of SERVER_CONSUMER_CLASSES) {
      for (const caller of consumer.callers) {
        const source = readRepo(caller);
        expect(source, caller).toContain(SERVER_FACADE_IMPORT);
        expect(source, caller).toContain(consumer.facadeSymbol);
        expect(source, caller).not.toMatch(/control_engine\/index\.js/);
        expect(source, caller).not.toContain('initSync');
      }
      if (consumer.compatibilityLoader && consumer.compatibilityLoader !== consumer.callers[0]) {
        const loader = readRepo(consumer.compatibilityLoader);
        expect(loader).toContain(SERVER_FACADE_IMPORT);
        expect(loader).not.toMatch(/control_engine\/index\.js/);
      }
    }
  });

  it('keeps generated WASM imports on the facade allowlist only', () => {
    expect(FACADE_GENERATED_IMPORT_ALLOWLIST).toEqual([
      'src/lib/control-engine/wasm-browser.ts',
      'src/lib/control-engine/wasm-server.ts',
    ]);
  });

  it('records R6 deletion candidates without deleting compatibility loaders yet', () => {
    expect(R6_SERVER_LOADER_DELETION_CANDIDATES).toEqual([
      'src/resources/control-system/analysis/control-engine-server-runtime.ts',
      'src/resources/simulations/rust/control-engine-server-runtime.ts',
      'src/resources/interactive-learning/control-odyssey/engine/control-engine-server-runtime.ts',
    ]);
    for (const relative of R6_SERVER_LOADER_DELETION_CANDIDATES) {
      expect(readRepo(relative)).toContain(SERVER_FACADE_IMPORT);
    }
  });
});
