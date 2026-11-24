import type { NextRequest } from 'next/server';
import { authorizeActIdentity } from '@/lib/platform-access';
import { resolveLocalPlatformUser } from '@/lib/platform-local-account';
import { exchangePlatformCode, requestOrigin, verifyPortalLaunch } from '@/lib/platform-oidc';
import { publishOidcCompletion, readOidcTransaction, transactionCookieName } from '@/lib/platform-oidc-store';
import { createPlatformSessionToken } from '@/lib/platform-session';

function html(origin: string, transactionId: string, outcome: 'complete' | 'error' | 'account-pending') {
  const type = outcome === 'complete' ? 'act-login-complete' : 'act-login-error';
  const message = JSON.stringify({ type, outcome, transactionId }).replaceAll('<', '\\u003c');
  const targetOrigin = JSON.stringify(origin).replaceAll('<', '\\u003c');
  return new Response(`<!doctype html><html><body><script>window.parent.postMessage(${message},${targetOrigin});</script></body></html>`, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'",
    },
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') ?? '';
  const origin = requestOrigin(request);
  const transaction = readOidcTransaction(state, request.cookies.get(transactionCookieName(state))?.value ?? '');
  if (!transaction) return html(origin, state, 'error');
  try {
    const code = url.searchParams.get('code');
    const issuer = url.searchParams.get('iss') ?? '';
    if (!code) return html(origin, state, 'error');
    const identity = await exchangePlatformCode({
      code,
      iss: issuer,
      codeVerifier: transaction.codeVerifier,
      nonce: transaction.nonce,
      origin,
    });
    const decision = await authorizeActIdentity(
      { issuer: identity.issuer, subject: identity.subject },
      fetch,
      { allowSessionRenewal: true },
    );
    if (!decision.allow || !decision.personId || (identity.personId && identity.personId !== decision.personId)) {
      return html(origin, state, 'error');
    }
    if (transaction.launchReference && !await verifyPortalLaunch(identity.issuer, transaction.launchReference, decision.personId)) {
      return html(origin, state, 'error');
    }
    const user = await resolveLocalPlatformUser({
      issuer: identity.issuer,
      subject: identity.subject,
      personId: decision.personId,
    });
    if (!user) return html(origin, state, 'account-pending');
    const sessionToken = await createPlatformSessionToken({
      user,
      issuer: identity.issuer,
      subject: identity.subject,
      personId: decision.personId,
      sessionVersion: decision.sessionVersion,
    });
    return publishOidcCompletion(state, sessionToken, transaction.returnTo)
      ? html(origin, state, 'complete')
      : html(origin, state, 'error');
  } catch {
    return html(origin, state, 'error');
  }
}
