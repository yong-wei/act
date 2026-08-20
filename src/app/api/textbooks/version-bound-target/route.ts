import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  issueTextbookVersionBoundHref,
  loadTextbookCoachContext,
  verifyTextbookVersionBoundHandle,
} from '@/lib/textbook-resource-coach';

export async function GET(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  const handle = request.nextUrl.searchParams.get('handle');
  const identity = verifyTextbookVersionBoundHandle(handle);
  if (!identity) {
    return NextResponse.json({ ok: false, reason: 'unverified-citation' }, { status: 400 });
  }
  const loaded = await loadTextbookCoachContext({
    actorUserId: session.user.id,
    pinned: identity,
  });
  if (loaded.status !== 'ready') {
    return NextResponse.json({ ok: false, reason: loaded.reason }, { status: 409 });
  }
  const href = issueTextbookVersionBoundHref(loaded.identity, loaded.structuralPath);
  if (!href) {
    return NextResponse.json({ ok: false, reason: 'location-unavailable' }, { status: 409 });
  }
  return NextResponse.json({ ok: true, href, identity: loaded.identity });
}
