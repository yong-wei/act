import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  hullExcludesWater,
  MAX_HULL_EXCLUSION_BOXES,
  packHullExclusion,
} from '@/resources/simulations/scene/water/hull-exclusion';
import { computeThrusterWashActivity } from '@/resources/simulations/scene/wake/wake-physics';

const ROOT = process.cwd();

describe('thruster wash activity (#2101)', () => {
  it('produces localized wash for a holding platform with active thrust', () => {
    const wash = computeThrusterWashActivity({
      totalThrustPower: 4500,
      ratedPowerPerThruster: 4500,
      thrusterCount: 6,
    });
    // 额定 1/6 功率：sqrt 压缩后可见但不满。
    expect(wash.washActivity).toBeGreaterThan(0.3);
    expect(wash.washActivity).toBeLessThan(1);
    expect(wash.washFoamActivity).toBeLessThanOrEqual(wash.washActivity + 1e-12);
  });

  it('returns zero activity without thrust telemetry (no invented propulsion)', () => {
    const wash = computeThrusterWashActivity({
      totalThrustPower: 0,
      ratedPowerPerThruster: 4500,
      thrusterCount: 6,
    });
    expect(wash.washActivity).toBe(0);
    expect(wash.washFoamActivity).toBe(0);
  });

  it('is monotonic in thrust power and bounded to [0,1]', () => {
    const params = (power: number) => computeThrusterWashActivity({
      totalThrustPower: power,
      ratedPowerPerThruster: 4500,
      thrusterCount: 6,
    });
    for (let power = 0; power <= 27000; power += 3000) {
      const wash = params(power);
      expect(wash.washActivity).toBeGreaterThanOrEqual(0);
      expect(wash.washActivity).toBeLessThanOrEqual(1);
      if (power > 0) {
        expect(wash.washActivity).toBeGreaterThanOrEqual(params(power - 3000).washActivity - 1e-12);
      }
    }
  });
});

describe('hull water exclusion (#2101)', () => {
  const pontoonsAndColumns = [
    { centerX: -35, centerZ: 0, halfX: 30, halfZ: 8 },
    { centerX: 35, centerZ: 0, halfX: 30, halfZ: 8 },
    { centerX: -35, centerZ: -28, halfX: 6, halfZ: 6 },
    { centerX: -35, centerZ: 28, halfX: 6, halfZ: 6 },
    { centerX: 35, centerZ: -28, halfX: 6, halfZ: 6 },
    { centerX: 35, centerZ: 28, halfX: 6, halfZ: 6 },
  ];
  const packed = packHullExclusion(pontoonsAndColumns);

  it('excludes water inside solid hull volumes at their declared heading', () => {
    const platform = { x: 100, z: -200 };
    // 浮筒中心（船体局部 (-35, 0)）。
    const cos = Math.cos(0.4);
    const sin = Math.sin(0.4);
    // local→world 逆变换：dx = lx·cos − lz·sin；dz = lx·sin + lz·cos。
    const pontoonWorld = {
      x: platform.x + -35 * cos - 0 * sin,
      z: platform.z + -35 * sin + 0 * cos,
    };
    expect(hullExcludesWater(packed, platform, 0.4, pontoonWorld.x, pontoonWorld.z)).toBe(true);
    // 立柱之间/平台中央的开口区域保留海水。
    expect(hullExcludesWater(packed, platform, 0.4, platform.x, platform.z)).toBe(false);
    // 平台外远处保留海水。
    expect(hullExcludesWater(packed, platform, 0.4, platform.x + 500, platform.z)).toBe(false);
  });

  it('rotates with the vessel heading while staying anchored to its position', () => {
    const platform = { x: 0, z: 0 };
    // 船体局部 (50, 0) 在 heading=π/2 时旋转到世界 (0, 50)。
    expect(hullExcludesWater(packed, platform, Math.PI / 2, 0, -35)).toBe(true);
    expect(hullExcludesWater(packed, platform, Math.PI / 2, -35, 0)).toBe(false);
  });

  it('caps packed boxes to the uniform budget', () => {
    expect(MAX_HULL_EXCLUSION_BOXES).toBe(6);
    const over = packHullExclusion([...pontoonsAndColumns, { centerX: 0, centerZ: 0, halfX: 1, halfZ: 1 }]);
    expect(over.count).toBe(6);
    expect(packed.count).toBe(6);
    expect(packed.boxes[0]).toEqual([-35, 0, 30, 8]);
  });

  it('empty exclusion excludes nothing', () => {
    const empty = packHullExclusion([]);
    expect(hullExcludesWater(empty, { x: 0, z: 0 }, 0, 0, 0)).toBe(false);
  });
});

describe('vessel interaction wiring (#2101 source contracts)', () => {
  it('shares the scene wake budget across the twin 055 propulsor trails', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/simulations/destroyer-simulation.tsx'),
      'utf-8',
    );
    expect(source).toContain('budgetShare={0.5}');
    // 排除框声明（船体局部近似）与水面桥接接线。
    expect(source).toContain('DESTROYER_055_HULL_EXCLUSION');
    expect(source).toContain('hullExclusionSampler={() => DESTROYER_055_HULL_EXCLUSION}');
    expect(source).toContain('shipHeadingSampler={() => simRef.current.headingRad}');
  });

  it('drives platform wash from existing thrust telemetry without inventing transit wake', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/simulations/drilling-simulation.tsx'),
      'utf-8',
    );
    expect(source).toContain('washActivitySampler={() => computeThrusterWashActivity({');
    expect(source).toContain('platformStateRef.current.thrusters.reduce');
    // 半潜排除按浮筒/立柱独立声明（非整平台 bbox）。
    expect(source).toContain('DRILLING_HULL_EXCLUSION');
    expect(source).not.toContain('halfX: 100');
  });

  it('blends wash into core/foam only and gates emission budget by share', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/wake/wake-trail.tsx'),
      'utf-8',
    );
    expect(source).toContain('foamActivity: Math.max(transitActivity.foamActivity, wash)');
    expect(source).toContain('wakeActivity: Math.max(transitActivity.wakeActivity, wash * 0.6)');
    // kelvin/farFoam 不被洗流抬升（不编造航行尾波）。
    expect(source).not.toContain('kelvinActivity: Math.max');
    expect(source).toContain('emissionRate: budgetShare');
  });

  it('discards water inside declared hull boxes in the fragment shader', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/water/gerstner-water-material.ts'),
      'utf-8',
    );
    expect(source).toContain('uHullExclusionBoxes');
    expect(source).toContain('if (abs(localX - box.x) <= box.z && abs(localZ - box.y) <= box.w) discard;');
    expect(source).toContain('uniform float uShipHeading;');
  });
});

describe('water contact preserves DOF ownership (#2101, carried from #2097)', () => {
  it('keeps cruise numerical roll as the displayed roll (telemetry read-only)', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/simulations/cruise-simulation.tsx'),
      'utf-8',
    );
    // 邮轮横摇来自物理引擎 waveRoll 遥测，模型组只读消费，无叠加视觉横摇。
    expect(source).toContain('rollAngle: simState.waveRoll');
    expect(source).not.toContain('visualRoll');
    expect(source).not.toContain('waveRoll +');
  });
});
