import 'server-only';

import { readFile } from 'node:fs/promises';
import type { Readable } from 'node:stream';

import { runtimeBlobObjectKey } from '@/lib/runtime-release';
import { createEcsRamRoleOssClient } from '@/lib/runtime-release-store';
import { resolveRuntimeContentPath } from '@/lib/runtime-content-path';
import { sha256Hex } from './contract';

type BlobClient = { getStream(key: string): Promise<{ stream: Readable }> };

let cachedClient: BlobClient | null | undefined;

function blobClientOrNull(): BlobClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const ramRole = process.env.ACT_RUNTIME_OSS_RAM_ROLE?.trim();
  cachedClient = ramRole
    ? createEcsRamRoleOssClient({
      bucket: process.env.ACT_RUNTIME_OSS_BUCKET?.trim() || 'act-course-assets',
      region: process.env.ACT_RUNTIME_OSS_REGION?.trim() || 'oss-cn-hangzhou',
      roleName: ramRole,
    })
    : null;
  return cachedClient;
}

/**
 * Runtime blobs are content-addressed (`runtime/blobs/sha256/<sha>`), shared
 * across releases: a bound session can always re-read its captured bytes from
 * the blob store even after the active release switched and the mounted view
 * moved on.
 */
export async function readRuntimeBlobBySha256(expectedSha256: string): Promise<Buffer | null> {
  const client = blobClientOrNull();
  if (!client) return null;
  try {
    const { stream } = await client.getStream(runtimeBlobObjectKey(expectedSha256));
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    return sha256Hex(bytes) === expectedSha256 ? bytes : null;
  } catch {
    return null;
  }
}

export type BoundResourceBytes = {
  bytes: Buffer;
  source: 'mounted' | 'captured-blob';
};

/**
 * Read one bound resource: a mounted file whose bytes still match the captured
 * hash, or the content-addressed blob for the captured hash. `undefined`
 * expected hash means the resource was absent at capture and must stay absent
 * for this session.
 */
export async function readBoundResourceBytes(options: {
  candidatePaths: string[];
  expectedSha256: string | undefined;
}): Promise<BoundResourceBytes | null> {
  const candidates = Array.from(new Set(options.candidatePaths.filter(Boolean)));
  for (const candidate of candidates) {
    let bytes: Buffer;
    try {
      bytes = await readFile(resolveRuntimeContentPath(candidate).absolutePath);
    } catch {
      continue;
    }
    if (options.expectedSha256 === undefined || sha256Hex(bytes) === options.expectedSha256) {
      return { bytes, source: 'mounted' };
    }
  }
  if (options.expectedSha256 === undefined) return null;
  const blob = await readRuntimeBlobBySha256(options.expectedSha256);
  return blob ? { bytes: blob, source: 'captured-blob' } : null;
}
