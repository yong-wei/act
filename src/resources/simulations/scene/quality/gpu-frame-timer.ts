/**
 * 非阻塞 GPU 帧计时（#2120）：对**实际受控渲染 pass**（平面反射）使用
 * EXT_disjoint_timer_query_webgl2 测量 GPU 耗时——begin/end 后逐帧轮询
 * QUERY_RESULT_AVAILABLE，GPU_DISJOINT 时丢弃样本；无扩展或从未返回结果时
 * 如实报告不可用（gpuTimerAvailable=false），不伪造 timer-query 口径。
 */

/** EXT_disjoint_timer_query_webgl2 最小契约（dom lib 未含该扩展类型）。 */
interface DisjointTimerQueryExt {
  readonly QUERY_RESULT_EXT: number;
  readonly QUERY_RESULT_AVAILABLE_EXT: number;
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
let pending: PendingQuery | null = null;
let resolvedCount = 0;
let lastMs: number | null = null;
let avgMs: number | null = null;
let disjointDrops = 0;

function resolveExtension(): DisjointTimerQueryExt | null {
  if (extension !== undefined) return extension;
  extension = null;
  if (typeof window === 'undefined') return extension;
  // R3F 渲染器自己的画布（不是 document 上的任意 canvas）。
  const canvases = Array.from(document.querySelectorAll('canvas'));
  for (const canvas of canvases) {
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (ext) {
        context = gl;
        extension = ext as DisjointTimerQueryExt;
        break;
      }
    }
  }
  return extension;
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
  const available = context.getQueryParameter(
    query,
    ext.QUERY_RESULT_AVAILABLE_EXT,
  ) as boolean | null;
  if (!available) return;
  const nanoseconds = context.getQueryParameter(query, ext.QUERY_RESULT_EXT) as number | null;
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
