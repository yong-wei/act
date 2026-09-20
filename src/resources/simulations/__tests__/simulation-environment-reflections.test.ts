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
    expect(source).toContain('getIBLRadiance(viewDirection, normal, roughness)');
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
  it('mirrors the camera, hides the water itself, and renders on motion only', () => {
    const source = readSource('scene/environment/planar-reflection.tsx');
    expect(source).toContain("2 * planeY - source.position.y");
    expect(source).toContain("REFLECTION_HIDDEN_NAMES");
    expect(source).toContain("'marine-water'");
    expect(source).toContain("'marine-wake'");
    // 运动触发：静止场景不重画（默认无每帧反射成本）。
    expect(source).toContain('if (state.hasRendered && !cameraMoved && !subjectMoved)');
    // 禁用释放 + 卸载释放。
    expect(source).toContain('delete scene.userData[MARINE_PLANAR_REFLECTION_SCENE_KEY]');
    expect(source).toContain('renderTarget.dispose()');
    // 纹理矩阵：bias × projection × view。
    expect(source).toContain('.multiply(mirrorCamera.projectionMatrix)');
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
