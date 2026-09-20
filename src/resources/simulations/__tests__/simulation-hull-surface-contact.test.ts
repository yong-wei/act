import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createNearFieldSurfaceQuery,
  DEFAULT_GERSTNER_SEA_STATE,
  gerstnerAmplitudeScale,
  NEAR_FIELD_VISIBLE_WAVES,
} from '../scene/water/gerstner-water';
import { computeGerstnerDisplacement } from '../scene/water/gerstner-waves';
import type { MarineShoreSegment } from '../scene/environment/scene-layouts';

const ROOT = process.cwd();
const readSource = (relative: string) =>
  readFileSync(path.join(ROOT, 'src/resources/simulations', relative), 'utf8');

/** 测试岸线：世界 x=400 处的南北向长直岸（近场域内、远离原点）。 */
const SHORE: readonly MarineShoreSegment[] = [
  { from: [400, -2000], to: [400, 2000], shoreDepthMeters: 6 },
];

describe('CPU near-field query shares the GPU surface definition (#2117)', () => {
  it('applies shore attenuation inside the query (same input as the GPU vertex path)', () => {
    const scale = gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE);
    const originX = 0;
    const originZ = 0;
    const probe = { x: 420, z: 30 };
    let withShoreRange = 0;
    let withoutShoreRange = 0;
    let analyticRange = 0;
    for (let step = 0; step < 40; step += 1) {
      const t = step * 0.35;
      const withShore = createNearFieldSurfaceQuery(scale, originX, originZ, t, {
        shoreSegments: SHORE,
        shoreFadeBandMeters: 400,
      }).heightAt(probe.x, probe.z);
      const withoutShore = createNearFieldSurfaceQuery(scale, originX, originZ, t).heightAt(
        probe.x,
        probe.z,
      );
      const analytic = computeGerstnerDisplacement(
        NEAR_FIELD_VISIBLE_WAVES,
        probe.x,
        probe.z,
        t,
      ).y * scale;
      withShoreRange = Math.max(withShoreRange, withShore);
      withoutShoreRange = Math.max(withoutShoreRange, withoutShore);
      analyticRange = Math.max(analyticRange, analytic);
    }
    // 岸线附近（距岸 20m）波幅被同公式衰减（岸边残量 0.15）。
    expect(withShoreRange).toBeLessThan(withoutShoreRange * 0.8);
    // 深水（无岸线输入）查询与解析带限场同口径（既有声明容差内）。
    expect(withoutShoreRange).toBeLessThan(analyticRange * 1.3 + 1.3);
  });

  it('keeps the query unchanged when no shore segments are declared', () => {
    const scale = gerstnerAmplitudeScale(4);
    const a = createNearFieldSurfaceQuery(scale, 0, 0, 3.25).heightAt(120, -80);
    const b = createNearFieldSurfaceQuery(scale, 0, 0, 3.25, {
      shoreSegments: [],
      shoreFadeBandMeters: 400,
    }).heightAt(120, -80);
    expect(a).toBe(b);
  });
});

describe('shared visual time across the fleet (#2117)', () => {
  it('every wake rig consumes the shared water height hook, not an independent wall clock', () => {
    for (const sim of ['destroyer', 'drilling', 'container', 'cruise', 'icebreaker', 'dredger', 'lng']) {
      const source = readSource(`simulations/${sim}-simulation.tsx`);
      expect(source, sim).toContain('useNearFieldWaterHeight({');
      expect(source, sim).not.toContain('timeRef.current = frameState.clock.getElapsedTime()');
      expect(source, sim).not.toContain('timeRef.current = state.clock.getElapsedTime()');
    }
  });

  it('the hook drives its time from the shared visual clock with frame memoization', () => {
    const water = readSource('scene/water/gerstner-water.tsx');
    expect(water).toContain('export function useNearFieldWaterHeight');
    expect(water).toContain('useMarineVisualTime()');
    expect(water).toContain('cacheRef.current = null');
  });
});

describe('explicit waterline mounts (#2117)', () => {
  it('fleet ships sample the shared surface instead of an implicit waterY=0', () => {
    const component = readSource('components/versioned-fleet-ship.tsx');
    expect(component).toContain('waterYSampler?: () => number');
    expect(component).toContain('const resolvedWaterY = waterYSampler ? waterYSampler() : waterY;');
    for (const sim of ['container', 'cruise', 'dredger', 'icebreaker', 'lng', 'drilling']) {
      const source = readSource(`simulations/${sim}-simulation.tsx`);
      expect(source, sim).toContain('waterYSampler={() => waterHeight(props.position.x, props.position.z)}');
    }
  });

  it('preserves numerical roll channels (cruise/lng) alongside the shared waterline', () => {
    const cruise = readSource('simulations/cruise-simulation.tsx');
    expect(cruise).toContain('extraEuler={{ z: props.rollAngle }}');
    expect(cruise).toContain('seaState: props.seaState');
    expect(cruise).toContain('seaState={state.seaState}');
    const lng = readSource('simulations/lng-simulation.tsx');
    expect(lng).toContain('extraEuler={{ z: props.sloshingAngle * 0.1 }}');
  });

  it('keeps the semi-submersible moon pool open (column/pontoon boxes only)', () => {
    const drilling = readSource('simulations/drilling-simulation.tsx');
    expect(drilling).toContain('DRILLING_HULL_EXCLUSION');
    // 四立柱 + 两浮筒框：域中心（月池）不在排除框内。
    const centerExcluded = /\{ centerX: 0,/.test(drilling);
    expect(centerExcluded).toBe(false);
  });
});

describe('simulation clocks restored after rig unification (#2117 review)', () => {
  it('keeps engine time writes and reset zeroing in the main simulation loops', () => {
    const specs: Array<[string, string, number]> = [
      ['container', 'timeRef.current = nextTime;', 1],
      ['cruise', 'timeRef.current = nextTime;', 1],
      ['lng', 'timeRef.current = nextTime;', 1],
      ['container', 'timeRef.current = 0;', 1],
      ['cruise', 'timeRef.current = 0;', 1],
      ['lng', 'timeRef.current = 0;', 1],
      ['dredger', 'timeRef.current = 0;', 1],
      ['drilling', 'timeRef.current = 0;', 1],
    ];
    for (const [sim, needle, expected] of specs) {
      const source = readSource(`simulations/${sim}-simulation.tsx`);
      expect(source.split(needle).length - 1, sim).toBe(expected);
    }
  });

  it('computes the shallow-water factor per fragment (tessellation-independent)', () => {
    const material = readSource('scene/water/gerstner-water-material.ts');
    expect(material).toContain('float shoreShallow01(vec2 worldXZ)');
    expect(material).toContain('shoreShallow01(vWorldPos.xz) * 0.45');
    // 顶点阶段不再输出浅水 varying（振幅衰减保留在顶点——几何量）。
    expect(material).not.toContain('vShoreShallow01');
  });
});

describe('far-field vertex budget (#2117)', () => {
  it('spends vertices on the near field: the waveless far plane uses minimal tessellation', () => {
    const bands = readSource('scene/water/ocean-bands.ts');
    expect(bands).toContain('high: { size: 60000, resolution: 32 }');
    expect(bands).toContain('medium: { size: 60000, resolution: 16 }');
    expect(bands).toContain('low: { size: 60000, resolution: 8 }');
    // 近场分辨率保持档位无关的交互基准（2048m/256²）。
    expect(bands).toContain('high: { size: 2048, resolution: 256 }');
  });
});
