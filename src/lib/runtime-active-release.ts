import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME,
  ACT_RUNTIME_RELEASE_MANIFEST_FILENAME,
  type ActRuntimeReleaseFile,
  type AnyActRuntimeReleaseManifest,
  parseAnyRuntimeReleaseManifest,
} from '@/lib/runtime-release';

const MEDIA_PATH = /^lessons\/[^/]+\/media\/[^/]+\.(?:mp4|webm|m4a|mp3|wav|pdf|png|jpe?g|webp|svg|gif)$/i;

export class RuntimeActiveReleaseError extends Error {
  constructor(public readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RuntimeActiveReleaseError';
  }
}

export async function readActiveRuntimeReleaseManifest(runtimeRoot = path.join(process.cwd(), 'course-content', 'runtime')): Promise<AnyActRuntimeReleaseManifest | null> {
  const manifestPaths = [
    path.join(runtimeRoot, ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME),
    path.join(runtimeRoot, ACT_RUNTIME_RELEASE_MANIFEST_FILENAME),
  ];
  for (const manifestPath of manifestPaths) {
    let source: string;
    try {
      source = await readFile(manifestPath, 'utf8');
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw new RuntimeActiveReleaseError('runtime-active-release-manifest-unreadable', 'Active runtime release manifest cannot be read.', { cause: error });
    }
    try {
      return parseAnyRuntimeReleaseManifest(JSON.parse(source));
    } catch (error) {
      throw new RuntimeActiveReleaseError('runtime-active-release-manifest-invalid', 'Active runtime release manifest is invalid.', { cause: error });
    }
  }
  return null;
}

export function findRuntimeMediaReleaseObject(manifest: AnyActRuntimeReleaseManifest, runtimePath: string): ActRuntimeReleaseFile | null {
  if (!MEDIA_PATH.test(runtimePath)) return null;
  return manifest.files.find((file) => file.path === runtimePath) ?? null;
}

export function isRuntimeMediaPath(runtimePath: string) {
  return MEDIA_PATH.test(runtimePath);
}
