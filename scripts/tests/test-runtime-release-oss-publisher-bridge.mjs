import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bridge = path.join(root, 'scripts/runtime-release/runtime-release-oss-publisher-bridge.py');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-bridge-contract-'));
const ossRoot = path.join(temporary, 'oss');
const spoolRoot = path.join(temporary, 'spool');
const lockRoot = path.join(temporary, 'locks');
const fakeOssutil = path.join(temporary, 'fake-ossutil.mjs');
await mkdir(ossRoot, { recursive: true });
await mkdir(spoolRoot, { recursive: true });
await mkdir(lockRoot, { recursive: true });
await chmod(spoolRoot, 0o700);

const imds = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end('act-runtime-oss-publisher\n');
});
await new Promise((resolve) => imds.listen(0, '127.0.0.1', resolve));
const imdsRoleUrl = `http://127.0.0.1:${imds.address().port}/latest/meta-data/ram/security-credentials/`;

await writeFile(fakeOssutil, `#!/usr/bin/env node
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.env.FAKE_OSS_ROOT;
const bucket = 'test-bucket';
const objectPath = (key) => path.join(root, key.replace('runtime/releases/', 'runtime/releases/'));
const args = process.argv.slice(2);
const has = (flag, value) => args.includes(flag) && (!value || args[args.indexOf(flag) + 1] === value);
const mode = process.env.FAKE_V2_MODE || '';
const v1Mode = process.env.FAKE_V1_MODE || '';
const operation = args[0];
if (operation === 'api') {
  if (!has('--mode', 'EcsRamRole') || args.includes('--role-arn') || !has('--endpoint', 'oss-cn-hangzhou-internal.aliyuncs.com') || !has('--region', 'cn-hangzhou')) process.exit(10);
  const api = args[1];
  if (api === 'list-objects-v2') {
    if (mode === 'nonzero') process.exit(12);
    if (mode === 'malformed') { process.stdout.write('{malformed'); process.exit(0); }
    const prefix = args[args.indexOf('--prefix') + 1];
    const token = args.includes('--continuation-token') ? args[args.indexOf('--continuation-token') + 1] : null;
    let entries = [];
    async function visit(current) {
      let children = [];
      try { children = await readdir(current, { withFileTypes: true }); } catch { return; }
      for (const child of children) {
        const absolute = path.join(current, child.name);
        if (child.isDirectory()) await visit(absolute);
        else entries.push({ key: path.relative(root, absolute).split(path.sep).join('/'), size: (await stat(absolute)).size });
      }
    }
    await visit(root);
    entries = entries.filter((entry) => entry.key.startsWith(prefix)).sort((a, b) => a.key.localeCompare(b.key));
    const start = token ? Number(token) : 0;
    const pageSize = Number(process.env.FAKE_PAGE_SIZE || 1);
    const page = entries.slice(start, start + pageSize);
    if (mode === 'duplicate' && page.length) page.push(page[0]);
    if (mode === 'outside') page.push({ key: 'runtime/releases/other-release/outside.txt', size: 1 });
    if (mode === 'control' && page.length) page[0] = { ...page[0], key: page[0].key + String.fromCharCode(11) };
    if (mode === 'wrong-size' && page.length) page[0] = { ...page[0], size: page[0].size + 1 };
    const end = start + page.length;
    const truncated = mode === 'repeat-token' ? end < entries.length : start + page.length < entries.length;
    const contentItems = page.map((entry) => ({ Key: entry.key, Size: String(entry.size), Type: 'Normal' }));
    const payload = {
      Contents: contentItems.length === 1 ? contentItems[0] : contentItems,
      IsTruncated: truncated ? 'true' : 'false',
      KeyCount: String(page.length),
      MaxKeys: String(pageSize),
      Name: bucket,
      Prefix: prefix,
    };
    if (truncated) payload.NextContinuationToken = mode === 'repeat-token' ? 'repeat' : String(end);
    process.stdout.write(JSON.stringify(payload));
  } else if (api === 'get-object') {
    const key = args[args.indexOf('--key') + 1];
    try { process.stdout.write(await readFile(objectPath(key))); } catch { process.exit(4); }
  } else if (api === 'put-object') {
    const key = args[args.indexOf('--key') + 1];
    const body = args[args.indexOf('--body') + 1];
    const target = objectPath(key);
    if (process.env.FAKE_PUT_DELAY_MS) await new Promise((resolve) => setTimeout(resolve, Number(process.env.FAKE_PUT_DELAY_MS)));
    try { await stat(target); process.exit(9); } catch {}
    await mkdir(path.dirname(target), { recursive: true });
    let conflictAlready = false;
    if (process.env.FAKE_CONFLICT_MARKER) {
      try { await stat(process.env.FAKE_CONFLICT_MARKER); conflictAlready = true; } catch {}
    }
    if (process.env.FAKE_CONFLICT_MODE && !conflictAlready) {
      const bytes = await readFile(body.replace('file://', ''));
      await writeFile(target, process.env.FAKE_CONFLICT_MODE === 'match' ? bytes : Buffer.from('different'));
      await writeFile(process.env.FAKE_CONFLICT_MARKER, '1');
      process.exit(9);
    }
    if (process.env.FAKE_LOG) await writeFile(process.env.FAKE_LOG, key + '\\n', { flag: 'a' });
    await copyFile(body.replace('file://', ''), target);
  } else process.exit(2);
} else if (operation === 'ls') {
  if (args[2] !== '-s') process.exit(11);
  if (v1Mode === 'nonzero') process.exit(12);
  const prefixUrl = args[1];
  const prefix = prefixUrl.slice(('oss://' + bucket + '/').length);
  const entries = [];
  async function visit(current) {
    let children = [];
    try { children = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const child of children) {
      const absolute = path.join(current, child.name);
      if (child.isDirectory()) await visit(absolute);
      else entries.push('oss://' + bucket + '/' + path.relative(root, absolute).split(path.sep).join('/'));
    }
  }
  await visit(root);
  const filtered = entries.filter((entry) => entry.slice(('oss://' + bucket + '/').length).startsWith(prefix));
  const lines = [...filtered, 'Object Number is: ' + filtered.length, 'Total Size is 0'];
  if (v1Mode === 'unknown') lines.push('diagnostic output is not an object URL');
  if (v1Mode === 'duplicate' && filtered.length) lines.push(filtered[0]);
  if (v1Mode === 'outside') lines.push('oss://' + bucket + '/runtime/releases/other-release/outside.txt');
  if (v1Mode === 'control' && filtered.length) lines.push(filtered[0] + String.fromCharCode(11) + 'diagnostic');
  lines.push('0.012345(s) elapsed');
  process.stdout.write(lines.join('\\n') + '\\n');
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
const buildManifest = (sizeOverride = bytes.byteLength) => {
  const sourceRevision = 'c'.repeat(40);
  const file = {
    path: `deep/${'segment-'.repeat(28)}folder/课程 文件/${'尾巴-'.repeat(20)}lesson.json`,
    objectKey: '',
    sizeBytes: sizeOverride,
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
    totalBytes: sizeOverride,
    treeSha256,
    files: [file],
  };
  const manifest = { ...body, manifestSha256: sha(stable(body)) };
  const wire = Buffer.from(`${stable(manifest)}\n`);
  const prefix = `runtime/releases/${releaseId}/`;
  return { file, manifest, wire, prefix, manifestKey: `${prefix}.act-runtime-release.v1.json` };
};

const state = buildManifest();
const headerFor = ({ file, manifest, wire, prefix }) => JSON.stringify({
  protocol: 'act-runtime-release-stream.v1',
  releaseId: manifest.releaseId,
  prefix,
  manifestSha256: manifest.manifestSha256,
  wireSha256: sha(wire),
  manifestWireBase64: wire.toString('base64url'),
});
const close = (child) => new Promise((resolve) => child.once('close', (code, signal) => resolve({ code, signal })));
const spoolFor = (prefix) => path.join(spoolRoot, sha(prefix));

async function publish({ data = state, crashAfterFrame = false, frameBytes = bytes, env = {} } = {}) {
  const child = spawn('python3', [bridge, '--bucket', 'test-bucket', '--operation', 'publish', '--prefix-b64', Buffer.from(data.prefix).toString('base64url')], {
    env: {
      ...process.env,
      ACT_RUNTIME_RELEASE_TEST_MODE: '1',
      ACT_RUNTIME_RELEASE_OSSUTIL: fakeOssutil,
      ACT_RUNTIME_RELEASE_IMDS_ROLE_URL: imdsRoleUrl,
      ACT_RUNTIME_RELEASE_LOCK_DIR: lockRoot,
      ACT_RUNTIME_RELEASE_SPOOL_DIR: spoolRoot,
      FAKE_OSS_ROOT: ossRoot,
      FAKE_PAGE_SIZE: '1',
      ...env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stderr = [];
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  const reader = createInterface({ input: child.stdout });
  const lines = reader[Symbol.asyncIterator]();
  child.stdin.write(`${headerFor(data)}\n`);
  const first = await lines.next();
  if (first.done) {
    const result = await close(child);
    reader.close();
    throw new Error(`bridge failed before state: ${Buffer.concat(stderr).toString()} (${JSON.stringify(result)})`);
  }
  const control = JSON.parse(first.value);
  if (control.status === 'complete') {
    child.stdin.end();
    const result = await close(child);
    reader.close();
    assert.equal(result.code, 0, Buffer.concat(stderr).toString());
    return control;
  }
  assert.equal(control.status, 'stream');
  for (const key of control.missingKeys) {
    assert.equal(key, data.file.objectKey);
    child.stdin.write(`${JSON.stringify({ key: data.file.objectKey, sizeBytes: data.file.sizeBytes, sha256: data.file.sha256 })}\n`);
    child.stdin.write(frameBytes);
    if (crashAfterFrame) {
      await new Promise((resolve) => setTimeout(resolve, 100));
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
  if (result.code !== 0) throw new Error(`bridge publish failed: ${Buffer.concat(stderr).toString()}`);
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
  assert.ok(state.file.objectKey.length > 256, 'long object keys must survive v2 JSON and v1 text cross-checks');
  assert.match(state.file.path, / /);
  assert.match(state.file.path, /课程 文件/);

  const releaseSpool = spoolFor(state.prefix);
  await rm(path.join(ossRoot, state.prefix), { recursive: true, force: true });
  await rm(releaseSpool, { recursive: true, force: true });
  const crashed = await publish({ crashAfterFrame: true, env: { FAKE_PUT_DELAY_MS: '1000' } });
  assert.equal(crashed, null);
  assert.equal((await readdir(releaseSpool)).length, 1, 'a killed stream must leave a detectable spool residue');
  await assert.rejects(() => publish(), /residual files/);
  await rm(releaseSpool, { recursive: true, force: true });
  const recovered = await publish();
  assert.equal(recovered.putCount, 2);

  await rm(path.join(ossRoot, state.prefix), { recursive: true, force: true });
  await assert.rejects(() => publish({ frameBytes: Buffer.from('wrong') }), /bridge publish failed/);
  assert.equal((await readdir(spoolRoot)).filter((entry) => entry !== path.basename(releaseSpool)).length, 0, 'hash mismatch must clean the current frame');

  const oversized = buildManifest(256 * 1024 * 1024 + 1);
  await assert.rejects(() => publish({ data: oversized }), /bridge failed before state/);

  await rm(path.join(ossRoot, state.prefix), { recursive: true, force: true });
  const conflictMarker = path.join(temporary, 'conflict-match.marker');
  const conflict = await publish({ env: { FAKE_CONFLICT_MODE: 'match', FAKE_CONFLICT_MARKER: conflictMarker } });
  assert.equal(conflict.status, 'complete', 'a same-content conditional conflict may be skipped after v2 verification');

  await rm(path.join(ossRoot, state.prefix), { recursive: true, force: true });
  const differentMarker = path.join(temporary, 'conflict-different.marker');
  await assert.rejects(() => publish({ env: { FAKE_CONFLICT_MODE: 'different', FAKE_CONFLICT_MARKER: differentMarker } }), /bridge publish failed/);

  for (const mode of ['malformed', 'duplicate', 'outside', 'control', 'wrong-size', 'repeat-token', 'nonzero']) {
    await assert.rejects(
      () => publish({ env: { FAKE_V2_MODE: mode } }),
      /bridge failed before state/,
      `v2 list ${mode} output must fail closed before any publish control response`,
    );
  }

  await rm(path.join(ossRoot, state.prefix), { recursive: true, force: true });
  const log = path.join(temporary, 'put.log');
  const logged = await publish({ env: { FAKE_LOG: log } });
  assert.equal(logged.status, 'complete');
  const puts = (await readFile(log, 'utf8')).trim().split('\n');
  assert.equal(puts.at(-1), state.manifestKey, 'completion manifest must be the final put');

  await rm(path.join(ossRoot, state.prefix), { recursive: true, force: true });
  await assert.rejects(() => publish({ env: { FAKE_V1_MODE: 'outside' } }), /bridge publish failed/);
  console.log('runtime release OSS v2 spool/conditional bridge contract passed');
} finally {
  await new Promise((resolve) => imds.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
