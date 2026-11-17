// Derives browser preview metadata from the existing frozen first-step records.
// It restores stored checkpoints and performs no new physics integration.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { CONTROL_ENGINE_BUILD_HASH } from '@/lib/control-engine/identity.generated';
import { preloadBrowserControlEngine } from '@/lib/control-engine/wasm-browser';
import { createServerVesselSession } from '@/lib/control-engine/wasm-server';
import { evaluateVesselHeadingRun } from '@/resources/simulations/experiments/student-analysis';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';

const option = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const root = option('--fixtures', '.tmp/load-fixtures');
const output = option('--output', '.tmp/load-fixture-previews.json');
const courses = ['destroyer', 'lng', 'container', 'cruise', 'drilling', 'icebreaker', 'dredger'];
const inputHash = createHash('sha256');
const previews: Record<string, unknown[]> = {};
// The browser and server bindings share the initialized immutable WASM module.
const firstFixture = JSON.parse(gunzipSync(readFileSync(`${root}/destroyer.json.gz`)).toString());
createServerVesselSession(firstFixture.packets[0].requests[0].body.configuration).free();
await preloadBrowserControlEngine();
for (const course of courses) {
  const bytes = readFileSync(`${root}/${course}.json.gz`);
  inputHash.update(course).update(bytes);
  const fixture = JSON.parse(gunzipSync(bytes).toString());
  const opening = fixture.packets[0].requests.find((row: {path: string}) => row.path === '/api/ilab/experiment-runs').body;
  const session = createServerVesselSession(opening.configuration);
  const run = { ...opening, initialInput: opening.input, trace: [], nativeSensorSamples: [], fineStepSamples: [], changes: [] } as unknown as VesselRunEvidence;
  previews[course] = [];
  try {
    for (const packet of fixture.packets) {
      for (const row of packet.requests) {
        if (!row.path.includes('/chunks')) continue;
        run.trace.push(...row.body.points);
        run.nativeSensorSamples.push(...row.body.nativeSamples);
        run.fineStepSamples!.push(...(row.body.fineSamples ?? []));
        run.changes.push(...row.body.changes);
      }
      const close = packet.requests.find((row: {method: string}) => row.method === 'PUT').body;
      session.restore(close.checkpoint);
      const frame = JSON.parse(session.read()) as VesselSessionFrame;
      run.lastTimeS = frame.timeS;
      run.checkpoint = close.checkpoint;
      run.cruiseComfort = frame.cruiseComfort;
      const evaluation = evaluateVesselHeadingRun(run, true);
      previews[course].push({ schema: 'act.vessel-checkpoint-preview.v1', recoverable: true,
        runtimeVersion: CONTROL_ENGINE_BUILD_HASH, parameterHash: frame.parameterHash, timeS: frame.timeS,
        controllerTicks: frame.controllerTicks, fineCount: frame.fineStepWindowSampleCount ?? 0,
        appliedFinalInput: frame.input, ...evaluation });
    }
  } finally { session.free(); }
}
const result = { schema: 'act.load-browser-previews.v1', inputDigest: inputHash.digest('hex'), previews };
writeFileSync(output, JSON.stringify(result), {mode: 0o600});
console.log(JSON.stringify({ output, inputDigest: result.inputDigest, courses: courses.length }));
