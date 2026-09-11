import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';

import {
  findRuntimeMediaReleaseObject,
  isRuntimeMediaPath,
  readActiveRuntimeReleaseManifest,
} from '@/lib/runtime-active-release';
import {
  boundRuntimeObjectPath,
  defaultRuntimeRoot,
  verifyBoundRuntimeObject,
} from '@/lib/runtime-bound-object-read';
import {
  parseAnyRuntimeReleaseManifest,
  runtimeReleaseManifestObjectKey,
  type AnyActRuntimeReleaseManifest,
} from '@/lib/runtime-release';
import { createEcsRamRoleOssClient } from '@/lib/runtime-release-store';

export const dynamic = 'force-dynamic';

const DEFAULT_BUCKET = 'act-course-assets';
const DEFAULT_REGION = 'oss-cn-hangzhou';

function runtimeMediaFallbackPath(assetPath: string[]) {
  return `/course-runtime/${assetPath.map((segment) => encodeURIComponent(segment)).join('/')}`;
}

function localMediaRedirect(request: Request, assetPath: string[]) {
  const response = NextResponse.redirect(new URL(runtimeMediaFallbackPath(assetPath), request.url), 307);
  response.headers.set('X-Act-Runtime-Fallback', 'local-unpinned');
  return response;
}

const MEDIA_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

function classifiedFailure(
  code: 'missing' | 'forbidden' | 'checksum-mismatch' | 'release-mismatch',
  status: number,
) {
  const error = {
    missing: 'Runtime media asset was not found.',
    forbidden: 'Runtime media asset is not readable.',
    'checksum-mismatch': 'Runtime media asset failed checksum verification.',
    'release-mismatch': 'Runtime media asset does not match the pinned release.',
  }[code];
  return NextResponse.json({ error, code }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function serveBoundReleaseMedia(runtimePath: string, expectedSha256?: string | null) {
  const runtimeRoot = defaultRuntimeRoot();
  const verified = await verifyBoundRuntimeObject(runtimeRoot, runtimePath, expectedSha256);
  if (verified.state !== 'verified') {
    const status = verified.state === 'forbidden' ? 403 : verified.state === 'checksum-mismatch' ? 409 : 404;
    return classifiedFailure(verified.state, status);
  }
  const abs = boundRuntimeObjectPath(runtimeRoot, runtimePath);
  if (!abs) return classifiedFailure('missing', 404);
  return new NextResponse(Readable.toWeb(createReadStream(abs)) as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': MEDIA_TYPES[path.extname(runtimePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Act-Runtime-Read': 'bound-release',
    },
  });
}

/**
 * A pinned release keeps serving the bytes captured by the session bundle even
 * after the active release has switched; the object identity comes from the
 * pinned release manifest, not the mounted one.
 */
async function readPinnedReleaseManifest(
  client: ReturnType<typeof createEcsRamRoleOssClient>,
  releaseId: string,
): Promise<AnyActRuntimeReleaseManifest | null> {
  try {
    const { stream } = await client.getStream(runtimeReleaseManifestObjectKey(releaseId));
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return parseAnyRuntimeReleaseManifest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    return null;
  }
}

export async function GET(request: Request, props: { params: Promise<{ assetPath: string[] }> }) {
  const { assetPath } = await props.params;
  const runtimePath = assetPath.join('/');
  if (!isRuntimeMediaPath(runtimePath)) {
    return NextResponse.json({ error: 'Runtime media asset was not found.' }, { status: 404 });
  }
  const pinnedReleaseId = new URL(request.url).searchParams.get('releaseId')?.trim() || '';
  const ramRole = process.env.ACT_RUNTIME_OSS_RAM_ROLE?.trim();
  if (!ramRole) {
    if (pinnedReleaseId === 'unreleased-worktree') {
      return localMediaRedirect(request, assetPath);
    }
    const manifest = await readActiveRuntimeReleaseManifest();
    if (!manifest) {
      return localMediaRedirect(request, assetPath);
    }
    if (pinnedReleaseId && pinnedReleaseId !== manifest.releaseId) {
      return classifiedFailure('release-mismatch', 404);
    }
    const releaseObject = findRuntimeMediaReleaseObject(manifest, runtimePath);
    if (!releaseObject) {
      return classifiedFailure('missing', 404);
    }
    return serveBoundReleaseMedia(runtimePath, releaseObject.sha256);
  }

  try {
    if (!pinnedReleaseId || pinnedReleaseId === 'unreleased-worktree') {
      // Unpinned delivery follows the mounted release; without one (local
      // development) the legacy filesystem route serves the bytes. A pinned
      // unreleased-worktree locator also falls back because that release was
      // captured without a mounted manifest.
      const manifest = await readActiveRuntimeReleaseManifest();
      if (!pinnedReleaseId && !manifest) {
        return localMediaRedirect(request, assetPath);
      }
      if (pinnedReleaseId === 'unreleased-worktree') {
        return localMediaRedirect(request, assetPath);
      }
      if (!manifest) {
        return NextResponse.json({ error: 'Runtime media asset was not found.' }, { status: 404 });
      }
      const client = createEcsRamRoleOssClient({
        bucket: process.env.ACT_RUNTIME_OSS_BUCKET?.trim() || DEFAULT_BUCKET,
        region: process.env.ACT_RUNTIME_OSS_REGION?.trim() || DEFAULT_REGION,
        roleName: ramRole,
      });
      const releaseObject = findRuntimeMediaReleaseObject(manifest, runtimePath);
      if (!releaseObject) {
        return NextResponse.json({ error: 'Runtime media asset was not found.' }, { status: 404 });
      }
      return NextResponse.redirect(await client.asyncSignatureUrl(releaseObject.objectKey, {
        expires: 300,
        method: 'GET',
      }), { status: 307, headers: { 'Cache-Control': 'no-store' } });
    }

    const client = createEcsRamRoleOssClient({
      bucket: process.env.ACT_RUNTIME_OSS_BUCKET?.trim() || DEFAULT_BUCKET,
      region: process.env.ACT_RUNTIME_OSS_REGION?.trim() || DEFAULT_REGION,
      roleName: ramRole,
    });
    const manifest = await readPinnedReleaseManifest(client, pinnedReleaseId);
    const releaseObject = manifest && findRuntimeMediaReleaseObject(manifest, runtimePath);
    if (!releaseObject) {
      return NextResponse.json({ error: 'Runtime media asset was not found.' }, { status: 404 });
    }
    return NextResponse.redirect(await client.asyncSignatureUrl(releaseObject.objectKey, {
      expires: 300,
      method: 'GET',
    }), { status: 307, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Runtime media delivery is unavailable.' }, { status: 503 });
  }
}
