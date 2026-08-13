import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const indexPaths = [
  'resources/textbook-hybrid-retrieval/bge-m3/vectors.f32',
  'resources/textbook-hybrid-retrieval/bge-m3/bodies.utf8',
  'resources/textbook-hybrid-retrieval/bge-m3/lexical-postings.bin',
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

async function main() {
  const runtimeRoot = required('--runtime-root');
  const sourceRevision = required('--source-revision');
  if (!/^[0-9a-f]{40}$/u.test(sourceRevision)) throw new Error('--source-revision must be a 40-character Git revision');
  const output = argument('--output');
  const runs = repetitions();
  const files = [];
  for (const relativePath of indexPaths) {
    const absolutePath = path.join(runtimeRoot, ...relativePath.split('/'));
    const expected = await stat(absolutePath);
    const measurements: number[] = [];
    let sha256 = '';
    for (let run = 0; run < runs; run += 1) {
      const started = performance.now();
      const source = await readFile(absolutePath);
      measurements.push(Number((performance.now() - started).toFixed(3)));
      const digest = createHash('sha256').update(source).digest('hex');
      if (sha256 && sha256 !== digest) throw new Error(`File changed while benchmarking: ${relativePath}`);
      sha256 = digest;
    }
    files.push({ relativePath, sizeBytes: expected.size, sha256, readMilliseconds: measurements });
  }
  const result = {
    schemaVersion: 'runtime-textbook-retrieval-benchmark.v1',
    sourceRevision,
    runtimeRootKind: argument('--runtime-root-kind') ?? 'unspecified',
    repetitions: runs,
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
