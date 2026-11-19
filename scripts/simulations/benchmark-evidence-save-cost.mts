import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fileApi, { readFile, writeFile, mkdir, mkdtemp, rm, readdir } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import type { Profiler } from 'node:inspector';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlibApi, { gzip, gunzipSync } from 'node:zlib';
import { promisify } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { prepareDirectLoadPacket } from './direct-evidence-load.mjs';
import { config } from 'dotenv';
import type { Prisma } from '@prisma/client';
import type { VesselEvidenceOpening, VesselEvidenceClose } from '../../src/features/ilab/course-evidence-contract';
import type { VesselRunEvidence, VesselTraceChunkData } from '../../src/features/simulations/run-evidence';
import { prepareVesselOssSave } from '../../src/features/simulations/evidence-worker-format';

function option(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}

config({ path: '.env.local', quiet: true });
config({ quiet: true });
const target = option('--target', 'local');
assert(['local', 'production'].includes(target), 'Use an explicit benchmark database target');
if (target === 'local') {
  assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname), 'Local database required');
} else {
  const expected = option('--revision', '');
  assert(/^[0-9a-f]{40}$/.test(expected), 'Production measurement requires the frozen revision');
  assert.equal((await readFile('/app/.app-revision', 'utf8')).trim(), expected);
}
const fixtureRoot = path.resolve(option('--fixtures', '.tmp/load-fixtures'));
const output = path.resolve(option('--output', '.logs/evidence-save-cost.json'));
const evidenceTransport = option('--transport', 'legacy');
const classroomComparison = process.argv.includes('--classroom-comparison');
assert(['legacy', 'oss'].includes(evidenceTransport));
assert(!classroomComparison || (target === 'local' && evidenceTransport === 'oss'), 'Classroom comparison uses a local database and private OSS');
const browserPreviews = evidenceTransport === 'oss'
  ? JSON.parse(await readFile(option('--previews', '.tmp/load-fixture-previews.json'), 'utf8')) : undefined;
const objectReferences = new Set<string>();
const rounds = Number(option('--rounds', '5'));
assert(Number.isInteger(rounds) && rounds >= 1 && rounds <= 20);
const courses = ['destroyer', 'lng', 'container', 'cruise', 'drilling', 'icebreaker', 'dredger'];
type PacketRequest = { method: string; path: string; body: Record<string, unknown> };
type Fixture = { packets: Array<{ requests: PacketRequest[] }> };
const fixtures = new Map<string, Fixture>();
const inputHash = createHash('sha256');
for (const course of courses) {
  const bytes = await readFile(path.join(fixtureRoot, course + '.json.gz'));
  inputHash.update(course).update(bytes);
  fixtures.set(course, JSON.parse(gunzipSync(bytes).toString('utf8')) as Fixture);
}

const savedEnvironment = new Map(['SIMULATION_EVIDENCE_ROOT', 'SIMULATION_CPU_WORKERS',
  'SUBMISSION_S3_ENDPOINT', 'SUBMISSION_S3_BUCKET', 'SUBMISSION_S3_ACCESS_KEY', 'SUBMISSION_S3_SECRET_KEY']
  .map(name => [name, process.env[name]]));
const privateRoot = await mkdtemp(path.join(tmpdir(), 'act-save-cost-'));
for (const name of savedEnvironment.keys()) delete process.env[name];
process.env.SIMULATION_EVIDENCE_ROOT = privateRoot;
process.env.SIMULATION_CPU_WORKERS = '0';

type SqlCounts = { total: number; reads: number; writes: number; locks: number; transactionStatements: number;
  other: number; prismaDurationMs: number };
const emptySql = (): SqlCounts => ({ total: 0, reads: 0, writes: 0, locks: 0, transactionStatements: 0, other: 0, prismaDurationMs: 0 });
let activeSql: SqlCounts | undefined;
const compress = promisify(gzip);
const inspector = new Session();
type Cost = { cpuMs: number; elapsedMs: number; requests: number; requestBytes: number; requestEncodedBytes: number;
  responseBytes: number; ossHeadRequests: number; ossObjectReads: number; ossReadBytes: number; ossUploadRequests: number; ossUploadBytes: number; responseEncodedBytes: number; privateObjectReads: number; gzipCalls: number;
  gunzipCalls: number; jsonParses: number; sql: SqlCounts };
type Sample = { course: string; kind: string; ordinal: number; cost: Cost };
type CoverageSample = { course: string; kind: string; calls: Record<string, number> };
const samples: Sample[] = [];
const coverageSamples: CoverageSample[] = [];
const observedCoverageFunctions = new Map<string, number>();
let recordTiming = false;
let recordCoverage = false;
let userId: string | undefined;
let activeCost: Cost | undefined;
const originalReadFile = fileApi.readFile;
const originalGzip = zlibApi.gzip;
const originalGunzip = zlibApi.gunzip;
const originalJsonParse = JSON.parse;
fileApi.readFile = ((...args: Parameters<typeof originalReadFile>) => {
  if (activeCost && String(args[0]).startsWith(privateRoot + path.sep)) activeCost.privateObjectReads++;
  return Reflect.apply(originalReadFile, fileApi, args);
}) as typeof originalReadFile;
zlibApi.gzip = ((...args: Parameters<typeof originalGzip>) => {
  if (activeCost) activeCost.gzipCalls++;
  return Reflect.apply(originalGzip, zlibApi, args);
}) as typeof originalGzip;
zlibApi.gunzip = ((...args: Parameters<typeof originalGunzip>) => {
  if (activeCost) activeCost.gunzipCalls++;
  return Reflect.apply(originalGunzip, zlibApi, args);
}) as typeof originalGunzip;
JSON.parse = (text, reviver) => {
  if (activeCost) activeCost.jsonParses++;
  return originalJsonParse(text, reviver);
};
syncBuiltinESMExports();
const Oss = createRequire(import.meta.url)('ali-oss');
const originalOssHead = Oss.prototype.head;
const originalOssGetStream = Oss.prototype.getStream;
Oss.prototype.head = function (...args: unknown[]) {
  if (activeCost) activeCost.ossHeadRequests++;
  return Reflect.apply(originalOssHead, this, args);
};
Oss.prototype.getStream = function (...args: unknown[]) {
  const cost = activeCost;
  if (!cost) return Reflect.apply(originalOssGetStream, this, args);
  cost.ossObjectReads++;
  return Promise.resolve(Reflect.apply(originalOssGetStream, this, args)).then(value => {
    const result = value as { res?: { headers?: Record<string, string> } };
    cost.ossReadBytes += Number(result.res?.headers?.['content-length'] ?? 0);
    return value;
  });
};

const { default: pg } = await import('pg');
const originalQuery = pg.Client.prototype.query;
pg.Client.prototype.query = function (this: InstanceType<typeof pg.Client>, ...args: Parameters<typeof originalQuery>) {
  if (activeSql) {
    const input = args[0] as unknown as string | { text?: string };
    const text = (typeof input === 'string' ? input : input.text ?? '').trim();
    activeSql.total++;
    if (/\bFOR\s+UPDATE\b/i.test(text)) activeSql.locks++;
    else if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(text)) activeSql.transactionStatements++;
    else if (/^(INSERT|UPDATE|DELETE)\b/i.test(text)) activeSql.writes++;
    else if (/^(SELECT|WITH)\b/i.test(text)) activeSql.reads++;
    else activeSql.other++;
  }
  return Reflect.apply(originalQuery, this, args);
} as typeof originalQuery;
const { createPrismaClient } = await import('../../src/lib/prisma-client');
const database = createPrismaClient({ log: [{ level: 'query', emit: 'event' }] });
(globalThis as { prisma?: typeof database }).prisma = database;
const onQuery = database.$on.bind(database) as (name: 'query', listener: (event: Prisma.QueryEvent) => void) => void;
onQuery('query', (event) => {
  if (!activeSql) return;
  activeSql.prismaDurationMs += event.duration;
});
const service = await import('../../src/features/ilab/course-evidence-service');
const direct = await import('../../src/features/ilab/adapters/course-evidence-oss');
const chunks = await import('../../src/features/ilab/course-evidence-chunks');
const contract = await import('../../src/features/ilab/course-evidence-contract');
const api = await import('../../src/features/ilab/course-evidence-api');
const recovery = await import('../../src/features/ilab/adapters/course-session-recovery');
const { closeEvidenceCpuPool } = await import('../../src/lib/control-engine/evidence-cpu-pool');
const { CONTROL_ENGINE_BUILD_HASH } = await import('../../src/lib/control-engine/identity.generated');

function emptyCost(): Cost {
  return { ossHeadRequests: 0, ossObjectReads: 0, ossReadBytes: 0, ossUploadRequests: 0, ossUploadBytes: 0, cpuMs: 0, elapsedMs: 0, requests: 0, requestBytes: 0, requestEncodedBytes: 0,
    responseBytes: 0, responseEncodedBytes: 0, privateObjectReads: 0, gzipCalls: 0, gunzipCalls: 0,
    jsonParses: 0, sql: emptySql() };
}

function addCost(total: Cost, value: Cost) {
  for (const key of ['cpuMs', 'elapsedMs', 'requests', 'requestBytes', 'requestEncodedBytes',
    'responseBytes', 'responseEncodedBytes', 'ossHeadRequests', 'ossObjectReads', 'ossReadBytes', 'ossUploadRequests', 'ossUploadBytes', 'privateObjectReads', 'gzipCalls', 'gunzipCalls', 'jsonParses'] as const) total[key] += value[key];
  for (const key of Object.keys(total.sql) as Array<keyof SqlCounts>) total.sql[key] += value.sql[key];
}

async function requestCost<T>(body: unknown, action: (request: Request) => Promise<T>, responseGzip = false) {
  // Browser request encoding precedes the measured server window.
  const plain = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
  const encoded = body === undefined ? plain : await compress(plain);
  const request = new Request('http://localhost/api/ilab/experiment-runs', {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? { 'accept-encoding': 'gzip' }
      : { 'content-type': 'application/json', 'content-encoding': 'gzip', 'content-length': String(encoded.byteLength) },
    ...(body === undefined ? {} : { body: new Uint8Array(encoded) }),
  });
  const cost = emptyCost();
  cost.requests = 1;
  cost.requestBytes = plain.byteLength;
  cost.requestEncodedBytes = encoded.byteLength;
  activeSql = cost.sql;
  activeCost = cost;
  const started = performance.now();
  const cpu = process.cpuUsage();
  let value: T;
  let responseBytes: ArrayBuffer;
  let compressedResponse = false;
  try {
    value = await action(request);
    const response = responseGzip ? await api.vesselEvidenceJsonResponse(request, value) : Response.json(value);
    responseBytes = await response.arrayBuffer();
    compressedResponse = response.headers.get('content-encoding') === 'gzip';
  } finally {
    const usage = process.cpuUsage(cpu);
    cost.cpuMs = (usage.user + usage.system) / 1000;
    cost.elapsedMs = performance.now() - started;
    activeSql = undefined;
    activeCost = undefined;
  }
  cost.responseEncodedBytes = responseBytes.byteLength;
  cost.responseBytes = compressedResponse ? gunzipSync(responseBytes).byteLength : responseBytes.byteLength;
  return { value, cost };
}

function coverageCounts(result: Profiler.TakePreciseCoverageReturnType) {
  const calls: Record<string, number> = { nativeInstances: 0, restore: 0, freedInstances: 0 };
  for (const script of result.result) {
    for (const fn of script.functions) {
      const name = fn.functionName;
      if (/restore|createServerVesselSession|VesselSimulationSession|withWaveTables|__wrap|free/.test(name)) {
        const url = script.url.startsWith('file:') ? script.url.slice(script.url.indexOf('/src/'))
          : script.url.startsWith('data:') ? 'data-module' : script.url;
        const key = url + '#' + name;
        observedCoverageFunctions.set(key, (observedCoverageFunctions.get(key) ?? 0) + (fn.ranges[0]?.count ?? 0));
      }
      if (script.url.includes('wasm-server') && name === 'createServerVesselSession') {
        calls.nativeInstances += fn.ranges[0]?.count ?? 0;
      }
      if (!script.url.includes('/wasm/control_engine/')) continue;
      if (name === 'restore') calls.restore += fn.ranges[0]?.count ?? 0;
      if (name === '__wrap') calls.nativeInstances += fn.ranges[0]?.count ?? 0;
      if (name === 'free') calls.freedInstances += fn.ranges[0]?.count ?? 0;
    }
  }
  return calls;
}

async function directSave(runRef: string, value: unknown, deferVerification = false) {
  return requestCost(value, async request => direct.commitOwnedVesselUpload(userId!, runRef,
    contract.vesselEvidenceDirectCloseSchema.parse(await api.readVesselEvidenceJson(request)), deferVerification));
}

async function runCourse(course: string, reportClientRef: string, fullRun = false, localFirst = false) {
  const fixture = fixtures.get(course)!;
  const packets = localFirst ? [{ requests: [
    ...fixture.packets.flatMap(packet => packet.requests.filter(request => request.path.includes('/chunks'))),
    fixture.packets.at(-1)!.requests.find(request => request.method === 'PUT')!,
  ] }] : fullRun ? fixture.packets : fixture.packets.slice(0, 3);
  const original = fixture.packets[0].requests.find(request => request.method === 'POST' && !request.path.includes('/chunks'))!.body;
  const opening = { ...original, reportClientRef, runRef: evidenceTransport === 'oss'
    ? `00000000-0000-4000-8000-${randomBytes(6).toString('hex')}` : randomUUID() };
  const opened = await requestCost(opening, async request => service.openVesselEvidenceRun(userId!,
    contract.vesselEvidenceOpeningSchema.parse(await api.readVesselEvidenceJson(request)) as unknown as VesselEvidenceOpening));
  let progress = opened.value;
  if (recordTiming) samples.push({ course, kind: 'initial-open', ordinal: 0, cost: opened.cost });
  for (const [ordinal, packet] of packets.entries()) {
    const finalPacket = fullRun && ordinal === packets.length - 1;
    const timed = recordTiming && (classroomComparison || !fullRun || finalPacket);
    const counted = recordCoverage && (ordinal === 0 || finalPacket);
    if (counted) await inspector.post('Profiler.takePreciseCoverage');
    const total = emptyCost();
    const originalClose = packet.requests.find(request => request.method === 'PUT')!.body;
    let closing: Record<string, unknown> = { ...originalClose, ...(fullRun ? {} : { reason: 'checkpoint', failure: null }) };
    let saved: Awaited<ReturnType<typeof directSave>>;
    if (evidenceTransport === 'oss') {
      assert(browserPreviews);
      const sourceChunks = packet.requests.filter(request => request.path.includes('/chunks')).map(request => request.body);
      const previews = browserPreviews.previews[course];
      const prepared = localFirst ? await prepareClassroomSave(opening, progress, sourceChunks, closing, previews.at(-1))
        : prepareDirectLoadPacket(opening, progress, sourceChunks, closing, previews[ordinal]);
      for (let offset = 0; offset < prepared.objects.length; offset += 16) {
        const batch = prepared.objects.slice(offset, offset + 16);
        const grant = await requestCost({ objects: batch.map(object => object.descriptor) }, async request =>
          direct.authorizeOwnedVesselUploads(userId!, opening.runRef,
            contract.vesselEvidenceOssGrantSchema.parse(await api.readVesselEvidenceJson(request)).objects));
        addCost(total, grant.cost);
        for (const object of batch) {
          objectReferences.add(object.descriptor.reference);
          const authorization = grant.value.objects.find(row => row.reference === object.descriptor.reference)!;
          if (authorization.confirmed) continue;
          const form = new FormData();
          for (const [key, value] of Object.entries(authorization.fields)) form.append(key, value);
          form.append('file', new Blob([object.body]), 'evidence.json.gz');
          const encoded = new Request(authorization.url, { method: 'POST', body: form });
          const body = await encoded.arrayBuffer();
          const response = await fetch(authorization.url, { method: 'POST', body,
            headers: { 'content-type': encoded.headers.get('content-type')! } });
          assert.equal(response.status, 200);
          total.ossUploadRequests++; total.ossUploadBytes += body.byteLength;
        }
      }
      saved = await directSave(opening.runRef, { ...prepared.close, checkpointReference: prepared.checkpointReference }, localFirst);
      progress = saved.value;
    } else {
      const repeated = await requestCost(opening, async request => service.openVesselEvidenceRun(userId!,
        contract.vesselEvidenceOpeningSchema.parse(await api.readVesselEvidenceJson(request)) as unknown as VesselEvidenceOpening));
      addCost(total, repeated.cost);
      const sourceChunk = packet.requests.find(request => request.path.includes('/chunks'))!.body;
      const staged = await requestCost({ ...sourceChunk, runRef: opening.runRef }, async request =>
        chunks.stageVesselEvidenceBytes(userId!, opening.runRef, await api.readVesselEvidenceBytes(request)));
      addCost(total, staged.cost);
      closing = { ...closing, pendingChunks: [staged.value.reference] };
      saved = await requestCost(closing, async request => chunks.closeVesselEvidenceRun(userId!, opening.runRef,
        contract.vesselEvidenceCloseSchema.parse(await api.readVesselEvidenceJson(request)) as VesselEvidenceClose));
    }
    addCost(total, saved.cost);
    const kind = localFirst ? 'explicit-save' : finalPacket ? 'final-save' : 'automatic-save';
    if (timed) {
      samples.push({ course, kind, ordinal, cost: total });
      samples.push({ course, kind: localFirst ? 'explicit-confirmation' : finalPacket ? 'final-confirmation' : 'checkpoint-confirmation', ordinal, cost: saved.cost });
    }
    if (counted) coverageSamples.push({ course, kind,
      calls: coverageCounts(await inspector.post('Profiler.takePreciseCoverage')) });
    const expected = contract.vesselEvidenceCloseSchema.parse(closing);
    assert.equal(saved.value.controlCount, expected.controlCount);
    assert.equal(saved.value.nativeCount, expected.nativeCount);
    assert.equal(saved.value.lastTimeS, expected.endTimeS);
    if (localFirst) {
      assert.equal(saved.value.evidenceStatus, 'pending');
      const verified = await requestCost(undefined, () => chunks.verifyVesselEvidenceRun(userId!, opening.runRef));
      assert.equal(verified.value.evidenceStatus, 'verified');
      if (timed) samples.push({ course, kind: 'selected-formal-verification', ordinal, cost: verified.cost });
    }
    if ((!classroomComparison && !fullRun) || finalPacket) {
      const restored = await requestCost(undefined, async () => evidenceTransport === 'oss'
        ? recovery.loadOwnedCourseRunRecovery(userId!, opening.runRef, true)
        : recovery.loadOwnedCourseRunRecovery(userId!, opening.runRef), true);
      if ('stateObjects' in restored.value) {
        const { readSimulationTraceChunk } = await import('../../src/lib/data-governance/simulation-trace-cas');
        const state = await readSimulationTraceChunk<{checkpoint: string}>(restored.value.stateObjects.checkpointReference);
        assert.equal(state.checkpoint, expected.checkpoint);
      } else assert.equal(restored.value.checkpoint, expected.checkpoint);
      if (timed) samples.push({ course, kind: localFirst ? 'explicit-selected-run-recovery' : 'selected-run-recovery', ordinal, cost: restored.cost });
    }
  }
  if (fullRun) assert.notEqual((packets.at(-1)!.requests.find(request => request.method === 'PUT')!.body).reason, 'checkpoint');
}

async function prepareClassroomSave(openingRaw: unknown, progress: ReturnType<typeof service.vesselRunProgress>,
  source: unknown[], closingRaw: unknown, preview: VesselRunEvidence['checkpointPreview']) {
  const opening = contract.vesselEvidenceOpeningSchema.parse(openingRaw) as unknown as VesselEvidenceOpening;
  const close = contract.vesselEvidenceCloseSchema.parse(closingRaw);
  const trace = source.map(chunk => contract.vesselTraceChunkSchema.parse(chunk) as unknown as VesselTraceChunkData);
  assert(close.reason !== 'checkpoint');
  return prepareVesselOssSave({ id: opening.runRef, scopeKey: 'classroom-comparison', courseKey: 'destroyer',
    courseVersion: opening.courseVersion, stepSequence: opening.stepSequence, durationS: close.durationS,
    createdAtMs: opening.startedAtMs, stoppedAtMs: opening.startedAtMs + close.endTimeS * 1000,
    lastTimeS: close.endTimeS, configuration: opening.configuration, runtimeVersion: opening.runtimeVersion,
    initialInput: opening.input, parameterHash: opening.parameterHash, initialCheckpoint: opening.initialCheckpoint,
    checkpoint: close.checkpoint, checkpointPreview: preview, stopReason: close.reason, failure: close.failure,
    trace: trace.flatMap(chunk => chunk.points), nativeSensorSamples: trace.flatMap(chunk => chunk.nativeSamples),
    ...(trace.some(chunk => chunk.fineSamples) ? { fineStepSamples: trace.flatMap(chunk => chunk.fineSamples ?? []) } : {}),
    changes: trace.flatMap(chunk => chunk.changes), prediction: opening.prediction ?? '',
  }, progress, opening, true);
}

async function sourceFingerprint() {
  const files = (await readdir('src/features/ilab')).filter(name => name.startsWith('course-evidence') && name.endsWith('.ts'))
    .map(name => 'src/features/ilab/' + name);
  files.push(...(await readdir('src/features/ilab/adapters'))
    .filter(name => name.startsWith('course-evidence') && name.endsWith('.ts'))
    .map(name => 'src/features/ilab/adapters/' + name));
  files.push('src/features/ilab/adapters/oss-object-store.ts');
  files.push('src/lib/data-governance/simulation-trace-cas.ts', 'src/lib/data-governance/simulation-trace-codec.ts',
    'src/features/ilab/adapters/course-session-recovery.ts', 'src/features/ilab/course-run-metrics.ts',
    'src/features/ilab/adapters/course-process-analysis.ts', 'src/features/simulations/evidence-worker-format.ts',
    'src/lib/control-engine/identity.ts', 'src/lib/control-engine/identity.generated.ts',
    'src/lib/control-engine/server.ts', 'prisma/schema.prisma', 'package-lock.json');
  const value = createHash('sha256');
  for (const file of files.sort()) value.update(file).update(await readFile(file));
  return value.digest('hex');
}

const quantile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};
const fingerprint = await sourceFingerprint();
const toolFingerprint = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
if (browserPreviews) assert.equal(browserPreviews.inputDigest, inputHash.copy().digest('hex'));
let revision: string;
try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
catch { revision = (await readFile('/app/.app-revision', 'utf8')).trim(); }

try {
  const identity = 'save_cost_' + randomUUID();
  await database.user.create({ data: { id: identity, name: 'ACT dedicated evidence save cost benchmark',
    role: 'STUDENT', accountSource: 'PLATFORM' } });
  userId = identity;
  const reports = new Map(courses.map(course => [course, randomUUID()]));
  if (classroomComparison) {
    for (let round = -1; round < rounds; round++) {
      recordTiming = round >= 0;
      for (const localFirst of round % 2 === 0 ? [false, true] : [true, false]) {
        await runCourse('destroyer', randomUUID(), true, localFirst);
      }
    }
  } else {
    for (const course of courses) await runCourse(course, reports.get(course)!);
    recordTiming = true;
    for (let round = 0; round < rounds; round++) {
      for (const course of courses) await runCourse(course, reports.get(course)!);
    }
    for (const course of courses) await runCourse(course, reports.get(course)!, true);
    recordTiming = false;
    inspector.connect();
    await inspector.post('Profiler.enable');
    await inspector.post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
    recordCoverage = true;
    for (const course of courses) await runCourse(course, reports.get(course)!, true);
    recordCoverage = false;
    await inspector.post('Profiler.stopPreciseCoverage');
    const formalCounts = coverageSamples.filter(sample => sample.kind === 'final-save');
    assert.equal(formalCounts.length, 7);
    const validFormalCounts = formalCounts.every(sample => sample.calls.nativeInstances === 1
      && sample.calls.restore === 1 && sample.calls.freedInstances === 1);
    if (!validFormalCounts) {
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output + '.diagnostics.json', JSON.stringify({ status: 'invalid-counters',
        coverage: coverageSamples, observedFunctions: Object.fromEntries(observedCoverageFunctions) }, null, 2));
    }
    assert(validFormalCounts,
      'Native creation/restoration counters were not observed in the formal verification control');
    const ordinaryCounts = coverageSamples.filter(sample => sample.kind === 'automatic-save');
    if (ordinaryCounts.every(sample => sample.calls.nativeInstances === 0)) {
      assert(ordinaryCounts.every(sample => sample.calls.restore === 0 && sample.calls.freedInstances === 0));
      assert(samples.filter(sample => sample.kind === 'automatic-save')
        .every(sample => sample.cost.privateObjectReads === 0 && sample.cost.ossObjectReads === 0),
      'Confirmed chunks were re-read during ordinary saving');
    }
  }
  assert(samples.every(sample => sample.cost.sql.total > 0), 'SQL statement events were not observed');
  assert(samples.filter(sample => sample.kind === 'checkpoint-confirmation')
    .every(sample => sample.cost.sql.transactionStatements >= 2
      && sample.cost.sql.transactionStatements % 2 === 0), 'Database transaction control statements were not observed');
  assert.equal(await sourceFingerprint(), fingerprint, 'Source changed during measurement');
  const aggregates = [...new Set(samples.map(sample => sample.kind))].map(kind => {
    const rows = samples.filter(sample => sample.kind === kind);
    return { kind, count: rows.length, cpuMedianMs: quantile(rows.map(row => row.cost.cpuMs), .5),
      cpuP95Ms: quantile(rows.map(row => row.cost.cpuMs), .95),
      cpuP99Ms: quantile(rows.map(row => row.cost.cpuMs), .99),
      latencyMedianMs: quantile(rows.map(row => row.cost.elapsedMs), .5),
      latencyP95Ms: quantile(rows.map(row => row.cost.elapsedMs), .95),
      latencyP99Ms: quantile(rows.map(row => row.cost.elapsedMs), .99),
      meanRequests: rows.reduce((sum, row) => sum + row.cost.requests, 0)/rows.length,
      meanRequestBytes: rows.reduce((sum, row) => sum + row.cost.requestBytes, 0)/rows.length,
      meanRequestEncodedBytes: rows.reduce((sum, row) => sum + row.cost.requestEncodedBytes, 0)/rows.length,
      meanResponseBytes: rows.reduce((sum, row) => sum + row.cost.responseBytes, 0)/rows.length,
      meanResponseEncodedBytes: rows.reduce((sum, row) => sum + row.cost.responseEncodedBytes, 0)/rows.length,
      meanSqlStatements: rows.reduce((sum, row) => sum + row.cost.sql.total, 0)/rows.length,
      meanPrivateObjectReads: rows.reduce((sum, row) => sum + row.cost.privateObjectReads, 0)/rows.length,
      meanOssHeadRequests: rows.reduce((sum, row) => sum + row.cost.ossHeadRequests, 0)/rows.length,
      meanOssObjectReads: rows.reduce((sum, row) => sum + row.cost.ossObjectReads, 0)/rows.length,
      meanOssReadBytes: rows.reduce((sum, row) => sum + row.cost.ossReadBytes, 0)/rows.length,
      meanOssUploadRequests: rows.reduce((sum, row) => sum + row.cost.ossUploadRequests, 0)/rows.length,
      meanOssUploadBytes: rows.reduce((sum, row) => sum + row.cost.ossUploadBytes, 0)/rows.length,
      meanGzipCalls: rows.reduce((sum, row) => sum + row.cost.gzipCalls, 0)/rows.length,
      meanGunzipCalls: rows.reduce((sum, row) => sum + row.cost.gunzipCalls, 0)/rows.length,
      meanJsonParses: rows.reduce((sum, row) => sum + row.cost.jsonParses, 0)/rows.length };
  });
  await mkdir(path.dirname(output), { recursive: true });
  const result = { schema: 'act.evidence-save-cost.v1', capturedAt: new Date().toISOString(), revision,
    sourceFingerprint: fingerprint, toolFingerprint, inputDigest: inputHash.digest('hex'), runtimeVersion: CONTROL_ENGINE_BUILD_HASH,
    evidenceTransport, classroomComparison,
    node: process.version, platform: process.platform, architecture: process.arch, databaseTarget: target, rounds,
    scope: 'Sequential real database and evidence service calls with actual request decoding and response encoding; fixed dedicated identity; session authentication and network latency measured separately by HTTP/browser tests',
    cpuScope: 'Application process user+system CPU including asynchronous codec threads; database statement duration is reported separately',
    countingScope: 'Native allocation via synchronous factory/__wrap, plus restore/free V8 counts in a separate pass; delegated builtin IO/codec/JSON entry counters and physical pg SQL entry counts including transaction control. Prisma query duration excludes control statements',
    aggregate: aggregates, coverage: coverageSamples, samples, checkpointsExact: true };
  const lines = (JSON.stringify(result, null, 2) + '\n').split(/(?<=\n)/);
  await writeFile(output, '');
  for (let index = 0; index < lines.length; index += 400) {
    await writeFile(output, lines.slice(index, index + 400).join(''), { flag: 'a' });
  }
  await rm(output + '.diagnostics.json', { force: true });
  console.log(JSON.stringify({ status: 'passed', revision, sourceFingerprint: fingerprint,
    aggregate: aggregates, coverage: coverageSamples, checkpointsExact: true }));
} finally {
  activeSql = undefined;
  activeCost = undefined;
  recordCoverage = false;
  recordTiming = false;
  inspector.disconnect();
  if (userId) {
    await database.simulationRun.deleteMany({ where: { ownerUserId: userId } });
    await database.evidenceOutbox.deleteMany({ where: { ownerUserId: userId } });
    await database.virtualSimulationReport.deleteMany({ where: { userId } });
    await database.user.deleteMany({ where: { id: userId } });
    assert.equal(await database.user.count({ where: { id: userId } }), 0);
    assert.equal(await database.simulationRun.count({ where: { ownerUserId: userId } }), 0);
    assert.equal(await database.virtualSimulationReport.count({ where: { userId } }), 0);
  }
  await closeEvidenceCpuPool();
  await database.$disconnect();
  if (objectReferences.size) await writeFile(output + '.objects.json', JSON.stringify([...objectReferences]));
  Oss.prototype.head = originalOssHead;
  Oss.prototype.getStream = originalOssGetStream;
  pg.Client.prototype.query = originalQuery;
  fileApi.readFile = originalReadFile;
  zlibApi.gzip = originalGzip;
  zlibApi.gunzip = originalGunzip;
  JSON.parse = originalJsonParse;
  syncBuiltinESMExports();
  for (const [name, value] of savedEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  await rm(privateRoot, { recursive: true, force: true });
}
