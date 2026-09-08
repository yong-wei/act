import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  SIMULATION_MODEL_REGISTRY,
  resolveRegisteredSimulationModel,
  resolveVersionedDefault,
} from '@/lib/browser-delivery/client';
import { TYPE055_NANCHANG_101_V2, matchActivatedType055Package } from '../model-packages/type055-nanchang-101-v2';

/**
 * issue #1996 生产切换守卫：destroyer 默认走 v2.1.3 版本化模型包、
 * 旧链仅作回退、武器/交互角色不进入首屏、七模型 registry 与受保护旧式场景不变。
 */

const DESTROYER = path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx');
const LEGACY_DESTROYER = path.join(process.cwd(), 'src/resources/simulations/destroyer-simulation.tsx');
const QA_PAGE = path.join(process.cwd(), 'src/app/simulations/type055-model-candidate/page.tsx');

// 受保护旧式场景文件在集成基线（19c0dd3880）上的 blob 哈希：
// 用内容钉死替代 diff 范围检查，浅克隆/无远端引用环境同样可判
const LEGACY_DESTROYER_BASE_BLOB = '2237fa504b69f71ea3a0e566d4a982b1ec2eb5f8';

const read = (file: string) => readFileSync(file, 'utf-8');

describe('type055 production activation keeps legacy fallback', () => {
  it('keeps the seven-model registry resolution unchanged', () => {
    expect(Object.keys(SIMULATION_MODEL_REGISTRY).sort()).toEqual([
      'container', 'destroyer', 'dredger', 'drilling-rig', 'icebreaker', 'lng-carrier', 'luxury-liner',
    ]);
    expect(resolveRegisteredSimulationModel('destroyer').candidates).toEqual([
      '/assets/models-opt/destroyer.glb',
      '/assets/destroyer.glb',
    ]);
    // 版本化模型包与单文件 registry 共存但分离：不进入七模型 registry 键集
    expect(SIMULATION_MODEL_REGISTRY).not.toHaveProperty(TYPE055_NANCHANG_101_V2.packageId);
  });

  it('resolves the destroyer default from the versioned activation pointer, not a scene hard-code', () => {
    const activation = resolveVersionedDefault('destroyer');
    expect(matchActivatedType055Package(activation)).toEqual(TYPE055_NANCHANG_101_V2);
    // icebreaker 保持候选态（xue-long-2 未授权激活：验收门槛未闭合）；
    // 055 匹配器对其 fail closed
    expect(resolveVersionedDefault('icebreaker')).toBeNull();
    expect(matchActivatedType055Package(resolveVersionedDefault('icebreaker'))).toBeNull();
    expect(matchActivatedType055Package(null)).toBeNull();
    expect(matchActivatedType055Package({
      packageId: TYPE055_NANCHANG_101_V2.packageId,
      modelVersion: '9.9.9',
      baseUrl: TYPE055_NANCHANG_101_V2.baseUrl,
    })).toBeNull();

    const source = read(DESTROYER);
    expect(source).toContain('resolveVersionedDefault');
    expect(source).toContain('matchActivatedType055Package');
    expect(source).toContain('<VersionedShipModel');
    // 有序回退链：激活版 → v2.1.2 → v2.1.1 → v2.1.0 → 旧单文件 registry 链
    expect(source).toContain('shipLodUrlForQualityTier(TYPE055_NANCHANG_101_V2_1_2, tier)');
    expect(source).toContain('shipLodUrlForQualityTier(TYPE055_NANCHANG_101_V2_1_1, tier)');
    expect(source).toContain('shipLodUrlForQualityTier(TYPE055_NANCHANG_101_V2_1_0, tier)');
    expect(source).toContain('...MODEL.candidates');
    expect(source).toContain('legacyCandidates={orderedFallback}');
    expect(source).toContain('FallbackGltfModel');
    expect(source).not.toContain('descriptor={TYPE055_NANCHANG_101_V2}');
    expect(source).not.toContain('useType055V2CandidateEnabled');
    expect(source).not.toContain('isType055V2CandidateSearch');
    expect(source).not.toContain('type055-v2');
    expect(source).not.toContain('useGLTF.preload(MODEL.primary)');
  });

  it('applies the basis yaw only to package assets, never to legacy fallback candidates', () => {
    const source = read(DESTROYER);
    // destroyer 场景按已接收包集合判定（激活版 + 有序回退版共用同一基适配入口）
    expect(source).toContain('basisYawRad={isType055VersionedAssetUrl(url) ? TYPE055_V2_BASIS_YAW_RAD : 0}');
    // 定义（props 类型 + 解构默认）+ 条件应用，不散落其它补偿旋转
    expect(source.match(/basisYawRad/g)?.length).toBeGreaterThanOrEqual(3);
    const qaSource = read(QA_PAGE);
    const qaConditional = 'url.startsWith(TYPE055_NANCHANG_101_V2.baseUrl) ? TYPE055_V2_BASIS_YAW_RAD : 0';
    expect(qaSource, 'QA route must use the same conditional basis adapter').toContain(qaConditional);
  });

  it('applies the coordinate basis exactly once at the candidate mount', () => {
    const source = read(DESTROYER);
    // 组件内唯一的补偿旋转挂点：内层 <group rotation-y>
    expect(source).toContain('<group rotation-y={basisYawRad}>');
    expect(source).not.toMatch(/rotation\.set\([^)]*Math\.PI \/ 4/);
  });

  it('does not eagerly request payload, demo, collision, or interactive-systems roles from the destroyer scene', () => {
    const source = read(DESTROYER);
    for (const role of ['payload', 'demo', 'collision', 'interactive-systems'] as const) {
      const url = TYPE055_NANCHANG_101_V2.roles[role].url;
      expect(source, `${role} must not appear in destroyer scene`).not.toContain(url);
    }
    expect(source).toContain('<VersionedShipModel');
    expect(source).toContain('descriptor={descriptor}');
    expect(source).not.toContain('useGLTF.preload(TYPE055');
  });

  it('leaves the protected legacy simulation file untouched', () => {
    // 与集成基线 blob 哈希比对（本地可判定，不依赖远端跟踪引用）
    const blob = execSync(`git hash-object ${LEGACY_DESTROYER}`, { encoding: 'utf-8' }).trim();
    expect(blob, 'protected legacy file content changed').toBe(LEGACY_DESTROYER_BASE_BLOB);
    expect(read(LEGACY_DESTROYER)).toContain('DestroyerSimulation');
  });

  it('keeps the simulation drive chain imports unchanged', () => {
    const source = read(DESTROYER);
    expect(source).toContain("import { SimulationClock } from '@/lib/simulation'");
    expect(source).toContain('buildDestroyerHifiStepRequest');
    expect(source).toContain('computeDestroyerHifiStep');
  });
});
