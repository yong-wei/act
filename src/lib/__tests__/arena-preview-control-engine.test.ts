import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ARENA_PREVIEW_CAPABILITY_MATRIX,
  ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
  ARENA_CRUISE_ROLL_SURROGATE_BASELINE_SUMMARY,
  ControlEngineFailure,
  assertArenaPreviewSummaryWithinBaseline,
  canonicalRequestHash,
  isSupportedArenaPreviewMethod,
  isWithinArenaPreviewTolerance,
  resolveArenaCruiseRollPlantParameters,
  arenaPreviewCanonicalRequest,
} from '@/lib/control-engine';
import { computeArenaVirtualPreview } from '@/lib/control-engine/server';
import { computeArenaVirtualPreviewBrowserSync } from '@/lib/control-engine/client';

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
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

const previewRequest = {
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
  modelRelation: 'surrogate' as const,
};

describe('arena preview control-engine migration', () => {
  it('publishes a capability matrix that supports only registered Rust methods', () => {
    expect(ARENA_PREVIEW_CAPABILITY_MATRIX.map((entry) => entry.method)).toEqual([
      'black-box-control',
      'pid',
      'serial-compensator',
      'composite-compensation',
      'optimized-pid',
      'mpc',
      'code-controller',
    ]);
    expect(isSupportedArenaPreviewMethod('pid')).toBe(true);
    expect(isSupportedArenaPreviewMethod('mpc')).toBe(false);
    expect(ARENA_PREVIEW_CAPABILITY_MATRIX.filter((entry) => entry.supportedByControlEngine).every((entry) => (
      entry.capability === 'computeArenaVirtualPreview' || entry.capability === 'computeAnalysis'
    ))).toBe(true);
  });

  it('keeps active Arena preview callers off generated modules and old Euler helpers', () => {
    const files = [
      'src/features/arena/blackbox/controller-preview.ts',
      'src/features/arena/submissions/workbench-preview.ts',
      'src/features/control-workbench/presets/blackbox-identification-preset.tsx',
      'src/app/api/arena/virtual-simulation-runs/route.ts',
    ];
    for (const relative of files) {
      const source = readFileSync(path.join(repoRoot, relative), 'utf8');
      expect(source).not.toMatch(/control_engine\/index\.js/);
      expect(source).not.toMatch(/rollRate\s*\+=/);
      expect(source).not.toMatch(/metricProviderMode:\s*'template-preview'/);
      expect(source).not.toMatch(/createHeuristicWhiteBoxMetricProvider\(/);
    }

    const arenaCallers = collectSourceFiles(path.join(repoRoot, 'src/features/arena')).filter((filePath) => {
      const relative = path.relative(repoRoot, filePath).replaceAll('\\', '/');
      return !relative.includes('/__tests__/') && !relative.endsWith('.test.ts');
    });
    const generatedOffenders = arenaCallers.filter((filePath) => (
      /(?:from|import)\s*\(?['"][^'"]*control_engine\/index\.js['"]/.test(readFileSync(filePath, 'utf8'))
    ));
    expect(generatedOffenders).toEqual([]);
  });

  it('fails closed when browser WASM is not ready instead of using a TypeScript loop', () => {
    expect(() => computeArenaVirtualPreviewBrowserSync(previewRequest)).toThrow(ControlEngineFailure);
    try {
      computeArenaVirtualPreviewBrowserSync(previewRequest);
    } catch (error) {
      expect(error).toBeInstanceOf(ControlEngineFailure);
      expect((error as ControlEngineFailure).category).toBe('wasm-not-ready');
    }
  });

  it('changes canonical identity when plant or task identity changes', async () => {
    const left = await canonicalRequestHash(arenaPreviewCanonicalRequest(previewRequest));
    const right = await canonicalRequestHash(arenaPreviewCanonicalRequest({
      ...previewRequest,
      taskId: 'task-other',
    }));
    const identified = await canonicalRequestHash(arenaPreviewCanonicalRequest({
      ...previewRequest,
      modelRelation: 'identified',
      authorizedModelParameters: {
        plantDamping: 1.4,
        plantStiffness: 2.2,
        plantInputGain: 0.4,
      },
    }));
    expect(left).not.toBe(right);
    expect(left).not.toBe(identified);
    expect(resolveArenaCruiseRollPlantParameters(previewRequest)).toEqual({
      plantDamping: 0.72,
      plantStiffness: 1.18,
      plantInputGain: 0.68,
    });
  });

  it('does not persist an identified claim without authorized plant parameters', async () => {
    await expect(computeArenaVirtualPreview({
      ...previewRequest,
      modelRelation: 'identified',
    })).rejects.toBeInstanceOf(ControlEngineFailure);
  });

  it('compares frozen surrogate summary against declared abs/rel tolerance', () => {
    expect(isWithinArenaPreviewTolerance(
      ARENA_CRUISE_ROLL_SURROGATE_BASELINE_SUMMARY.trackingError,
      ARENA_CRUISE_ROLL_SURROGATE_BASELINE_SUMMARY.trackingError,
    )).toBe(true);
    expect(isWithinArenaPreviewTolerance(1, 0.025)).toBe(false);
    expect(() => assertArenaPreviewSummaryWithinBaseline(previewRequest, {
      ...ARENA_CRUISE_ROLL_SURROGATE_BASELINE_SUMMARY,
      trackingError: 1,
    })).toThrow(ControlEngineFailure);
    expect(() => assertArenaPreviewSummaryWithinBaseline({
      ...previewRequest,
      controllerGain: 9,
    }, {
      ...ARENA_CRUISE_ROLL_SURROGATE_BASELINE_SUMMARY,
      trackingError: 1,
    })).not.toThrow();
  });

  it('keeps the frozen surrogate fixture inside declared tolerance on the server facade', async () => {
    const envelope = await computeArenaVirtualPreview(previewRequest);
    expect(isWithinArenaPreviewTolerance(
      envelope.result.summary.trackingError,
      ARENA_CRUISE_ROLL_SURROGATE_BASELINE_SUMMARY.trackingError,
    )).toBe(true);
    expect(isWithinArenaPreviewTolerance(
      envelope.result.summary.maxDeviation,
      ARENA_CRUISE_ROLL_SURROGATE_BASELINE_SUMMARY.maxDeviation,
    )).toBe(true);
    expect(isWithinArenaPreviewTolerance(
      envelope.result.summary.controlEnergy,
      ARENA_CRUISE_ROLL_SURROGATE_BASELINE_SUMMARY.controlEnergy,
    )).toBe(true);
  });

  it('proves preview writers do not create official Arena records', () => {
    const previewSource = readFileSync(path.join(repoRoot, 'src/features/arena/blackbox/controller-preview.ts'), 'utf8');
    expect(previewSource).not.toMatch(/arenaSubmission\.create|ArenaSubmission\b/);
    expect(previewSource).not.toMatch(/arenaEvaluationRun\.create|ArenaEvaluationRun\b/);
    expect(previewSource).not.toMatch(/leaderboard/i);
    expect(previewSource).toContain("runKind: 'arena_preview'");
    expect(previewSource).toContain("evaluationVisibility: 'preview'");
    expect(previewSource).toContain('officialEligible: false');

    const workbenchSource = readFileSync(path.join(repoRoot, 'src/features/arena/submissions/workbench-preview.ts'), 'utf8');
    expect(workbenchSource).not.toMatch(/prisma\.\w+\.create|ArenaSubmission\.create|ArenaEvaluationRun/);
    // #1853 起工作台预览统一消费 practice-lab run contract 的共享边界常量。
    expect(workbenchSource).toContain('evaluationVisibility: PREVIEW_DISPLAY_BOUNDARY.evaluationVisibility');
    expect(workbenchSource).toContain('persisted: PREVIEW_DISPLAY_BOUNDARY.persisted');
  });
});
