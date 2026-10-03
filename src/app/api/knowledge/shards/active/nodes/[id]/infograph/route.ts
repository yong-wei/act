import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

import {
  activeUnavailableResponse,
  readActiveDetailInfograph,
} from '@/app/api/knowledge/_active-authority';
import { knowledgeSurfaceSelectorRejection } from '@/lib/knowledge-surface';
import {
  activeLocaleCapability,
  resolveActiveLocaleRequest,
} from '@/lib/authority-locale-readiness/request';
import { publicTeachingMediaUrlForBuffer } from '@/lib/public-teaching-media';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  if (!id || id.length > 200) {
    return NextResponse.json(
      { error: '当前信息图暂时不可用。', code: 'ACTIVE_INFOGRAPH_UNAVAILABLE' },
      { status: 404 },
    );
  }
  const rejected = knowledgeSurfaceSelectorRejection(request);
  if (rejected) return rejected;
  try {
    const locale = resolveActiveLocaleRequest(request, activeLocaleCapability());
    if (!locale.ok) return locale.response;
    const image = readActiveDetailInfograph(id);
    if (!image) {
      return NextResponse.json(
        { error: '当前信息图暂时不可用。', code: 'ACTIVE_INFOGRAPH_UNAVAILABLE' },
        { status: 404 },
      );
    }
    const publicUrl = await publicTeachingMediaUrlForBuffer(image, 'image/png');
    if (publicUrl) return NextResponse.redirect(publicUrl, { status: 307, headers: { 'Cache-Control': 'no-store' } });
    return new NextResponse(image, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority infograph request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}
