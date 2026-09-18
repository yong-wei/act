import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildMarineFrameStatistics,
  buildMarinePerformanceReport,
  MARINE_PERFORMANCE_TARGETS,
  type MarinePerformanceContext,
} from '@/resources/simulations/scene/quality/performance-evidence';
import {
  DEGRADATION_LADDER,
  degradationDecision,
  degradationPreservesSemantics,
} from '@/resources/simulations/scene/quality/degradation';
import { MarineSceneResourceLedger } from '@/resources/simulations/scene/quality/resource-ledger';
import { SCENE_QUALITY_TIERS } from '@/resources/simulations/scene/quality/quality-tiers';

const ROOT = process.cwd();

const CONTEXT: MarinePerformanceContext = {
  drawingBufferWidth: 1920,
  drawingBufferHeight: 1080,
  cssWidth: 1920,
  cssHeight: 1080,
  devicePixelRatio: 1,
  gpuRenderer: 'Apple M2 (mock)',
  browser: 'Chrome 130 (mock)',
  hardwareConcurrency: 8,
  vesselId: 'type055',
  cameraView: 'chase',
  seaState: 3,
  qualityTier: 'high',
};

describe('performance evidence measurement context (#2103)', () => {
  it('computes nearest-rank percentiles, long frames, and worst frame', () => {
    const samples = Array.from({ length: 100 }, (_, i) => 8 + (i % 7));
    const stats = buildMarineFrameStatistics(samples);
    expect(stats.sampleCount).toBe(100);
    expect(stats.p50Ms).toBeGreaterThan(0);
    expect(stats.p95Ms!).toBeGreaterThanOrEqual(stats.p50Ms!);
    expect(stats.p99Ms!).toBeGreaterThanOrEqual(stats.p95Ms!);
    expect(stats.worstMs).toBe(Math.max(...samples));
    expect(stats.longFrameCount).toBe(0);
    const empty = buildMarineFrameStatistics([]);
    expect(empty.p50Ms).toBeNull();
    expect(empty.worstMs).toBeNull();
  });

  it('marks GPU timing unavailable without relabeling frame intervals as GPU duration', () => {
    const report = buildMarinePerformanceReport({
      context: CONTEXT,
      gpuTimerAvailable: false,
      frameMsSamples: [16.7, 17.2, 33.4],
    });
    expect(report.gpuTimerAvailable).toBe(false);
    expect(report.method).toBe('frame-intervals');
    // 无扩展：报告不出现任何 GPU 时长口径字段。
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('gpuMs');
    // 有扩展时才用 timer-query 口径。
    const withTimer = buildMarinePerformanceReport({
      context: CONTEXT,
      gpuTimerAvailable: true,
      frameMsSamples: [16.7],
    });
    expect(withTimer.method).toBe('timer-query');
  });

  it('carries targets separately from measured results and full attribution context', () => {
    const report = buildMarinePerformanceReport({
      context: CONTEXT,
      gpuTimerAvailable: false,
      frameMsSamples: [16.7],
      measuredAt: '2026-09-18T00:00:00.000Z',
    });
    expect(report.targets).toEqual(MARINE_PERFORMANCE_TARGETS);
    expect(report.measuredAt).toBe('2026-09-18T00:00:00.000Z');
    // 证据可归因：硬件/浏览器/绘制缓冲/船包/镜头/海况/画质档齐备。
    expect(report.context.drawingBufferWidth).toBe(1920);
    expect(report.context.gpuRenderer).toContain('M2');
    expect(report.context.vesselId).toBe('type055');
    expect(report.context.seaState).toBe(3);
  });
});

describe('performance probe honesty and entry (#2103 contracts)', () => {
  it('keeps rAF samples as frame-intervals even when the timer-query extension exists', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/quality/quality-state.tsx'),
      'utf-8',
    );
    // 口径诚实：未经实际 query 采集，gpuTimerAvailable 恒 false；扩展存在性单独记录。
    expect(source).toContain('gpuTimerAvailable: false,');
    expect(source).toContain('timerQueryExtensionPresent: Boolean(');
  });

  it('accepts both the marine-frame contract entry and the performance entry', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/quality/quality-state.tsx'),
      'utf-8',
    );
    expect(source).toContain("qaParams.includes('marine-performance')");
    expect(source).toContain("qaParams.includes('marine-frame')");
  });

  it('exposes warm-up start/stop with a time-bounded 60s window and live context reads', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/quality/quality-state.tsx'),
      'utf-8',
    );
    expect(source).toContain('start: () => {');
    expect(source).toContain('stop: () => {');
    expect(source).toContain('WINDOW_MS = 60_000');
    // ref 化：read() 时调用最新 contextInput（镜头切换后归因随场景）。
    expect(source).toContain('contextInputRef.current?.()');
    // GPU 渲染器身份：WEBGL_debug_renderer_info 可用时读取实际字符串。
    expect(source).toContain("gl.getExtension('WEBGL_debug_renderer_info')");
    expect(source).toContain('UNMASKED_RENDERER_WEBGL');
  });

  it('registers real resource lifetimes into the global ledger (PMREM boundary)', () => {
    const radiance = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/environment/environment-radiance.ts'),
      'utf-8',
    );
    expect(radiance).toContain('marineSceneResourceLedger.register({');
    expect(radiance).toContain("id: `pmrem-rt:${rendererKey}:${presetId}`");
    expect(radiance).toContain('marineSceneResourceLedger.release(');
    const scene = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/environment/environment-scene.tsx'),
      'utf-8',
    );
    expect(scene).toContain("id: `pmrem-generator:${marineRendererKey(gl)}`");
    expect(scene).toContain("marineSceneResourceLedger.release(`pmrem-generator:");
  });

  it('attributes vessel/camera from live scene state (no placeholders)', () => {
    for (const file of ['destroyer-simulation.tsx', 'cruise-simulation.tsx', 'container-simulation.tsx', 'lng-simulation.tsx', 'dredger-simulation.tsx', 'drilling-simulation.tsx', 'icebreaker-simulation.tsx']) {
      const source = readFileSync(path.join(ROOT, 'src/resources/simulations/simulations', file), 'utf-8');
      expect(source, file).toContain('cameraView: String(cameraMode)');
      expect(source, file).not.toContain("cameraView: String('current')");
    }
  });
});

describe('degradation preserves semantics (#2103)', () => {
  it('orders cost cuts from optional effects to rendering detail, never the base field', () => {
    expect(DEGRADATION_LADDER.high).toEqual([]);
    expect(DEGRADATION_LADDER.medium).not.toContain('post-disabled');
    expect(DEGRADATION_LADDER.low).toContain('post-disabled');
    expect(DEGRADATION_LADDER.low).toContain('dpr-capped-1');
    // 阶梯不含基础波场/姿态/数值项。
    const allCuts = [...DEGRADATION_LADDER.high, ...DEGRADATION_LADDER.medium, ...DEGRADATION_LADDER.low];
    for (const forbidden of ['base-wave', 'pose', 'numerical', 'physics']) {
      expect(allCuts.some((cut) => cut.includes(forbidden))).toBe(false);
    }
  });

  it('reports the incremental cuts and constant invariants of each degradation step', () => {
    const decision = degradationDecision('high', 'medium');
    expect(decision.newlyCutCosts).toEqual(DEGRADATION_LADDER.medium);
    expect(decision.invariants).toContain('base-interaction-wave-field');
    expect(decision.invariants).toContain('pose-ownership-per-dof');
  });

  it('keeps the real tier params monotonic in optional costs only', () => {
    expect(degradationPreservesSemantics(SCENE_QUALITY_TIERS)).toBe(true);
  });

  it('keeps base wave field tier-invariant (carried contract from #2098)', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/water/gerstner-water.tsx'),
      'utf-8',
    );
    // 近场网格与波组固定（NEAR_FIELD_VISIBLE_WAVES / NEAR_FIELD_MESH_SPEC），不随画质档。
    expect(source).toContain('waves={NEAR_FIELD_VISIBLE_WAVES}');
    expect(source).toContain('meshSpec={NEAR_FIELD_MESH_SPEC}');
  });
});

describe('resource ledger bounded lifetimes (#2103)', () => {
  it('returns to steady state after repeated preset transitions with no unshared leaks', () => {
    const ledger = new MarineSceneResourceLedger();
    const cycle = () => {
      // 预设 A→B：A 的 PMREM 为共享缓存（保留），B 的生成注册；卸载再释放。
      ledger.register({ id: 'pmrem:open-sea', kind: 'pmrem-render-target', shared: true, estimatedBytes: 1 << 20 });
      ledger.register({ id: 'pmrem:storm-blue', kind: 'pmrem-render-target', shared: true, estimatedBytes: 1 << 20 });
      ledger.register({ id: 'generator:r1', kind: 'pmrem-generator' });
      ledger.release('generator:r1');
      ledger.register({ id: 'water:near', kind: 'water-material' });
      ledger.release('water:near');
    };
    for (let i = 0; i < 10; i += 1) cycle();
    // 十次切换后：只剩共享 PMREM 条目，无未释放泄漏。
    expect(ledger.count()).toBe(2);
    expect(ledger.leaks()).toEqual([]);
    expect(ledger.estimatedBytes()).toBe(2 * (1 << 20));
  });

  it('detects route-cycle leaks for unshared scene resources', () => {
    const ledger = new MarineSceneResourceLedger();
    for (let route = 0; route < 3; route += 1) {
      ledger.register({ id: `wake:${route}`, kind: 'wake-buffer' });
      // 正确卸载应释放；模拟一次遗漏。
      if (route < 2) ledger.release(`wake:${route}`);
    }
    const leaks = ledger.leaks();
    expect(leaks).toHaveLength(1);
    expect(leaks[0]!.id).toBe('wake:2');
  });
});
