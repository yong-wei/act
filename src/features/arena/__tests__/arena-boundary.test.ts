import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function productionSourceFiles(directory: string): string[] {
  return readdirSync(join(process.cwd(), directory), { withFileTypes: true })
    .flatMap((entry) => {
      const child = join(directory, entry.name);
      return entry.isDirectory() ? productionSourceFiles(child) : [child];
    })
    .filter((path) => /\.(ts|tsx)$/.test(path) && !path.includes('__tests__'));
}

describe('arena module boundaries', () => {
  it('exposes explicit domain, client, and server entrypoints without a root barrel', () => {
    for (const entrypoint of ['domain.ts', 'client.ts', 'server.ts']) {
      expect(existsSync(join(process.cwd(), 'src/features/arena', entrypoint))).toBe(true);
    }
    expect(existsSync(join(process.cwd(), 'src/features/arena', 'index.ts'))).toBe(false);
  });

  it('keeps production code free of root Arena barrel imports', () => {
    for (const path of productionSourceFiles('src')) {
      expect(source(path)).not.toContain("from '@/features/arena'");
      expect(source(path)).not.toMatch(/import\(['"]@\/features\/arena['"]\)/);
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
  });

  it('does not keep stale whitebox-v1 as the exported current protocol constant', () => {
    expect(source('src/features/arena/submissions/persistence.ts')).not.toContain(
      "ARENA_EVALUATION_PROTOCOL_VERSION = 'whitebox-v1'",
    );
  });

  it('keeps browser Arena submission types out of the server evaluator module', () => {
    const browserEntries = [
      'src/features/arena/submissions/arena-blackbox-submission-panel.tsx',
      'src/features/arena/submissions/ranking-policy.ts',
      'src/features/arena/leaderboards/leaderboard.ts',
      'src/features/arena/student/arena-feedback-rules.ts',
      'src/features/arena/student/arena-personal-feedback.tsx',
      'src/features/control-workbench/presets/blackbox-identification-preset.tsx',
    ];
    for (const path of browserEntries) {
      const entrySource = source(path);
      expect(entrySource).toMatch(/from ['"][^'"]*(?:submissions\/types|\.\/types)['"]/);
      expect(entrySource).not.toContain('submissions/submission-service');
    }
    const blackBoxClient = source('src/features/control-workbench/presets/blackbox-identification-preset.tsx');
    const blackBoxEvidence = source('src/features/arena/blackbox/engineering-evidence.ts');
    expect(blackBoxClient).toContain('blackbox/contracts');
    expect(blackBoxClient).not.toContain('blackbox/experiment-service');
    expect(blackBoxClient).not.toContain('blackbox/controller-preview');
    expect(blackBoxEvidence).toContain("from './contracts'");
    expect(blackBoxEvidence).not.toContain("from './controller-preview'");
    const feedbackRules = source('src/features/arena/student/arena-feedback-rules.ts');
    expect(feedbackRules).toContain("from '../submissions/evidence-status'");
    expect(feedbackRules).not.toContain("from '../evidence-writeback'");
  });
});
