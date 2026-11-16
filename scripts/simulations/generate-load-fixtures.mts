// One first-step native trajectory per vessel, shared only by the HTTP load generator.
// Generated files stay in the ignored .tmp directory.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { randomUUID, createHash } from 'node:crypto';
import { createServerVesselSession } from '@/lib/control-engine/wasm-server';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import {
  collectVesselTracePoint,
  type VesselRunEvidence,
} from '@/features/simulations/run-evidence';
import {
  uploadVesselRunEvidence,
  type VesselEvidenceProgress,
} from '@/features/simulations/evidence-upload';
import { readVesselEvidenceJson } from '@/features/ilab/course-evidence-api';
import { lngCourseAdapter } from '@/resources/simulations/experiments/course-adapter';
import { containerCourseAdapter } from '@/resources/simulations/experiments/container-course';
import { cruiseCourseAdapter } from '@/resources/simulations/experiments/cruise-course';
import { drillingCourseAdapter } from '@/resources/simulations/experiments/drilling-course';
import { icebreakerCourseAdapter } from '@/resources/simulations/experiments/icebreaker-course-adapter';
import { dredgerCourseAdapter } from '@/resources/simulations/experiments/dredger-course-adapter';
import {
  DESTROYER_COURSE_STEPS,
  VESSEL_COURSE_VERSION,
} from '@/resources/simulations/experiments/destroyer-course';
import type { VesselCourseAdapter } from '@/resources/simulations/experiments/course-adapter';

const adapters: Record<string, VesselCourseAdapter<any>> = {
  lng: lngCourseAdapter,
  container: containerCourseAdapter,
  cruise: cruiseCourseAdapter,
  drilling: drillingCourseAdapter,
  icebreaker: icebreakerCourseAdapter,
  dredger: dredgerCourseAdapter,
};
mkdirSync('.tmp/load-fixtures', { recursive: true });
const originalFetch = globalThis.fetch;
try {
  for (const key of ['destroyer', ...Object.keys(adapters)]) {
    const adapter = adapters[key];
    const step = key === 'destroyer' ? DESTROYER_COURSE_STEPS[0] : adapter.steps[0];
    const settings = adapter?.defaultSettings(1);
    const configuration =
      key === 'destroyer'
        ? DESTROYER_COURSE_STEPS[0].configuration
        : adapter.configuration(1, settings);
    const native = createServerVesselSession(configuration);
    const packets: Array<{
      endTimeS: number;
      requests: Array<{ path: string; method: string; body: any }>;
    }> = [];
    let progress: VesselEvidenceProgress = {
      runRef: '',
      reportId: 'fixture',
      experimentKey: key,
      status: 'running',
      chunkCount: 0,
      controlCount: 0,
      nativeCount: 0,
      fineCount: 0,
      lastTimeS: 0,
      parameterHash: '',
    };
    let requests: Array<{ path: string; method: string; body: any }> = [];
    globalThis.fetch = async (url, options) => {
      const path = String(url),
        method = options?.method ?? 'POST';
      const body = await readVesselEvidenceJson(new Request(`http://localhost${path}`, options));
      requests.push({ path, method, body });
      if (path.includes('/chunks'))
        return Response.json({
          reference: `simulation-cas:file:sha256:${createHash('sha256').update(JSON.stringify(body)).digest('hex')}`,
        });
      if (method === 'PUT') {
        const close = body as any;
        progress = {
          ...progress,
          controlCount: close.controlCount,
          nativeCount: close.nativeCount,
          fineCount: close.fineCount,
          lastTimeS: close.endTimeS,
          chunkCount: progress.chunkCount + close.pendingChunks.length,
          status: close.reason === 'duration' ? 'completed' : 'running',
        };
      }
      return Response.json(progress);
    };
    try {
      let frame = JSON.parse(native.read()) as VesselSessionFrame;
      const opening = structuredClone(frame.input);
      const requested =
        key === 'destroyer'
          ? { ...opening, controlMode: 'manual', feedback: 'measurement' }
          : adapter.input(1, settings, opening, frame, [], '');
      frame = JSON.parse(native.advance(0, JSON.stringify(requested)));
      const initial = structuredClone(frame.input),
        id = randomUUID(),
        duration = step.runDurationS!;
      const run: VesselRunEvidence = {
        id,
        scopeKey: 'load-fixture',
        courseKey: key as any,
        courseVersion: VESSEL_COURSE_VERSION,
        stepSequence: 1,
        durationS: duration,
        configuration,
        courseSettings: settings,
        createdAtMs: Date.now(),
        stoppedAtMs: null,
        prediction: '专用压力测试记录，预测并核验同一课程的读数、保存与恢复。',
        lastTimeS: 0,
        initialInput: initial,
        initialCheckpoint: native.snapshot(),
        checkpoint: native.snapshot(),
        parameterHash: frame.parameterHash,
        trace: [],
        nativeSensorSamples: [],
        fineStepSamples: [],
        changes: [],
        stopReason: null,
        failure: null,
      };
      progress = { ...progress, runRef: id, parameterHash: frame.parameterHash };
      for (let second = 0; second < duration; second++) {
        const next =
          key === 'destroyer' ? initial : adapter.input(1, settings, opening, frame, [], '');
        frame = JSON.parse(native.advance(1, JSON.stringify(next)));
        for (const sample of frame.controlSamples)
          run.trace.push(collectVesselTracePoint(sample, run.trace.at(-1)?.measurements ?? {}));
        run.nativeSensorSamples.push(...frame.samples);
        run.fineStepSamples!.push(...(frame.fineStepSamples ?? []));
        run.lastTimeS = frame.timeS;
        if ((second + 1) % 5 === 0 || second + 1 === duration) {
          native.setPaused(true);
          run.checkpoint = native.snapshot();
          if (second + 1 === duration) {
            run.stoppedAtMs = Date.now();
            run.stopReason = 'duration';
          }
          await uploadVesselRunEvidence('00000000-0000-4000-8000-000000000001', run);
          packets.push({ endTimeS: run.lastTimeS, requests });
          requests = [];
          if (second + 1 < duration) native.setPaused(false);
        }
      }
      const bytes = gzipSync(
        JSON.stringify({
          schema: 'act.load-course-fixture.v1',
          courseKey: key,
          courseVersion: VESSEL_COURSE_VERSION,
          experimentKey: adapter?.experimentKey ?? 'destroyer-heading',
          durationS: duration,
          packets,
        }),
      );
      writeFileSync(`.tmp/load-fixtures/${key}.json.gz`, bytes);
      console.log(
        JSON.stringify({
          course: key,
          durationS: duration,
          packets: packets.length,
          compressedBytes: bytes.length,
          controlCount: progress.controlCount,
          nativeCount: progress.nativeCount,
          fineCount: progress.fineCount,
        }),
      );
    } finally {
      native.free();
    }
  }
} finally {
  globalThis.fetch = originalFetch;
}
