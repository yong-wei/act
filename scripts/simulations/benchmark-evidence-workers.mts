import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { availableParallelism, cpus, tmpdir, totalmem } from 'node:os';
import path from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { gunzipSync } from 'node:zlib';
import { config } from 'dotenv';
import { prisma } from '@/lib/prisma';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { openVesselEvidenceRun, findOwnedVesselRun, vesselRunStorageSummary } from '@/features/ilab/course-evidence-service';
import { stageVesselEvidenceBytes } from '@/features/ilab/course-evidence-chunks';
import { prepareVesselEvidenceClose, type PrepareVesselCloseInput } from '@/features/ilab/course-evidence-compute';
import { vesselEvidenceOpeningSchema, vesselEvidenceCloseSchema, type VesselEvidenceOpening,
  type VesselEvidenceClose } from '@/features/ilab/course-evidence-contract';
import { runEvidenceCpuTask, evidenceCpuPoolStats, closeEvidenceCpuPool } from '@/lib/control-engine/evidence-cpu-pool';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname));
const fixtureRoot = process.argv[2] ?? '.tmp/load-fixtures';
const output = process.argv[3] ?? '.logs/evidence-worker-benchmark.json';
const courses = ['destroyer', 'lng', 'container', 'cruise', 'drilling', 'icebreaker', 'dredger'];
const root = await mkdtemp(path.join(tmpdir(), 'act-evidence-workers-'));
const environmentNames = ['SIMULATION_EVIDENCE_ROOT', 'SUBMISSION_S3_ENDPOINT', 'SUBMISSION_S3_BUCKET',
  'SUBMISSION_S3_ACCESS_KEY', 'SUBMISSION_S3_SECRET_KEY', 'SIMULATION_CPU_WORKERS'];
const savedEnvironment = new Map(environmentNames.map(key => [key, process.env[key]]));
for (const key of environmentNames) delete process.env[key];
process.env.SIMULATION_EVIDENCE_ROOT = root;
process.env.SIMULATION_CPU_WORKERS = '0';
const tasks: PrepareVesselCloseInput[] = [];
const expected: unknown[] = [];
const inputHash = createHash('sha256');
type Sample = { workers: number; round: number; operations: number; elapsedMs: number; cpuMs: number;
  effectiveCpuCores: number; operationsPerSecond: number; eventLoopP95Ms: number; eventLoopMaximumMs: number;
  rssBytes: number; actualWorkers: number };
const samples: Sample[] = [];
let userId: string | undefined;

async function executeBatch(workers: number, operations: number) {
  const results: unknown[] = [];
  for (let offset = 0; offset < operations; offset += 16) {
    const indices = Array.from({ length: Math.min(16, operations - offset) }, (_, index) => offset + index);
    results.push(...await Promise.all(indices.map(index => workers
      ? runEvidenceCpuTask('close-prepare', tasks[index % tasks.length])
      : prepareVesselEvidenceClose(tasks[index % tasks.length]))));
  }
  return results;
}

try {
  userId = (await prisma.user.create({ data: { name: 'ACT local worker scalability measurement',
    role: 'STUDENT', accountSource: 'PLATFORM' } })).id;
  for (const course of courses) {
    const bytes = await readFile(path.join(fixtureRoot, `${course}.json.gz`));
    inputHash.update(bytes);
    const fixture = JSON.parse(gunzipSync(bytes).toString('utf8')) as { packets: Array<{
      requests: Array<{ method: string; path: string; body: Record<string, unknown> }> }> };
    const packet = fixture.packets[0];
    const source = packet.requests.find(request => request.method === 'POST' && !request.path.includes('/chunks'))!.body;
    const opening = vesselEvidenceOpeningSchema.parse({ ...source, reportClientRef: randomUUID(), runRef: randomUUID() }) as unknown as VesselEvidenceOpening;
    await openVesselEvidenceRun(userId, opening);
    const chunk = packet.requests.find(request => request.path.includes('/chunks'))!.body;
    const staged = await stageVesselEvidenceBytes(userId, opening.runRef, Buffer.from(JSON.stringify({ ...chunk, runRef: opening.runRef })));
    const closing = packet.requests.find(request => request.method === 'PUT')!.body;
    const input = vesselEvidenceCloseSchema.parse({ ...closing, pendingChunks: [staged.reference] }) as VesselEvidenceClose;
    const run = await findOwnedVesselRun(userId, opening.runRef);
    const task = { run: { id: run.id, runtimeVersion: run.runtimeVersion, modelVersion: run.modelVersion, seed: run.seed },
      runRef: opening.runRef, summary: vesselRunStorageSummary(run), input,
      closeHash: createHash('sha256').update(canonicalJson(input)).digest('hex'), traces: [] };
    tasks.push(task);
    expected.push(await prepareVesselEvidenceClose(task));
  }
  for (const workers of [0, 1, 2, 4, 8]) {
    if (workers > availableParallelism()) continue;
    await closeEvidenceCpuPool();
    process.env.SIMULATION_CPU_WORKERS = String(workers);
    const warm = await executeBatch(workers, 56);
    warm.forEach((result, index) => assert.deepEqual(result, expected[index % expected.length]));
    for (let round = 0; round < 3; round++) {
      const delay = monitorEventLoopDelay({ resolution: 1 });
      delay.enable();
      await new Promise(resolve => setTimeout(resolve, 10));
      const started = performance.now();
      const cpu = process.cpuUsage();
      const results = await executeBatch(workers, 56);
      const elapsedMs = performance.now() - started;
      const usage = process.cpuUsage(cpu);
      const cpuMs = (usage.user + usage.system) / 1000;
      await new Promise(resolve => setTimeout(resolve, 5));
      delay.disable();
      const state = evidenceCpuPoolStats();
      samples.push({ workers, round, operations: results.length, elapsedMs, cpuMs,
        effectiveCpuCores: cpuMs / elapsedMs, operationsPerSecond: results.length / elapsedMs * 1000,
        eventLoopP95Ms: delay.percentile(95) / 1e6, eventLoopMaximumMs: delay.max / 1e6,
        rssBytes: process.memoryUsage().rss, actualWorkers: state.workers });
      results.forEach((result, index) => assert.deepEqual(result, expected[index % expected.length]));
      console.log(JSON.stringify(samples.at(-1)));
    }
  }
  const median = (values: number[]) => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
  const summary = [...new Set(samples.map(sample => sample.workers))].map(workers => {
    const selected = samples.filter(sample => sample.workers === workers);
    return { workers, elapsedMs: median(selected.map(sample => sample.elapsedMs)),
      operationsPerSecond: median(selected.map(sample => sample.operationsPerSecond)),
      cpuMs: median(selected.map(sample => sample.cpuMs)),
      effectiveCpuCores: median(selected.map(sample => sample.effectiveCpuCores)),
      eventLoopP95Ms: median(selected.map(sample => sample.eventLoopP95Ms)),
      rssMaximumBytes: Math.max(...selected.map(sample => sample.rssBytes)) };
  });
  const result = { schema: 'act.evidence-worker-benchmark.v1', inputDigest: inputHash.digest('hex'),
    scope: 'Local CPU preparation and private-file IO only, seven existing native first-step checkpoints, no database transaction in measured window',
    platform: process.platform, arch: process.arch, node: process.version, cpu: cpus()[0].model,
    availableCpuCount: availableParallelism(), memoryBytes: totalmem(), concurrency: 16,
    allPreparedDataExact: true, samples, summary };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, samples: undefined }, null, 2));
} finally {
  await closeEvidenceCpuPool();
  if (userId) {
    await prisma.simulationRun.deleteMany({ where: { ownerUserId: userId } });
    await prisma.user.delete({ where: { id: userId } });
  }
  await prisma.$disconnect();
  for (const [name, value] of savedEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  await rm(root, { recursive: true, force: true });
}
