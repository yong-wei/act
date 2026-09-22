/**
 * 海洋分项成本（#2135）。
 * 帧间隔、CPU 提交、GPU elapsed 与完成工作量分开记录。
 * 无合法时间戳时继续用有标签的完成墙钟，不把该墙钟写入 GPU 时长。
 */

import {
  marineGpuTimerHoldDisjointQuery,
  marineGpuTimerPassActive,
} from './gpu-frame-timer';

export const MAIN_THREAD_POINT_QUERY_KIND = 'main-thread-reference-call' as const;
/** 历史探针 raw：主线程循环 fftOceanHeightAt 的均值，不是 Worker 端到端。 */
export const HISTORICAL_POINT_QUERY_RAW_MS = 1.12;
/** 历史对照 p95：刷新率下的体验间隔，不是两条路线的同等 GPU 成本。 */
export const HISTORICAL_PRESENTATION_P95_MS = 17.4;
export const MAX_OFFSCREEN_BATCH = 32;
export const PAIRED_ROUND_COUNT = 3;

export type TimingMethod = 'gpu-elapsed' | 'completed-work' | 'frame-intervals';

export type TimingReason =
  | 'ok'
  | 'disjoint'
  | 'below-quantum'
  | 'timer-unavailable'
  | 'non-positive'
  | 'quantum-unknown'
  | 'cpu-submit'
  | 'wall-clock';

export type TimingLabel =
  | 'gpu-elapsed'
  | 'completed-work'
  | 'frame-intervals'
  | 'cpu-submit'
  | 'submit-to-complete-wall-clock';

export interface TimingSample {
  readonly gpuMs: number | null;
  readonly completedWorkMs: number | null;
  readonly frameIntervalMs: number | null;
  readonly method: TimingMethod;
  readonly reason: TimingReason;
  readonly quantizationNs: number | null;
  readonly rawGpuNs: number | null;
  readonly treatedAsFree: false;
  readonly disjointDropped: boolean;
  readonly labeledAs: TimingLabel;
}

export interface StageEntry {
  readonly id: string;
  readonly ms: number | null;
  readonly method: TimingMethod;
  readonly fusedWith: string | null;
}

export interface MarineStageRenderer {
  getContext(): unknown;
  readonly backend?: { readonly device?: GpuDeviceLike };
  readonly device?: GpuDeviceLike;
}

interface GpuDeviceLike {
  readonly features?: { has(name: string): boolean };
  readonly limits?: { readonly timestampPeriod?: number };
  readonly queue?: { readonly onSubmittedWorkDone?: () => Promise<void> };
}

interface TimestampResolvingRenderer extends MarineStageRenderer {
  resolveTimestampsAsync?(type?: string): Promise<number | undefined>;
  backend?: { trackTimestamp?: boolean; device?: GpuDeviceLike };
}

interface WebGL2TimerContext {
  getExtension(name: string): { readonly TIME_ELAPSED_EXT: number; readonly GPU_DISJOINT_EXT: number } | null;
  fenceSync(condition: number, flags: number): unknown;
  flush(): void;
  clientWaitSync(sync: unknown, flags: number, timeout: number): number;
  deleteSync(sync: unknown): void;
  readonly SYNC_GPU_COMMANDS_COMPLETE: number;
  readonly ALREADY_SIGNALED: number;
  readonly CONDITION_SATISFIED: number;
  readonly TIMEOUT_EXPIRED: number;
  readonly WAIT_FAILED: number;
}

export interface ViewportBox {
  x: number;
  y: number;
  z: number;
  w: number;
  copy(source: { x: number; y: number; z: number; w: number }): ViewportBox;
}

export interface OffscreenRenderer {
  getRenderTarget(): unknown;
  setRenderTarget(target: unknown): void;
  getViewport(target: ViewportBox): ViewportBox;
  setViewport(x: number, y: number, width: number, height: number): void;
  getScissor(target: ViewportBox): ViewportBox;
  setScissor(x: number, y: number, width: number, height: number): void;
  getScissorTest(): boolean;
  setScissorTest(enabled: boolean): void;
  readonly info?: { readonly render: { calls: number; triangles: number } };
}

export interface StageTimerDescription {
  readonly method: 'gpu-elapsed' | 'completed-work';
  readonly extension: 'disjoint-time-elapsed' | 'timestamp-query' | 'none';
  readonly quantizationNs: number | null;
  readonly gpuTimeAvailable: boolean;
  readonly contextIdentity: string;
  readonly defaultStages: readonly StageEntry[];
}

export interface StageTimerBinding {
  describe(): StageTimerDescription;
  beginQuery(): void;
  endQuery(): void;
  poll(): TimingSample | null;
  latest(): TimingSample | null;
  collectRound(work: () => void | Promise<void>): Promise<TimingSample>;
  accept(sample: {
    readonly gpuElapsedNs: number | null;
    readonly quantumNs?: number | null;
    readonly disjoint?: boolean;
    readonly completedWorkMs?: number | null;
    readonly frameIntervalMs?: number | null;
  }): TimingSample;
  measureCompletedWork(work: () => void | Promise<void>): Promise<TimingSample>;
}

const rendererIdentities = new WeakMap<object, string>();
let nextRendererIdentity = 1;

function rendererIdentity(renderer: object): string {
  const existing = rendererIdentities.get(renderer);
  if (existing) return existing;
  const identity = `marine-renderer-${nextRendererIdentity}`;
  nextRendererIdentity += 1;
  rendererIdentities.set(renderer, identity);
  return identity;
}

function isWebGL2Context(gl: unknown): gl is WebGL2TimerContext {
  if (!gl || typeof gl !== 'object') return false;
  const candidate = gl as Partial<WebGL2TimerContext>;
  return typeof candidate.getExtension === 'function'
    && typeof candidate.fenceSync === 'function'
    && typeof candidate.flush === 'function'
    && typeof candidate.clientWaitSync === 'function'
    && typeof candidate.deleteSync === 'function';
}

function readDevice(renderer: MarineStageRenderer): GpuDeviceLike | null {
  if (renderer.device) return renderer.device;
  return renderer.backend?.device ?? null;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function methodFor(gpuMs: number | null, completedWorkMs: number | null): TimingMethod {
  if (gpuMs !== null) return 'gpu-elapsed';
  if (completedWorkMs !== null) return 'completed-work';
  return 'frame-intervals';
}

function labelFor(method: TimingMethod): TimingLabel {
  if (method === 'gpu-elapsed') return 'gpu-elapsed';
  if (method === 'completed-work') return 'completed-work';
  return 'frame-intervals';
}

export function acceptTimingSample(input: {
  readonly gpuElapsedNs: number | null;
  readonly quantumNs: number | null;
  readonly disjoint: boolean;
  readonly completedWorkMs: number | null;
  readonly frameIntervalMs: number | null;
}): TimingSample {
  const completedWorkMs = finiteOrNull(input.completedWorkMs);
  const frameIntervalMs = finiteOrNull(input.frameIntervalMs);
  const quantumNs = finiteOrNull(input.quantumNs);
  if (input.disjoint) {
    const method = methodFor(null, completedWorkMs);
    return {
      gpuMs: null,
      completedWorkMs,
      frameIntervalMs,
      method,
      reason: 'disjoint',
      quantizationNs: quantumNs,
      rawGpuNs: null,
      treatedAsFree: false,
      disjointDropped: true,
      labeledAs: labelFor(method),
    };
  }
  if (input.gpuElapsedNs === null || input.gpuElapsedNs === undefined) {
    const method = methodFor(null, completedWorkMs);
    return {
      gpuMs: null,
      completedWorkMs,
      frameIntervalMs,
      method,
      reason: 'timer-unavailable',
      quantizationNs: quantumNs,
      rawGpuNs: null,
      treatedAsFree: false,
      disjointDropped: false,
      labeledAs: labelFor(method),
    };
  }
  if (!(input.gpuElapsedNs > 0)) {
    const method = methodFor(null, completedWorkMs);
    return {
      gpuMs: null,
      completedWorkMs,
      frameIntervalMs,
      method,
      reason: 'non-positive',
      quantizationNs: quantumNs,
      rawGpuNs: input.gpuElapsedNs,
      treatedAsFree: false,
      disjointDropped: false,
      labeledAs: labelFor(method),
    };
  }
  if (quantumNs === null) {
    const method = methodFor(null, completedWorkMs);
    return {
      gpuMs: null,
      completedWorkMs,
      frameIntervalMs,
      method,
      reason: 'quantum-unknown',
      quantizationNs: null,
      rawGpuNs: input.gpuElapsedNs,
      treatedAsFree: false,
      disjointDropped: false,
      labeledAs: labelFor(method),
    };
  }
  if (input.gpuElapsedNs < quantumNs) {
    const method = methodFor(null, completedWorkMs);
    return {
      gpuMs: null,
      completedWorkMs,
      frameIntervalMs,
      method,
      reason: 'below-quantum',
      quantizationNs: quantumNs,
      rawGpuNs: input.gpuElapsedNs,
      treatedAsFree: false,
      disjointDropped: false,
      labeledAs: labelFor(method),
    };
  }
  const gpuMs = input.gpuElapsedNs / 1e6;
  return {
    gpuMs,
    completedWorkMs,
    frameIntervalMs,
    method: 'gpu-elapsed',
    reason: 'ok',
    quantizationNs: quantumNs,
    rawGpuNs: input.gpuElapsedNs,
    treatedAsFree: false,
    disjointDropped: false,
    labeledAs: 'gpu-elapsed',
  };
}

/** CPU 提交耗时留在完成工作量，不写入 GPU elapsed。 */
export function separateCpuSubmit(cpuSubmitMs: number): TimingSample {
  return {
    gpuMs: null,
    completedWorkMs: cpuSubmitMs,
    frameIntervalMs: null,
    method: 'completed-work',
    reason: 'cpu-submit',
    quantizationNs: null,
    rawGpuNs: null,
    treatedAsFree: false,
    disjointDropped: false,
    labeledAs: 'cpu-submit',
  };
}

export function labelPointQuerySample(rawMs: number): {
  readonly rawMs: number;
  readonly kind: typeof MAIN_THREAD_POINT_QUERY_KIND;
  readonly workerE2eMs: null;
  readonly initChargedPerQuery: false;
} {
  return {
    rawMs,
    kind: MAIN_THREAD_POINT_QUERY_KIND,
    workerE2eMs: null,
    initChargedPerQuery: false,
  };
}

export function assembleWorkerQueryReport(input: {
  readonly computeMs: number;
  readonly queueMs: number;
  readonly e2eMs: number;
  readonly resultAgeSeconds: number;
  readonly initMs?: number | null;
}): {
  readonly computeMs: number;
  readonly queueMs: number;
  readonly transferMs: number;
  readonly e2eMs: number;
  readonly resultAgeSeconds: number;
  readonly initMs: number | null;
  readonly initChargedPerQuery: false;
  readonly kind: 'worker-batch';
} {
  return {
    computeMs: input.computeMs,
    queueMs: input.queueMs,
    transferMs: Math.max(0, input.e2eMs - input.computeMs - input.queueMs),
    e2eMs: input.e2eMs,
    resultAgeSeconds: input.resultAgeSeconds,
    initMs: input.initMs ?? null,
    initChargedPerQuery: false,
    kind: 'worker-batch',
  };
}

export function recordFusedWaveDraw(): StageEntry {
  return {
    id: 'wave-generate',
    ms: null,
    method: 'completed-work',
    fusedWith: 'water-draw',
  };
}

export function buildStageReport(
  stages: readonly StageEntry[],
  presentationP95Ms: number | null,
): {
  readonly stages: readonly StageEntry[];
  readonly summedStageMs: number | null;
  readonly sumIsFrameTime: false;
  readonly equalPresentationIsEqualCost: false;
  readonly presentationP95Ms: number | null;
} {
  const measured = stages.filter((stage) => typeof stage.ms === 'number');
  const summedStageMs = measured.length === 0
    ? null
    : measured.reduce((sum, stage) => sum + (stage.ms ?? 0), 0);
  return {
    stages,
    summedStageMs,
    sumIsFrameTime: false,
    equalPresentationIsEqualCost: false,
    presentationP95Ms,
  };
}

export interface RouteCostSample {
  readonly id: string;
  readonly fps: number;
  readonly presentationP95Ms: number;
  readonly completedWorkMs: number | null;
  readonly gpuMs: number | null;
}

export function buildRefreshSaturatedComparison(routes: readonly RouteCostSample[]): {
  readonly equalPresentationIsEqualCost: false;
  readonly saturatedDisplay: boolean;
  readonly method: TimingMethod;
  readonly routes: readonly {
    readonly id: string;
    readonly fps: number;
    readonly presentationP95Ms: number;
    readonly gpuMs: number | null;
    readonly completedWorkMs: number | null;
  }[];
} {
  if (routes.length < 2) throw new Error('comparison requires two routes');
  const saturatedDisplay = routes.every((route) => route.fps === 60);
  const gpuReady = routes.every((route) => route.gpuMs !== null && Number.isFinite(route.gpuMs));
  const completedReady = routes.every((route) => (
    route.completedWorkMs !== null && Number.isFinite(route.completedWorkMs)
  ));
  if (saturatedDisplay && !gpuReady && !completedReady) {
    throw new Error('refresh-saturated comparison requires stage or completed-work samples');
  }
  const method: TimingMethod = gpuReady ? 'gpu-elapsed' : completedReady ? 'completed-work' : 'frame-intervals';
  return {
    equalPresentationIsEqualCost: false,
    saturatedDisplay,
    method,
    routes: routes.map((route) => ({
      id: route.id,
      fps: route.fps,
      presentationP95Ms: route.presentationP95Ms,
      gpuMs: gpuReady ? route.gpuMs : null,
      completedWorkMs: route.completedWorkMs,
    })),
  };
}

export function judgePairDelta(
  aMs: number,
  bMs: number,
  noiseMs: number,
  quantumMs: number,
): 'a-lower' | 'b-lower' | 'inconclusive' {
  const limit = Math.max(0, noiseMs, quantumMs);
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs) || Math.abs(aMs - bMs) <= limit) return 'inconclusive';
  return aMs < bMs ? 'a-lower' : 'b-lower';
}

export function runPairedStageSample<T>(input: {
  readonly rounds?: number;
  readonly screenRecord?: boolean;
  readonly measure: (round: number) => { readonly workMs: number; readonly totalMs: number; readonly raw: T };
}): {
  readonly rounds: readonly {
    readonly round: number;
    readonly workMs: number;
    readonly totalMs: number;
    readonly overheadMs: number;
    readonly raw: T;
  }[];
  readonly screenRecorded: false;
} {
  if (input.screenRecord) throw new Error('timing round cannot include screen recording');
  const count = input.rounds ?? PAIRED_ROUND_COUNT;
  const rounds = [];
  for (let round = 0; round < count; round += 1) {
    const sample = input.measure(round);
    rounds.push({
      round,
      workMs: sample.workMs,
      totalMs: sample.totalMs,
      overheadMs: sample.totalMs - sample.workMs,
      raw: sample.raw,
    });
  }
  return { rounds, screenRecorded: false };
}

export interface PassResourceStat {
  readonly draws: number;
  readonly triangles: number;
  readonly dispatches?: number;
  readonly targetWidth: number;
  readonly targetHeight: number;
  readonly uploadBytes?: number;
}

export function aggregatePassResources(passes: readonly PassResourceStat[]): {
  readonly draws: number;
  readonly triangles: number;
  readonly dispatches: number;
  readonly uploadBytes: number;
  readonly targets: readonly { readonly width: number; readonly height: number }[];
  readonly byteEstimateKind: 'budget';
  readonly claimsHardwarePeak: false;
  readonly claimsBandwidth: false;
} {
  return {
    draws: passes.reduce((sum, pass) => sum + pass.draws, 0),
    triangles: passes.reduce((sum, pass) => sum + pass.triangles, 0),
    dispatches: passes.reduce((sum, pass) => sum + (pass.dispatches ?? 0), 0),
    uploadBytes: passes.reduce((sum, pass) => sum + (pass.uploadBytes ?? 0), 0),
    targets: passes.map((pass) => ({ width: pass.targetWidth, height: pass.targetHeight })),
    byteEstimateKind: 'budget',
    claimsHardwarePeak: false,
    claimsBandwidth: false,
  };
}

export function selectBoundMarineContext<T extends { readonly id: string }>(
  canvases: readonly T[],
  boundId: string,
): T {
  const match = canvases.find((canvas) => canvas.id === boundId);
  if (!match) throw new Error(`marine renderer ${boundId} was not found`);
  return match;
}

function createViewportBox(): ViewportBox {
  return {
    x: 0,
    y: 0,
    z: 0,
    w: 0,
    copy(source) {
      this.x = source.x;
      this.y = source.y;
      this.z = source.z;
      this.w = source.w;
      return this;
    },
  };
}

function sameBox(left: ViewportBox, right: ViewportBox): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z && left.w === right.w;
}

export async function measureOffscreenBatch<T>(
  renderer: OffscreenRenderer,
  options: {
    readonly maxBatch: number;
    readonly createTarget: (width: number, height: number) => T;
    readonly draw: (index: number, target: T) => number | Promise<number>;
  },
): Promise<{
  readonly executedBatch: number;
  readonly requestedBatch: number;
  readonly capped: boolean;
  readonly width: number;
  readonly height: number;
  readonly checksums: readonly number[];
  readonly workObserved: boolean;
  readonly wallClockMs: number;
  readonly overheadMs: number;
  readonly observedDraws: number | null;
  readonly observedTriangles: number | null;
  readonly method: 'completed-work';
  readonly gpuMs: null;
  readonly screenRecorded: false;
}> {
  if (!Number.isInteger(options.maxBatch) || options.maxBatch < 2) {
    throw new Error('offscreen batch requires at least two draws');
  }
  const savedTarget = renderer.getRenderTarget();
  const savedViewport = createViewportBox();
  renderer.getViewport(savedViewport);
  const savedScissor = createViewportBox();
  renderer.getScissor(savedScissor);
  const savedScissorTest = renderer.getScissorTest();
  if (!(savedViewport.z > 0) || !(savedViewport.w > 0)) {
    throw new Error('offscreen batch requires the bound viewport size');
  }
  const executedBatch = Math.min(options.maxBatch, MAX_OFFSCREEN_BATCH);
  const drawsBefore = renderer.info?.render.calls ?? null;
  const trianglesBefore = renderer.info?.render.triangles ?? null;
  let setupMs = 0;
  let wallClockMs = 0;
  let restoreMs = 0;
  const checksums: number[] = [];
  let thrown: unknown = null;
  try {
    const setupStarted = performance.now();
    const target = options.createTarget(savedViewport.z, savedViewport.w);
    renderer.setRenderTarget(target);
    setupMs = performance.now() - setupStarted;
    const workStarted = performance.now();
    for (let index = 0; index < executedBatch; index += 1) {
      checksums.push(await options.draw(index, target));
    }
    wallClockMs = performance.now() - workStarted;
  } catch (error) {
    thrown = error;
  } finally {
    const restoreStarted = performance.now();
    renderer.setRenderTarget(savedTarget);
    renderer.setViewport(savedViewport.x, savedViewport.y, savedViewport.z, savedViewport.w);
    renderer.setScissor(savedScissor.x, savedScissor.y, savedScissor.z, savedScissor.w);
    renderer.setScissorTest(savedScissorTest);
    restoreMs = performance.now() - restoreStarted;
  }
  const afterViewport = createViewportBox();
  renderer.getViewport(afterViewport);
  const afterScissor = createViewportBox();
  renderer.getScissor(afterScissor);
  if (
    renderer.getRenderTarget() !== savedTarget
    || !sameBox(afterViewport, savedViewport)
    || !sameBox(afterScissor, savedScissor)
    || renderer.getScissorTest() !== savedScissorTest
  ) {
    throw new Error('offscreen batch did not restore renderer state');
  }
  if (thrown) throw thrown;
  const drawsAfter = renderer.info?.render.calls ?? null;
  const trianglesAfter = renderer.info?.render.triangles ?? null;
  const workObserved = checksums.length >= 2
    && checksums.every((value) => Number.isFinite(value))
    && checksums.some((value) => value !== checksums[0]);
  return {
    executedBatch,
    requestedBatch: options.maxBatch,
    capped: options.maxBatch > MAX_OFFSCREEN_BATCH,
    width: savedViewport.z,
    height: savedViewport.w,
    checksums,
    workObserved,
    wallClockMs,
    overheadMs: setupMs + restoreMs,
    observedDraws: drawsBefore === null || drawsAfter === null ? null : drawsAfter - drawsBefore,
    observedTriangles: trianglesBefore === null || trianglesAfter === null ? null : trianglesAfter - trianglesBefore,
    method: 'completed-work',
    gpuMs: null,
    screenRecorded: false,
  };
}

const FENCE_WAIT_MS = 2000;
const QUERY_RESULT_AVAILABLE = 0x8867;
const QUERY_RESULT = 0x8866;

interface DisjointTimerExt {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

interface QueryRecordingContext extends WebGL2TimerContext {
  createQuery(): unknown;
  beginQuery(target: number, query: unknown): void;
  endQuery(target: number): void;
  deleteQuery(query: unknown): void;
  getQueryParameter(query: unknown, pname: number): unknown;
  getParameter(pname: number): unknown;
  readonly QUERY_RESULT_AVAILABLE?: number;
  readonly QUERY_RESULT?: number;
}

interface IssuedQuery {
  readonly query: unknown;
  readonly wallClockMs: number;
}

function canIssueDisjointQuery(
  gl: WebGL2TimerContext | null,
  extension: DisjointTimerExt | null,
): gl is QueryRecordingContext {
  if (!gl || !extension) return false;
  const candidate = gl as Partial<QueryRecordingContext>;
  return typeof candidate.createQuery === 'function'
    && typeof candidate.beginQuery === 'function'
    && typeof candidate.endQuery === 'function'
    && typeof candidate.getQueryParameter === 'function'
    && typeof candidate.deleteQuery === 'function'
    && typeof candidate.getParameter === 'function';
}

function canResolvePassTimestamps(renderer: MarineStageRenderer, periodNs: number | null): renderer is TimestampResolvingRenderer {
  return periodNs !== null && typeof (renderer as TimestampResolvingRenderer).resolveTimestampsAsync === 'function';
}

async function waitForWebGlCompletion(gl: WebGL2TimerContext): Promise<boolean> {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!sync) return false;
  gl.flush();
  const deadline = performance.now() + FENCE_WAIT_MS;
  try {
    while (performance.now() < deadline) {
      const status = gl.clientWaitSync(sync, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return true;
      if (status === gl.WAIT_FAILED) return false;
      await new Promise((resolve) => {
        setTimeout(resolve, 1);
      });
    }
    return false;
  } finally {
    gl.deleteSync(sync);
  }
}

export function bindMarineStageTimer(renderer: MarineStageRenderer): StageTimerBinding {
  const gl = (() => {
    try {
      return renderer.getContext();
    } catch {
      return null;
    }
  })();
  const webgl = isWebGL2Context(gl) ? gl : null;
  const device = readDevice(renderer);
  const extension = webgl?.getExtension('EXT_disjoint_timer_query_webgl2') ?? null;
  const timestampFeature = Boolean(device?.features?.has('timestamp-query'));
  const timestampPeriod = timestampFeature ? finiteOrNull(device?.limits?.timestampPeriod ?? null) : null;
  const queryGl = canIssueDisjointQuery(webgl, extension) ? webgl : null;
  const canDisjoint = queryGl !== null;
  const canTimestamp = !canDisjoint && timestampFeature && canResolvePassTimestamps(renderer, timestampPeriod);
  const method: 'gpu-elapsed' | 'completed-work' = canDisjoint || canTimestamp ? 'gpu-elapsed' : 'completed-work';
  const quantizationNs = canDisjoint ? 1 : canTimestamp ? timestampPeriod : null;
  let queryOpen = false;
  let queryStartedAt = 0;
  let issued: IssuedQuery | null = null;
  let latestSample: TimingSample | null = null;

  function remember(sample: TimingSample): TimingSample {
    latestSample = sample;
    return sample;
  }

  async function measureCompletedWork(work: () => void | Promise<void>): Promise<TimingSample> {
    const started = performance.now();
    await work();
    let waited = false;
    if (webgl) waited = await waitForWebGlCompletion(webgl);
    else if (device?.queue?.onSubmittedWorkDone) {
      await device.queue.onSubmittedWorkDone();
      waited = true;
    }
    const wallMs = performance.now() - started;
    if (!waited) return remember(separateCpuSubmit(wallMs));
    return remember({
      gpuMs: null,
      completedWorkMs: wallMs,
      frameIntervalMs: null,
      method: 'completed-work',
      reason: 'wall-clock',
      quantizationNs: null,
      rawGpuNs: null,
      treatedAsFree: false,
      disjointDropped: false,
      labeledAs: 'submit-to-complete-wall-clock',
    });
  }

  function beginQuery(): void {
    if (queryOpen) throw new Error('stage timer queries must not nest');
    queryOpen = true;
    queryStartedAt = performance.now();
    if (!queryGl || !extension || marineGpuTimerPassActive()) return;
    const query = queryGl.createQuery();
    if (!query) return;
    marineGpuTimerHoldDisjointQuery(true);
    try {
      queryGl.beginQuery(extension.TIME_ELAPSED_EXT, query);
    } catch (error) {
      queryOpen = false;
      marineGpuTimerHoldDisjointQuery(false);
      queryGl.deleteQuery(query);
      throw error;
    }
    issued = { query, wallClockMs: 0 };
  }

  function endQuery(): void {
    if (!queryOpen) throw new Error('stage timer query is not open');
    queryOpen = false;
    const wallClockMs = performance.now() - queryStartedAt;
    marineGpuTimerHoldDisjointQuery(false);
    if (!queryGl || !extension || !issued) return;
    queryGl.endQuery(extension.TIME_ELAPSED_EXT);
    issued = { query: issued.query, wallClockMs };
  }

  function poll(): TimingSample | null {
    if (!queryGl || !extension || !issued || queryOpen) return null;
    const disjoint = Boolean(extension.GPU_DISJOINT_EXT) && Boolean(queryGl.getParameter(extension.GPU_DISJOINT_EXT));
    if (disjoint) {
      queryGl.deleteQuery(issued.query);
      const wallClockMs = issued.wallClockMs;
      issued = null;
      return remember(acceptTimingSample({
        gpuElapsedNs: null,
        quantumNs: quantizationNs,
        disjoint: true,
        completedWorkMs: wallClockMs,
        frameIntervalMs: null,
      }));
    }
    const availableName = queryGl.QUERY_RESULT_AVAILABLE ?? QUERY_RESULT_AVAILABLE;
    const resultName = queryGl.QUERY_RESULT ?? QUERY_RESULT;
    if (!queryGl.getQueryParameter(issued.query, availableName)) return null;
    const raw = queryGl.getQueryParameter(issued.query, resultName);
    queryGl.deleteQuery(issued.query);
    const wallClockMs = issued.wallClockMs;
    issued = null;
    const gpuElapsedNs = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    return remember(acceptTimingSample({
      gpuElapsedNs,
      quantumNs: quantizationNs,
      disjoint: false,
      completedWorkMs: wallClockMs,
      frameIntervalMs: null,
    }));
  }

  function discardIssuedQuery(): void {
    if (queryGl && issued) queryGl.deleteQuery(issued.query);
    issued = null;
    marineGpuTimerHoldDisjointQuery(false);
  }

  async function collectDisjointRound(work: () => void | Promise<void>): Promise<TimingSample> {
    if (marineGpuTimerPassActive()) return measureCompletedWork(work);
    beginQuery();
    try {
      await work();
    } catch (error) {
      if (queryOpen) endQuery();
      discardIssuedQuery();
      throw error;
    }
    if (queryOpen) endQuery();
    if (!issued) return measureCompletedWork(work);
    const deadline = performance.now() + FENCE_WAIT_MS;
    while (performance.now() < deadline) {
      const sample = poll();
      if (sample?.method === 'gpu-elapsed' && sample.gpuMs !== null && !sample.disjointDropped) return sample;
      if (sample) return measureCompletedWork(work);
      await new Promise((resolve) => {
        setTimeout(resolve, 1);
      });
    }
    discardIssuedQuery();
    return measureCompletedWork(work);
  }

  async function collectTimestampRound(work: () => void | Promise<void>): Promise<TimingSample> {
    const resolving = renderer as TimestampResolvingRenderer;
    if (!canTimestamp || timestampPeriod === null || !resolving.resolveTimestampsAsync) {
      return measureCompletedWork(work);
    }
    const backend = resolving.backend;
    const previousTracking = backend?.trackTimestamp;
    if (backend) backend.trackTimestamp = true;
    const started = performance.now();
    let workFinished = false;
    try {
      await work();
      workFinished = true;
      const durationMs = await resolving.resolveTimestampsAsync('render');
      const wallClockMs = performance.now() - started;
      const gpuElapsedNs = typeof durationMs === 'number' && Number.isFinite(durationMs)
        ? durationMs * 1e6
        : null;
      return remember(acceptTimingSample({
        gpuElapsedNs,
        quantumNs: timestampPeriod,
        disjoint: false,
        completedWorkMs: wallClockMs,
        frameIntervalMs: null,
      }));
    } catch (error) {
      if (!workFinished) throw error;
      return remember(separateCpuSubmit(performance.now() - started));
    } finally {
      if (backend) backend.trackTimestamp = previousTracking ?? false;
    }
  }

  const binding: StageTimerBinding = {
    describe() {
      return {
        method,
        extension: canDisjoint
          ? 'disjoint-time-elapsed'
          : timestampFeature
            ? 'timestamp-query'
            : 'none',
        quantizationNs,
        gpuTimeAvailable: canDisjoint || canTimestamp,
        contextIdentity: rendererIdentity(renderer),
        defaultStages: [
          recordFusedWaveDraw(),
          {
            id: 'water-draw',
            ms: null,
            method,
            fusedWith: 'wave-generate',
          },
        ],
      };
    },
    beginQuery() {
      beginQuery();
    },
    endQuery() {
      endQuery();
    },
    poll,
    latest: () => latestSample,
    async collectRound(work) {
      if (canDisjoint) return collectDisjointRound(work);
      if (canTimestamp) return collectTimestampRound(work);
      return measureCompletedWork(work);
    },
    accept(sample) {
      return acceptTimingSample({
        gpuElapsedNs: sample.gpuElapsedNs,
        quantumNs: sample.quantumNs === undefined ? quantizationNs : sample.quantumNs,
        disjoint: sample.disjoint ?? false,
        completedWorkMs: sample.completedWorkMs ?? null,
        frameIntervalMs: sample.frameIntervalMs ?? null,
      });
    },
    measureCompletedWork,
  };
  return binding;
}

export async function collectStageWindow(
  binding: StageTimerBinding,
  work: () => void | Promise<void>,
): Promise<{
  readonly rounds: readonly TimingSample[];
  readonly screenRecorded: false;
}> {
  const rounds = [];
  for (let round = 0; round < PAIRED_ROUND_COUNT; round += 1) {
    rounds.push(await binding.collectRound(work));
  }
  return { rounds, screenRecorded: false };
}

export function buildLocalStageSample(input: {
  readonly routes: readonly RouteCostSample[];
  readonly pointQueryRawMs: number;
  readonly worker: {
    readonly computeMs: number;
    readonly queueMs: number;
    readonly e2eMs: number;
    readonly resultAgeSeconds: number;
    readonly initMs?: number | null;
  };
  readonly paired: ReturnType<typeof runPairedStageSample>;
  readonly delta: { readonly aMs: number; readonly bMs: number; readonly noiseMs: number; readonly quantumMs: number };
  readonly stages: readonly StageEntry[];
}): {
  readonly comparison: ReturnType<typeof buildRefreshSaturatedComparison>;
  readonly pointQuery: ReturnType<typeof labelPointQuerySample>;
  readonly worker: ReturnType<typeof assembleWorkerQueryReport>;
  readonly paired: ReturnType<typeof runPairedStageSample>;
  readonly judgment: ReturnType<typeof judgePairDelta>;
  readonly stages: ReturnType<typeof buildStageReport>;
  readonly screenRecorded: false;
} {
  if (input.paired.screenRecorded !== false) {
    throw new Error('timing round cannot include screen recording');
  }
  return {
    comparison: buildRefreshSaturatedComparison(input.routes),
    pointQuery: labelPointQuerySample(input.pointQueryRawMs),
    worker: assembleWorkerQueryReport(input.worker),
    paired: input.paired,
    judgment: judgePairDelta(input.delta.aMs, input.delta.bMs, input.delta.noiseMs, input.delta.quantumMs),
    stages: buildStageReport(input.stages, input.routes[0]?.presentationP95Ms ?? null),
    screenRecorded: false,
  };
}
