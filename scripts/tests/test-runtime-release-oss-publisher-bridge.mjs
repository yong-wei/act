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
const ossMetadata = path.join(temporary, 'oss-metadata.json');
const spoolRoot = path.join(temporary, 'spool');
const lockRoot = path.join(temporary, 'locks');
const fakeOssutil = path.join(temporary, 'fake-ossutil.mjs');
const fakeIdentity = path.join(temporary, 'fake-identity.mjs');
await mkdir(ossRoot, { recursive: true });
await mkdir(spoolRoot, { recursive: true });
await mkdir(lockRoot, { recursive: true });
await chmod(spoolRoot, 0o700);

let imdsRoleName = 'act-runtime-oss-release-operator-ecs';
const imds = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end(`${imdsRoleName}\n`);
});
await new Promise((resolve) => imds.listen(0, '127.0.0.1', resolve));
const imdsRoleUrl = `http://127.0.0.1:${imds.address().port}/latest/meta-data/ram/security-credentials/`;

await writeFile(fakeOssutil, `#!/usr/bin/env node
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.env.FAKE_OSS_ROOT;
const metadataFile = process.env.FAKE_OSS_METADATA;
const bucket = 'test-bucket';
const objectPath = (key) => path.join(root, key.replace('runtime/releases/', 'runtime/releases/'));
const args = process.argv.slice(2);
const has = (flag, value) => args.includes(flag) && (!value || args[args.indexOf(flag) + 1] === value);
const mode = process.env.FAKE_V2_MODE || '';
const v1Mode = process.env.FAKE_V1_MODE || '';
const operation = args[0];
const readMetadata = async () => {
  try { return JSON.parse(await readFile(metadataFile, 'utf8')); } catch { return {}; }
};
const writeMetadata = async (value) => writeFile(metadataFile, JSON.stringify(value));
if (operation === 'api') {
  const endpoint = process.env.FAKE_LOCAL === '1' ? 'https://oss-cn-hangzhou.aliyuncs.com' : 'oss-cn-hangzhou-internal.aliyuncs.com';
  if ((process.env.FAKE_LOCAL === '1' ? args.includes('--mode') : !has('--mode', 'EcsRamRole')) || args.includes('--role-arn') || !has('--endpoint', endpoint) || !has('--region', 'cn-hangzhou')) process.exit(10);
  const api = args[1];
  if (api === 'list-objects-v2') {
    if (mode === 'nonzero') process.exit(12);
    if (mode === 'malformed') { process.stdout.write('{malformed'); process.exit(0); }
    const prefix = args[args.indexOf('--prefix') + 1];
    if (process.env.FAKE_LIST_LOG) await writeFile(process.env.FAKE_LIST_LOG, prefix + '\\n', { flag: 'a' });
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
    if (process.env.FAKE_GET_LOG) await writeFile(process.env.FAKE_GET_LOG, key + '\\n', { flag: 'a' });
    try { process.stdout.write(await readFile(objectPath(key))); } catch { process.exit(4); }
  } else if (api === 'head-object') {
    const key = args[args.indexOf('--key') + 1];
    if (process.env.FAKE_HEAD_LOG) await writeFile(process.env.FAKE_HEAD_LOG, key + '\\n', { flag: 'a' });
    try {
      const details = await stat(objectPath(key));
      const metadata = await readMetadata();
      process.stdout.write(JSON.stringify({ ContentLength: String(details.size), Metadata: metadata[key] || {} }));
    } catch {
      process.stderr.write('NoSuchKey');
      process.exit(4);
    }
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
    const metadata = await readMetadata();
    for (let index = 0; index < args.length; index += 1) {
      if (args[index] !== '--metadata') continue;
      const pair = args[index + 1];
      const delimiter = typeof pair === 'string' ? pair.indexOf('=') : -1;
      if (delimiter <= 0) process.exit(13);
      metadata[key] = metadata[key] || {};
      metadata[key][pair.slice(0, delimiter)] = pair.slice(delimiter + 1);
    }
    await writeMetadata(metadata);
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
await writeFile(fakeIdentity, `#!/usr/bin/env node
process.stdout.write(JSON.stringify({ AccountId: '1444654551628953', Arn: 'acs:ram::1444654551628953:role/act-runtime-oss-release-operator' }));
`);
await chmod(fakeIdentity, 0o755);

const stable = (value) => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(stable).join(',')}]`
    : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const bytes = Buffer.from('{"bridge":true}\n');
const buildManifest = (sizeOverride = bytes.byteLength, sourceRevision = 'c'.repeat(40)) => {
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
const forgeManifest = ({ schemaVersion = 'act-runtime-release.v1', treeSha256 = state.manifest.treeSha256 } = {}) => {
  const sourceRevision = state.manifest.sourceRevision;
  const releaseId = `runtime-${sha(stable({ sourceRevision, treeSha256 })).slice(0, 55)}`;
  const file = {
    ...state.file,
    objectKey: `runtime/releases/${releaseId}/${state.file.path}`,
  };
  const body = {
    schemaVersion,
    releaseId,
    sourceRevision,
    fileCount: 1,
    totalBytes: file.sizeBytes,
    treeSha256,
    files: [file],
  };
  const manifest = { ...body, manifestSha256: sha(stable(body)) };
  const wire = Buffer.from(`${stable(manifest)}\n`);
  const prefix = `runtime/releases/${releaseId}/`;
  return { file, manifest, wire, prefix, manifestKey: `${prefix}.act-runtime-release.v1.json` };
};
const headerFor = ({ file, manifest, wire, prefix }) => JSON.stringify({
  protocol: 'act-runtime-release-stream.v1',
  releaseId: manifest.releaseId,
  prefix,
  manifestSha256: manifest.manifestSha256,
  wireSha256: sha(wire),
  manifestWireBase64: wire.toString('base64url'),
});
const buildBlobState = (sourceRevision = 'd'.repeat(40), frameBytes = bytes) => {
  const fileBytes = Array.isArray(frameBytes) ? frameBytes : [frameBytes, frameBytes];
  assert.equal(fileBytes.length, 2, 'blob test fixtures require two logical files');
  const files = [
    'lessons/1-1/media/shared-a.bin',
    'lessons/1-2/media/shared-b.bin',
  ].map((filePath, index) => ({
    path: filePath,
    objectKey: `runtime/blobs/sha256/${sha(fileBytes[index])}`,
    sizeBytes: fileBytes[index].byteLength,
    sha256: sha(fileBytes[index]),
  }));
  const treeSha256 = sha(stable(files.map(({ path: filePath, sizeBytes, sha256 }) => ({ path: filePath, sizeBytes, sha256 }))));
  const releaseId = `runtime-${sha(stable({ sourceRevision, treeSha256 })).slice(0, 55)}`;
  const body = {
    schemaVersion: 'act-runtime-release.v2',
    releaseId,
    sourceRevision,
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    treeSha256,
    files,
  };
  const manifest = { ...body, manifestSha256: sha(stable(body)) };
  const wire = Buffer.from(`${stable(manifest)}\n`);
  const prefix = `runtime/blob-releases/${releaseId}/`;
  const manifestKey = `${prefix}manifest.json`;
  const receiptBody = {
    schemaVersion: 'act-runtime-release-receipt.v2',
    releaseId,
    manifestVersion: 'act-runtime-release.v2',
    manifestObjectKey: manifestKey,
    manifestSha256: manifest.manifestSha256,
    manifestWireSha256: sha(wire),
    manifestWireSizeBytes: wire.byteLength,
    treeSha256,
    fileCount: files.length,
    totalBytes: body.totalBytes,
    blobs: [...new Map(files.map((file) => [file.objectKey, {
      objectKey: file.objectKey,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
    }])).values()].sort((left, right) => left.objectKey.localeCompare(right.objectKey)),
  };
  const receipt = { ...receiptBody, receiptSha256: sha(stable(receiptBody)) };
  const receiptWire = Buffer.from(`${stable(receipt)}\n`);
  return {
    files,
    manifest,
    wire,
    receipt,
    receiptWire,
    prefix,
    manifestKey,
    receiptKey: `${prefix}receipt.json`,
    frameBytesByKey: new Map(files.map((file, index) => [file.objectKey, fileBytes[index]])),
  };
};
const buildBlobStateFromV1 = (source) => {
  const files = source.manifest.files.map((file) => ({
    path: file.path,
    objectKey: `runtime/blobs/sha256/${file.sha256}`,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
  }));
  const treeSha256 = sha(stable(files.map(({ path: filePath, sizeBytes, sha256 }) => ({ path: filePath, sizeBytes, sha256 }))));
  const releaseId = `runtime-${sha(stable({ sourceRevision: source.manifest.sourceRevision, treeSha256 })).slice(0, 55)}`;
  const body = {
    schemaVersion: 'act-runtime-release.v2',
    releaseId,
    sourceRevision: source.manifest.sourceRevision,
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    treeSha256,
    files,
  };
  const manifest = { ...body, manifestSha256: sha(stable(body)) };
  const wire = Buffer.from(`${stable(manifest)}\n`);
  const prefix = `runtime/blob-releases/${releaseId}/`;
  const manifestKey = `${prefix}manifest.json`;
  const receiptBody = {
    schemaVersion: 'act-runtime-release-receipt.v2',
    releaseId,
    manifestVersion: 'act-runtime-release.v2',
    manifestObjectKey: manifestKey,
    manifestSha256: manifest.manifestSha256,
    manifestWireSha256: sha(wire),
    manifestWireSizeBytes: wire.byteLength,
    treeSha256,
    fileCount: files.length,
    totalBytes: body.totalBytes,
    blobs: files.map((file) => ({ objectKey: file.objectKey, sizeBytes: file.sizeBytes, sha256: file.sha256 })),
  };
  const receipt = { ...receiptBody, receiptSha256: sha(stable(receiptBody)) };
  const receiptWire = Buffer.from(`${stable(receipt)}\n`);
  return { files, manifest, wire, receiptWire, prefix, manifestKey, receiptKey: `${prefix}receipt.json` };
};
const blobHeaderFor = (data, parent) => JSON.stringify({
  protocol: 'act-runtime-blob-release-stream.v2',
  releaseId: data.manifest.releaseId,
  prefix: data.prefix,
  manifestSha256: data.manifest.manifestSha256,
  wireSha256: sha(data.wire),
  manifestWireBase64: data.wire.toString('base64url'),
  receiptWireSha256: sha(data.receiptWire),
  receiptWireBase64: data.receiptWire.toString('base64url'),
  ...(parent ? { parentRelease: { releaseId: parent.manifest.releaseId, manifestSha256: parent.manifest.manifestSha256 } } : {}),
});
const blobImportHeaderFor = (source, target) => JSON.stringify({
  protocol: 'act-runtime-blob-release-import.v1',
  releaseId: target.manifest.releaseId,
  prefix: target.prefix,
  manifestSha256: target.manifest.manifestSha256,
  wireSha256: sha(target.wire),
  manifestWireBase64: target.wire.toString('base64url'),
  receiptWireSha256: sha(target.receiptWire),
  receiptWireBase64: target.receiptWire.toString('base64url'),
  sourceReleaseId: source.manifest.releaseId,
  sourcePrefix: source.prefix,
  sourceManifestSha256: source.manifest.manifestSha256,
  sourceManifestWireSha256: sha(source.wire),
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
      FAKE_OSS_METADATA: ossMetadata,
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

async function publishBlob({ data = buildBlobState(), parent, crashAfterFrame = false, crashDelayMs = 100, frameBytes, env = {}, local = false } = {}) {
  const localArguments = local ? [
    '--credential-mode', 'local',
    '--ossutil-path', fakeOssutil,
    '--ossutil-sha256', sha(await readFile(fakeOssutil)),
    '--identity-command-path', fakeIdentity,
    '--identity-command-sha256', sha(await readFile(fakeIdentity)),
    '--operator-account-id', '1444654551628953',
    '--operator-principal-arn', 'acs:ram::1444654551628953:role/act-runtime-oss-release-operator',
    '--lock-dir', lockRoot,
    '--spool-dir', spoolRoot,
  ] : [];
  const child = spawn('python3', [bridge, '--bucket', 'test-bucket', '--operation', 'publish', '--prefix-b64', Buffer.from(data.prefix).toString('base64url'), ...localArguments], {
    env: {
      ...process.env,
      ACT_RUNTIME_RELEASE_TEST_MODE: '1',
      ACT_RUNTIME_RELEASE_OSSUTIL: fakeOssutil,
      ACT_RUNTIME_RELEASE_IMDS_ROLE_URL: imdsRoleUrl,
      ACT_RUNTIME_RELEASE_LOCK_DIR: lockRoot,
      ACT_RUNTIME_RELEASE_SPOOL_DIR: spoolRoot,
      FAKE_OSS_ROOT: ossRoot,
      FAKE_OSS_METADATA: ossMetadata,
      FAKE_PAGE_SIZE: '1',
      ...(local ? { FAKE_LOCAL: '1' } : {}),
      ...env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stderr = [];
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  const reader = createInterface({ input: child.stdout });
  const lines = reader[Symbol.asyncIterator]();
  child.stdin.write(`${blobHeaderFor(data, parent)}\n`);
  const first = await lines.next();
  if (first.done) {
    const result = await close(child);
    reader.close();
    throw new Error(`blob bridge failed before state: ${Buffer.concat(stderr).toString()} (${JSON.stringify(result)})`);
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
  const sources = new Map(data.files.map((file) => [file.objectKey, file]));
  for (const key of control.missingKeys) {
    const file = sources.get(key);
    assert.ok(file, `bridge requested known blob ${key}`);
    child.stdin.write(`${JSON.stringify({ key, sizeBytes: file.sizeBytes, sha256: file.sha256 })}\n`);
    child.stdin.write(frameBytes ?? data.frameBytesByKey.get(key));
    if (crashAfterFrame) {
      await new Promise((resolve) => setTimeout(resolve, crashDelayMs));
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
  if (result.code !== 0) throw new Error(`blob bridge publish failed: ${Buffer.concat(stderr).toString()}`);
  assert.equal(final.done, false);
  return JSON.parse(final.value);
}

async function importBlobFromV1(source, target) {
  const child = spawn('python3', [bridge, '--bucket', 'test-bucket', '--operation', 'import-v1', '--prefix-b64', Buffer.from(target.prefix).toString('base64url')], {
    env: {
      ...process.env,
      ACT_RUNTIME_RELEASE_TEST_MODE: '1',
      ACT_RUNTIME_RELEASE_OSSUTIL: fakeOssutil,
      ACT_RUNTIME_RELEASE_IMDS_ROLE_URL: imdsRoleUrl,
      ACT_RUNTIME_RELEASE_LOCK_DIR: lockRoot,
      ACT_RUNTIME_RELEASE_SPOOL_DIR: spoolRoot,
      FAKE_OSS_ROOT: ossRoot,
      FAKE_OSS_METADATA: ossMetadata,
      FAKE_PAGE_SIZE: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  child.stdin.end(`${blobImportHeaderFor(source, target)}\n`);
  const result = await close(child);
  if (result.code !== 0) throw new Error(`blob v1 import failed: ${Buffer.concat(stderr).toString()}`);
  return JSON.parse(Buffer.concat(stdout).toString('utf8'));
}

async function verify(data = state, { expectFailure = false } = {}) {
  const child = spawn('python3', [bridge, '--bucket', 'test-bucket', '--operation', 'verify', '--prefix-b64', Buffer.from(data.prefix).toString('base64url')], {
    env: {
      ...process.env,
      ACT_RUNTIME_RELEASE_TEST_MODE: '1',
      ACT_RUNTIME_RELEASE_OSSUTIL: fakeOssutil,
      ACT_RUNTIME_RELEASE_IMDS_ROLE_URL: imdsRoleUrl,
      ACT_RUNTIME_RELEASE_LOCK_DIR: lockRoot,
      ACT_RUNTIME_RELEASE_SPOOL_DIR: spoolRoot,
      FAKE_OSS_ROOT: ossRoot,
      FAKE_OSS_METADATA: ossMetadata,
      FAKE_PAGE_SIZE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  const result = await close(child);
  if (expectFailure) {
    assert.notEqual(result.code, 0, 'verification must reject the forged manifest');
    return Buffer.concat(stderr).toString('utf8');
  }
  assert.equal(result.code, 0, Buffer.concat(stderr).toString());
  return JSON.parse(Buffer.concat(stdout).toString('utf8'));
}

async function seedForgedRelease(data) {
  await mkdir(path.dirname(path.join(ossRoot, data.file.objectKey)), { recursive: true });
  await writeFile(path.join(ossRoot, data.file.objectKey), bytes);
  await writeFile(path.join(ossRoot, data.manifestKey), data.wire);
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

  const blobState = buildBlobState();
  const blobNextRevision = buildBlobState('e'.repeat(40), [bytes, Buffer.from('changed blob bytes')]);
  const blobLog = path.join(temporary, 'blob-put.log');
  const blobFirst = await publishBlob({ data: blobState, env: { FAKE_LOG: blobLog } });
  assert.equal(blobFirst.putCount, 3, 'the first blob release writes one shared blob, receipt, then manifest');
  const blobPuts = (await readFile(blobLog, 'utf8')).trim().split('\n');
  assert.deepEqual(blobPuts.slice(-2), [blobState.receiptKey, blobState.manifestKey], 'receipt precedes the terminal immutable manifest');
  const blobGetLog = path.join(temporary, 'blob-get.log');
  const blobHeadLog = path.join(temporary, 'blob-head.log');
  const blobSecond = await publishBlob({
    data: blobNextRevision,
    parent: blobState,
    env: { FAKE_LOG: blobLog, FAKE_GET_LOG: blobGetLog, FAKE_HEAD_LOG: blobHeadLog },
  });
  assert.equal(blobSecond.putCount, 3, 'a delta release writes only its changed blob, receipt, then manifest');
  assert.equal(blobSecond.inheritedBlobCount, 1, 'the unchanged parent blob must be inherited without a remote metadata request');
  assert.equal(blobSecond.metadataCheckCount, 1, 'only the changed blob receives a metadata lookup');
  const blobGets = (await readFile(blobGetLog, 'utf8')).trim().split('\n').filter(Boolean);
  assert.equal(blobGets.some((key) => key.startsWith('runtime/blobs/sha256/')), false, 'daily delta publication must not download inherited or changed blob bodies from OSS');
  const blobHeads = (await readFile(blobHeadLog, 'utf8')).trim().split('\n').filter(Boolean);
  assert.deepEqual(blobHeads, [blobNextRevision.files[1].objectKey, blobNextRevision.files[1].objectKey], 'only the changed blob is metadata-checked before and after its conditional upload');
  const blobReplay = await publishBlob({ data: blobState });
  assert.equal(blobReplay.putCount, 0, 'a completed blob release retry is verification-only');

  const localBlobState = buildBlobState('8'.repeat(40));
  const localBlobReceipt = await publishBlob({ data: localBlobState, local: true });
  assert.equal(localBlobReceipt.status, 'complete', 'the local operator publisher must complete the same immutable manifest-last protocol without ECS IMDS');

  const multipleBlobState = buildBlobState('9'.repeat(40), [Buffer.from('unique blob a'), Buffer.from('unique blob b')]);
  const blobListLog = path.join(temporary, 'blob-list.log');
  const multipleBlobReceipt = await publishBlob({ data: multipleBlobState, env: { FAKE_LIST_LOG: blobListLog } });
  assert.equal(multipleBlobReceipt.putCount, 4, 'two distinct blobs, receipt, and manifest must be written');
  const blobListRequests = (await readFile(blobListLog, 'utf8')).trim().split('\n')
    .filter((prefix) => prefix === 'runtime/blobs/sha256/');
  assert.equal(blobListRequests.length, 0, 'a publish must use exact object metadata lookups instead of inventorying the shared blob prefix');

  const interruptedBlob = buildBlobState('f'.repeat(40), Buffer.from('interrupted blob bytes'));
  const interruptedSpool = spoolFor(interruptedBlob.prefix);
  const crashedBlob = await publishBlob({ data: interruptedBlob, crashAfterFrame: true, crashDelayMs: 1200, env: { FAKE_PUT_DELAY_MS: '1000' } });
  assert.equal(crashedBlob, null);
  assert.equal((await readdir(interruptedSpool)).length, 0, 'an interruption after the verified blob but before the manifest leaves an empty resumable spool directory');
  await rm(interruptedSpool, { recursive: true, force: true });
  const resumedBlob = await publishBlob({ data: interruptedBlob });
  assert.equal(resumedBlob.putCount, 2, 'an interrupted publish resumes from the exact pre-existing blob and writes only receipt and manifest');

  const poisonedBlob = buildBlobState('a'.repeat(40), Buffer.from('poisoned blob expected bytes'));
  await mkdir(path.dirname(path.join(ossRoot, poisonedBlob.files[0].objectKey)), { recursive: true });
  await writeFile(path.join(ossRoot, poisonedBlob.files[0].objectKey), 'different');
  await assert.rejects(() => publishBlob({ data: poisonedBlob }), /blob bridge (failed before state|publish failed)/);
  await rm(path.join(ossRoot, poisonedBlob.files[0].objectKey), { force: true });

  imdsRoleName = 'act-runtime-oss-publisher';
  assert.match(await verify(state, { expectFailure: true }), /restricted release operator role/);
  imdsRoleName = 'act-runtime-oss-release-operator-ecs';
  const readVerification = await verify();
  assert.deepEqual(readVerification, {
    schemaVersion: 'runtime-release-verification.v1',
    releaseId: state.manifest.releaseId,
    manifestSha256: state.manifest.manifestSha256,
    wireSha256: sha(state.wire),
    treeSha256: state.manifest.treeSha256,
    fileCount: state.manifest.fileCount,
    totalBytes: state.manifest.totalBytes,
  }, 'read-role verification must re-list and re-read the immutable release');
  const blobReadVerification = await verify(blobState);
  assert.deepEqual(blobReadVerification, {
    schemaVersion: 'runtime-release-verification.v2',
    releaseId: blobState.manifest.releaseId,
    manifestObjectKey: blobState.manifestKey,
    manifestSha256: blobState.manifest.manifestSha256,
    wireSha256: sha(blobState.wire),
    wireSizeBytes: blobState.wire.byteLength,
    treeSha256: blobState.manifest.treeSha256,
    fileCount: blobState.manifest.fileCount,
    totalBytes: blobState.manifest.totalBytes,
  }, 'read-role verification must re-read every reachable blob and immutable documents');

  const importSource = buildManifest(bytes.byteLength, 'b'.repeat(40));
  const importTarget = buildBlobStateFromV1(importSource);
  await publish({ data: importSource });
  const importReceipt = await importBlobFromV1(importSource, importTarget);
  assert.equal(importReceipt.status, 'complete');
  assert.equal(importReceipt.sourceReleaseId, importSource.manifest.releaseId);
  assert.equal(importReceipt.sourceManifestSha256, importSource.manifest.manifestSha256);
  assert.equal(importReceipt.putCount, 2, 'v1 import reuses a verified shared blob and writes its receipt and manifest');
  assert.equal((await verify(importTarget)).schemaVersion, 'runtime-release-verification.v2');
  await writeFile(path.join(ossRoot, importSource.file.objectKey), 'tampered source');
  await assert.rejects(() => importBlobFromV1(importSource, importTarget), /v1 import failed/);

  const unsupportedSchema = forgeManifest({ schemaVersion: 'unsupported-runtime-release.v999' });
  await seedForgedRelease(unsupportedSchema);
  assert.match(await verify(unsupportedSchema, { expectFailure: true }), /manifest identity/);
  const tamperedTree = forgeManifest({ treeSha256: 'd'.repeat(64) });
  await seedForgedRelease(tamperedTree);
  assert.match(await verify(tamperedTree, { expectFailure: true }), /tree digest/);
  imdsRoleName = 'act-runtime-oss-release-operator-ecs';

  await rm(path.join(ossRoot, state.prefix), { recursive: true, force: true });
  await assert.rejects(() => publish({ env: { FAKE_V1_MODE: 'outside' } }), /bridge publish failed/);
  console.log('runtime release OSS v2 spool/conditional bridge contract passed');
} finally {
  await new Promise((resolve) => imds.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
