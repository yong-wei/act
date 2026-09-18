import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const CRUISE = path.join(process.cwd(), 'src/resources/simulations/simulations/cruise-simulation.tsx');
const PROFILE = path.join(process.cwd(), 'src/resources/simulations/profiles/cruise-adora-scene.ts');

const read = (file: string) => readFileSync(file, 'utf8');

describe('cruise scene visual profile', () => {
  it('pins ship length, design speed, model url, and wake anchors', () => {
    const source = read(PROFILE);
    expect(source).toContain('shipLengthMeters: 323.6');
    expect(source).toContain('designSpeedKnots: 18');
    expect(source).toContain("resolveRegisteredSimulationModel('luxury-liner')");
    expect(source).toContain('wakeAnchors');
  });
});

describe('cruise pipeline integration', () => {
  it('mounts every pipeline layer in the cruise scene', () => {
    const source = read(CRUISE);
    for (const marker of [
      '<EnvironmentScene',
      'GerstnerWater',
      '<WakeTrail',
      '<StayPutCameraController',
      'SceneEnvironmentProvider',
      'SceneSoundscapeProvider',
      'TeachingAnnotationsProvider',
      'SceneQualityProvider',
      '<ScenePostEffects',
      'SceneQualityAttributes',
    ]) {
      expect(source, `missing ${marker}`).toContain(marker);
    }
  });

  it('retires the legacy environment and camera controller from cruise', () => {
    const source = read(CRUISE);
    expect(source).not.toContain('MaritimeEnvironment');
    expect(source).not.toContain('UnifiedCameraController');
  });

  it('feeds the wake with model-speed semantics and remounts it on reset', () => {
    const source = read(CRUISE);
    const rigStart = source.indexOf('WakeTrailRig');
    // #2104：rig 迁移统一近场查询后函数变长——窗口改为整个函数体（意图是速度语义+重挂载，非字符数）。
    const rigEnd = source.indexOf('\n}\n', rigStart);
    const rig = source.slice(rigStart, rigEnd > rigStart ? rigEnd : rigStart + 1600);
    expect(rig).toContain('worldSpeedSampler');
    expect(rig).toContain('state.speed');
    expect(rig).toContain('key={resetToken}');
  });

  it('wires the optimized model with error boundary and culling workaround', () => {
    const source = read(CRUISE);
    expect(source).toContain('VersionedFleetShip');
    expect(source).toContain("logicalId=\"luxury-liner\"");
  });

  it('gates the heading indicator behind the teaching-annotations toggle and keeps desired route', () => {
    const source = read(CRUISE);
    expect(source).toContain('showAnnotations');
    expect(source).toContain('TeachingAnnotationsGate');
    expect(source).toContain('HeadingIndicator');
    expect(source).toContain('DesiredRouteLine');
  });
});

describe('cruise heading convention adaptation', () => {
  it('feeds wake and camera samplers through the adapter, never bare toRadians', () => {
    const source = read(CRUISE);
    expect(source).toContain('transformRef.current.heading = platformHeadingToSceneRad(state.heading)');
    expect(source).toContain('headingSampler={() => platformHeadingToSceneRad(state.heading)}');
    expect(source).not.toContain('headingSampler={() => toRadians(');
  });
});
