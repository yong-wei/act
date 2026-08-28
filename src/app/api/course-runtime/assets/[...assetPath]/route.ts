import { NextResponse } from 'next/server';

import {
  findRuntimeMediaReleaseObject,
  isRuntimeMediaPath,
  readActiveRuntimeReleaseManifest,
} from '@/lib/runtime-active-release';
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

  try {
    if (!pinnedReleaseId || pinnedReleaseId === 'unreleased-worktree') {
      // Unpinned delivery follows the mounted release; without one (local
      // development) the legacy filesystem route serves the bytes. A pinned
      // unreleased-worktree locator also falls back because that release was
      // captured without a mounted manifest.
      const manifest = await readActiveRuntimeReleaseManifest();
      if (!pinnedReleaseId && !manifest) {
        return NextResponse.redirect(new URL(runtimeMediaFallbackPath(assetPath), request.url), 307);
      }
      if (pinnedReleaseId === 'unreleased-worktree') {
        return NextResponse.redirect(new URL(runtimeMediaFallbackPath(assetPath), request.url), 307);
      }
      if (!manifest) {
        return NextResponse.json({ error: 'Runtime media asset was not found.' }, { status: 404 });
      }
      const ramRole = process.env.ACT_RUNTIME_OSS_RAM_ROLE?.trim();
      if (!ramRole) {
        return NextResponse.json({ error: 'Runtime media delivery is unavailable.' }, { status: 503 });
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

    const ramRole = process.env.ACT_RUNTIME_OSS_RAM_ROLE?.trim();
    if (!ramRole) {
      return NextResponse.json({ error: 'Runtime media delivery is unavailable.' }, { status: 503 });
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
