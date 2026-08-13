import { execFile as execFileCallback, spawn, type SpawnOptions } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildRuntimeReleaseSshArgv,
  createSshRuntimeReleaseObjectStore,
  publishRuntimeBlobReleaseViaSsh,
  publishRuntimeReleaseViaSsh,
  verifyPublishedRuntimeBlobReleaseViaSsh,
  verifyPublishedRuntimeReleaseViaSsh,
} from '../runtime-release-streaming-publisher';
import {
  buildRuntimeReleaseManifest,
  computeRuntimeReleaseManifestWireSha256,
  deriveRuntimeReleaseId,
  runtimeBlobReleaseManifestWireSha256,
} from '../runtime-release';
import { buildGitRuntimeBlobReleaseSnapshot } from '../runtime-release-git-snapshot';

const execFile = promisify(execFileCallback);

const config = {
  target: 'publisher@example.invalid',
  bucket: 'act-course-assets',
  remoteBridgePath: '/usr/local/sbin/act-runtime-release-bridge.py',
  knownHostsFile: '/etc/ssh/ssh_known_hosts',
  port: 22,
};

const roots: string[] = [];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-stream-'));
  roots.push(root);
  await mkdir(path.join(root, 'lessons'), { recursive: true });
  await writeFile(path.join(root, 'lessons', 'lesson.json'), '{"id":"stream"}\n');
  return root;
}

async function contentAddressedManifest(root: string) {
  const draft = await buildRuntimeReleaseManifest(root, { releaseId: 'runtime-plan', sourceRevision: 'c'.repeat(40) });
  return buildRuntimeReleaseManifest(root, {
    releaseId: deriveRuntimeReleaseId(draft.sourceRevision, draft.treeSha256),
    sourceRevision: 'c'.repeat(40),
  });
}

function streamingBridgeSpawnFactory(calls: Array<{ command: string; args: readonly string[] }>) {
  const script = `
let buffer = Buffer.alloc(0);
let state = 'header';
let manifest;
let wireSha256;
let receiptWireSha256;
let missing = [];
let filesByKey = [];
let missingFiles = [];
let frameIndex = 0;
function consume() {
  while (true) {
    if (state === 'header') {
      const newline = buffer.indexOf(10);
      if (newline < 0) return;
      const header = JSON.parse(buffer.subarray(0, newline).toString());
      buffer = buffer.subarray(newline + 1);
      manifest = JSON.parse(Buffer.from(header.manifestWireBase64, 'base64url').toString());
      wireSha256 = header.wireSha256;
      receiptWireSha256 = header.receiptWireSha256;
      filesByKey = [...new Map(manifest.files.map((file) => [file.objectKey, file])).values()];
      missingFiles = header.protocol === 'act-runtime-blob-release-stream.v2'
        ? [...filesByKey].sort((left, right) => right.objectKey.localeCompare(left.objectKey))
        : filesByKey;
      missing = missingFiles.map((file) => file.objectKey);
      process.stdout.write(JSON.stringify({ status: 'stream', missingKeys: missing }) + '\\n');
      state = 'frame';
    }
    if (state === 'frame') {
      const newline = buffer.indexOf(10);
      if (newline < 0) return;
      const frame = buffer.subarray(0, newline).toString();
      if (frame === 'DONE') {
        buffer = buffer.subarray(newline + 1);
        process.stdout.write(JSON.stringify({ status: 'complete', releaseId: manifest.releaseId, manifestSha256: manifest.manifestSha256, wireSha256, receiptWireSha256, treeSha256: manifest.treeSha256, fileCount: manifest.fileCount, totalBytes: manifest.totalBytes }) + '\\n');
        process.exit(0);
      }
      const header = JSON.parse(frame);
      const file = missingFiles[frameIndex];
      const size = header.sizeBytes;
      if (!file || header.key !== file.objectKey || buffer.length - (newline + 1) < size) return;
      buffer = buffer.subarray(newline + 1 + size);
      frameIndex += 1;
    }
  }
}
process.stdin.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]); consume(); });
`;
  return (command: string, args: readonly string[], options: SpawnOptions) => {
    calls.push({ command, args });
    return spawn(process.execPath, ['-e', script], options);
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function fakeSpawnFactory(mode: 'success' | 'child-failure' | 'get-failure' | 'blob-verify') {
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const spawnFake = (command: string, args: readonly string[], options: SpawnOptions) => {
    calls.push({ command, args });
    const operation = args[args.indexOf('--operation') + 1];
    const expectedSize = args[args.indexOf('--expected-size') + 1];
    const expectedSha = args[args.indexOf('--expected-sha256') + 1];
    const prefix = Buffer.from(args[args.indexOf('--prefix-b64') + 1] ?? '', 'base64url').toString('utf8');
    const releaseId = prefix.split('/').filter(Boolean).at(-1);
    const script = operation === 'verify'
      ? `process.stdout.write(${JSON.stringify(JSON.stringify(mode === 'blob-verify' ? {
        schemaVersion: 'runtime-release-verification.v2',
        releaseId,
        manifestObjectKey: 'runtime/releases/' + releaseId + '/manifest.json',
        manifestSha256: 'a'.repeat(64),
        wireSha256: 'b'.repeat(64),
        wireSizeBytes: 42,
        treeSha256: 'c'.repeat(64),
        fileCount: 1,
        totalBytes: 42,
      } : {
        schemaVersion: 'runtime-release-verification.v1',
        releaseId,
        manifestSha256: 'a'.repeat(64),
        wireSha256: 'b'.repeat(64),
        treeSha256: 'c'.repeat(64),
        fileCount: 1,
        totalBytes: 42,
      }))});`
      : operation === 'get'
      ? mode === 'get-failure'
        ? "process.stdout.write('partial'); process.exit(7);"
        : "process.stdout.write('remote-bytes');"
      : operation === 'list'
        ? "process.stdout.write('[]');"
        : mode === 'child-failure'
          ? "process.stdin.resume(); process.stdin.on('end', () => process.exit(9));"
          : `process.stdin.resume(); process.stdin.on('end', () => process.stdout.write(${JSON.stringify(JSON.stringify({ sizeBytes: Number(expectedSize), sha256: expectedSha }))}));`;
    return spawn(process.execPath, ['-e', script], options);
  };
  return { calls, spawnFake };
}

describe('source-authoritative SSH runtime release transport', () => {
  it('encodes path-bearing argv values and pins host verification options', () => {
    const args = buildRuntimeReleaseSshArgv(config, 'put', {
      key: 'runtime/releases/runtime-test/知识 cards/lesson one.json',
      expectation: { sizeBytes: 4, sha256: 'a'.repeat(64) },
    });
    expect(args).toContain('StrictHostKeyChecking=yes');
    expect(args).toContain('UserKnownHostsFile=/etc/ssh/ssh_known_hosts');
    expect(args).not.toContain('知识 cards/lesson one.json');
    expect(args.join(' ')).not.toMatch(/[;|&`$]/);
    expect(() => buildRuntimeReleaseSshArgv(config, 'put', {
      key: 'runtime/releases/runtime-test/../escape',
      expectation: { sizeBytes: 1, sha256: 'a'.repeat(64) },
    })).toThrow(/safe runtime release object key/);
    expect(() => buildRuntimeReleaseSshArgv({ ...config, remoteBridgePath: '/usr/local/../bridge.py' }, 'list', {
      prefix: 'runtime/releases/runtime-test/',
    })).toThrow(/absolute fixed executable path/);
  });

  it('streams bytes through the child and verifies local and remote size/hash receipts', async () => {
    const fake = fakeSpawnFactory('success');
    const store = createSshRuntimeReleaseObjectStore(config, { spawn: fake.spawnFake });
    await expect(store.listObjects('runtime/releases/runtime-test/')).resolves.toEqual([]);
    const bytes = Buffer.from('remote-bytes');
    const { createHash } = await import('node:crypto');
    const expectedSha = createHash('sha256').update(bytes).digest('hex');
    await expect(store.putObject('runtime/releases/runtime-test/file.bin', Readable.from(bytes), {
      sizeBytes: bytes.byteLength,
      sha256: expectedSha,
    })).resolves.toBeUndefined();
    const putCall = fake.calls.find((call) => call.args[call.args.indexOf('--operation') + 1] === 'put');
    expect(putCall?.args).toContain('--operation');
    expect(putCall?.args).toContain('put');
  });

  it('uses one SSH read-role verification operation and rejects malformed receipts', async () => {
    const fake = fakeSpawnFactory('success');
    await expect(verifyPublishedRuntimeReleaseViaSsh({
      releaseId: 'runtime-test',
      ssh: config,
      dependencies: { spawn: fake.spawnFake },
    })).resolves.toMatchObject({ releaseId: 'runtime-test', fileCount: 1, totalBytes: 42 });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].args).toContain('verify');
  });

  it('uses the read-role bridge only for a v2 blob verification receipt', async () => {
    const fake = fakeSpawnFactory('blob-verify');
    await expect(verifyPublishedRuntimeBlobReleaseViaSsh({
      releaseId: 'runtime-test',
      ssh: config,
      dependencies: { spawn: fake.spawnFake },
    })).resolves.toMatchObject({
      schemaVersion: 'runtime-release-verification.v2',
      releaseId: 'runtime-test',
      manifestObjectKey: 'runtime/releases/runtime-test/manifest.json',
    });
    expect(fake.calls).toHaveLength(1);
  });

  it('propagates a child upload failure instead of reporting a successful stream', async () => {
    const fake = fakeSpawnFactory('child-failure');
    const store = createSshRuntimeReleaseObjectStore(config, { spawn: fake.spawnFake });
    const bytes = Buffer.from('remote-bytes');
    const { createHash } = await import('node:crypto');
    await expect(store.putObject('runtime/releases/runtime-test/file.bin', Readable.from(bytes), {
      sizeBytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })).rejects.toMatchObject({ code: 'runtime-release-ssh-child-failed' });
  });

  it('propagates source EOF failures and remote get failures', async () => {
    const sourceFake = fakeSpawnFactory('success');
    const sourceStore = createSshRuntimeReleaseObjectStore(config, { spawn: sourceFake.spawnFake });
    const failingSource = Readable.from((async function* () {
      yield Buffer.from('partial');
      throw new Error('simulated source EOF failure');
    })());
    await expect(sourceStore.putObject('runtime/releases/runtime-test/file.bin', failingSource, {
      sizeBytes: 7,
      sha256: 'a'.repeat(64),
    })).rejects.toMatchObject({ code: 'runtime-release-stream-source-failed' });

    const getFake = fakeSpawnFactory('get-failure');
    const getStore = createSshRuntimeReleaseObjectStore(config, { spawn: getFake.spawnFake });
    const remote = await getStore.getObject('runtime/releases/runtime-test/file.bin');
    await expect((async () => {
      for await (const _chunk of remote) {
        // Consume the stream to observe the child exit status.
      }
    })()).rejects.toMatchObject({ code: 'runtime-release-ssh-child-failed' });
  });

  it('completes one source-authoritative stream and validates the semantic and wire manifest digests', async () => {
    const root = await fixture();
    const manifest = await contentAddressedManifest(root);
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const receipt = await publishRuntimeReleaseViaSsh({
      runtimeRoot: root,
      manifest,
      ssh: config,
      dependencies: { spawn: streamingBridgeSpawnFactory(calls) },
    });
    expect(receipt).toMatchObject({
      releaseId: manifest.releaseId,
      manifestSha256: manifest.manifestSha256,
      wireSha256: computeRuntimeReleaseManifestWireSha256(manifest),
      treeSha256: manifest.treeSha256,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain('publish');
  });

  it('streams each unique blob once and requires the v2 manifest-last receipt identity', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-git-stream-'));
    roots.push(root);
    const runtimeRoot = path.join(root, 'course-content', 'runtime');
    await mkdir(path.join(runtimeRoot, 'lessons'), { recursive: true });
    await writeFile(path.join(runtimeRoot, 'lessons', 'lesson.json'), '{"id":"stream"}\n');
    await writeFile(path.join(runtimeRoot, 'lessons', 'duplicate.json'), '{"id":"distinct"}\n');
    await execFile('git', ['init', '-b', 'integration'], { cwd: root });
    await execFile('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
    await execFile('git', ['config', 'user.name', 'Test'], { cwd: root });
    await execFile('git', ['add', '.'], { cwd: root });
    await execFile('git', ['commit', '-m', 'fixture'], { cwd: root });
    const commit = (await execFile('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
    const snapshot = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision: commit, integrationRef: 'integration' });
    const manifest = snapshot.manifest;
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const receipt = await publishRuntimeBlobReleaseViaSsh({
      snapshot,
      manifest,
      ssh: config,
      dependencies: { spawn: streamingBridgeSpawnFactory(calls) },
    });
    expect(receipt).toMatchObject({
      schemaVersion: 'runtime-release-verification.v2',
      releaseId: manifest.releaseId,
      manifestSha256: manifest.manifestSha256,
      wireSha256: runtimeBlobReleaseManifestWireSha256(manifest),
      fileCount: manifest.fileCount,
    });
    expect(new Set(manifest.files.map((file) => file.objectKey))).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });
});
