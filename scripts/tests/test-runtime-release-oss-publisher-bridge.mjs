import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bridge = path.join(root, 'scripts/runtime-release/runtime-release-oss-publisher-bridge.py');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-bridge-contract-'));
const ossRoot = path.join(temporary, 'oss');
const lockRoot = path.join(temporary, 'locks');
const fakeOssutil = path.join(temporary, 'fake-ossutil.mjs');
await mkdir(ossRoot, { recursive: true });
await mkdir(lockRoot, { recursive: true });
await writeFile(fakeOssutil, `#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.env.FAKE_OSS_ROOT;
const bucket = 'test-bucket';
const objectPath = (url) => path.join(root, url.replace('oss://' + bucket + '/', ''));
const [operation, source, destination] = process.argv.slice(2);
if (operation === 'ls') {
  const prefix = objectPath(source);
  const entries = [];
  async function visit(current) {
    let children = [];
    try { children = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const child of children) {
      const absolute = path.join(current, child.name);
      if (child.isDirectory()) await visit(absolute);
      else entries.push({ name: 'oss://' + bucket + '/' + path.relative(root, absolute).split(path.sep).join('/'), size: (await stat(absolute)).size });
    }
  }
  await visit(prefix);
  process.stdout.write(JSON.stringify({ objects: entries }));
} else if (operation === 'cat') {
  process.stdout.write(await readFile(objectPath(source)));
} else if (operation === 'cp') {
  const target = objectPath(destination);
  try { await stat(target); if (process.argv.includes('--force=false')) process.exit(9); } catch {}
  await mkdir(path.dirname(target), { recursive: true });
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  if (process.env.FAKE_CP_DELAY_MS) await new Promise((resolve) => setTimeout(resolve, Number(process.env.FAKE_CP_DELAY_MS)));
  await writeFile(target, Buffer.concat(chunks));
} else process.exit(2);
`);
await chmod(fakeOssutil, 0o755);

const stable = (value) => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(stable).join(',')}]`
    : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const bytes = Buffer.from('{"bridge":true}\n');
const sourceRevision = 'c'.repeat(40);
const file = {
  path: 'lesson.json',
  objectKey: '',
  sizeBytes: bytes.byteLength,
  sha256: sha(bytes),
};
const treeSha256 = sha(stable([{ path: file.path, sizeBytes: file.sizeBytes, sha256: file.sha256 }]));
const releaseId = `runtime-${sha(stable({ sourceRevision, treeSha256 })).slice(0, 55)}`;
file.objectKey = `runtime/releases/${releaseId}/${file.path}`;
const body = {
  schemaVersion: 'act-runtime-release.v1',
  releaseId,
  sourceRevision,
  fileCount: 1,
  totalBytes: bytes.byteLength,
  treeSha256,
  files: [file],
};
const manifest = { ...body, manifestSha256: sha(stable(body)) };
const wire = Buffer.from(`${stable(manifest)}\n`);
const prefix = `runtime/releases/${releaseId}/`;
const manifestKey = `${prefix}.act-runtime-release.v1.json`;
const header = JSON.stringify({
  protocol: 'act-runtime-release-stream.v1',
  releaseId,
  prefix,
  manifestSha256: manifest.manifestSha256,
  wireSha256: sha(wire),
  manifestWireBase64: wire.toString('base64url'),
});

function close(child) {
  return new Promise((resolve) => child.once('close', (code, signal) => resolve({ code, signal })));
}

async function publish({ onFirstControl, crashAfterFrame = false, delayMs = '20' } = {}) {
  const child = spawn('python3', [bridge, '--bucket', 'test-bucket', '--operation', 'publish', '--prefix-b64', Buffer.from(prefix).toString('base64url')], {
    env: { ...process.env, ACT_RUNTIME_RELEASE_OSSUTIL: fakeOssutil, FAKE_OSS_ROOT: ossRoot, ACT_RUNTIME_RELEASE_LOCK_DIR: lockRoot, FAKE_CP_DELAY_MS: delayMs },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stderr = [];
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  const reader = createInterface({ input: child.stdout });
  const lines = reader[Symbol.asyncIterator]();
  child.stdin.write(`${header}\n`);
  const first = await lines.next();
  if (first.done) {
    const result = await close(child);
    throw new Error(`bridge failed before state: ${Buffer.concat(stderr).toString()} (${JSON.stringify(result)})`);
  }
  const state = JSON.parse(first.value);
  await onFirstControl?.(state);
  if (state.status === 'complete') {
    child.stdin.end();
    const result = await close(child);
    reader.close();
    assert.equal(result.code, 0, Buffer.concat(stderr).toString());
    return state;
  }
  assert.equal(state.status, 'stream');
  for (const key of state.missingKeys) {
    assert.equal(key, file.objectKey);
    child.stdin.write(`${JSON.stringify({ key: file.objectKey, sizeBytes: file.sizeBytes, sha256: file.sha256 })}\n`);
    child.stdin.write(bytes);
    if (crashAfterFrame) {
      child.kill('SIGKILL');
      const result = await close(child);
      reader.close();
      assert.equal(result.signal, 'SIGKILL');
      return null;
    }
  }
  child.stdin.end('DONE\n');
  const final = await lines.next();
  const result = await close(child);
  reader.close();
  assert.equal(result.code, 0, Buffer.concat(stderr).toString());
  assert.equal(final.done, false);
  return JSON.parse(final.value);
}

try {
  const first = publish();
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = publish();
  const [firstReceipt, secondReceipt] = await Promise.all([first, second]);
  assert.deepEqual([firstReceipt.putCount, secondReceipt.putCount].sort(), [0, 2]);
  assert.equal(firstReceipt.status, 'complete');
  assert.equal(secondReceipt.status, 'complete');

  await rm(path.join(ossRoot, prefix), { recursive: true, force: true });
  const crashed = await publish({ crashAfterFrame: true, delayMs: '0' });
  assert.equal(crashed, null);
  // The child was killed before it could finish the fake cp process. Model the
  // durable partial object left by a real remote PUT before retrying.
  await mkdir(path.dirname(path.join(ossRoot, file.objectKey)), { recursive: true });
  await writeFile(path.join(ossRoot, file.objectKey), bytes);
  const recovered = await publish();
  assert.equal(recovered.putCount, 1, 'recovery after a pre-manifest crash must only write the manifest');
  assert.equal(recovered.manifestSha256, manifest.manifestSha256);
  console.log('runtime release OSS bridge transaction contract passed');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
