import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

import {
  activeUnavailableResponse,
  authorizeActiveGraph,
  readActiveDetailInfograph,
} from '@/app/api/knowledge/_active-authority';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  if (!id || id.length > 200) {
    return NextResponse.json(
      { error: '当前信息图暂时不可用。', code: 'ACTIVE_INFOGRAPH_UNAVAILABLE' },
      { status: 404 },
    );
  }
  try {
    const authorization = await authorizeActiveGraph();
    if (!authorization.ok) return authorization.response;
    const image = readActiveDetailInfograph(id);
    if (!image) {
      return NextResponse.json(
        { error: '当前信息图暂时不可用。', code: 'ACTIVE_INFOGRAPH_UNAVAILABLE' },
        { status: 404 },
      );
    }
    return new NextResponse(image, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'private, max-age=300',
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority infograph request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}
