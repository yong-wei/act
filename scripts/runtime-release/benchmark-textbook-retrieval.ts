import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const indexPaths = [
  'resources/textbook-retrieval/vectors.f32',
  'resources/textbook-retrieval/bodies.utf8',
  'resources/textbook-retrieval/lexical-postings.bin',
];

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string) {
  const value = argument(name);
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return value;
}

function repetitions() {
  const raw = argument('--repetitions') ?? '3';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error('--repetitions must be an integer from 1 to 10');
  return value;
}

function concurrency() {
  const raw = argument('--concurrency') ?? '4';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 2 || value > 16) throw new Error('--concurrency must be an integer from 2 to 16');
  return value;
}

async function readAndHash(absolutePath: string) {
  const started = performance.now();
  const source = await readFile(absolutePath);
  return {
    elapsedMilliseconds: Number((performance.now() - started).toFixed(3)),
    sha256: createHash('sha256').update(source).digest('hex'),
  };
}

async function main() {
  const runtimeRoot = required('--runtime-root');
  const sourceRevision = required('--source-revision');
  if (!/^[0-9a-f]{40}$/u.test(sourceRevision)) throw new Error('--source-revision must be a 40-character Git revision');
  const output = argument('--output');
  const runs = repetitions();
  const concurrentReaders = concurrency();
  const files = [];
  for (const relativePath of indexPaths) {
    const absolutePath = path.join(runtimeRoot, ...relativePath.split('/'));
    const expected = await stat(absolutePath);
    const cold = await readAndHash(absolutePath);
    const warm = [];
    for (let run = 0; run < runs; run += 1) {
      warm.push(await readAndHash(absolutePath));
    }
    const concurrent = await Promise.all(Array.from({ length: concurrentReaders }, () => readAndHash(absolutePath)));
    const hashes = [cold.sha256, ...warm.map((measurement) => measurement.sha256), ...concurrent.map((measurement) => measurement.sha256)];
    if (new Set(hashes).size !== 1) throw new Error(`File changed while benchmarking: ${relativePath}`);
    files.push({
      relativePath,
      sizeBytes: expected.size,
      sha256: cold.sha256,
      coldReadMilliseconds: [cold.elapsedMilliseconds],
      warmReadMilliseconds: warm.map((measurement) => measurement.elapsedMilliseconds),
      concurrentReadMilliseconds: concurrent.map((measurement) => measurement.elapsedMilliseconds),
    });
  }
  const result = {
    schemaVersion: 'runtime-textbook-retrieval-benchmark.v1',
    sourceRevision,
    runtimeRootKind: argument('--runtime-root-kind') ?? 'unspecified',
    repetitions: runs,
    concurrency: concurrentReaders,
    files,
  };
  if (output) {
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
