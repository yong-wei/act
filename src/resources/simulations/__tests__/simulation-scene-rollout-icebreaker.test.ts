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
    const rig = source.slice(rigStart, source.indexOf('/** 教学标注开关门控'));
    expect(rig).toContain('worldSpeedSampler');
    expect(rig).toContain('() => speed');
    expect(rig).toContain('key={resetToken}');
    expect(source).toContain('speed={metrics.speed}');
  });

  it('wires the optimized model with error boundary and culling workaround', () => {
    const source = read(ICEBREAKER);
    expect(source).toContain("resolveRegisteredSimulationModel('icebreaker')");
    expect(source).toContain('FallbackGltfModel');
    expect(source).toContain('frustumCulled = false');
  });

  it('gates the heading indicator behind the teaching-annotations toggle and keeps trail line', () => {
    const source = read(ICEBREAKER);
    expect(source).toContain('showAnnotations');
    expect(source).toContain('TeachingAnnotationsGate');
    expect(source).toContain('HeadingIndicator');
    expect(source).toContain('TrailLine');
  });
});

describe('icebreaker xue-long-2 versioned model integration', () => {
  it('resolves the icebreaker default from the versioned activation pointer with legacy fallback', () => {
    const source = read(ICEBREAKER);
    expect(source).toContain("matchActivatedXueLong2Package(resolveVersionedDefault('icebreaker'))");
    expect(source).toContain('<VersionedShipModel');
    expect(source).toContain('legacyCandidates={orderedFallback}');
    // 回退链：旧单文件 registry 链兜底（本包暂无历史版本）
    expect(source).toContain('...MODEL.candidates');
    // 旧 primary 预载已退役（版本化包为默认下载路径，双份预载浪费带宽）
    expect(source).not.toContain('useGLTF.preload(MODEL.primary)');
  });

  it('applies the basis yaw only to package assets and anchors the declared waterline', () => {
    const source = read(ICEBREAKER);
    expect(source).toContain('basisYawRad={isXueLong2VersionedAssetUrl(url) ? XUE_LONG_2_BASIS_YAW_RAD : 0}');
    expect(source).toContain('<group rotation-y={basisYawRad}>');
    // 垂向锚定与主尺度缩放都按描述符声明，不再按包围盒推导
    expect(source).toContain('descriptor.verticalAnchor.designWaterlineY');
    expect(source).toContain('descriptor?.modelLengthMeters');
  });

  it('mounts the semantic bindings rig and retires the legacy azipod arrow overlay', () => {
    const source = read(ICEBREAKER);
    expect(source).toContain('<SemanticBindingsRig');
    // 旧 Azipod 绿色箭头指示器退役：真实吊舱方位动画承担方位指示职能
    expect(source).not.toContain('arrowHelper');
    expect(source).not.toContain('0x00ff00');
    // 材质保留加载器 PBR 输出（上游接入合同：不统一改透明/双面）
    expect(source).not.toContain('DoubleSide');
    expect(source).not.toContain('material.transparent = false');
  });

  it('keeps the clone path skeleton-aware and exposes the QA observation surface', () => {
    const source = read(ICEBREAKER);
    expect(source).toContain('cloneSkinnedScene(scene)');
    expect(source).toContain('skinnedBindingsIntact(model)');
    expect(source).toContain('window.__icebreakerModelVisual');
    expect(source).toContain('propPortQuat');
    expect(source).toContain('podPortQuat');
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
