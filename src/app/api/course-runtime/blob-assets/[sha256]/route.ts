import { NextResponse } from 'next/server';

import { runtimeBlobObjectKey } from '@/lib/runtime-release';
import { createEcsRamRoleOssClient } from '@/lib/runtime-release-store';

export const dynamic = 'force-dynamic';

const DEFAULT_BUCKET = 'act-course-assets';
const DEFAULT_REGION = 'oss-cn-hangzhou';
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Content-addressed blob delivery for session-bound resources whose bytes no
 * longer match the mounted release (e.g. a captured handout PDF after an
 * active-release switch). The object key is derived from the captured sha256,
 * so the served bytes are exactly the captured bytes.
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ sha256: string }> },
) {
  const { sha256 } = await props.params;
  const normalized = sha256.trim().toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) {
    return NextResponse.json({ error: 'Runtime blob asset was not found.' }, { status: 404 });
  }

  const ramRole = process.env.ACT_RUNTIME_OSS_RAM_ROLE?.trim();
  if (!ramRole) {
    return NextResponse.json({ error: 'Runtime blob delivery is unavailable.' }, { status: 503 });
  }
  try {
    const client = createEcsRamRoleOssClient({
      bucket: process.env.ACT_RUNTIME_OSS_BUCKET?.trim() || DEFAULT_BUCKET,
      region: process.env.ACT_RUNTIME_OSS_REGION?.trim() || DEFAULT_REGION,
      roleName: ramRole,
    });
    const signedUrl = await client.asyncSignatureUrl(runtimeBlobObjectKey(normalized), {
      expires: 300,
      method: 'GET',
    });
    return NextResponse.redirect(signedUrl, {
      status: 307,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Runtime blob delivery is unavailable.' }, { status: 503 });
  }
}
