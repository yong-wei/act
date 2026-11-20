import { NextResponse } from 'next/server';
import { assertSameOrigin, requestOrigin } from '@/lib/platform-oidc';
import { consumeOidcCompletion } from '@/lib/platform-oidc-store';
import { sessionCookieName } from '@/lib/platform-session';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { transactionId?: string };
    const completion = consumeOidcCompletion(body.transactionId ?? '');
    if (!completion) return NextResponse.json({ error: 'invalid-completion' }, { status: 409 });
    const response = NextResponse.json({ ok: true, returnTo: completion.returnTo });
    response.cookies.set(sessionCookieName(requestOrigin(request)), completion.sessionToken, {
      httpOnly: true,
      secure: requestOrigin(request).startsWith('https://'),
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'invalid-origin' }, { status: 403 });
  }
}
