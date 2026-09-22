import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  MAIN_THREAD_POINT_QUERY_KIND,
  HISTORICAL_POINT_QUERY_RAW_MS,
  HISTORICAL_PRESENTATION_P95_MS,
  MAX_OFFSCREEN_BATCH,
  acceptTimingSample,
  aggregatePassResources,
  assembleWorkerQueryReport,
  bindMarineStageTimer,
  buildLocalStageSample,
  buildRefreshSaturatedComparison,
  buildStageReport,
  judgePairDelta,
  labelPointQuerySample,
  measureOffscreenBatch,
  recordFusedWaveDraw,
  runPairedStageSample,
  selectBoundMarineContext,
  separateCpuSubmit,
  type OffscreenRenderer,
  type ViewportBox,
} from '@/resources/simulations/scene/quality/stage-performance';

const ROOT = process.cwd();

function createBox(x: number, y: number, z: number, w: number): ViewportBox {
  return {
    x,
    y,
    z,
    w,
    copy(source) {
      this.x = source.x;
      this.y = source.y;
      this.z = source.z;
      this.w = source.w;
      return this;
    },
  };
}

function createOffscreenRenderer(width = 640, height = 360): OffscreenRenderer & {
  readonly viewport: ViewportBox;
  readonly scissor: ViewportBox;
  readonly info: { render: { calls: number; triangles: number } };
  target: unknown;
  scissorTest: boolean;
} {
  const viewport = createBox(2, 4, width, height);
  const scissor = createBox(1, 3, width - 8, height - 6);
  const info = { render: { calls: 5, triangles: 100 } };
  const renderer = {
    viewport,
    scissor,
    info,
    target: { id: 'screen' } as unknown,
    scissorTest: true,
    getRenderTarget() {
      return this.target;
    },
    setRenderTarget(target: unknown) {
      this.target = target;
    },
    getViewport(target: ViewportBox) {
      return target.copy(this.viewport);
    },
    setViewport(x: number, y: number, nextWidth: number, nextHeight: number) {
      this.viewport.x = x;
      this.viewport.y = y;
      this.viewport.z = nextWidth;
      this.viewport.w = nextHeight;
    },
    getScissor(target: ViewportBox) {
      return target.copy(this.scissor);
    },
    setScissor(x: number, y: number, nextWidth: number, nextHeight: number) {
      this.scissor.x = x;
      this.scissor.y = y;
      this.scissor.z = nextWidth;
      this.scissor.w = nextHeight;
    },
    getScissorTest() {
      return this.scissorTest;
    },
    setScissorTest(enabled: boolean) {
      this.scissorTest = enabled;
    },
  };
  return renderer;
}

describe('stage timing labels (#2135)', () => {
  it('keeps a valid elapsed query and does not copy the frame interval into it', () => {
    const sample = acceptTimingSample({
      gpuElapsedNs: 2_500_000,
      quantumNs: 1,
      disjoint: false,
      completedWorkMs: 4,
      frameIntervalMs: 16.7,
    });
    expect(sample.method).toBe('gpu-elapsed');
    expect(sample.gpuMs).toBeCloseTo(2.5);
    expect(sample.frameIntervalMs).toBe(16.7);
    expect(sample.gpuMs).not.toBe(sample.frameIntervalMs);
    expect(sample.treatedAsFree).toBe(false);
  });

  it('drops disjoint, sub-quantum and non-positive timestamps instead of calling them free', () => {
    const disjoint = acceptTimingSample({
      gpuElapsedNs: 8_000_000,
      quantumNs: 1,
      disjoint: true,
      completedWorkMs: 3,
      frameIntervalMs: null,
    });
    expect(disjoint.gpuMs).toBeNull();
    expect(disjoint.rawGpuNs).toBeNull();
    expect(disjoint.disjointDropped).toBe(true);
    expect(disjoint.method).toBe('completed-work');
    expect(disjoint.completedWorkMs).toBe(3);

    const below = acceptTimingSample({
      gpuElapsedNs: 40,
      quantumNs: 100,
      disjoint: false,
      completedWorkMs: 1.4,
      frameIntervalMs: 17.4,
    });
    expect(below.gpuMs).toBeNull();
    expect(below.reason).toBe('below-quantum');
    expect(below.rawGpuNs).toBe(40);
    expect(below.treatedAsFree).toBe(false);
    expect(below.completedWorkMs).toBe(1.4);

    const zero = acceptTimingSample({
      gpuElapsedNs: 0,
      quantumNs: 1,
      disjoint: false,
      completedWorkMs: null,
      frameIntervalMs: 17.4,
    });
    expect(zero.gpuMs).toBeNull();
    expect(zero.reason).toBe('non-positive');
    expect(zero.method).toBe('frame-intervals');
    expect(zero.treatedAsFree).toBe(false);
  });

  it('continues with a labeled completed-work sample when the timer is missing', () => {
    const missing = acceptTimingSample({
      gpuElapsedNs: null,
      quantumNs: null,
      disjoint: false,
      completedWorkMs: 6.25,
      frameIntervalMs: HISTORICAL_PRESENTATION_P95_MS,
    });
    expect(missing.method).toBe('completed-work');
    expect(missing.reason).toBe('timer-unavailable');
    expect(missing.gpuMs).toBeNull();
    expect(missing.rawGpuNs).toBeNull();
    expect(missing.completedWorkMs).toBe(6.25);
    expect(missing.frameIntervalMs).toBe(HISTORICAL_PRESENTATION_P95_MS);
  });

  it('keeps CPU submit time out of the GPU elapsed field', () => {
    const sample = separateCpuSubmit(3.5);
    expect(sample.labeledAs).toBe('cpu-submit');
    expect(sample.completedWorkMs).toBe(3.5);
    expect(sample.gpuMs).toBeNull();
    expect(sample.method).toBe('completed-work');
    expect(JSON.stringify(sample)).not.toContain('"gpuMs":3.5');
  });
});

describe('worker and historical query口径 (#2135)', () => {
  it('preserves the 1.12ms raw as a main-thread reference call', () => {
    expect(HISTORICAL_POINT_QUERY_RAW_MS).toBe(1.12);
    const historical = labelPointQuerySample(HISTORICAL_POINT_QUERY_RAW_MS);
    expect(historical.rawMs).toBe(1.12);
    expect(historical.kind).toBe(MAIN_THREAD_POINT_QUERY_KIND);
    expect(historical.kind).toBe('main-thread-reference-call');
    expect(historical.workerE2eMs).toBeNull();
    const other = labelPointQuerySample(2.5);
    expect(other.rawMs).toBe(2.5);
    expect(other.kind).toBe('main-thread-reference-call');
    expect(other.workerE2eMs).toBeNull();
  });

  it('splits worker compute, queue, transfer and result age without charging init per query', () => {
    const report = assembleWorkerQueryReport({
      computeMs: 4.5,
      queueMs: 1.25,
      e2eMs: 7,
      resultAgeSeconds: 0.4,
      initMs: 80,
    });
    expect(report.kind).toBe('worker-batch');
    expect(report.computeMs).toBe(4.5);
    expect(report.queueMs).toBe(1.25);
    expect(report.transferMs).toBeCloseTo(1.25);
    expect(report.e2eMs).toBe(7);
    expect(report.resultAgeSeconds).toBe(0.4);
    expect(report.initMs).toBe(80);
    expect(report.initChargedPerQuery).toBe(false);
    expect(report.computeMs).not.toBe(report.computeMs + report.initMs);
  });

  it('does not treat fused wave generation as its own frame time', () => {
    const stages = buildStageReport([recordFusedWaveDraw()], HISTORICAL_PRESENTATION_P95_MS);
    expect(stages.stages[0]?.ms).toBeNull();
    expect(stages.stages[0]?.fusedWith).toBe('water-draw');
    expect(stages.summedStageMs).toBeNull();
    expect(stages.sumIsFrameTime).toBe(false);
    expect(stages.equalPresentationIsEqualCost).toBe(false);
    expect(stages.presentationP95Ms).toBe(17.4);
  });
});

describe('offscreen throughput and renderer binding (#2135)', () => {
  it('binds the marine renderer rather than the first canvas', () => {
    const chart = { id: 'chart', getContext: () => null };
    const marineGl = {
      getExtension: () => ({ TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }),
      fenceSync: () => ({}),
      flush: () => undefined,
      clientWaitSync: () => 0,
      deleteSync: () => undefined,
      SYNC_GPU_COMMANDS_COMPLETE: 1,
      ALREADY_SIGNALED: 2,
      CONDITION_SATISFIED: 3,
      TIMEOUT_EXPIRED: 4,
      WAIT_FAILED: 5,
    };
    const marine = { id: 'marine', getContext: () => marineGl };
    const canvases = [chart, marine];
    const bound = selectBoundMarineContext(canvases, 'marine');
    expect(bound).toBe(marine);
    expect(bound).not.toBe(canvases[0]);
    const chartTimer = bindMarineStageTimer(chart);
    const marineTimer = bindMarineStageTimer(bound);
    expect(chartTimer.describe().contextIdentity).not.toBe(marineTimer.describe().contextIdentity);
    expect(marineTimer.describe().extension).toBe('disjoint-time-elapsed');
    expect(marineTimer.describe().quantizationNs).toBe(1);
    expect(marineTimer.describe().gpuTimeAvailable).toBe(true);
    expect(chartTimer.describe().method).toBe('completed-work');
    expect(chartTimer.describe().gpuTimeAvailable).toBe(false);
    expect(JSON.stringify(chartTimer.describe())).not.toContain('gpuMs');
  });

  it('uses a WebGPU timestamp period when the device already exposes it', () => {
    const features = new Set<string>();
    const device = {
      features: { has: (name: string) => features.has(name) },
      limits: { timestampPeriod: 41.6 },
      queue: { onSubmittedWorkDone: () => Promise.resolve() },
    };
    const without = bindMarineStageTimer({ getContext: () => null, device });
    expect(without.describe().gpuTimeAvailable).toBe(false);
    expect(without.describe().extension).toBe('none');
    features.add('timestamp-query');
    const withQuery = bindMarineStageTimer({ getContext: () => null, device });
    expect(withQuery.describe().extension).toBe('timestamp-query');
    expect(withQuery.describe().quantizationNs).toBe(41.6);
    expect(withQuery.describe().gpuTimeAvailable).toBe(true);
    expect(withQuery.describe().defaultStages[0]?.fusedWith).toBe('water-draw');
    expect(withQuery.describe().defaultStages[0]?.ms).toBeNull();
  });

  it('refuses nested stage queries', () => {
    const timer = bindMarineStageTimer({ getContext: () => null });
    timer.beginQuery();
    expect(() => timer.beginQuery()).toThrow(/must not nest/);
    timer.endQuery();
    expect(() => timer.endQuery()).toThrow(/not open/);
  });

  it('renders a capped same-size batch, observes changing output, and restores state', () => {
    const renderer = createOffscreenRenderer(800, 450);
    const screen = renderer.target;
    let created: { width: number; height: number } | null = null;
    const result = measureOffscreenBatch(renderer, {
      maxBatch: 100,
      createTarget(width, height) {
        const started = performance.now();
        while (performance.now() - started < 15) {
          // 测量开关耗时与绘制耗时分开。
        }
        created = { width, height };
        return created;
      },
      draw(index, target) {
        expect(target).toBe(created);
        renderer.setViewport(0, 0, 1, 1);
        renderer.setScissor(0, 0, 2, 2);
        renderer.setScissorTest(false);
        renderer.info.render.calls += 2;
        renderer.info.render.triangles += 10;
        return index * 3 + 1;
      },
    });
    expect(created).toEqual({ width: 800, height: 450 });
    expect(result.requestedBatch).toBe(100);
    expect(result.executedBatch).toBe(MAX_OFFSCREEN_BATCH);
    expect(result.capped).toBe(true);
    expect(result.workObserved).toBe(true);
    expect(result.checksums).toHaveLength(MAX_OFFSCREEN_BATCH);
    expect(result.method).toBe('completed-work');
    expect(result.gpuMs).toBeNull();
    expect(result.screenRecorded).toBe(false);
    expect(result.overheadMs).toBeGreaterThanOrEqual(10);
    expect(result.wallClockMs).toBeLessThan(result.overheadMs);
    expect(result.observedDraws).toBe(MAX_OFFSCREEN_BATCH * 2);
    expect(result.observedTriangles).toBe(MAX_OFFSCREEN_BATCH * 10);
    expect(renderer.target).toBe(screen);
    expect(renderer.viewport).toMatchObject({ x: 2, y: 4, z: 800, w: 450 });
    expect(renderer.scissor).toMatchObject({ x: 1, y: 3, z: 792, w: 444 });
    expect(renderer.scissorTest).toBe(true);
  });

  it('rejects an unchanged batch as unobserved work and still restores after a draw failure', () => {
    const unchanged = createOffscreenRenderer();
    const flat = measureOffscreenBatch(unchanged, {
      maxBatch: 4,
      createTarget: () => ({ id: 'off' }),
      draw: () => 7,
    });
    expect(flat.workObserved).toBe(false);
    expect(flat.gpuMs).toBeNull();

    const renderer = createOffscreenRenderer();
    const screen = renderer.target;
    expect(() => measureOffscreenBatch(renderer, {
      maxBatch: 4,
      createTarget: () => ({ id: 'off' }),
      draw(index) {
        renderer.setViewport(9, 9, 9, 9);
        if (index === 1) throw new Error('draw failed');
        return index;
      },
    })).toThrow(/draw failed/);
    expect(renderer.target).toBe(screen);
    expect(renderer.viewport).toMatchObject({ x: 2, y: 4, z: 640, w: 360 });
  });

  it('waits for submitted work without labeling that wall clock as GPU elapsed', async () => {
    const calls: string[] = [];
    const gl = {
      getExtension: () => null,
      fenceSync() {
        calls.push('fence');
        return { id: 'sync' };
      },
      flush() {
        calls.push('flush');
      },
      clientWaitSync() {
        calls.push('wait');
        return this.ALREADY_SIGNALED;
      },
      deleteSync() {
        calls.push('delete');
      },
      finish() {
        calls.push('finish');
      },
      readPixels() {
        calls.push('readPixels');
      },
      SYNC_GPU_COMMANDS_COMPLETE: 1,
      ALREADY_SIGNALED: 2,
      CONDITION_SATISFIED: 3,
      TIMEOUT_EXPIRED: 4,
      WAIT_FAILED: 5,
    };
    const timer = bindMarineStageTimer({ getContext: () => gl });
    let worked = false;
    const sample = await timer.measureCompletedWork(() => {
      worked = true;
    });
    expect(worked).toBe(true);
    expect(calls).toEqual(['fence', 'flush', 'wait', 'delete']);
    expect(sample.gpuMs).toBeNull();
    expect(sample.labeledAs).toBe('submit-to-complete-wall-clock');
    expect(sample.reason).toBe('wall-clock');
    expect(sample.method).toBe('completed-work');
    expect(sample.completedWorkMs).toBeGreaterThanOrEqual(0);

    let submitted = false;
    const gpuTimer = bindMarineStageTimer({
      getContext: () => null,
      device: {
        queue: {
          onSubmittedWorkDone: () => {
            submitted = true;
            return Promise.resolve();
          },
        },
      },
    });
    const gpuSample = await gpuTimer.measureCompletedWork(() => undefined);
    expect(submitted).toBe(true);
    expect(gpuSample.gpuMs).toBeNull();
    expect(gpuSample.labeledAs).toBe('submit-to-complete-wall-clock');
  });
});

describe('local paired sample (#2135)', () => {
  it('keeps raw presentation and point-query numbers, overhead, and an inconclusive delta', () => {
    const renderer = createOffscreenRenderer(320, 180);
    const batch = measureOffscreenBatch(renderer, {
      maxBatch: 4,
      createTarget: (width, height) => ({ width, height }),
      draw: (index) => index + 1,
    });
    expect(batch.workObserved).toBe(true);
    const paired = runPairedStageSample({
      measure: (round) => ({
        workMs: batch.wallClockMs,
        totalMs: batch.wallClockMs + batch.overheadMs + round,
        raw: { presentationP95Ms: HISTORICAL_PRESENTATION_P95_MS, checksums: batch.checksums.length },
      }),
    });
    expect(paired.rounds).toHaveLength(3);
    expect(paired.screenRecorded).toBe(false);
    expect(paired.rounds[2]?.overheadMs).toBeCloseTo(batch.overheadMs + 2);
    expect(() => runPairedStageSample({
      screenRecord: true,
      measure: () => ({ workMs: 1, totalMs: 2, raw: null }),
    })).toThrow(/screen recording/);

    const sample = buildLocalStageSample({
      routes: [
        {
          id: 'webgl-fft',
          fps: 60,
          presentationP95Ms: HISTORICAL_PRESENTATION_P95_MS,
          completedWorkMs: batch.wallClockMs + 4,
          gpuMs: null,
        },
        {
          id: 'webgl-gerstner',
          fps: 60,
          presentationP95Ms: HISTORICAL_PRESENTATION_P95_MS,
          completedWorkMs: batch.wallClockMs + 9,
          gpuMs: null,
        },
      ],
      pointQueryRawMs: HISTORICAL_POINT_QUERY_RAW_MS,
      worker: { computeMs: 4.5, queueMs: 1.25, e2eMs: 7, resultAgeSeconds: 0.2, initMs: 40 },
      paired,
      delta: { aMs: 10, bMs: 10.2, noiseMs: 0.5, quantumMs: 0.1 },
      stages: [recordFusedWaveDraw()],
    });
    expect(sample.comparison.saturatedDisplay).toBe(true);
    expect(sample.comparison.equalPresentationIsEqualCost).toBe(false);
    expect(sample.comparison.method).toBe('completed-work');
    expect(sample.comparison.routes[0]?.presentationP95Ms).toBe(17.4);
    expect(sample.comparison.routes[0]?.gpuMs).toBeNull();
    expect(sample.comparison.routes[1]?.completedWorkMs).not.toBe(sample.comparison.routes[0]?.completedWorkMs);
    expect(sample.pointQuery.rawMs).toBe(1.12);
    expect(sample.pointQuery.workerE2eMs).toBeNull();
    expect(sample.worker.initChargedPerQuery).toBe(false);
    expect(sample.worker.computeMs).toBe(4.5);
    expect(sample.judgment).toBe('inconclusive');
    expect(judgePairDelta(10, 14, 0.5, 0.1)).toBe('a-lower');
    expect(sample.stages.sumIsFrameTime).toBe(false);
    expect(sample.screenRecorded).toBe(false);
    expect(() => buildRefreshSaturatedComparison([
      { id: 'a', fps: 60, presentationP95Ms: 17.4, completedWorkMs: null, gpuMs: null },
      { id: 'b', fps: 60, presentationP95Ms: 17.4, completedWorkMs: null, gpuMs: null },
    ])).toThrow(/completed-work/);

    const evidenceDir = process.env.MARINE_STAGE_EVIDENCE_DIR;
    if (evidenceDir) {
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(path.join(evidenceDir, 'stage-sample.json'), JSON.stringify(sample, null, 2));
    }
  });

  it('aggregates pass draws as a budget and wires the live probe to the bound renderer', () => {
    const resources = aggregatePassResources([
      { draws: 3, triangles: 10, dispatches: 1, targetWidth: 256, targetHeight: 256, uploadBytes: 128 },
      { draws: 5, triangles: 20, dispatches: 0, targetWidth: 128, targetHeight: 64, uploadBytes: 32 },
    ]);
    expect(resources.draws).toBe(8);
    expect(resources.triangles).toBe(30);
    expect(resources.dispatches).toBe(1);
    expect(resources.uploadBytes).toBe(160);
    expect(resources.byteEstimateKind).toBe('budget');
    expect(resources.claimsHardwarePeak).toBe(false);
    expect(resources.claimsBandwidth).toBe(false);

    const quality = readFileSync(path.join(ROOT, 'src/resources/simulations/scene/quality/quality-state.tsx'), 'utf8');
    const guardAt = quality.indexOf("qaParams.includes('marine-performance')");
    const bindAt = quality.indexOf('bindMarineStageTimer(renderer)');
    expect(guardAt).toBeGreaterThan(-1);
    expect(bindAt).toBeGreaterThan(guardAt);
    expect(quality).toContain('stageTimer: (): StageTimerDescription => stageTimer.describe()');
    expect(quality).not.toContain("querySelector('canvas')");

    const surface = readFileSync(path.join(ROOT, 'src/resources/simulations/scene/water/fft-ocean-surface.tsx'), 'utf8');
    expect(surface).toContain('pointQueryKind: MAIN_THREAD_POINT_QUERY_KIND');
    const stageSource = readFileSync(path.join(ROOT, 'src/resources/simulations/scene/quality/stage-performance.ts'), 'utf8');
    expect(stageSource).not.toMatch(/\.finish\s*\(/);
    expect(stageSource).not.toMatch(/readPixels\s*\(/);

    const collector = readFileSync(path.join(ROOT, 'scripts/tests/collect-marine-fft-measurement.mjs'), 'utf8');
    const measurement = collector.slice(
      collector.indexOf('async function measurementRound'),
      collector.indexOf('async function videoRound'),
    );
    expect(measurement).toContain('pointQueryMs: rt.measurePointQueryMs(60)');
    expect(measurement).toContain('pointQueryKind: rt.pointQueryKind');
    expect(measurement).not.toContain('recordVideo');

    const client = readFileSync(path.join(ROOT, 'src/app/simulations/fft-ocean-comparison/comparison-client.tsx'), 'utf8');
    expect(client).toContain('assembleWorkerQueryReport({');
    expect(client).toContain('queryKind: report.kind');
    expect(client).toContain("queryKind: 'main-thread-fallback'");
  });
});
