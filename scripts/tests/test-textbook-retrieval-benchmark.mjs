import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'act-textbook-benchmark-'));
const runtimeRoot = path.join(temporary, 'runtime');
const output = path.join(temporary, 'benchmark.json');
const indexRoot = path.join(runtimeRoot, 'resources', 'textbook-retrieval');

try {
  fs.mkdirSync(indexRoot, { recursive: true });
  fs.writeFileSync(path.join(indexRoot, 'vectors.f32'), Buffer.from([1, 2, 3, 4]));
  fs.writeFileSync(path.join(indexRoot, 'bodies.utf8'), 'body\n');
  fs.writeFileSync(path.join(indexRoot, 'lexical-postings.bin'), Buffer.from([5, 6, 7]));
  const result = spawnSync(path.join(root, 'node_modules', '.bin', 'tsx'), [
    'scripts/runtime-release/benchmark-textbook-retrieval.ts',
    '--runtime-root', runtimeRoot,
    '--source-revision', 'a'.repeat(40),
    '--repetitions', '2',
    '--concurrency', '3',
    '--output', output,
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const benchmark = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(benchmark.concurrency, 3);
  assert.equal(benchmark.files.length, 3);
  for (const file of benchmark.files) {
    assert.equal(file.coldReadMilliseconds.length, 1);
    assert.equal(file.warmReadMilliseconds.length, 2);
    assert.equal(file.concurrentReadMilliseconds.length, 3);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('textbook retrieval cold/warm/concurrent benchmark contract passed');
