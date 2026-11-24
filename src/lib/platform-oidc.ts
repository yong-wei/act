import { createRemoteJWKSet, jwtVerify } from '../../node_modules/next-auth/node_modules/jose';

export function platformOidcConfig() {
  const issuer = process.env.PLATFORM_OIDC_ISSUER?.trim() ?? '';
  const clientId = process.env.PLATFORM_OIDC_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.PLATFORM_OIDC_CLIENT_SECRET?.trim() ?? '';
  return issuer && clientId && clientSecret ? { issuer, clientId, clientSecret } : null;
}

export function requestOrigin(request: Request): string {
  const configured = process.env.NEXTAUTH_URL?.trim();
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || (configured ? new URL(configured).protocol.replace(':', '') : 'http');
  return `${proto}://${host}`;
}

export function assertSameOrigin(request: Request): void {
  const expected = requestOrigin(request);
  const origin = request.headers.get('origin') ?? '';
  const referer = request.headers.get('referer') ?? '';
  if (origin === expected || referer.startsWith(`${expected}/`)) return;
  if (!origin && !referer && request.headers.get('sec-fetch-site') === 'same-origin') return;
  throw new Error('invalid-origin');
}

export async function verifyPortalLaunch(identity: { issuer: string; subject: string }, reference: string): Promise<boolean> {
  const response = await fetch(new URL('/api/apps/act/verify-launch', identity.issuer), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reference, subject: identity.subject }),
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  return response.status === 204;
}

export async function exchangePlatformCode(input: {
  code: string;
  iss: string;
  codeVerifier: string;
  nonce: string;
  origin: string;
}) {
  const config = platformOidcConfig();
  if (!config || input.iss !== config.issuer) throw new Error('invalid-issuer');
  const redirectUri = `${input.origin}/api/auth/platform/callback`;
  const response = await fetch(`${config.issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('exchange-failed');
  const tokens = await response.json() as { id_token?: string };
  if (!tokens.id_token) throw new Error('exchange-failed');
  const { payload } = await jwtVerify(
    tokens.id_token,
    createRemoteJWKSet(new URL(`${config.issuer}/protocol/openid-connect/certs`)),
    { issuer: config.issuer, audience: config.clientId },
  );
  if (payload.nonce !== input.nonce || typeof payload.sub !== 'string') throw new Error('invalid-token');
  return {
    issuer: config.issuer,
    subject: payload.sub,
    personId: typeof payload.person_id === 'string' ? payload.person_id : null,
  };
}
