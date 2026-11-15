import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { createServerVesselSessionWithAssets } from '@/lib/control-engine/wasm-server';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { collectVesselTracePoint, type VesselRunEvidence } from '@/features/simulations/run-evidence';
import { uploadVesselRunEvidence } from '@/features/simulations/evidence-upload';
import { readVesselEvidenceJson } from '../course-evidence-api';
import { vesselEvidenceOpeningSchema, vesselTraceChunkSchema, vesselEvidenceCloseSchema } from '../course-evidence-contract';
import { openVesselEvidenceRun } from '../course-evidence-service';
import { appendVesselEvidenceChunk, closeVesselEvidenceRun, stageVesselEvidenceChunk } from '../course-evidence-chunks';
import { loadCourseSessionRecovery, loadOwnedCourseRunRecovery } from '../adapters/course-session-recovery';
import { drillingCourseConfiguration, drillingCourseDefaultSettings, drillingCourseInput } from '@/resources/simulations/experiments/drilling-course';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
assert(['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));
const privateRoot = await mkdtemp(path.join(os.tmpdir(), 'act-drilling-evidence-'));
process.env.SIMULATION_EVIDENCE_ROOT = privateRoot;
for (const key of ['SUBMISSION_S3_ENDPOINT', 'SUBMISSION_S3_BUCKET', 'SUBMISSION_S3_ACCESS_KEY', 'SUBMISSION_S3_SECRET_KEY']) process.env[key] = '';
const user = await prisma.user.create({ data: { name: 'drilling evidence integration fixture' } });
const originalFetch = globalThis.fetch;
try {
  for (const sequence of [5, 11, 12]) {
    const settings = drillingCourseDefaultSettings(sequence);
    const configuration = drillingCourseConfiguration(sequence, settings);
    const native = await createServerVesselSessionWithAssets(configuration);
    try {
      let frame = JSON.parse(native.read()) as VesselSessionFrame;
      const input = drillingCourseInput(sequence, settings, frame.input, frame);
      frame = JSON.parse(native.advance(0, JSON.stringify(input))) as VesselSessionFrame;
      const run: VesselRunEvidence = { id: randomUUID(), scopeKey: 'drilling-evidence-fixture', courseKey: 'drilling',
        courseVersion: VESSEL_COURSE_VERSION, stepSequence: sequence, prediction: '验证定位控制和独立恢复',
        durationS: 600, createdAtMs: Date.now(), stoppedAtMs: null, lastTimeS: 0,
        configuration, initialInput: input, courseSettings: { ...settings }, parameterHash: frame.parameterHash,
        initialCheckpoint: native.snapshot(), checkpoint: native.snapshot(), trace: [], nativeSensorSamples: [],
        fineStepSamples: [], changes: [], stopReason: null, failure: null };
      globalThis.fetch = async (url, options) => {
        const request = new Request(`http://127.0.0.1:3001${url}`, options);
        const data = await readVesselEvidenceJson(request);
        const result = String(url).includes('/chunks') ? String(url).endsWith('?stage=1')
          ? await stageVesselEvidenceChunk(user.id, vesselTraceChunkSchema.parse(data))
          : await appendVesselEvidenceChunk(user.id, vesselTraceChunkSchema.parse(data))
          : options?.method === 'PUT' ? await closeVesselEvidenceRun(user.id, run.id, vesselEvidenceCloseSchema.parse(data))
          : await openVesselEvidenceRun(user.id, vesselEvidenceOpeningSchema.parse(data));
        return Response.json(result);
      };
      for (let second = 0; second < 2; second++) {
        frame = JSON.parse(native.advance(1, JSON.stringify(input))) as VesselSessionFrame;
        for (const point of frame.controlSamples) run.trace.push(collectVesselTracePoint(point, run.trace.at(-1)?.measurements ?? {}));
        run.nativeSensorSamples.push(...frame.samples);
        run.fineStepSamples!.push(...(frame.fineStepSamples ?? []));
      }
      run.lastTimeS = frame.timeS;
      run.checkpoint = native.snapshot();
      assert.equal(frame.dpController?.ticks, 20);
      assert.equal(run.trace.length, 40);
      assert(run.trace.every((point) => point.dp && point.estimatedControlLoadBody?.length === 3 && point.propulsorThrustN?.length === 8));
      assert.equal(frame.waveModel?.secondOrderEnabled, sequence >= 11);
      for (const point of run.trace) for (const [name, reading] of Object.entries(point.measurements)) {
        assert(reading.sampledAtS <= reading.arrivedAtS + 1e-7 && reading.arrivedAtS <= point.timeS + 1e-7
          && (reading.quality === 'Good') === (reading.value !== null), JSON.stringify({timeS: point.timeS, name, reading}));
      }
      const reportClientRef = randomUUID();
      const receipt = await uploadVesselRunEvidence(reportClientRef, run);
      assert.equal(receipt.controlCount, 40);
      const recovery = await loadCourseSessionRecovery({ userId: user.id, courseKey: 'drilling', courseVersion: VESSEL_COURSE_VERSION });
      const restored = recovery.runs.find((item) => item.id === run.id)!;
      const selected = await loadOwnedCourseRunRecovery(user.id, run.id);
      assert.equal(selected.checkpoint, run.checkpoint);
      await assert.rejects(() => loadOwnedCourseRunRecovery('other-account', run.id), { status: 404 });
      assert.equal(restored.checkpoint, run.checkpoint);
      const canonicalTrace = vesselTraceChunkSchema.shape.points.parse(JSON.parse(JSON.stringify(run.trace)));
      const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
      assert.equal(digest(restored.trace), digest(canonicalTrace), 'All public trace diagnostics must survive recovery');
      const other = await createServerVesselSessionWithAssets(configuration);
      try {
        other.restore(restored.checkpoint);
        assert.equal(other.advance(1, JSON.stringify(input)), native.advance(1, JSON.stringify(input)));
      } finally { other.free(); }
      run.stoppedAtMs = Date.now();
      run.stopReason = 'student';
      await uploadVesselRunEvidence(reportClientRef, run);
      const compactRecovery = await loadCourseSessionRecovery({ userId: user.id, courseKey: 'drilling',
        reportClientRef, deferTraceChunks: true, lazyHistory: true });
      assert.equal(compactRecovery.runs.length, 0);
      assert.equal(compactRecovery.archivedRuns?.length, 1);
      assert.equal(compactRecovery.archivedRuns?.[0].sampleCount, 40);
      console.log(JSON.stringify({ sequence, secondOrder: frame.waveModel?.secondOrderEnabled,
        restoredTimeS: restored.lastTimeS, controllerTicks: frame.dpController?.ticks, controls: run.trace.length }));
    } finally { native.free(); }
  }
} finally {
  globalThis.fetch = originalFetch;
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
  await rm(privateRoot, { recursive: true, force: true });
}
