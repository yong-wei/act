import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { cubeUvDefinesForHeight } from '../scene/water/gerstner-water-material';

const ROOT = process.cwd();
const readSource = (relative: string) =>
  readFileSync(path.join(ROOT, 'src/resources/simulations', relative), 'utf8');

describe('CubeUV defines match the locked three layout (#2118)', () => {
  it('derives texel/max-mip exactly like three generateCubeUVSize', () => {
    // three 0.184 WebGLProgram.generateCubeUVSize：
    // maxMip = log2(height) - 2; texelHeight = 1/height;
    // texelWidth = 1/(3 * max(2^maxMip, 7*16))。
    for (const height of [64, 256, 1024]) {
      const defines = cubeUvDefinesForHeight(height);
      const maxMip = Math.log2(height) - 2;
      expect(defines.CUBEUV_MAX_MIP).toBe(maxMip.toFixed(1));
      expect(Number(defines.CUBEUV_TEXEL_HEIGHT)).toBeCloseTo(1 / height, 12);
      expect(Number(defines.CUBEUV_TEXEL_WIDTH)).toBeCloseTo(
        1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16)),
        12,
      );
    }
  });
});

describe('water shader consumes shared PMREM radiance (#2118)', () => {
  it('samples IBL through the built-in CubeUV chunks with a disabled guard', () => {
    const source = readSource('scene/water/gerstner-water-material.ts');
    expect(source).toContain('#include <cube_uv_reflection_fragment>');
    expect(source).toContain('#include <envmap_common_pars_fragment>');
    expect(source).toContain('#include <envmap_physical_pars_fragment>');
    // P1 修复：世界空间直接采样（chunk 的 getIBLRadiance 期望视图空间入参）。
    expect(source).toContain('textureCubeUV(envMap, envMapRotation * envReflect, roughness)');
    expect(source).toContain('mix(envReflect, normal, pow4(roughness))');
    // 无环境时兜底回退 horizonColor 过渡（波光责任不变）。
    expect(source).toContain('reflectionTint = uHorizonColor;');
    expect(source).toContain('uEnvEnabled > 0.5');
    // 菲涅尔项从纯色过渡升级为 horizon↔IBL 混合（强度受 preset IBL 钳制）。
    expect(source).toContain('mix(uHorizonColor, ibl, clamp(envMapIntensity, 0.0, 1.0))');
  });

  it('binds radiance per frame from scene.userData with define recompile', () => {
    const water = readSource('scene/water/gerstner-water.tsx');
    expect(water).toContain('marineEnvRadiance');
    expect(water).toContain('cubeUvDefinesForHeight');
    expect(water).toContain("material.defines.USE_ENVMAP = ''");
    // QA 方向诊断：?qa=marine-env 旋转 envMapRotation——证明水面在读环境。
    expect(water).toContain("has('qa', 'marine-env')");
    expect(water).toContain('envMapRotation');
  });

  it('shares the radiance cache entry height and publishes via scene.userData', () => {
    const radiance = readSource('scene/environment/environment-radiance.ts');
    expect(radiance).toContain('cubeUVHeight: number');
    expect(radiance).toContain('Number(image?.height) > 0');
    const scene = readSource('scene/environment/environment-scene.tsx');
    expect(scene).toContain('scene.userData.marineEnvRadiance = {');
    expect(scene).toContain('delete scene.userData.marineEnvRadiance');
  });
});

describe('camera-relative sky and fog plumbing (#2118)', () => {
  it('moves the sky group with the camera (infinite-distance equivalence)', () => {
    const scene = readSource('scene/environment/environment-scene.tsx');
    expect(scene).toContain('skyGroupRef');
    expect(scene).toContain('skyGroupRef.current.position.set(camera.position.x, 0, camera.position.z)');
  });

  it('participates in scene fog with a single output transform', () => {
    const material = readSource('scene/water/gerstner-water-material.ts');
    expect(material).toContain('#include <fog_pars_fragment>');
    expect(material).toContain('#include <fog_fragment>');
    // 单次输出变换：tonemapping/colorspace 各只出现一次（片元输出尾部）。
    expect(material.split('#include <tonemapping_fragment>').length - 1).toBe(1);
    expect(material.split('#include <colorspace_fragment>').length - 1).toBe(1);
    expect(material).toContain('fog: true');
  });
});

describe('controlled high-tier planar reflection (#2118)', () => {
  it('mirrors the camera, hides overlays by prefix, and renders on motion only', () => {
    const source = readSource('scene/environment/planar-reflection.tsx');
    expect(source).toContain("2 * planeY - source.position.y");
    // 复审修复：marine- 前缀隐藏约定（水面/尾迹防递归 + 教学/辅助线不泄漏）。
    expect(source).toContain("REFLECTION_HIDDEN_NAME_PREFIX = 'marine-'");
    expect(source).toContain("object.name.startsWith(REFLECTION_HIDDEN_NAME_PREFIX)");
    // 运动触发：静止场景不重画；原地转向（航向变化）同样失效（复审修复）。
    expect(source).toContain('if (state.hasRendered && !cameraMoved && !subjectMoved && !subjectTurned)');
    expect(source).toContain('subjectHeadingSampler');
    expect(source).toContain('Math.abs(subjectHeading - state.lastSubjectHeading) > 0.02');
    // 禁用释放（降档 dispose RT）+ 卸载释放 + 重启用重建。
    expect(source).toContain('delete scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY]');
    expect(source).toContain('renderTargetRef.current?.dispose()');
    expect(source).toContain('if (!renderTargetRef.current) {');
    // 纹理矩阵：bias × projection × view。
    expect(source).toContain('.multiply(mirrorCamera.projectionMatrix)');
  });

  it('names overlays with the marine- prefix across the fleet', () => {
    expect(readSource('scene/annotations/teaching-annotations.tsx')).toContain('name="marine-annotations"');
    expect(readSource('scene/lines/index.tsx')).toContain('name="marine-trail"');
    for (const sim of ['container', 'cruise', 'lng', 'dredger']) {
      const source = readSource(`simulations/${sim}-simulation.tsx`);
      expect(source, sim).toContain('name="marine-annotations"');
      expect(source, sim).toContain('name="marine-grid"');
    }
    // 挖泥/钻井目标标记同样纳入前缀隐藏。
    expect(readSource('simulations/dredger-simulation.tsx')).toContain('<group name="marine-annotations"');
    expect(readSource('simulations/drilling-simulation.tsx')).toContain('<group name="marine-annotations"');
    expect(readSource('simulations/destroyer-simulation.tsx')).toContain('name="marine-guide"');
  });

  it('wires subject heading samplers into every water mount (turn invalidation)', () => {
    for (const sim of ['container', 'cruise', 'lng', 'icebreaker', 'dredger', 'destroyer', 'drilling']) {
      const source = readSource(`simulations/${sim}-simulation.tsx`);
      expect(source, sim).toContain('shipHeadingSampler={');
    }
  });

  it('samples the reflection via projective texture with distance fade', () => {
    const material = readSource('scene/water/gerstner-water-material.ts');
    expect(material).toContain('texture2DProj(uPlanarTex, planarUv)');
    expect(material).toContain('2.0 * uPlanarPlaneY - vWorldPos.y');
    expect(material).toContain('smoothstep(120.0, 900.0');
  });

  it('is hosted at high tier with an explicit QA kill switch', () => {
    const water = readSource('scene/water/gerstner-water.tsx');
    expect(water).toContain("enabled={tier === 'high' && !PLANAR_QA_DISABLED}");
    expect(water).toContain("get('qa-planar') === 'off'");
    expect(water).toContain('<group name="marine-water">');
    const wake = readSource('scene/wake/wake-trail.tsx');
    expect(wake).toContain('name="marine-wake"');
  });
});
