/**
 * 非阻塞 GPU 帧计时（#2120）：对**实际受控渲染 pass**（平面反射）使用
 * EXT_disjoint_timer_query_webgl2 测量 GPU 耗时——begin/end 后逐帧轮询
 * QUERY_RESULT_AVAILABLE，GPU_DISJOINT 时丢弃样本；无扩展或从未返回结果时
 * 如实报告不可用（gpuTimerAvailable=false），不伪造 timer-query 口径。
 */

import type { THREE_WebGLRendererLike } from './gpu-frame-timer-types';

/** 当前绑定上下文的扩展（未绑定为 null；由 marineGpuTimerBind 建立）。 */
function resolveExtension(): DisjointTimerQueryExt | null {
  if (extension !== undefined) return extension;
  extension = null;
  return extension;
}

/** EXT_disjoint_timer_query_webgl2 最小契约（dom lib 未含该扩展类型）。
 * 注意：QUERY_RESULT / QUERY_RESULT_AVAILABLE 是 WebGL2 **核心**常量
 * （在 context 上），扩展对象只提供 TIME_ELAPSED_EXT / GPU_DISJOINT_EXT。 */
interface DisjointTimerQueryExt {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

interface PendingQuery {
  readonly query: WebGLQuery;
  readonly issuedAtMs: number;
}

export interface MarineGpuTimerState {
  readonly supported: boolean;
  /** 已成功返回的测量数（>0 才允许 gpuTimerAvailable=true）。 */
  resolvedCount: number;
  lastMs: number | null;
  avgMs: number | null;
  disjointDrops: number;
}

let extension: (DisjointTimerQueryExt | null) | undefined;
let context: WebGL2RenderingContext | null = null;
let boundRendererKey: unknown = null;
let pending: PendingQuery | null = null;
let resolvedCount = 0;
let lastMs: number | null = null;
let avgMs: number | null = null;
let disjointDrops = 0;

/** 绑定实际渲染反射 pass 的 renderer（P1 复审修复）：调用方（MarinePlanarReflection）
 * 直接传入自己的 R3F `gl`——查询与渲染必须同一上下文；换绑时丢弃旧挂起查询。 */
export function marineGpuTimerBind(renderer: THREE_WebGLRendererLike): void {
  const gl = renderer.getContext() as WebGL2RenderingContext | null;
  if (!gl) return;
  if (boundRendererKey === renderer && extension !== undefined) return;
  if (pending && context) context.deleteQuery(pending.query);
  pending = null;
  context = gl;
  boundRendererKey = renderer;
  extension = (gl.getExtension('EXT_disjoint_timer_query_webgl2') as DisjointTimerQueryExt | null) ?? null;
}


/** 目标 pass 开始前调用（无扩展时为空操作）。 */
export function marineGpuTimerBeginPass(): void {
  const ext = resolveExtension();
  if (!ext || !context || pending) return;
  const query = context.createQuery();
  if (!query) return;
  context.beginQuery(ext.TIME_ELAPSED_EXT, query);
  pending = { query, issuedAtMs: performance.now() };
}

/** 目标 pass 结束后调用。 */
export function marineGpuTimerEndPass(): void {
  const ext = resolveExtension();
  if (!ext || !context || !pending) return;
  context.endQuery(ext.TIME_ELAPSED_EXT);
  // pending 保留至轮询完成（pollMarineGpuTimer）。
}

/** 逐帧轮询：结果就绪或 disjoint 时收敛；挂起查询超时回收。 */
export function pollMarineGpuTimer(): void {
  const ext = resolveExtension();
  if (!ext || !context || !pending) return;
  const { query, issuedAtMs } = pending;
  // 挂起超过 2s 视为丢弃（不阻塞渲染循环）。
  if (performance.now() - issuedAtMs > 2000) {
    context.deleteQuery(query);
    pending = null;
    return;
  }
  if (ext.GPU_DISJOINT_EXT && context.getParameter(ext.GPU_DISJOINT_EXT)) {
    context.deleteQuery(query);
    pending = null;
    disjointDrops += 1;
    return;
  }
  // P1 复审修复：结果常量取 WebGL2 核心（context.QUERY_RESULT_AVAILABLE /
  // QUERY_RESULT）——扩展对象不提供 *_EXT 变体。
  const available = context.getQueryParameter(
    query,
    context.QUERY_RESULT_AVAILABLE,
  ) as boolean | null;
  if (!available) return;
  const nanoseconds = context.getQueryParameter(query, context.QUERY_RESULT) as number | null;
  context.deleteQuery(query);
  pending = null;
  if (typeof nanoseconds === 'number' && nanoseconds > 0) {
    const ms = nanoseconds / 1e6;
    lastMs = ms;
    avgMs = avgMs === null ? ms : avgMs * 0.8 + ms * 0.2;
    resolvedCount += 1;
  }
}

/** 证据探针读取（展开进报告输入）。 */
export function readMarineGpuTimerEvidence(): {
  gpuTimerAvailable: boolean;
  gpuTimerResolvedCount: number;
  gpuTimerLastMs: number | null;
  gpuTimerAvgMs: number | null;
  gpuTimerDisjointDrops: number;
} {
  return {
    gpuTimerAvailable: resolvedCount > 0,
    gpuTimerResolvedCount: resolvedCount,
    gpuTimerLastMs: lastMs,
    gpuTimerAvgMs: avgMs,
    gpuTimerDisjointDrops: disjointDrops,
  };
}

/** 只读状态（QA/测试）。 */
export function marineGpuTimerState(): MarineGpuTimerState {
  return {
    supported: resolveExtension() !== null,
    resolvedCount,
    lastMs,
    avgMs,
    disjointDrops,
  };
}
