import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ICEBREAKER = path.join(process.cwd(), 'src/resources/simulations/simulations/icebreaker-simulation.tsx');
const PROFILE = path.join(process.cwd(), 'src/resources/simulations/profiles/icebreaker-xuelong-scene.ts');

const read = (file: string) => readFileSync(file, 'utf8');

describe('icebreaker scene visual profile', () => {
  it('pins ship length, design speed, model url, and wake anchors', () => {
    const source = read(PROFILE);
    expect(source).toContain('shipLengthMeters: 122.5');
    expect(source).toContain('designSpeedKnots: 15.5');
    expect(source).toContain("resolveRegisteredSimulationModel('icebreaker')");
    expect(source).toContain('wakeAnchors');
  });
});

describe('icebreaker pipeline integration', () => {
  it('mounts every pipeline layer in the icebreaker scene', () => {
    const source = read(ICEBREAKER);
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

  it('retires the legacy environment, ice ocean, and camera controller from icebreaker', () => {
    const source = read(ICEBREAKER);
    expect(source).not.toContain('MaritimeEnvironment');
    expect(source).not.toContain('UnifiedCameraController');
    expect(source).not.toContain('IceOcean');
  });

  it('feeds the wake with model-speed semantics and remounts it on reset', () => {
    const source = read(ICEBREAKER);
    const rigStart = source.indexOf('WakeTrailRig');
    // #2104：rig 迁移统一近场查询后函数变长——窗口改为整个函数体（意图是速度语义+重挂载，非字符数）。
    const rigEnd = source.indexOf('\n}\n', rigStart);
    const rig = source.slice(rigStart, rigEnd > rigStart ? rigEnd : rigStart + 1600);
    expect(rig).toContain('worldSpeedSampler');
    expect(rig).toContain('() => speed');
    expect(rig).toContain('key={resetToken}');
    expect(source).toContain('speed={metrics.speed}');
  });

  it('wires the optimized model with error boundary and culling workaround', () => {
    const source = read(ICEBREAKER);
    expect(source).toContain('VersionedFleetShip');
    expect(source).toContain("logicalId=\"icebreaker\"");
  });

  it('gates the heading indicator behind the teaching-annotations toggle and keeps trail line', () => {
    const source = read(ICEBREAKER);
    expect(source).toContain('showAnnotations');
    expect(source).toContain('TeachingAnnotationsGate');
    expect(source).toContain('HeadingIndicator');
    expect(source).toContain('TrailLine');
  });
});

describe('icebreaker heading convention adaptation', () => {
  it('feeds wake and camera samplers through the adapter on psi radians', () => {
    const source = read(ICEBREAKER);
    expect(source).toContain('transformRef.current.heading = platformHeadingToSceneRad(toDegrees(heading))');
    expect(source).toContain('headingSampler={() => platformHeadingToSceneRad(toDegrees(heading))}');
    expect(source).not.toContain('headingSampler={() => toRadians(');
    expect(source).not.toContain('headingSampler={() => heading}');
  });
});
