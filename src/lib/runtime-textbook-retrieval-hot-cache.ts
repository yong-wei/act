import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import {
  ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME,
  ACT_RUNTIME_RELEASE_MANIFEST_FILENAME,
  type AnyActRuntimeReleaseManifest,
  parseAnyRuntimeReleaseManifest,
} from '@/lib/runtime-release';

const HOT_CACHE_PATHS = [
  'resources/textbook-retrieval/vectors.f32',
  'resources/textbook-retrieval/bodies.utf8',
  'resources/textbook-retrieval/lexical-postings.bin',
] as const;

export const ACT_RUNTIME_TEXTBOOK_HOT_CACHE_SCHEMA_VERSION = 'act-runtime-textbook-hot-cache.v1';

export type RuntimeTextbookHotCacheReceipt = {
  schemaVersion: typeof ACT_RUNTIME_TEXTBOOK_HOT_CACHE_SCHEMA_VERSION;
  releaseId: string;
  manifestSha256: string;
  cacheRoot: string;
  files: Array<{ path: string; sizeBytes: number; sha256: string }>;
};

export class RuntimeTextbookHotCacheError extends Error {
  constructor(public readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RuntimeTextbookHotCacheError';
  }
}

async function assertDirectory(absolutePath: string, code: string) {
  let stats;
  try {
    stats = await lstat(absolutePath);
  } catch (error) {
    throw new RuntimeTextbookHotCacheError(code, `Required directory is unavailable: ${absolutePath}`, { cause: error });
  }
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new RuntimeTextbookHotCacheError(code, `Required directory must be a non-symlink directory: ${absolutePath}`);
  }
}

async function copyAndVerify(source: string, destination: string, expected: { sizeBytes: number; sha256: string }) {
  const hash = createHash('sha256');
  let sizeBytes = 0;
  const sourceStream = createReadStream(source);
  sourceStream.on('data', (chunk) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(bytes);
    sizeBytes += bytes.byteLength;
  });
  await pipeline(sourceStream, createWriteStream(destination, { flags: 'wx', mode: 0o440 }));
  if (sizeBytes !== expected.sizeBytes || hash.digest('hex') !== expected.sha256) {
    throw new RuntimeTextbookHotCacheError('runtime-hot-cache-source-mismatch', `Mounted runtime object diverges from manifest: ${source}`);
  }
}

export async function readMountedRuntimeReleaseManifest(runtimeRoot: string) {
  const candidates = [ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME, ACT_RUNTIME_RELEASE_MANIFEST_FILENAME];
  let firstError: unknown;
  for (const filename of candidates) {
    try {
      return parseAnyRuntimeReleaseManifest(JSON.parse(await readFile(path.join(runtimeRoot, filename), 'utf8')));
    } catch (error) {
      firstError ??= error;
    }
  }
  throw new RuntimeTextbookHotCacheError('runtime-hot-cache-manifest-invalid', 'Mounted runtime release manifest is unavailable or invalid.', { cause: firstError });
}

export async function stageTextbookRetrievalHotCache(input: {
  runtimeRoot: string;
  cacheParent: string;
  manifest?: AnyActRuntimeReleaseManifest;
}): Promise<RuntimeTextbookHotCacheReceipt> {
  await assertDirectory(input.runtimeRoot, 'runtime-hot-cache-runtime-root-invalid');
  await mkdir(input.cacheParent, { recursive: true, mode: 0o700 });
  await assertDirectory(input.cacheParent, 'runtime-hot-cache-parent-invalid');
  const manifest = input.manifest ?? await readMountedRuntimeReleaseManifest(input.runtimeRoot);
  const selected = HOT_CACHE_PATHS.map((relativePath) => {
    const entry = manifest.files.find((file) => file.path === relativePath);
    if (!entry) {
      throw new RuntimeTextbookHotCacheError('runtime-hot-cache-manifest-entry-missing', `Release does not contain required textbook retrieval object: ${relativePath}`);
    }
    return entry;
  });
  const cacheRoot = path.join(input.cacheParent, manifest.manifestSha256);
  const temporary = path.join(input.cacheParent, `.${manifest.manifestSha256}.tmp-${process.pid}`);
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true, mode: 0o700 });
  try {
    for (const entry of selected) {
      const source = path.join(input.runtimeRoot, ...entry.path.split('/'));
      const destination = path.join(temporary, path.basename(entry.path));
      await copyAndVerify(source, destination, entry);
    }
    const receipt: RuntimeTextbookHotCacheReceipt = {
      schemaVersion: ACT_RUNTIME_TEXTBOOK_HOT_CACHE_SCHEMA_VERSION,
      releaseId: manifest.releaseId,
      manifestSha256: manifest.manifestSha256,
      cacheRoot,
      files: selected.map((entry) => ({ path: entry.path, sizeBytes: entry.sizeBytes, sha256: entry.sha256 })),
    };
    await writeFile(path.join(temporary, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o440 });
    try {
      await lstat(cacheRoot);
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        await rename(temporary, cacheRoot);
        return receipt;
      }
      throw error;
    }
    const existing = JSON.parse(await readFile(path.join(cacheRoot, 'receipt.json'), 'utf8')) as RuntimeTextbookHotCacheReceipt;
    if (existing.manifestSha256 !== receipt.manifestSha256 || existing.releaseId !== receipt.releaseId) {
      throw new RuntimeTextbookHotCacheError('runtime-hot-cache-existing-invalid', 'Existing hot cache is not bound to this mounted release.');
    }
    await rm(temporary, { recursive: true, force: true });
    return existing;
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
