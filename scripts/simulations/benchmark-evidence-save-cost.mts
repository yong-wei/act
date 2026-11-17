import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fileApi, { readFile, writeFile, mkdir, mkdtemp, rm, readdir } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import type { Profiler } from 'node:inspector';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlibApi, { gzip, gunzipSync } from 'node:zlib';
import { promisify } from 'node:util';
import { execFileSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { config } from 'dotenv';
import type { Prisma } from '@prisma/client';
import type { VesselEvidenceOpening, VesselEvidenceClose } from '../../src/features/ilab/course-evidence-contract';

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
  responseBytes: number; responseEncodedBytes: number; privateObjectReads: number; gzipCalls: number;
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
const chunks = await import('../../src/features/ilab/course-evidence-chunks');
const contract = await import('../../src/features/ilab/course-evidence-contract');
const api = await import('../../src/features/ilab/course-evidence-api');
const recovery = await import('../../src/features/ilab/adapters/course-session-recovery');
const { closeEvidenceCpuPool } = await import('../../src/lib/control-engine/evidence-cpu-pool');
const { CONTROL_ENGINE_BUILD_HASH } = await import('../../src/lib/control-engine/identity.generated');

function emptyCost(): Cost {
  return { cpuMs: 0, elapsedMs: 0, requests: 0, requestBytes: 0, requestEncodedBytes: 0,
    responseBytes: 0, responseEncodedBytes: 0, privateObjectReads: 0, gzipCalls: 0, gunzipCalls: 0,
    jsonParses: 0, sql: emptySql() };
}

function addCost(total: Cost, value: Cost) {
  for (const key of ['cpuMs', 'elapsedMs', 'requests', 'requestBytes', 'requestEncodedBytes',
    'responseBytes', 'responseEncodedBytes', 'privateObjectReads', 'gzipCalls', 'gunzipCalls', 'jsonParses'] as const) total[key] += value[key];
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

async function runCourse(course: string, reportClientRef: string, fullRun = false) {
  const fixture = fixtures.get(course)!;
  const packets = fullRun ? fixture.packets : fixture.packets.slice(0, 3);
  const original = packets[0].requests.find(request => request.method === 'POST' && !request.path.includes('/chunks'))!.body;
  const opening = { ...original, reportClientRef, runRef: randomUUID() };
  const opened = await requestCost(opening, async request => service.openVesselEvidenceRun(userId!,
    contract.vesselEvidenceOpeningSchema.parse(await api.readVesselEvidenceJson(request)) as unknown as VesselEvidenceOpening));
  if (recordTiming) samples.push({ course, kind: 'initial-open', ordinal: 0, cost: opened.cost });
  for (const [ordinal, packet] of packets.entries()) {
    const finalPacket = fullRun && ordinal === packets.length - 1;
    const timed = recordTiming && (!fullRun || finalPacket);
    const counted = recordCoverage && (ordinal === 0 || finalPacket);
    if (counted) await inspector.post('Profiler.takePreciseCoverage');
    const total = emptyCost();
    const repeated = await requestCost(opening, async request => service.openVesselEvidenceRun(userId!,
      contract.vesselEvidenceOpeningSchema.parse(await api.readVesselEvidenceJson(request)) as unknown as VesselEvidenceOpening));
    addCost(total, repeated.cost);
    const sourceChunk = packet.requests.find(request => request.path.includes('/chunks'))!.body;
    const staged = await requestCost({ ...sourceChunk, runRef: opening.runRef }, async request =>
      chunks.stageVesselEvidenceBytes(userId!, opening.runRef, await api.readVesselEvidenceBytes(request)));
    addCost(total, staged.cost);
    const originalClose = packet.requests.find(request => request.method === 'PUT')!.body;
    const closing = { ...originalClose, pendingChunks: [staged.value.reference],
      ...(fullRun ? {} : { reason: 'checkpoint', failure: null }) };
    const saved = await requestCost(closing, async request => chunks.closeVesselEvidenceRun(userId!, opening.runRef,
      contract.vesselEvidenceCloseSchema.parse(await api.readVesselEvidenceJson(request)) as VesselEvidenceClose));
    addCost(total, saved.cost);
    const kind = finalPacket ? 'final-save' : 'automatic-save';
    if (timed) {
      samples.push({ course, kind, ordinal, cost: total });
      samples.push({ course, kind: finalPacket ? 'final-confirmation' : 'checkpoint-confirmation', ordinal, cost: saved.cost });
    }
    if (counted) coverageSamples.push({ course, kind,
      calls: coverageCounts(await inspector.post('Profiler.takePreciseCoverage')) });
    const expected = contract.vesselEvidenceCloseSchema.parse(closing);
    assert.equal(saved.value.controlCount, expected.controlCount);
    assert.equal(saved.value.nativeCount, expected.nativeCount);
    assert.equal(saved.value.lastTimeS, expected.endTimeS);
    if (!fullRun || finalPacket) {
      const restored = await requestCost(undefined, async () => recovery.loadOwnedCourseRunRecovery(userId!, opening.runRef), true);
      assert.equal(restored.value.checkpoint, expected.checkpoint);
      if (timed) samples.push({ course, kind: 'selected-run-recovery', ordinal, cost: restored.cost });
    }
  }
  if (fullRun) assert.notEqual((packets.at(-1)!.requests.find(request => request.method === 'PUT')!.body).reason, 'checkpoint');
}

async function sourceFingerprint() {
  const files = (await readdir('src/features/ilab')).filter(name => name.startsWith('course-evidence') && name.endsWith('.ts'))
    .map(name => 'src/features/ilab/' + name);
  files.push(...(await readdir('src/features/ilab/adapters'))
    .filter(name => name.startsWith('course-evidence') && name.endsWith('.ts'))
    .map(name => 'src/features/ilab/adapters/' + name));
  files.push('src/lib/data-governance/simulation-trace-cas.ts', 'src/lib/data-governance/simulation-trace-codec.ts',
    'src/features/ilab/adapters/course-session-recovery.ts', 'prisma/schema.prisma');
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
let revision: string;
try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
catch { revision = (await readFile('/app/.app-revision', 'utf8')).trim(); }

try {
  const identity = 'save_cost_' + randomUUID();
  await database.user.create({ data: { id: identity, name: 'ACT dedicated evidence save cost benchmark',
    role: 'STUDENT', accountSource: 'PLATFORM' } });
  userId = identity;
  const reports = new Map(courses.map(course => [course, randomUUID()]));
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
      .every(sample => sample.cost.privateObjectReads === 0), 'Confirmed chunks were re-read during ordinary saving');
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
      meanGzipCalls: rows.reduce((sum, row) => sum + row.cost.gzipCalls, 0)/rows.length,
      meanGunzipCalls: rows.reduce((sum, row) => sum + row.cost.gunzipCalls, 0)/rows.length,
      meanJsonParses: rows.reduce((sum, row) => sum + row.cost.jsonParses, 0)/rows.length };
  });
  await mkdir(path.dirname(output), { recursive: true });
  const result = { schema: 'act.evidence-save-cost.v1', capturedAt: new Date().toISOString(), revision,
    sourceFingerprint: fingerprint, toolFingerprint, inputDigest: inputHash.digest('hex'), runtimeVersion: CONTROL_ENGINE_BUILD_HASH,
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
    await database.virtualSimulationReport.deleteMany({ where: { userId } });
    await database.user.deleteMany({ where: { id: userId } });
    assert.equal(await database.user.count({ where: { id: userId } }), 0);
    assert.equal(await database.simulationRun.count({ where: { ownerUserId: userId } }), 0);
    assert.equal(await database.virtualSimulationReport.count({ where: { userId } }), 0);
  }
  await closeEvidenceCpuPool();
  await database.$disconnect();
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
