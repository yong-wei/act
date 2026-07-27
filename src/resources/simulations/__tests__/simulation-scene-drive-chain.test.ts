import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const DRIVE_CHAIN_PREFIXES = [
  'src/lib/simulation/',
  'src/resources/simulations/physics/',
  'src/resources/simulations/rust/',
  'src/resources/control-system/wasm/',
  'rust/',
];

const PANEL_FILES = [
  'src/app/simulations/_components/simulation-shell.tsx',
];

// 面板控制逻辑守卫：dock 布局（自然高度/卡片占满）已由 unify-simulation-chrome-and-camera-views
// 的 ADDED requirement 显式授权，不再列入不可触碰集；控制逻辑（SimulationDock 行为/标签页）仍不得改动。
const PANEL_LOGIC_MARKERS = [
  'function SimulationDock',
  'SimulationAssessmentPanel',
];

function diffNameOnly(): string[] {
  const mergeBase = execSync('git merge-base HEAD origin/integration', { encoding: 'utf8' }).trim();
  const output = execSync(`git diff --name-only ${mergeBase} HEAD`, { encoding: 'utf8' });
  const unstaged = execSync('git diff --name-only', { encoding: 'utf8' });
  return [...new Set([...output.split('\n'), ...unstaged.split('\n')])].filter(Boolean);
}

describe('visual pipeline preserves the simulation drive chain', () => {
  it('leaves drive-chain files out of the change diff', () => {
    const changed = diffNameOnly();
    for (const prefix of DRIVE_CHAIN_PREFIXES) {
      const violations = changed.filter((file) => file.startsWith(prefix));
      expect(violations, `drive chain touched: ${violations.join(', ')}`).toEqual([]);
    }
  });

  it('leaves panel structure files untouched and keeps dock control logic markers', () => {
    const changed = diffNameOnly();
    for (const file of PANEL_FILES) {
      expect(changed, `panel structure changed: ${file}`).not.toContain(file);
    }
    const dockSource = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/components/simulation-ui.tsx'), 'utf8'
    );
    for (const marker of PANEL_LOGIC_MARKERS) {
      expect(dockSource, `dock control logic marker lost: ${marker}`).toContain(marker);
    }
  });

  it('introduces no numerical integrator in the visual pipeline modules', () => {
    const sceneDir = path.join(process.cwd(), 'src/resources/simulations/scene');
    const files = execSync(`find ${sceneDir} -name '*.ts' -o -name '*.tsx'`, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    const integratorPatterns = [/rk4/i, /runge/i, /\beuler\b/i, /integrate\s*\(/, /stepper/i, /tustin/i];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of integratorPatterns) {
        expect(pattern.test(source), `${file} contains integrator pattern ${pattern}`).toBe(false);
      }
    }
  });

  it('keeps the fixed-step SimulationClock import path unchanged in the sample experiment', () => {
    const destroyer = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf8'
    );
    expect(destroyer).toContain("import { SimulationClock } from '@/lib/simulation'");
  });
});

describe('sample experiment full pipeline integration', () => {
  it('mounts every pipeline layer in the sample experiment', () => {
    const destroyer = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf8'
    );
    for (const marker of [
      '<EnvironmentScene',
      '<GerstnerWater',
      '<WakeTrail',
      '<StayPutCameraController',
      'SceneSoundscapeProvider',
      '<ActualPathTrail',
      'SceneQualityProvider',
      '<ScenePostEffects',
      'ModelAssetErrorBoundary',
    ]) {
      expect(destroyer, `missing pipeline layer ${marker}`).toContain(marker);
    }
  });
});
