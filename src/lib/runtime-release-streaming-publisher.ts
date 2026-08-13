import { createHash } from 'node:crypto';
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  RuntimeReleaseStoreError,
  runtimeReleasePrefix,
  type RuntimeReleaseObjectExpectation,
  type RuntimeReleaseObjectStore,
  type RuntimeReleaseStoredObject,
  type RuntimeBlobReleaseVerificationReceipt,
  type RuntimeReleaseVerificationReceipt,
} from '@/lib/runtime-release-store';
import {
  type ActRuntimeBlobReleaseManifest,
  type ActRuntimeReleaseFile,
  assertContentAddressedRuntimeReleaseId,
  buildRuntimeBlobReleaseReceipt,
  computeRuntimeReleaseManifestWireSha256,
  runtimeBlobReleaseManifestObjectKey,
  runtimeBlobReleaseManifestWireSha256,
  serializeRuntimeBlobReleaseManifest,
  serializeRuntimeBlobReleaseReceipt,
  serializeRuntimeReleaseManifest,
  verifyRuntimeReleaseDirectory,
  type ActRuntimeReleaseManifest,
} from '@/lib/runtime-release';
import type { GitRuntimeBlobReleaseSnapshot } from '@/lib/runtime-release-git-snapshot';

const RELEASE_KEY_PREFIX = 'runtime/releases/';
const BLOB_KEY_PREFIX = 'runtime/blobs/sha256/';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const BUCKET_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const TARGET_PATTERN = /^[A-Za-z0-9._@[\]:-]+$/;
const REMOTE_PATH_PATTERN = /^\/[A-Za-z0-9._/-]+$/;

export interface RuntimeReleaseSshPublisherConfig {
  target: string;
  bucket: string;
  remoteBridgePath: string;
  knownHostsFile: string;
  sshBinary?: string;
  identityFile?: string;
  port?: number;
  connectTimeoutSeconds?: number;
}

export interface RuntimeReleaseSshPublisherDependencies {
  spawn?: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
}

export interface RuntimeReleaseRemoteObjectReceipt {
  sizeBytes: number;
  sha256: string;
  wireSha256?: string;
}

export class RuntimeReleaseStreamingPublisherError extends RuntimeReleaseStoreError {
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(code, message, options);
    this.name = 'RuntimeReleaseStreamingPublisherError';
  }
}

function invalid(message: string): never {
  throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-config-invalid', message);
}

function assertNoControlCharacters(value: string, context: string) {
  if (!value || /[\u0000-\u001f\u007f]/u.test(value)) invalid(`${context} must be non-empty and contain no control characters.`);
}

function assertObjectKey(value: string, context = 'object key') {
  assertNoControlCharacters(value, context);
  if (!value.startsWith(RELEASE_KEY_PREFIX) || value.includes('\\') || value.split('/').some((part) => !part || part === '.' || part === '..')) {
    invalid(`${context} is not a safe runtime release object key.`);
  }
}

function assertBlobObjectKey(value: string, context = 'blob object key') {
  assertNoControlCharacters(value, context);
  if (!value.startsWith(BLOB_KEY_PREFIX) || !SHA256_PATTERN.test(value.slice(BLOB_KEY_PREFIX.length))) {
    invalid(`${context} is not a SHA-256 addressed runtime blob key.`);
  }
}

function assertPrefix(value: string) {
  assertNoControlCharacters(value, 'release prefix');
  if (!value.startsWith(RELEASE_KEY_PREFIX) || !value.endsWith('/') || value.split('/').filter(Boolean).some((part) => part === '.' || part === '..')) invalid('Release prefix must be a runtime release prefix.');
}

function encodeArgument(value: string) {
  // SSH passes the command after the target through a remote shell. Encoding
  // path-bearing values keeps that shell boundary free of user-controlled
  // whitespace, quotes, globbing, and command separators. The bridge decodes
  // and validates the value again before invoking ossutil with argv.
  return Buffer.from(value, 'utf8').toString('base64url');
}

function assertConfig(config: RuntimeReleaseSshPublisherConfig) {
  assertNoControlCharacters(config.target, 'SSH target');
  if (!TARGET_PATTERN.test(config.target) || config.target.startsWith('-')) invalid('SSH target contains unsupported characters.');
  assertNoControlCharacters(config.bucket, 'OSS bucket');
  if (!BUCKET_PATTERN.test(config.bucket)) invalid('OSS bucket name is invalid.');
  assertNoControlCharacters(config.remoteBridgePath, 'remote bridge path');
  if (!REMOTE_PATH_PATTERN.test(config.remoteBridgePath) || config.remoteBridgePath.split('/').filter(Boolean).some((part) => part === '.' || part === '..')) invalid('Remote bridge path must be an absolute fixed executable path.');
  assertNoControlCharacters(config.knownHostsFile, 'known-hosts file');
  if (!config.knownHostsFile.startsWith('/')) invalid('Known-hosts file must be an absolute path.');
  if (config.sshBinary !== undefined) assertNoControlCharacters(config.sshBinary, 'ssh binary');
  if (config.identityFile !== undefined) {
    assertNoControlCharacters(config.identityFile, 'identity file');
    if (!config.identityFile.startsWith('/')) invalid('Identity file must be an absolute path.');
  }
  if (config.port !== undefined && (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)) invalid('SSH port must be between 1 and 65535.');
  if (config.connectTimeoutSeconds !== undefined && (!Number.isInteger(config.connectTimeoutSeconds) || config.connectTimeoutSeconds < 1 || config.connectTimeoutSeconds > 300)) invalid('SSH connect timeout must be between 1 and 300 seconds.');
}

type SshOperation = 'list' | 'get' | 'put' | 'publish' | 'verify';

export function buildRuntimeReleaseSshArgv(
  config: RuntimeReleaseSshPublisherConfig,
  operation: SshOperation,
  input: { prefix?: string; key?: string; expectation?: RuntimeReleaseObjectExpectation } = {},
) {
  assertConfig(config);
  const args = [
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', `UserKnownHostsFile=${config.knownHostsFile}`,
    '-o', 'IdentitiesOnly=yes',
  ];
  if (config.port !== undefined) args.push('-p', String(config.port));
  if (config.connectTimeoutSeconds !== undefined) args.push('-o', `ConnectTimeout=${config.connectTimeoutSeconds}`);
  if (config.identityFile !== undefined) args.push('-i', config.identityFile);
  args.push('--', config.target, config.remoteBridgePath, '--bucket', config.bucket, '--operation', operation);
  if (operation === 'list' || operation === 'verify') {
    if (!input.prefix) invalid(`${operation === 'verify' ? 'Verify' : 'List'} operation requires a release prefix.`);
    assertPrefix(input.prefix);
    args.push('--prefix-b64', encodeArgument(input.prefix));
  } else if (operation === 'publish') {
    if (!input.prefix) invalid('Publish operation requires a release prefix.');
    assertPrefix(input.prefix);
    args.push('--prefix-b64', encodeArgument(input.prefix));
  } else {
    if (!input.key) invalid(`${operation} operation requires an object key.`);
    assertObjectKey(input.key);
    args.push('--key-b64', encodeArgument(input.key));
  }
  if (operation === 'put') {
    const expectation = input.expectation;
    if (!expectation || !Number.isSafeInteger(expectation.sizeBytes) || expectation.sizeBytes < 0 || !SHA256_PATTERN.test(expectation.sha256)) {
      invalid('Put operation requires a safe expected size and SHA-256.');
    }
    args.push('--expected-size', String(expectation.sizeBytes), '--expected-sha256', expectation.sha256);
    if (expectation.wireSha256 !== undefined) {
      if (!SHA256_PATTERN.test(expectation.wireSha256)) invalid('Put operation wire SHA-256 is invalid.');
      args.push('--expected-wire-sha256', expectation.wireSha256);
    }
  }
  return args;
}

class CountingTransform extends Transform {
  bytes = 0;
  private readonly hash = createHash('sha256');

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.bytes += bytes.byteLength;
    this.hash.update(bytes);
    this.push(bytes);
    callback();
  }

  digest() {
    return { sizeBytes: this.bytes, sha256: this.hash.digest('hex') } satisfies RuntimeReleaseRemoteObjectReceipt;
  }
}

function spawnChild(spawn: RuntimeReleaseSshPublisherDependencies['spawn'], command: string, args: readonly string[]) {
  try {
    return (spawn ?? nodeSpawn)(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', 'Unable to start the SSH publisher bridge.', { cause: error });
  }
}

function childExit(child: ChildProcess) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
}

async function readOutput(stream: NodeJS.ReadableStream | null) {
  if (!stream) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function parseObjectReceipt(bytes: Buffer, expected: RuntimeReleaseObjectExpectation, key: string) {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString('utf8').trim());
  } catch (error) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', `Publisher bridge returned invalid JSON for ${key}.`, { cause: error });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', `Publisher bridge returned an invalid receipt for ${key}.`);
  const receipt = value as { sizeBytes?: unknown; sha256?: unknown; wireSha256?: unknown };
  if (receipt.sizeBytes !== expected.sizeBytes || receipt.sha256 !== expected.sha256) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-remote-object-invalid', `Remote publisher verification differs from the manifest for ${key}.`);
  }
  if (expected.wireSha256 !== undefined && receipt.wireSha256 !== expected.wireSha256) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-remote-manifest-wire-digest-invalid', `Remote publisher wire digest differs from the manifest for ${key}.`);
  }
  return receipt as RuntimeReleaseRemoteObjectReceipt;
}

async function runBuffered(child: ChildProcess, operation: string) {
  const exitPromise = childExit(child);
  const stdout = readOutput(child.stdout);
  const stderr = readOutput(child.stderr);
  let exit: { code: number | null; signal: NodeJS.Signals | null };
  try {
    exit = await exitPromise;
  } catch (error) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `${operation} bridge process failed.`, { cause: error });
  }
  const [stdoutBytes, stderrBytes] = await Promise.all([stdout, stderr]);
  if (exit.code !== 0) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `${operation} bridge process exited unsuccessfully${exit.signal ? ` (${exit.signal})` : ''}: ${stderrBytes.toString('utf8').trim()}`);
  }
  return stdoutBytes;
}

function streamChildOutput(child: ChildProcess, operation: string) {
  const output = new PassThrough();
  if (!child.stdout) {
    output.destroy(new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `${operation} bridge did not provide stdout.`));
    return output;
  }
  child.stdout.pipe(output, { end: false });
  child.stderr?.resume();
  child.stdout.once('error', (error) => output.destroy(new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `${operation} bridge output failed.`, { cause: error })));
  child.once('error', (error) => output.destroy(new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `${operation} bridge process failed.`, { cause: error })));
  child.once('close', (code, signal) => {
    if (code === 0) output.end();
    else output.destroy(new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `${operation} bridge process exited unsuccessfully${signal ? ` (${signal})` : ''}.`));
  });
  return output;
}

/**
 * @internal test adapter for per-object/list/get child lifecycle contracts. Production
 * writes must call publishRuntimeReleaseViaSsh so one bridge process owns the
 * release lock and manifest-last transaction.
 */
export class SshRuntimeReleaseObjectStore implements RuntimeReleaseObjectStore {
  private readonly config: RuntimeReleaseSshPublisherConfig;
  private readonly spawn: RuntimeReleaseSshPublisherDependencies['spawn'];

  constructor(config: RuntimeReleaseSshPublisherConfig, dependencies: RuntimeReleaseSshPublisherDependencies = {}) {
    assertConfig(config);
    this.config = config;
    this.spawn = dependencies.spawn;
  }

  async listObjects(prefix: string): Promise<RuntimeReleaseStoredObject[]> {
    const child = spawnChild(this.spawn, this.config.sshBinary ?? 'ssh', buildRuntimeReleaseSshArgv(this.config, 'list', { prefix }));
    const bytes = await runBuffered(child, 'list');
    let value: unknown;
    try {
      value = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'List bridge returned invalid JSON.', { cause: error });
    }
    if (!Array.isArray(value)) throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'List bridge must return an array.');
    return value.map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', `List bridge entry ${index} is invalid.`);
      const item = entry as { key?: unknown; sizeBytes?: unknown };
      if (typeof item.key !== 'string' || !Number.isSafeInteger(item.sizeBytes) || Number(item.sizeBytes) < 0) throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', `List bridge entry ${index} is invalid.`);
      assertObjectKey(item.key, `list entry ${index}`);
      return { key: item.key, sizeBytes: Number(item.sizeBytes) };
    });
  }

  async putObject(key: string, content: Readable, expectation?: RuntimeReleaseObjectExpectation): Promise<void> {
    if (!expectation) throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-expectation-required', `Streaming upload requires a manifest expectation for ${key}.`);
    const child = spawnChild(this.spawn, this.config.sshBinary ?? 'ssh', buildRuntimeReleaseSshArgv(this.config, 'put', { key, expectation }));
    if (!child.stdin) throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `Put bridge did not provide stdin for ${key}.`);
    const exitPromise = childExit(child);
    const stdout = readOutput(child.stdout);
    const stderr = readOutput(child.stderr);
    const counter = new CountingTransform();
    let streamError: unknown;
    let killedForStreamError = false;
    try {
      await pipeline(content, counter, child.stdin);
    } catch (error) {
      streamError = error;
      if (child.exitCode === null && child.signalCode === null) {
        killedForStreamError = true;
        child.kill();
      }
    }
    let exit: { code: number | null; signal: NodeJS.Signals | null };
    try {
      exit = await exitPromise;
    } catch (error) {
      throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `Put bridge process failed for ${key}.`, { cause: error });
    }
    const [stdoutBytes, stderrBytes] = await Promise.all([stdout, stderr]);
    if (streamError) {
      const code = streamError instanceof RuntimeReleaseStoreError
        ? streamError.code
        : !killedForStreamError && (exit.code !== 0 || exit.signal)
          ? 'runtime-release-ssh-child-failed'
          : 'runtime-release-stream-source-failed';
      throw new RuntimeReleaseStreamingPublisherError(code, `Source stream failed for ${key}.`, { cause: streamError });
    }
    const local = counter.digest();
    if (local.sizeBytes !== expectation.sizeBytes || local.sha256 !== expectation.sha256) {
      throw new RuntimeReleaseStreamingPublisherError('runtime-release-source-object-invalid', `Source bytes differ from the manifest for ${key}.`);
    }
    if (exit.code !== 0) {
      throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `Put bridge process exited unsuccessfully for ${key}: ${stderrBytes.toString('utf8').trim()}`);
    }
    parseObjectReceipt(stdoutBytes, expectation, key);
  }

  async getObject(key: string): Promise<Readable> {
    const child = spawnChild(this.spawn, this.config.sshBinary ?? 'ssh', buildRuntimeReleaseSshArgv(this.config, 'get', { key }));
    return streamChildOutput(child, 'get');
  }
}

export function createSshRuntimeReleaseObjectStore(config: RuntimeReleaseSshPublisherConfig, dependencies?: RuntimeReleaseSshPublisherDependencies) {
  return new SshRuntimeReleaseObjectStore(config, dependencies);
}

function parseVerificationReceipt(bytes: Buffer, releaseId: string): RuntimeReleaseVerificationReceipt | RuntimeBlobReleaseVerificationReceipt {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString('utf8').trim());
  } catch (error) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Read-role verification bridge returned invalid JSON.', { cause: error });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Read-role verification bridge returned an invalid receipt.');
  }
  const receipt = value as Record<string, unknown>;
  const { manifestSha256, wireSha256, treeSha256, fileCount, totalBytes } = receipt;
  if (
    receipt.schemaVersion === 'runtime-release-verification.v2'
    && receipt.releaseId === releaseId
    && typeof receipt.manifestObjectKey === 'string'
    && receipt.manifestObjectKey === runtimeBlobReleaseManifestObjectKey(releaseId)
    && typeof manifestSha256 === 'string' && SHA256_PATTERN.test(manifestSha256)
    && typeof wireSha256 === 'string' && SHA256_PATTERN.test(wireSha256)
    && typeof receipt.wireSizeBytes === 'number' && Number.isSafeInteger(receipt.wireSizeBytes) && receipt.wireSizeBytes > 0
    && typeof treeSha256 === 'string' && SHA256_PATTERN.test(treeSha256)
    && typeof fileCount === 'number' && Number.isSafeInteger(fileCount) && fileCount > 0
    && typeof totalBytes === 'number' && Number.isSafeInteger(totalBytes) && totalBytes >= 0
  ) {
    return {
      schemaVersion: 'runtime-release-verification.v2',
      releaseId,
      manifestObjectKey: receipt.manifestObjectKey,
      manifestSha256,
      wireSha256,
      wireSizeBytes: receipt.wireSizeBytes,
      treeSha256,
      fileCount,
      totalBytes,
    };
  }
  if (
    receipt.schemaVersion !== 'runtime-release-verification.v1'
    || receipt.releaseId !== releaseId
    || typeof manifestSha256 !== 'string' || !SHA256_PATTERN.test(manifestSha256)
    || typeof wireSha256 !== 'string' || !SHA256_PATTERN.test(wireSha256)
    || typeof treeSha256 !== 'string' || !SHA256_PATTERN.test(treeSha256)
    || typeof fileCount !== 'number' || !Number.isSafeInteger(fileCount) || fileCount < 1
    || typeof totalBytes !== 'number' || !Number.isSafeInteger(totalBytes) || totalBytes < 0
  ) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Read-role verification bridge receipt is incomplete or identity-mismatched.');
  }
  return {
    schemaVersion: 'runtime-release-verification.v1',
    releaseId,
    manifestSha256,
    wireSha256,
    treeSha256,
    fileCount,
    totalBytes,
  };
}

export async function verifyPublishedRuntimeReleaseViaSsh(input: {
  releaseId: string;
  ssh: RuntimeReleaseSshPublisherConfig;
  dependencies?: RuntimeReleaseSshPublisherDependencies;
}) {
  const prefix = runtimeReleasePrefix(input.releaseId);
  assertPrefix(prefix);
  const child = spawnChild(input.dependencies?.spawn, input.ssh.sshBinary ?? 'ssh', buildRuntimeReleaseSshArgv(input.ssh, 'verify', { prefix }));
  const receipt = parseVerificationReceipt(await runBuffered(child, 'verify'), input.releaseId);
  if (receipt.schemaVersion !== 'runtime-release-verification.v1') {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Read-role verification returned a blob release receipt for a v1 release request.');
  }
  return receipt;
}

export async function verifyPublishedRuntimeBlobReleaseViaSsh(input: {
  releaseId: string;
  ssh: RuntimeReleaseSshPublisherConfig;
  dependencies?: RuntimeReleaseSshPublisherDependencies;
}) {
  const prefix = runtimeReleasePrefix(input.releaseId);
  assertPrefix(prefix);
  const child = spawnChild(input.dependencies?.spawn, input.ssh.sshBinary ?? 'ssh', buildRuntimeReleaseSshArgv(input.ssh, 'verify', { prefix }));
  const receipt = parseVerificationReceipt(await runBuffered(child, 'verify'), input.releaseId);
  if (receipt.schemaVersion !== 'runtime-release-verification.v2') {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Read-role verification did not return a blob release receipt.');
  }
  return receipt;
}

type PublishControlMessage = {
  status?: unknown;
  missingKeys?: unknown;
  releaseId?: unknown;
  manifestSha256?: unknown;
  wireSha256?: unknown;
  receiptWireSha256?: unknown;
  treeSha256?: unknown;
  fileCount?: unknown;
  totalBytes?: unknown;
};

function parsePublishControlLine(line: string, context: string): PublishControlMessage {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch (error) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', `${context} bridge returned invalid JSON.`, { cause: error });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', `${context} bridge returned an invalid control message.`);
  }
  return value as PublishControlMessage;
}

async function writeChild(child: ChildProcess, bytes: string | Uint8Array, context: string) {
  if (!child.stdin || child.stdin.destroyed) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `${context} bridge stdin is unavailable.`);
  }
  const stdin = child.stdin;
  try {
    if (!stdin.write(bytes)) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          stdin.off('drain', onDrain);
          stdin.off('error', onError);
          stdin.off('close', onClose);
        };
        const onDrain = () => {
          cleanup();
          resolve();
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const onClose = () => {
          cleanup();
          reject(new Error('bridge stdin closed before accepting the complete frame'));
        };
        stdin.once('drain', onDrain);
        stdin.once('error', onError);
        stdin.once('close', onClose);
      });
    }
  } catch (error) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `${context} bridge stdin failed.`, { cause: error });
  }
}

async function openVerifiedRuntimeSourceFile(root: string, relativePath: string) {
  const rootAbsolute = path.resolve(root);
  const absolutePath = path.resolve(rootAbsolute, ...relativePath.split('/'));
  if (absolutePath !== rootAbsolute && !absolutePath.startsWith(`${rootAbsolute}${path.sep}`)) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-source-path-invalid', `Runtime source path escapes the selected root: ${relativePath}`);
  }
  const sourceStat = await lstat(absolutePath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-source-path-invalid', `Runtime source path is not a regular file: ${relativePath}`);
  }
  return createReadStream(absolutePath);
}

async function streamSourceFrame(child: ChildProcess, sourceFactory: () => Promise<Readable>, file: ActRuntimeReleaseFile) {
  const source = await sourceFactory();
  const hash = createHash('sha256');
  let sizeBytes = 0;
  try {
    for await (const chunk of source) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(bytes);
      sizeBytes += bytes.byteLength;
      await writeChild(child, bytes, file.path);
    }
  } catch (error) {
    if (error instanceof RuntimeReleaseStreamingPublisherError) throw error;
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-stream-source-failed', `Source stream failed for ${file.path}.`, { cause: error });
  }
  if (sizeBytes !== file.sizeBytes || hash.digest('hex') !== file.sha256) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-source-object-invalid', `Source bytes differ from the manifest for ${file.path}.`);
  }
}

function parsePublishReceipt(message: PublishControlMessage, manifest: ActRuntimeReleaseManifest): RuntimeReleaseVerificationReceipt {
  const expectedWireSha256 = computeRuntimeReleaseManifestWireSha256(manifest);
  if (
    message.status !== 'complete'
    || message.releaseId !== manifest.releaseId
    || message.manifestSha256 !== manifest.manifestSha256
    || message.wireSha256 !== expectedWireSha256
    || message.treeSha256 !== manifest.treeSha256
    || message.fileCount !== manifest.fileCount
    || message.totalBytes !== manifest.totalBytes
  ) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-remote-identity-mismatch', 'Publisher bridge completion receipt does not match the submitted manifest.');
  }
  return {
    schemaVersion: 'runtime-release-verification.v1',
    releaseId: manifest.releaseId,
    manifestSha256: manifest.manifestSha256,
    wireSha256: expectedWireSha256,
    treeSha256: manifest.treeSha256,
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
  };
}

function parseBlobPublishReceipt(message: PublishControlMessage, manifest: ActRuntimeBlobReleaseManifest): RuntimeBlobReleaseVerificationReceipt {
  const receipt = buildRuntimeBlobReleaseReceipt(manifest);
  const expectedWireSha256 = runtimeBlobReleaseManifestWireSha256(manifest);
  if (
    message.status !== 'complete'
    || message.releaseId !== manifest.releaseId
    || message.manifestSha256 !== manifest.manifestSha256
    || message.wireSha256 !== expectedWireSha256
    || message.receiptWireSha256 !== createHash('sha256').update(serializeRuntimeBlobReleaseReceipt(receipt)).digest('hex')
    || message.treeSha256 !== manifest.treeSha256
    || message.fileCount !== manifest.fileCount
    || message.totalBytes !== manifest.totalBytes
  ) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-remote-identity-mismatch', 'Blob publisher bridge completion receipt does not match the submitted manifest.');
  }
  return {
    schemaVersion: 'runtime-release-verification.v2',
    releaseId: manifest.releaseId,
    manifestObjectKey: runtimeBlobReleaseManifestObjectKey(manifest.releaseId),
    manifestSha256: manifest.manifestSha256,
    wireSha256: expectedWireSha256,
    wireSizeBytes: Buffer.byteLength(serializeRuntimeBlobReleaseManifest(manifest)),
    treeSha256: manifest.treeSha256,
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
  };
}

async function publishRuntimeReleaseStream(input: {
  runtimeRoot: string;
  manifest: ActRuntimeReleaseManifest;
  config: RuntimeReleaseSshPublisherConfig;
  spawn?: RuntimeReleaseSshPublisherDependencies['spawn'];
}) {
  try {
    assertContentAddressedRuntimeReleaseId(input.manifest);
  } catch (error) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-id-not-content-addressed', 'Runtime release id must bind source revision and tree identity before publishing.', { cause: error });
  }
  await verifyRuntimeReleaseDirectory(input.runtimeRoot, input.manifest);
  const child = spawnChild(input.spawn, input.config.sshBinary ?? 'ssh', buildRuntimeReleaseSshArgv(input.config, 'publish', {
    prefix: runtimeReleasePrefix(input.manifest.releaseId),
  }));
  if (!child.stdin || !child.stdout) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', 'Publish bridge did not provide bidirectional streams.');
  }
  const exitPromise = childExit(child);
  const stderrPromise = readOutput(child.stderr);
  const reader = createInterface({ input: child.stdout });
  const lines = reader[Symbol.asyncIterator]();
  const wireBytes = Buffer.from(serializeRuntimeReleaseManifest(input.manifest), 'utf8');
  const header = {
    protocol: 'act-runtime-release-stream.v1',
    releaseId: input.manifest.releaseId,
    prefix: runtimeReleasePrefix(input.manifest.releaseId),
    manifestSha256: input.manifest.manifestSha256,
    wireSha256: computeRuntimeReleaseManifestWireSha256(input.manifest),
    manifestWireBase64: wireBytes.toString('base64url'),
  };
  let receipt: RuntimeReleaseVerificationReceipt;
  try {
    await writeChild(child, `${JSON.stringify(header)}\n`, 'publish');
    const first = await lines.next();
    if (first.done || typeof first.value !== 'string') {
      throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Publish bridge closed before reporting prefix state.');
    }
    const control = parsePublishControlLine(first.value, 'Publish');
    if (control.status === 'complete') {
      child.stdin.end();
      receipt = parsePublishReceipt(control, input.manifest);
    } else {
      if (control.status !== 'stream' || !Array.isArray(control.missingKeys) || control.missingKeys.some((key) => typeof key !== 'string')) {
        throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Publish bridge returned an invalid prefix state.');
      }
      const missing = new Set(control.missingKeys as string[]);
      for (const file of input.manifest.files) {
        if (!missing.has(file.objectKey)) continue;
        await writeChild(child, `${JSON.stringify({ key: file.objectKey, sizeBytes: file.sizeBytes, sha256: file.sha256 })}\n`, file.path);
        await streamSourceFrame(child, () => openVerifiedRuntimeSourceFile(input.runtimeRoot, file.path), file);
      }
      await writeChild(child, 'DONE\n', 'publish');
      child.stdin.end();
      const finalLine = await lines.next();
      if (finalLine.done || typeof finalLine.value !== 'string') {
        throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Publish bridge closed before returning a completion receipt.');
      }
      receipt = parsePublishReceipt(parsePublishControlLine(finalLine.value, 'Publish'), input.manifest);
    }
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    if (error instanceof RuntimeReleaseStreamingPublisherError) throw error;
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', 'Publish bridge process failed.', { cause: error });
  } finally {
    reader.close();
  }
  // Wait for the bridge after consuming its receipt so child/EOF failures are
  // never hidden by a successful-looking control line.
  const exit = await exitPromise.catch((error) => {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', 'Publish bridge process failed.', { cause: error });
  });
  const stderr = await stderrPromise;
  if (exit.code !== 0) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `Publish bridge exited unsuccessfully: ${stderr.toString('utf8').trim()}`);
  }
  return receipt;
}

export async function publishRuntimeReleaseViaSsh(input: {
  runtimeRoot: string;
  manifest: ActRuntimeReleaseManifest;
  ssh: RuntimeReleaseSshPublisherConfig;
  dependencies?: RuntimeReleaseSshPublisherDependencies;
}) {
  return publishRuntimeReleaseStream({
    runtimeRoot: input.runtimeRoot,
    manifest: input.manifest,
    config: input.ssh,
    spawn: input.dependencies?.spawn,
  });
}

async function publishRuntimeBlobReleaseStream(input: {
  snapshot: GitRuntimeBlobReleaseSnapshot;
  manifest: ActRuntimeBlobReleaseManifest;
  config: RuntimeReleaseSshPublisherConfig;
  spawn?: RuntimeReleaseSshPublisherDependencies['spawn'];
}) {
  try {
    assertContentAddressedRuntimeReleaseId(input.manifest);
  } catch (error) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-id-not-content-addressed', 'Runtime blob release id must bind source revision and tree identity before publishing.', { cause: error });
  }
  if (
    input.snapshot.manifest.releaseId !== input.manifest.releaseId
    || input.snapshot.manifest.manifestSha256 !== input.manifest.manifestSha256
    || input.snapshot.sourceRevision !== input.manifest.sourceRevision
  ) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-git-source-mismatch', 'Git snapshot identity does not match the submitted blob manifest.');
  }
  const child = spawnChild(input.spawn, input.config.sshBinary ?? 'ssh', buildRuntimeReleaseSshArgv(input.config, 'publish', {
    prefix: runtimeReleasePrefix(input.manifest.releaseId),
  }));
  if (!child.stdin || !child.stdout) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', 'Blob publish bridge did not provide bidirectional streams.');
  }
  const exitPromise = childExit(child);
  const stderrPromise = readOutput(child.stderr);
  const reader = createInterface({ input: child.stdout });
  const lines = reader[Symbol.asyncIterator]();
  const manifestWireBytes = Buffer.from(serializeRuntimeBlobReleaseManifest(input.manifest), 'utf8');
  const receipt = buildRuntimeBlobReleaseReceipt(input.manifest);
  const receiptWireBytes = Buffer.from(serializeRuntimeBlobReleaseReceipt(receipt), 'utf8');
  const header = {
    protocol: 'act-runtime-blob-release-stream.v2',
    releaseId: input.manifest.releaseId,
    prefix: runtimeReleasePrefix(input.manifest.releaseId),
    manifestSha256: input.manifest.manifestSha256,
    wireSha256: runtimeBlobReleaseManifestWireSha256(input.manifest),
    manifestWireBase64: manifestWireBytes.toString('base64url'),
    receiptWireSha256: createHash('sha256').update(receiptWireBytes).digest('hex'),
    receiptWireBase64: receiptWireBytes.toString('base64url'),
  };
  const sourcesByKey = new Map<string, ActRuntimeReleaseFile>();
  for (const file of input.manifest.files) {
    assertBlobObjectKey(file.objectKey);
    const existing = sourcesByKey.get(file.objectKey);
    if (existing && (existing.sizeBytes !== file.sizeBytes || existing.sha256 !== file.sha256)) {
      throw new RuntimeReleaseStreamingPublisherError('runtime-release-manifest-invalid', `Blob manifest has inconsistent source bindings: ${file.objectKey}`);
    }
    if (!existing) sourcesByKey.set(file.objectKey, file);
  }
  let published: RuntimeBlobReleaseVerificationReceipt;
  try {
    await writeChild(child, `${JSON.stringify(header)}\n`, 'blob publish');
    const first = await lines.next();
    if (first.done || typeof first.value !== 'string') {
      throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Blob publish bridge closed before reporting release state.');
    }
    const control = parsePublishControlLine(first.value, 'Blob publish');
    if (control.status === 'complete') {
      child.stdin.end();
      published = parseBlobPublishReceipt(control, input.manifest);
    } else {
      if (control.status !== 'stream' || !Array.isArray(control.missingKeys) || control.missingKeys.some((key) => typeof key !== 'string')) {
        throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Blob publish bridge returned an invalid release state.');
      }
      const missing = new Set<string>();
      for (const key of control.missingKeys) {
        assertBlobObjectKey(key, 'blob publish missing key');
        if (!sourcesByKey.has(key) || missing.has(key)) {
          throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Blob publish bridge requested an unexpected or duplicate source blob.');
        }
        missing.add(key);
      }
      for (const requestedKey of control.missingKeys) {
        const key = requestedKey as string;
        const file = sourcesByKey.get(key);
        if (!file || !missing.has(key)) {
          throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Blob publish bridge requested a source blob that was not validated.');
        }
        await writeChild(child, `${JSON.stringify({ key, sizeBytes: file.sizeBytes, sha256: file.sha256 })}\n`, file.path);
        const snapshotFile = input.snapshot.filesByPath.get(file.path);
        if (!snapshotFile || snapshotFile.sizeBytes !== file.sizeBytes || snapshotFile.sha256 !== file.sha256) {
          throw new RuntimeReleaseStreamingPublisherError('runtime-release-git-source-mismatch', `Git snapshot source differs from the blob manifest for ${file.path}.`);
        }
        await streamSourceFrame(child, () => input.snapshot.openFile(file.path), file);
      }
      await writeChild(child, 'DONE\n', 'blob publish');
      child.stdin.end();
      const finalLine = await lines.next();
      if (finalLine.done || typeof finalLine.value !== 'string') {
        throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-response-invalid', 'Blob publish bridge closed before returning a completion receipt.');
      }
      published = parseBlobPublishReceipt(parsePublishControlLine(finalLine.value, 'Blob publish'), input.manifest);
    }
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    if (error instanceof RuntimeReleaseStreamingPublisherError) throw error;
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', 'Blob publish bridge process failed.', { cause: error });
  } finally {
    reader.close();
  }
  const exit = await exitPromise.catch((error) => {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', 'Blob publish bridge process failed.', { cause: error });
  });
  const stderr = await stderrPromise;
  if (exit.code !== 0) {
    throw new RuntimeReleaseStreamingPublisherError('runtime-release-ssh-child-failed', `Blob publish bridge exited unsuccessfully: ${stderr.toString('utf8').trim()}`);
  }
  return published;
}

export async function publishRuntimeBlobReleaseViaSsh(input: {
  snapshot: GitRuntimeBlobReleaseSnapshot;
  manifest: ActRuntimeBlobReleaseManifest;
  ssh: RuntimeReleaseSshPublisherConfig;
  dependencies?: RuntimeReleaseSshPublisherDependencies;
}) {
  return publishRuntimeBlobReleaseStream({
    snapshot: input.snapshot,
    manifest: input.manifest,
    config: input.ssh,
    spawn: input.dependencies?.spawn,
  });
}

export { runtimeReleasePrefix };
