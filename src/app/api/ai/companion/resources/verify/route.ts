import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { isKonlingCompanionEnabled } from '@/lib/konling-companion-flag';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  resolveTeachingResourceTarget,
} from '@/lib/teaching-resource-target-resolver';

export const dynamic = 'force-dynamic';

export interface CompanionResourceVerifyResult {
  status: 'available' | 'unavailable';
  reason?: 'not-found' | 'hash-drift' | 'unauthorized';
  href?: string;
  mediaUrl?: string;
  mediaKind?: 'video' | 'audio';
}

/** 会话内资源卡打开/恢复校验：按 resourceId + versionHash 重查权限与版本，失效仅降级对应卡片。 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isKonlingCompanionEnabled()) {
      return NextResponse.json({ error: 'Companion disabled' }, { status: 404 });
    }

    const params = request.nextUrl.searchParams;
    const resourceId = params.get('resourceId')?.slice(0, 256) ?? '';
    const versionHash = params.get('versionHash')?.slice(0, 128) ?? '';
    const kind = params.get('kind') ?? '';
    if (!resourceId || !versionHash) {
      return NextResponse.json({ error: 'Invalid verify request' }, { status: 400 });
    }

    // 三段解析真源已抽到共享模块（#2047）；companion 语义保持 teacherOnly
    // 对所有查看者 not-found 混淆、STATIC_MEDIA 内嵌优先于 href。
    const resolved = await resolveTeachingResourceTarget({
      resourceId,
      versionHash,
      kind,
      viewerRole: 'student',
      teacherOnlyPolicy: 'always-unavailable',
    });
    const result: CompanionResourceVerifyResult = resolved.status === 'available'
      ? resolved.mediaUrl
        ? { status: 'available', mediaUrl: resolved.mediaUrl, mediaKind: resolved.mediaKind }
        : { status: 'available', href: resolved.href }
      : { status: 'unavailable', reason: resolved.reason };
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('companion resource verify failed', error);
    return NextResponse.json({ error: 'Companion resource verify failed' }, { status: 500 });
  }
}
