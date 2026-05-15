import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('arena module boundaries', () => {
  it('exposes explicit domain, client, and server entrypoints', () => {
    for (const entrypoint of ['domain.ts', 'client.ts', 'server.ts']) {
      expect(existsSync(join(process.cwd(), 'src/features/arena', entrypoint))).toBe(true);
    }
  });

  it('moves touched UI and page imports away from the root Arena barrel', () => {
    for (const path of [
      'src/features/arena/arena-hall.tsx',
      'src/features/arena/teacher/teacher-arena-config.tsx',
      'src/features/interactive/multi-representation-linkage/arena-submit-panel.tsx',
      'src/features/interactive/multi-representation-linkage/model.ts',
      'src/app/arena/page.tsx',
      'src/app/arena/challenges/[taskId]/page.tsx',
    ]) {
      expect(source(path)).not.toContain("from '@/features/arena'");
    }
  });

  it('keeps Arena event type definitions in one source imported by telemetry and dictionary modules', () => {
    expect(source('src/features/arena/telemetry.ts')).toContain("from './arena-events'");
    expect(source('src/features/arena/arena-event-dictionary.ts')).toContain("from './arena-events'");
    expect(source('src/features/arena/arena-event-dictionary.ts')).not.toContain('export const ARENA_CORE_EVENT_TYPES = [');
  });

  it('marks the random cruise-roll adapter as a test-only mock instead of a production adapter', () => {
    const adapterSource = source('src/features/arena/adapters/plant-adapter.ts');

    expect(adapterSource).toContain('createMockCruiseRollBlackBoxAdapterForTests');
    expect(adapterSource).not.toContain('export function createCruiseRollBlackBoxAdapter');
    expect(source('src/features/arena/server.ts')).not.toContain("export * from './adapters/plant-adapter'");
    expect(source('src/features/arena/index.ts')).not.toContain("export * from './adapters/plant-adapter'");
  });

  it('does not keep stale whitebox-v1 as the exported current protocol constant', () => {
    expect(source('src/features/arena/submissions/persistence.ts')).not.toContain(
      "ARENA_EVALUATION_PROTOCOL_VERSION = 'whitebox-v1'",
    );
  });
});
