import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  RETIRED_RAW_BUSINESS_LOADERS,
  RETIRED_TS_STEPPER_EXPORTS,
  RETIRED_TS_STEPPER_MODULES,
} from '@/lib/control-engine';

const DRIVE_CHAIN_PREFIXES = [
  'src/lib/simulation/',
  'src/resources/simulations/physics/',
  'src/resources/simulations/rust/',
  'src/resources/control-system/wasm/',
  'rust/',
];

const R6_DRIVE_CHAIN_ALLOWLIST = new Set([
  ...RETIRED_TS_STEPPER_MODULES,
  'src/resources/simulations/physics/simulation-engine-facade.ts',
  ...RETIRED_RAW_BUSINESS_LOADERS
    .map((item) => item.path)
    .filter((relative) => DRIVE_CHAIN_PREFIXES.some((prefix) => relative.startsWith(prefix))),
]);

// 显式授权的驱动链改动（各自 change 覆盖）：#1944 挖泥船 DP 执行链路接通，
// 遗留 MMG3DOFEngine 的 DP 分支与活动 facade 路径同步修复（无新 TS stepper）。
const AUTHORIZED_DRIVE_CHAIN_FILES = new Set([
  'src/resources/simulations/physics/engine-factory.ts',
  'rust/control-engine/src/virtual_simulation_runtime.rs',
  'rust/control-engine/src/practice_live.rs',
  'rust/control-engine/tests/virtual_simulation_runtime.rs',
  'src/resources/control-system/wasm/control_engine/index_bg.wasm',
]);

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
  it('leaves drive-chain files out of the change diff except R6 numeric retirement', () => {
    const changed = diffNameOnly();
    const driveChainAllow = new Set([...R6_DRIVE_CHAIN_ALLOWLIST, ...AUTHORIZED_DRIVE_CHAIN_FILES]);
    for (const prefix of DRIVE_CHAIN_PREFIXES) {
      const violations = changed.filter((file) => file.startsWith(prefix) && !driveChainAllow.has(file));
      expect(violations, `drive chain touched: ${violations.join(', ')}`).toEqual([]);
    }
    for (const relative of RETIRED_TS_STEPPER_MODULES) {
      const source = readFileSync(path.join(process.cwd(), relative), 'utf8');
      for (const name of RETIRED_TS_STEPPER_EXPORTS) {
        expect(source, `${relative} ${name}`).not.toMatch(new RegExp(`export (async )?function ${name}\\b`));
      }
    }
    for (const relative of [...R6_DRIVE_CHAIN_ALLOWLIST].filter((item) => item.endsWith('control-engine-runtime.ts') || item.endsWith('control-engine-server-runtime.ts'))) {
      expect(existsSync(path.join(process.cwd(), relative)), relative).toBe(false);
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
      'VersionedShipModel',
      'FallbackGltfModel',
    ]) {
      expect(destroyer, `missing pipeline layer ${marker}`).toContain(marker);
    }
  });
});
