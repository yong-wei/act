import { NextResponse } from 'next/server';

import {
  findRuntimeMediaReleaseObject,
  isRuntimeMediaPath,
  readActiveRuntimeReleaseManifest,
} from '@/lib/runtime-active-release';
import { createEcsRamRoleOssClient } from '@/lib/runtime-release-store';

export const dynamic = 'force-dynamic';

const DEFAULT_BUCKET = 'act-course-assets';
const DEFAULT_REGION = 'oss-cn-hangzhou';

function runtimeMediaFallbackPath(assetPath: string[]) {
  return `/course-runtime/${assetPath.map((segment) => encodeURIComponent(segment)).join('/')}`;
}

export async function GET(request: Request, props: { params: Promise<{ assetPath: string[] }> }) {
  const { assetPath } = await props.params;
  const runtimePath = assetPath.join('/');
  if (!isRuntimeMediaPath(runtimePath)) {
    return NextResponse.json({ error: 'Runtime media asset was not found.' }, { status: 404 });
  }

  try {
    const manifest = await readActiveRuntimeReleaseManifest();
    if (!manifest) {
      return NextResponse.redirect(new URL(runtimeMediaFallbackPath(assetPath), request.url), 307);
    }

    const releaseObject = findRuntimeMediaReleaseObject(manifest, runtimePath);
    if (!releaseObject) {
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
    const signedUrl = await client.asyncSignatureUrl(releaseObject.objectKey, {
      expires: 300,
      method: 'GET',
    });
    return NextResponse.redirect(signedUrl, {
      status: 307,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Runtime media delivery is unavailable.' }, { status: 503 });
  }
}
