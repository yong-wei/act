/**
 * 海洋渲染性能证据（#2103）：测量上下文、统计口径与"实测 vs 目标"分离。
 *
 * 纯模块。桌面 1920×1080 DPR1 目标 60fps（预热后 60s p95 ≈ 18.2ms）与移动 30fps
 * 均为**目标**（targets），未经真实硬件实测前不得写入 measured；无 GPU timer-query
 * 扩展时只报告帧间隔（frame intervals），明确标记 GPU 计时不可用——不得把帧间隔
 * 冒充 GPU 时长。p50/p95/p99/长帧由样本计算；RT/纹理字节为估算，不冒充显存测量。
 */

export interface MarinePerformanceContext {
  /** 绘制缓冲尺寸（drawingBufferSize，像素）。 */
  readonly drawingBufferWidth: number;
  readonly drawingBufferHeight: number;
  /** CSS 画布尺寸（像素）。 */
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly devicePixelRatio: number;
  /** GPU 渲染器字符串（WEBGL_debug_renderer_info），不可得为 null。 */
  readonly gpuRenderer: string | null;
  readonly browser: string;
  readonly hardwareConcurrency: number;
  /** 场景输入：船包身份/镜头/海况/画质档（证据必须可归因）。 */
  readonly vesselId: string;
  readonly cameraView: string;
  readonly seaState: number;
  readonly qualityTier: string;
}

export interface MarineFrameStatistics {
  readonly sampleCount: number;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly p99Ms: number | null;
  /** 超过预算 2 倍的长帧数。 */
  readonly longFrameCount: number;
  readonly worstMs: number | null;
}

export interface MarinePerformanceReport {
  readonly context: MarinePerformanceContext;
  /** 测量方法：timer-query（GPU 段）或 frame-intervals（CPU/合成帧间隔）。 */
  readonly method: 'timer-query' | 'frame-intervals';
  readonly gpuTimerAvailable: boolean;
  readonly frameStats: MarineFrameStatistics;
  /** 实测值（measured）：来自真实硬件采样；目标（targets）单独携带，不得混写。 */
  readonly measuredAt: string | null;
  readonly targets: {
    readonly desktop1080p60Fps: 60;
    readonly desktopP95Ms: 18.2;
    readonly mobile30Fps: 30;
  };
}

export const MARINE_PERFORMANCE_TARGETS = {
  desktop1080p60Fps: 60,
  desktopP95Ms: 18.2,
  mobile30Fps: 30,
} as const;

/** 有序性能样本 → p50/p95/p99/长帧/最差帧（nearest-rank 分位）。 */
export function buildMarineFrameStatistics(
  frameMsSamples: readonly number[],
  options: { budgetMs?: number } = {},
): MarineFrameStatistics {
  const budgetMs = options.budgetMs ?? 18.2;
  if (frameMsSamples.length === 0) {
    return { sampleCount: 0, p50Ms: null, p95Ms: null, p99Ms: null, longFrameCount: 0, worstMs: null };
  }
  const sorted = [...frameMsSamples].sort((left, right) => left - right);
  const quantile = (q: number): number => {
    const rank = Math.min(Math.max(Math.ceil(q * sorted.length), 1), sorted.length);
    return sorted[rank - 1]!;
  };
  return {
    sampleCount: sorted.length,
    p50Ms: quantile(0.5),
    p95Ms: quantile(0.95),
    p99Ms: quantile(0.99),
    longFrameCount: sorted.filter((ms) => ms > budgetMs * 2).length,
    worstMs: sorted[sorted.length - 1]!,
  };
}

/**
 * 构建报告：gpuTimerAvailable=false 时强制 method='frame-intervals'
 * （无 timer-query 扩展只报告帧间隔，不把帧间隔标注为 GPU 时长）。
 */
export function buildMarinePerformanceReport(input: {
  readonly context: MarinePerformanceContext;
  readonly gpuTimerAvailable: boolean;
  readonly frameMsSamples: readonly number[];
  readonly measuredAt?: string | null;
}): MarinePerformanceReport {
  return {
    context: input.context,
    method: input.gpuTimerAvailable ? 'timer-query' : 'frame-intervals',
    gpuTimerAvailable: input.gpuTimerAvailable,
    frameStats: buildMarineFrameStatistics(input.frameMsSamples),
    measuredAt: input.measuredAt ?? null,
    targets: MARINE_PERFORMANCE_TARGETS,
  };
}
