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

  it('starts a clean measurement window: baseline reset + GPU window snapshot', () => {
    const probe = readSource('scene/quality/quality-state.tsx');
    // start() 重置时间基准（start 前的阻塞段不计入本窗口）与 GPU 窗口快照。
    expect(probe).toContain('lastMs = performance.now();');
    expect(probe).toContain('marineGpuTimerStartWindow();');
    const timer = readSource('scene/quality/gpu-frame-timer.ts');
    expect(timer).toContain('export function marineGpuTimerStartWindow()');
    // 二轮：切窗丢弃在途查询（上一窗口 pending 完成不混入本窗口）。
    expect(timer).toContain('context.deleteQuery(pending.query);');
    // 二轮：stop() 冻结窗口（代次切换）——窗口外完成/新发起查询不写入。
    expect(timer).toContain('export function marineGpuTimerStopWindow()');
    expect(timer).toContain('if (!ext || !context || !windowOpen) return;');
    expect(timer).toContain('resolvedGeneration === windowGeneration && windowOpen');
    expect(timer).toContain('if (generation === windowGeneration && windowOpen) windowDisjointDrops += 1;');
    const probe2 = readSource('scene/quality/quality-state.tsx');
    expect(probe2).toContain('marineGpuTimerStopWindow();');
    expect(timer).toContain('gpuTimerAvailable: windowResolvedCount > 0');
    // active/pending 状态机：只对本轮成功 begin 的查询执行 end。
    expect(timer).toContain('if (active || pending) return;');
    expect(timer).toContain('pending = active;');
    // QA 验收流程显式启用重观测（普通用户路径保持关闭）。
    const spec = readFileSync(path.join(ROOT, 'tests/type055-model-candidate.spec.ts'), 'utf8');
    expect(spec).toContain('window.__destroyerModelVisualProbe = true;');
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
    expect(probe).toContain('marineGpuTimerStartWindow');
    expect(probe).toContain('marineGpuTimerStopWindow');
    expect(probe).toContain('readMarineGpuTimerEvidence');
    expect(probe).toContain("from './gpu-frame-timer'");
    const timer = readSource('scene/quality/gpu-frame-timer.ts');
    expect(timer).toContain('EXT_disjoint_timer_query_webgl2');
    // P1 复审：结果常量取 WebGL2 核心（context.QUERY_RESULT*）——扩展对象只
    // 提供 TIME_ELAPSED_EXT / GPU_DISJOINT_EXT。
    expect(timer).toContain('context.QUERY_RESULT_AVAILABLE');
    expect(timer).toContain('context.QUERY_RESULT');
    expect(timer).toContain('GPU_DISJOINT_EXT');
    expect(timer).not.toContain('QUERY_RESULT_AVAILABLE_EXT');
    expect(timer).toContain('gpuTimerAvailable: windowResolvedCount > 0');
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
    // 挂载即隐藏（后台打开/会话恢复）也处于保护态。
    expect(source).toContain('hiddenRef.current = document.hidden;');
    // 预热以可见墙钟计（后台驻留不消耗预热窗口）。
    expect(source).toContain('if (wasHidden && !isHidden) hiddenAccumRef.current += now - lastVisibilityTsRef.current;');
    expect(source).toContain('now - mountedAtRef.current - hiddenAccumRef.current < GOVERNOR_WARMUP_MS');
    expect(source).toContain("document.addEventListener('visibilitychange', onVisibility)");
    // 恢复帧的巨大间隔被丢弃（lastRef 复位，不算超预算帧）。
    expect(source).toContain('if (!isHidden) lastRef.current = 0;');
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
