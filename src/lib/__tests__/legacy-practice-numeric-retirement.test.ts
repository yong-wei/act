import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FACADE_GENERATED_IMPORT_ALLOWLIST,
  GENERATED_ARTIFACTS,
  PROTECTED_LEGACY_PATHS,
  RAW_BUSINESS_LOADER_DENOMINATOR,
  RETIRED_RAW_BUSINESS_LOADERS,
  RETIRED_TS_STEPPER_EXPORTS,
  RETIRED_TS_STEPPER_MODULES,
  ROLLBACK_COMMIT,
} from '@/lib/control-engine';
import { computeVirtualSimulationServerStep } from '@/lib/control-engine/server';
import { rejectClientResultFields } from '@/lib/control-engine';

const repoRoot = process.cwd();

function readRepo(relative: string) {
  return readFileSync(path.join(repoRoot, relative), 'utf8');
}

describe('legacy practice numeric retirement', () => {
  it('represents all nine raw loaders and deletes the retired paths', () => {
    expect(RAW_BUSINESS_LOADER_DENOMINATOR).toHaveLength(9);
    // 三个 server compatibility loader 的退役路径是固定测试事实（登记表已删除）。
    expect(RETIRED_RAW_BUSINESS_LOADERS.map((item) => item.path)).toEqual(
      expect.arrayContaining([
        'src/resources/control-system/analysis/control-engine-server-runtime.ts',
        'src/resources/simulations/rust/control-engine-server-runtime.ts',
        'src/resources/interactive-learning/control-odyssey/engine/control-engine-server-runtime.ts',
      ]),
    );
    for (const item of RETIRED_RAW_BUSINESS_LOADERS) {
      expect(existsSync(path.join(repoRoot, item.path)), item.path).toBe(false);
      expect(item.replacement.length).toBeGreaterThan(0);
      expect(item.deleteCondition.length).toBeGreaterThan(0);
    }
    expect(ROLLBACK_COMMIT).toMatch(/^[a-f0-9]{40}$/);
  });

  it('keeps generated WASM imports on the facade allowlist only', () => {
    expect(FACADE_GENERATED_IMPORT_ALLOWLIST).toEqual([
      'src/lib/control-engine/wasm-browser.ts',
      'src/lib/control-engine/wasm-server.ts',
    ]);
    for (const relative of FACADE_GENERATED_IMPORT_ALLOWLIST) {
      expect(readRepo(relative)).toMatch(/control_engine\/index\.js/);
    }
  });

  it('removes retired TypeScript stepper exports from original modules', () => {
    for (const relative of RETIRED_TS_STEPPER_MODULES) {
      const source = readRepo(relative);
      for (const name of RETIRED_TS_STEPPER_EXPORTS) {
        expect(source, `${relative} ${name}`).not.toMatch(new RegExp(`export (async )?function ${name}\\b`));
        expect(source, `${relative} ${name}`).not.toMatch(new RegExp(`export class ${name}\\b`));
      }
    }
  });

  it('protects legacy persistence, generated artifacts, and the old destroyer monolith', () => {
    expect(PROTECTED_LEGACY_PATHS).toEqual([
      'src/resources/simulations/destroyer-simulation.tsx',
      'prisma/schema.prisma',
    ]);
    for (const relative of PROTECTED_LEGACY_PATHS) {
      expect(existsSync(path.join(repoRoot, relative)), relative).toBe(true);
    }
    const schema = readRepo('prisma/schema.prisma');
    expect(schema).toContain('model SimulationSession');
    expect(schema).toContain('model SimulationLog');
    for (const artifact of GENERATED_ARTIFACTS) {
      if (artifact.path.endsWith('.build-hash')) {
        continue;
      }
      expect(existsSync(path.join(repoRoot, artifact.path)), artifact.path).toBe(true);
    }
  });

  it('rejects client preview fields and keeps practice WASM finite', () => {
    expect(rejectClientResultFields({
      taskId: 'task-cruise-roll-blackbox-identification',
      checksum: 'forged',
    })).toContain('checksum');
    const result = computeVirtualSimulationServerStep<{
      output: { rudderDeg: number };
      modelId: string;
    }>({
      modelId: 'practice_pid_control',
      dt: 1 / 60,
      targetHeading: 1,
      currentHeading: 0,
      controlMode: 'pid',
      gains: { kp: 0.8, ki: 0.05, kd: 2 },
      maxRudderDeg: 35,
      derivativeFilter: 0.1,
      state: { integral: 0, prevError: 0, prevDerivative: 0 },
    });
    expect(result.modelId).toBe('practice_pid_control');
    expect(Number.isFinite(result.output.rudderDeg)).toBe(true);
  });
});
