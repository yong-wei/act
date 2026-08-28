import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
  CAPTURED_SOURCE_COMMIT,
  FACADE_GENERATED_IMPORT_ALLOWLIST,
  RAW_BUSINESS_LOADERS,
  canonicalRequestHash,
  identifiedClaimWithoutParameters,
  rejectClientResultFields,
} from '@/lib/control-engine';
import { ControlEngineFailure, mapFailure } from '@/lib/control-engine';
import {
  computeAnalysisServer,
  computeArenaVirtualPreview,
  readGeneratedPackageIdentity,
} from '@/lib/control-engine/server';
import type { ControlAnalysisRequest } from '@/resources/control-system/analysis/types';

const repoRoot = process.cwd();

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'wasm' || entry.name === '.next') {
        return [];
      }
      return collectSourceFiles(fullPath);
    }
    return /\.(ts|tsx|js|mjs)$/.test(entry.name) ? [fullPath] : [];
  });
}

const analysisRequest: ControlAnalysisRequest = {
  runtimeMode: 'analysis',
  caseId: 'facade-parity',
  plant: { numerator: [1], denominator: [1, 1], coefficientOrder: 'descending' },
  structures: [{ kind: 'gain', enabled: true, params: { k: 1 } }],
  outputs: ['step_response'],
  timeRange: { start: 0, end: 4, samples: 21 },
  frequencyRange: { min: 0.1, max: 10, samples: 8 },
  rootLocus: { minGain: 0.1, maxGain: 4, samples: 8, currentGain: 1 },
};

describe('control-engine wasm facade', () => {
  it('freezes the nine raw business loaders including Unit 5-5', () => {
    expect(RAW_BUSINESS_LOADERS).toHaveLength(9);
    expect(RAW_BUSINESS_LOADERS.map((item) => item.path)).toEqual(expect.arrayContaining([
      'src/features/interactive/unit-5-5-policy-learning-entry-risk/rl-training-runtime.ts',
    ]));
    expect(RAW_BUSINESS_LOADERS.every((item) => item.facadeException === false)).toBe(true);
    expect(CAPTURED_SOURCE_COMMIT).toMatch(/^[a-f0-9]{40}$/);
  });

  it('rejects generated-module imports outside facade adapters', () => {
    const files = [
      ...collectSourceFiles(path.join(repoRoot, 'src/features')),
      ...collectSourceFiles(path.join(repoRoot, 'src/resources')),
      ...collectSourceFiles(path.join(repoRoot, 'src/lib')),
      ...collectSourceFiles(path.join(repoRoot, 'src/app')),
    ];
    const offenders = files.filter((filePath) => {
      const relative = path.relative(repoRoot, filePath).replaceAll('\\', '/');
      if (relative.includes('/__tests__/') || relative.endsWith('.test.ts') || relative.endsWith('.test.tsx')) {
        return false;
      }
      if (FACADE_GENERATED_IMPORT_ALLOWLIST.includes(relative as typeof FACADE_GENERATED_IMPORT_ALLOWLIST[number])) {
        return false;
      }
      const source = readFileSync(filePath, 'utf8');
      return /(?:from|import)\s*\(?['"][^'"]*control_engine\/index\.js['"]/.test(source);
    });
    expect(offenders.map((filePath) => path.relative(repoRoot, filePath))).toEqual([]);
  });

  it('does not introduce a TypeScript numerical fallback in the facade adapters', () => {
    const sources = [
      'src/lib/control-engine/client.ts',
      'src/lib/control-engine/server.ts',
      'src/lib/control-engine/wasm-browser.ts',
      'src/lib/control-engine/wasm-server.ts',
      'src/resources/control-system/analysis/use-control-engine.ts',
    ].map((relative) => readFileSync(path.join(repoRoot, relative), 'utf8'));
    for (const source of sources) {
      expect(source).not.toMatch(/setInterval\(/);
      expect(source).not.toMatch(/createLinearPlant|discretizeTransferFunctionTustin|useShipSimulation/);
    }
  });

  it('does not rewrite sealed identity when SKIP_WASM_BUILD=1', () => {
    const identityPath = path.join(repoRoot, 'src/lib/control-engine/identity.generated.ts');
    const before = readFileSync(identityPath, 'utf8');
    execFileSync('node', ['./scripts/wasm/build-control-engine.mjs'], {
      cwd: repoRoot,
      env: { ...process.env, SKIP_WASM_BUILD: '1' },
      stdio: 'pipe',
    });
    expect(readFileSync(identityPath, 'utf8')).toBe(before);
  });

  it('seals the generated package identity', () => {
    const identity = readGeneratedPackageIdentity();
    expect(identity.exports).toEqual(expect.arrayContaining([
      'compute_analysis',
      'compute_virtual_simulation_step',
    ]));
    expect(identity.buildHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails closed on a missing generated package and maps timeouts', () => {
    expect(() => readGeneratedPackageIdentity(path.join(repoRoot, 'does-not-exist-control-engine'))).toThrow(
      /incomplete|ENOENT|unavailable/,
    );
    const timeout = mapFailure(new Error('slow'), 'timeout');
    expect(timeout).toBeInstanceOf(ControlEngineFailure);
    expect(timeout.state).toBe('timeout');
  });

  it('returns a server analysis envelope with executor and authority source', async () => {
    const envelope = await computeAnalysisServer(analysisRequest);
    expect(envelope.ok).toBe(true);
    expect(envelope.executor).toBe('server');
    expect(envelope.authoritySource).toBe('control-engine-server-facade');
    expect(envelope.persisted).toBe(false);
    expect(envelope.modelRelation).toBe('surrogate');
    expect(envelope.prohibitsMixedClaims).toBe(true);
    expect(Number.isFinite(envelope.result.metrics.finalValue)).toBe(true);
  });

  it('binds analysis identity into the canonical request hash', async () => {
    const left = await computeAnalysisServer(analysisRequest);
    const right = await computeAnalysisServer({ ...analysisRequest, caseId: 'facade-parity-b' });
    expect(left.canonicalRequestHash).not.toBe(right.canonicalRequestHash);
    expect(left.result.metrics.finalValue).toBeCloseTo(right.result.metrics.finalValue, 8);
  });

  it('rejects client trace/summary/checksum before execution', () => {
    expect(rejectClientResultFields({
      taskId: 'task-cruise-roll-blackbox-identification',
      trace: [{ t: 0, output: 1 }],
    })).toContain('trace');
    expect(rejectClientResultFields({
      artifact: { checksum: 'sha256:deadbeef' },
    })).toContain('checksum');
    expect(rejectClientResultFields({ taskId: 'task' })).toBeNull();
  });

  it('computes arena preview through the server facade as a surrogate', async () => {
    const envelope = await computeArenaVirtualPreview({
      modelId: ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
      taskId: 'task-cruise-roll-blackbox-identification',
      datasetHash: 'arena-blackbox-dataset-preview123456',
      identificationModelId: 'arena-identification-preview12345',
      controllerHash: 'artifact-preview',
      controllerGain: 1.6,
      dampingCompensation: 0.72,
      energyBudget: 12,
      initialRoll: 0.2,
      sampleTime: 0.2,
      steps: 61,
      modelRelation: 'surrogate',
    });
    expect(envelope.executor).toBe('server');
    expect(envelope.authoritySource).toBe('control-engine-server-facade');
    expect(envelope.modelRelation).toBe('surrogate');
    expect(envelope.result.trace.length).toBe(61);
    expect(envelope.canonicalRequestHash).toBe(await canonicalRequestHash({
      modelId: ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
      taskId: 'task-cruise-roll-blackbox-identification',
      datasetHash: 'arena-blackbox-dataset-preview123456',
      identificationModelId: 'arena-identification-preview12345',
      controllerHash: 'artifact-preview',
      controllerGain: 1.6,
      dampingCompensation: 0.72,
      energyBudget: 12,
      initialRoll: 0.2,
      modelRelation: 'surrogate',
    }));
  });

  it('fails closed when an identified claim lacks authorized model parameters', async () => {
    expect(identifiedClaimWithoutParameters('identified', null)).toBe(true);
    await expect(computeArenaVirtualPreview({
      modelId: ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
      taskId: 'task-cruise-roll-blackbox-identification',
      datasetHash: 'arena-blackbox-dataset-preview123456',
      identificationModelId: 'arena-identification-preview12345',
      controllerHash: 'artifact-preview',
      controllerGain: 1.6,
      dampingCompensation: 0.72,
      energyBudget: 12,
      initialRoll: 0.2,
      sampleTime: 0.2,
      steps: 61,
      modelRelation: 'identified',
    })).rejects.toThrow(/authorized model parameters/);
  });

  it('characterizes fallback presentation as non-authoritative', () => {
    const hookSource = readFileSync(
      path.join(repoRoot, 'src/resources/control-system/analysis/use-control-engine.ts'),
      'utf8',
    );
    expect(hookSource).toContain("source: 'fallback'");
    expect(hookSource).toContain('isAuthoritative: false');
    expect(hookSource).not.toContain('control_engine/index.js');
    const workspaceSource = readFileSync(
      path.join(repoRoot, 'src/resources/control-system/charts/control-figure-workspace.tsx'),
      'utf8',
    );
    expect(workspaceSource).toContain('isAuthoritative === false');
  });
});
