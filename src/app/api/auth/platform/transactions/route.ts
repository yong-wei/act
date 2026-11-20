import { NextResponse } from 'next/server';
import { assertSameOrigin, platformOidcConfig, requestOrigin } from '@/lib/platform-oidc';
import { codeChallenge, createOidcTransaction, transactionCookieName } from '@/lib/platform-oidc-store';

export async function POST(request: Request) {
  const config = platformOidcConfig();
  if (!config) return NextResponse.json({ error: 'disabled' }, { status: 404 });
  try {
    assertSameOrigin(request);
    const origin = requestOrigin(request);
    const transaction = createOidcTransaction(new URL(request.url).searchParams.get('return_to') ?? '/');
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
