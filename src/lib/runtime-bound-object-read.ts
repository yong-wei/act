import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readlink } from 'node:fs/promises';
import path from 'node:path';

import type { AdaptivePathObjectKeyVerifier } from '@/features/personalization/path-planning/adaptive-path-oss-provenance';

const SHA256 = /^[a-f0-9]{64}$/;
const HELPER = '.act-runtime-blobs';

export type BoundRuntimeObjectReadState = 'verified' | 'missing' | 'forbidden' | 'checksum-mismatch';

export function defaultRuntimeRoot(): string {
  return process.env.ACT_RUNTIME_ROOT?.trim() || path.join(/*turbopackIgnore: true*/ process.cwd(), 'course-content', 'runtime');
}

function resolveInside(root: string, relative: string): string | null {
  if (!relative || relative.includes('\0') || path.isAbsolute(relative)) return null;
  const resolved = path.resolve(root, relative);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`)) return null;
  return resolved;
}

export function boundRuntimeObjectPath(runtimeRoot: string, objectKey: string): string | null {
  if (objectKey.startsWith('published:')) return null;
  if (objectKey.startsWith('blob:')) {
    const sha = objectKey.slice('blob:'.length).toLowerCase();
    if (!SHA256.test(sha)) return null;
    return resolveInside(runtimeRoot, path.join(HELPER, sha));
  }
  return resolveInside(runtimeRoot, objectKey);
}

function hashFile(abs: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(abs);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function verifyBoundRuntimeObject(
  runtimeRoot: string,
  objectKey: string,
  expectedSha256?: string | null,
): Promise<{ state: BoundRuntimeObjectReadState; contentSha256: string | null }> {
  const abs = boundRuntimeObjectPath(runtimeRoot, objectKey);
  if (!abs) return { state: 'missing', contentSha256: null };
  try {
    const info = await lstat(abs);
    if (info.isSymbolicLink()) {
      const target = path.resolve(path.dirname(abs), await readlink(abs));
      const helperRoot = path.resolve(runtimeRoot, HELPER);
      if (target !== helperRoot && !target.startsWith(`${helperRoot}${path.sep}`)) {
        return { state: 'forbidden', contentSha256: null };
      }
      const named = path.basename(target).toLowerCase();
      if (SHA256.test(named)) {
        if (expectedSha256 && named !== expectedSha256.toLowerCase()) {
          return { state: 'checksum-mismatch', contentSha256: named };
        }
        await lstat(target);
        return { state: 'verified', contentSha256: named };
      }
    }
    const digest = await hashFile(abs);
    if (expectedSha256 && digest !== expectedSha256.toLowerCase()) {
      return { state: 'checksum-mismatch', contentSha256: digest };
    }
    return { state: 'verified', contentSha256: digest };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') return { state: 'forbidden', contentSha256: null };
    return { state: 'missing', contentSha256: null };
  }
}

export function createBoundRuntimeObjectKeyVerifier(
  runtimeRoot = defaultRuntimeRoot(),
): AdaptivePathObjectKeyVerifier {
  return {
    verify(objectKey) {
      return verifyBoundRuntimeObject(runtimeRoot, objectKey);
    },
  };
}
