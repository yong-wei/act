import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { gunzipSync } from 'node:zlib';
import * as current from '../../src/lib/data-governance/simulation-trace-cas';

const option = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const baselineRef = option('--baseline-ref', '5c3ecaaf5a');
assert(/^[a-f0-9]{7,40}$/.test(baselineRef), 'Use a captured baseline commit');
const baselineRevision = execFileSync('git', ['rev-parse', `${baselineRef}^{commit}`], { encoding: 'utf8' }).trim();
const fixtureRoot = option('--fixtures', '.tmp/load-fixtures');
const output = option('--output', '.logs/evidence-storage-second-pass.json');
await mkdir('.tmp', { recursive: true });
const modules = await mkdtemp(path.resolve('.tmp/evidence-storage-baseline-'));
const root = await mkdtemp(path.join(os.tmpdir(), 'act-evidence-storage-benchmark-'));
const environmentKeys = ['SIMULATION_EVIDENCE_ROOT', 'SUBMISSION_S3_ENDPOINT', 'SUBMISSION_S3_BUCKET',
  'SUBMISSION_S3_ACCESS_KEY', 'SUBMISSION_S3_SECRET_KEY'];
const savedEnvironment = new Map(environmentKeys.map(key => [key, process.env[key]]));
type Sample = { label: string; round: number; elapsedMs: number; cpuMs: number;
  eventLoopP95Ms: number; eventLoopMaximumMs: number; storedBytes: number };
const samples: Sample[] = [];
try {
  for (const key of environmentKeys) delete process.env[key];
  const show = (name: string) => execFileSync('git', ['show', `${baselineRevision}:${name}`], { encoding: 'utf8' });
  await writeFile(path.join(modules, 'canonical.ts'), show('src/lib/student-model-artifact-contract/server-hash.ts'));
  await writeFile(path.join(modules, 'cas.ts'), show('src/lib/data-governance/simulation-trace-cas.ts')
    .replace("'@/lib/student-model-artifact-contract/server-hash'", "'./canonical'"));
  const baseline: typeof current = await import(pathToFileURL(path.join(modules, 'cas.ts')).href);
  const inputs: unknown[] = [];
  for (const key of ['destroyer', 'lng', 'container', 'cruise', 'drilling', 'icebreaker', 'dredger']) {
    const fixture = JSON.parse(gunzipSync(await readFile(path.join(fixtureRoot, `${key}.json.gz`))).toString());
    const chunk = fixture.packets.flatMap((packet: { requests: Array<{ path: string; body: unknown }> }) => packet.requests)
      .find((request: { path: string }) => request.path.includes('/chunks')).body;
    for (let repeat = 0; repeat < 10; repeat++) inputs.push({ ...chunk,
      runRef: `00000000-0000-4000-8000-${String(inputs.length + 1).padStart(12, '0')}` });
  }
  const inputDigest = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
  let expectedReferences: string[] | undefined;
  for (let round = -1; round < 5; round++) {
    for (const label of round % 2 ? ['current', 'baseline'] : ['baseline', 'current']) {
      process.env.SIMULATION_EVIDENCE_ROOT = path.join(root, label);
      const codec = label === 'baseline' ? baseline : current;
      const delay = monitorEventLoopDelay({ resolution: 1 });
      delay.enable();
      await new Promise(resolve => setTimeout(resolve, 10));
      const cpu = process.cpuUsage();
      const started = performance.now();
      let storedBytes = 0;
      const references: string[] = [];
      try {
        for (let offset = 0; offset < inputs.length; offset += 10) {
          const selected = inputs.slice(offset, offset + 10);
          const stored = await Promise.all(selected.map(input => codec.writeSimulationTraceChunk(input)));
          const recovered = await Promise.all(stored.map(record => codec.readSimulationTraceChunk(record.uri)));
          recovered.forEach((value, index) => assert.deepEqual(value, selected[index]));
          references.push(...stored.map(record => record.uri));
          storedBytes += stored.reduce((sum, record) => sum + record.storedBytes, 0);
        }
        const elapsedMs = performance.now() - started;
        const usage = process.cpuUsage(cpu);
        await new Promise(resolve => setTimeout(resolve, 10));
        if (round >= 0) samples.push({ label, round, elapsedMs, cpuMs: (usage.user + usage.system) / 1000,
          eventLoopP95Ms: delay.percentile(95) / 1e6, eventLoopMaximumMs: delay.max / 1e6, storedBytes });
      } finally { delay.disable(); }
      if (!expectedReferences) expectedReferences = references;
      else assert.deepEqual(references, expectedReferences, 'Content references must match the captured baseline');
    }
  }
  const median = (values: number[]) => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
  const summary = Object.fromEntries(['baseline', 'current'].map(label => {
    const rows = samples.filter(sample => sample.label === label);
    return [label, { elapsedMs: median(rows.map(row => row.elapsedMs)), cpuMs: median(rows.map(row => row.cpuMs)),
      eventLoopP95Ms: median(rows.map(row => row.eventLoopP95Ms)), storedBytes: rows[0].storedBytes }];
  }));
  const result = { schema: 'act.evidence-storage-benchmark.v1', baselineRevision, inputDigest,
    scope: 'Local file-backed storage; seven representative native chunks; 70 operations per round; ten concurrent writes/reads; five alternating rounds after warm-up',
    roundTripExact: true, referencesExact: true, samples, summary };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, samples: undefined }));
} finally {
  for (const [key, value] of savedEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(root, { recursive: true, force: true });
  await rm(modules, { recursive: true, force: true });
}
