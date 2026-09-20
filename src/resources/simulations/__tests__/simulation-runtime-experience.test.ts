import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const readSource = (relative: string) =>
  readFileSync(path.join(ROOT, 'src/resources/simulations', relative), 'utf8');

describe('probe binds the real renderer (#2120)', () => {
  it('samples the R3F renderer canvas and context, not document.querySelector(canvas)', () => {
    const source = readSource('scene/quality/quality-state.tsx');
    expect(source).toContain('const renderer = useThree((state) => state.gl);');
    expect(source).toContain('const canvas = renderer.domElement;');
    expect(source).toContain('renderer.getContext()');
    // 多 canvas 页面不再猜画布。
    expect(source).not.toContain("querySelector('canvas')");
  });

  it('records foreground stalls >= 1s separately instead of silently dropping them', () => {
    const source = readSource('scene/quality/quality-state.tsx');
    // P2 复审：按测量窗口聚合（总数+最差，无 16 条截断），start() 重置。
    expect(source).toContain('stallTotalCount += 1;');
    expect(source).toContain('stallWorstMs = Math.max(stallWorstMs, delta);');
    expect(source).toContain('stallTotalCount = 0;');
    expect(source).toContain('longForegroundStallCount: stallTotalCount');
    expect(source).not.toContain('longStalls.shift()');
    // 长帧不进 p95 窗口（口径分离）。
    expect(source).toContain('if (delta >= 1000) {');
  });

  it('drives gpuTimerAvailable from real disjoint-query results', () => {
    const probe = readSource('scene/quality/quality-state.tsx');
    expect(probe).toContain("import { readMarineGpuTimerEvidence } from './gpu-frame-timer'");
    const timer = readSource('scene/quality/gpu-frame-timer.ts');
    expect(timer).toContain('EXT_disjoint_timer_query_webgl2');
    // P1 复审：结果常量取 WebGL2 核心（context.QUERY_RESULT*）——扩展对象只
    // 提供 TIME_ELAPSED_EXT / GPU_DISJOINT_EXT。
    expect(timer).toContain('context.QUERY_RESULT_AVAILABLE');
    expect(timer).toContain('context.QUERY_RESULT');
    expect(timer).toContain('GPU_DISJOINT_EXT');
    expect(timer).not.toContain('QUERY_RESULT_AVAILABLE_EXT');
    expect(timer).toContain('gpuTimerAvailable: resolvedCount > 0');
    // P1 复审：查询绑定调用方传入的 R3F renderer（不扫描 document 找上下文）。
    expect(timer).toContain('export function marineGpuTimerBind(');
    const planar = readSource('scene/environment/planar-reflection.tsx');
    expect(planar).toContain('marineGpuTimerBind(gl);');
    expect(planar).toContain('marineGpuTimerBeginPass()');
    expect(planar).toContain('marineGpuTimerEndPass()');
    expect(planar).toContain('pollMarineGpuTimer()');
  });
});

describe('governor warm-up and background protection (#2120)', () => {
  it('skips degradation decisions during warm-up and while the page is hidden', () => {
    const source = readSource('scene/quality/quality-state.tsx');
    expect(source).toContain('GOVERNOR_WARMUP_MS = 8000');
    expect(source).toContain('if (inWarmup || hiddenRef.current) return;');
    expect(source).toContain("document.addEventListener('visibilitychange', onVisibility)");
    // 恢复帧的巨大间隔被丢弃（lastRef 复位，不算超预算帧）。
    expect(source).toContain('if (!document.hidden) lastRef.current = 0;');
  });
});

describe('per-frame QA model scan is gated (#2120)', () => {
  it('runs Box3 traversal and skinned-binding checks only under the QA probe flag', () => {
    const source = readSource('simulations/destroyer-simulation.tsx');
    expect(source).toContain('__destroyerModelVisualProbe?: boolean');
    expect(source).toContain('window.__destroyerModelVisualProbe === true');
    // 普通运行只写轻量字段（无逐帧全模型遍历）。
    expect(source).toContain('boxInView: undefined,');
    expect(source).toContain('skinnedIntact: undefined,');
  });
});
