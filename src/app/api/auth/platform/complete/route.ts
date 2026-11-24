import { NextResponse, type NextRequest } from 'next/server';
import { assertSameOrigin, requestOrigin } from '@/lib/platform-oidc';
import { consumeOidcCompletion, transactionCookieName } from '@/lib/platform-oidc-store';
import { sessionCookieName } from '@/lib/platform-session';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { transactionId } = await request.json() as { transactionId?: string };
    if (typeof transactionId !== 'string' || request.cookies.get(transactionCookieName(transactionId))?.value !== transactionId) {
      return NextResponse.json({ error: 'invalid-completion' }, { status: 409 });
    }
    const completion = consumeOidcCompletion(transactionId);
    if (!completion) return NextResponse.json({ error: 'invalid-completion' }, { status: 409 });
    const response = NextResponse.json({ ok: true, returnTo: completion.returnTo });
    response.cookies.set(sessionCookieName(requestOrigin(request)), completion.sessionToken, {
      httpOnly: true,
      secure: requestOrigin(request).startsWith('https://'),
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    response.cookies.delete(transactionCookieName(transactionId));
    return response;
  } catch {
    return NextResponse.json({ error: 'invalid-origin' }, { status: 403 });
  }
}
