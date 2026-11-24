import { NextResponse } from 'next/server';
import { assertSameOrigin, platformOidcConfig, requestOrigin } from '@/lib/platform-oidc';
import { codeChallenge, createOidcTransaction, transactionCookieName } from '@/lib/platform-oidc-store';

export async function POST(request: Request) {
  const config = platformOidcConfig();
  if (!config) return NextResponse.json({ error: 'disabled' }, { status: 404 });
  try {
    assertSameOrigin(request);
    const { launchReference, reauthenticate } = await request.json() as { launchReference?: unknown; reauthenticate?: unknown };
    if (launchReference != null && (typeof launchReference !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(launchReference))) {
      return NextResponse.json({ error: 'invalid-launch' }, { status: 400 });
    }
    const origin = requestOrigin(request);
    const transaction = createOidcTransaction(new URL(request.url).searchParams.get('return_to') ?? '/', launchReference ?? null);
    const authorize = new URL(`${config.issuer}/protocol/openid-connect/auth`);
    authorize.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${origin}/api/auth/platform/callback`,
      response_type: 'code',
      scope: 'openid',
      state: transaction.state,
      nonce: transaction.nonce,
      code_challenge: codeChallenge(transaction.codeVerifier),
      code_challenge_method: 'S256',
    }).toString();
    if (transaction.launchReference) authorize.searchParams.set('prompt', 'none');
    else if (reauthenticate === true) authorize.searchParams.set('prompt', 'login');
    const response = NextResponse.json({ transactionId: transaction.state, authorizeUrl: authorize.toString(), mode: 'in-page' });
    response.cookies.set(transactionCookieName(transaction.state), transaction.state, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 600,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'invalid-origin' }, { status: 403 });
  }
}
