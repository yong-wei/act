import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { vesselTraceChunkSchema } from '../../src/features/ilab/course-evidence-contract';
import { decodeVesselTraceColumns, encodeVesselTraceColumns } from '../../src/features/simulations/evidence-chunk-columns';
import type { VesselTraceChunkData } from '../../src/features/simulations/run-evidence';
import { canonicalJson } from '../../src/lib/student-model-artifact-contract';

function option(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const fixtureRoot = option('--fixtures', '.tmp/load-fixtures');
const output = option('--output', '.logs/compact-evidence-benchmark.json');
const additional = option('--additional-manifest', '');
const rounds = Number(option('--rounds', '5'));
assert(Number.isSafeInteger(rounds) && rounds > 0 && rounds <= 20);

type Fixture = { packets: Array<{ requests: Array<{ path: string; body: VesselTraceChunkData }> }> };
const digest = createHash('sha256');
const fixtures = new Map<string, VesselTraceChunkData[]>();
for (const key of ['destroyer', 'lng', 'container', 'cruise', 'drilling', 'icebreaker', 'dredger']) {
  const gzip = await readFile(join(fixtureRoot, key + '.json.gz'));
  digest.update(key).update(gzip);
  const fixture = JSON.parse(gunzipSync(gzip).toString()) as Fixture;
  fixtures.set(key, fixture.packets.flatMap(packet => packet.requests
    .filter(request => request.path.includes('/chunks')).map(request => request.body)));
}
if (additional) {
  const manifest = JSON.parse(await readFile(additional, 'utf8')) as { runs: { chunks: string[] }[] };
  const chunks = [];
  for (const run of manifest.runs) {
    for (const file of [run.chunks[0], run.chunks.at(-1)!]) {
      const json = await readFile(join(dirname(additional), file));
      digest.update(json);
      chunks.push(JSON.parse(json.toString()) as VesselTraceChunkData);
    }
  }
  fixtures.set('additional', chunks);
}

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const cpuMs = (since: NodeJS.CpuUsage) => {
  const cpu = process.cpuUsage(since);
  return (cpu.user + cpu.system) / 1000;
};
const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const results: Array<{ fixture: string; chunks: number; legacy: Measurement; columns: Measurement }> = [];
for (const [fixture, chunks] of fixtures) {
  assert(chunks.length > 0, 'Missing representative chunks for ' + fixture);
  const measures = { legacy: [] as Measurement[], columns: [] as Measurement[] };
  for (let round = -1; round < rounds; round++) {
    for (const mode of round % 2 === 0 ? ['legacy', 'columns'] as const : ['columns', 'legacy'] as const) {
      const metrics = { rawBytes: 0, gzipBytes: 0, writeCpuMs: 0, readAndValidateCpuMs: 0 };
      for (const chunk of chunks) {
        const write = process.cpuUsage();
        const bytes = mode === 'legacy' ? Buffer.from(canonicalJson(chunk)) : encodeVesselTraceColumns(chunk);
        assert(bytes, 'Representative chunk exceeded compact format bounds');
        const checksum = sha(bytes);
        const compressed = gzipSync(bytes);
        metrics.writeCpuMs += cpuMs(write);
        metrics.rawBytes += bytes.byteLength;
        metrics.gzipBytes += compressed.byteLength;
        const read = process.cpuUsage();
        const decompressed = gunzipSync(compressed);
        assert.equal(sha(decompressed), checksum);
        const decoded: unknown = mode === 'legacy' ? JSON.parse(decompressed.toString()) : decodeVesselTraceColumns(decompressed);
        assert(vesselTraceChunkSchema.safeParse(decoded).success);
        metrics.readAndValidateCpuMs += cpuMs(read);
        if (round === -1) assert.equal(canonicalJson(decoded), canonicalJson(chunk));
      }
      if (round >= 0) measures[mode].push(metrics);
    }
  }
  results.push({ fixture, chunks: chunks.length, legacy: summarize(measures.legacy), columns: summarize(measures.columns) });
}

interface Measurement { rawBytes: number; gzipBytes: number; writeCpuMs: number; readAndValidateCpuMs: number }
function summarize(rows: Measurement[]) {
  return {
    rawBytes: rows[0].rawBytes,
    gzipBytes: rows[0].gzipBytes,
    writeCpuMs: median(rows.map(row => row.writeCpuMs)),
    readAndValidateCpuMs: median(rows.map(row => row.readAndValidateCpuMs)),
  };
}

const totals = (['legacy', 'columns'] as const).map(mode => ({ mode,
  rawBytes: results.reduce((sum, row) => sum + row[mode].rawBytes, 0),
  gzipBytes: results.reduce((sum, row) => sum + row[mode].gzipBytes, 0),
  writeCpuMs: results.reduce((sum, row) => sum + row[mode].writeCpuMs, 0),
  readAndValidateCpuMs: results.reduce((sum, row) => sum + row[mode].readAndValidateCpuMs, 0),
}));
const receipt = {
  schema: 'act.evidence-columns-benchmark.v1', node: process.version, platform: process.platform,
  chunks: results.reduce((sum, row) => sum + row.chunks, 0),
  inputDigest: digest.digest('hex'), rounds, allCanonicalValuesEqual: true,
  scope: 'Gzip and decompressed SHA-256 in both arms, existing trace validation on read. CPU totals sum per-fixture medians. No database, WASM or network.',
  results, totals,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ chunks: receipt.chunks, rounds, totals, allCanonicalValuesEqual: true }));
