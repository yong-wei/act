import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as callback } from '@/app/api/auth/platform/callback/route';
import { POST as complete } from '@/app/api/auth/platform/complete/route';
import { POST as start } from '@/app/api/auth/platform/transactions/route';
import { authorizeActIdentity } from '@/lib/platform-access';
import { resolveLocalPlatformUser } from '@/lib/platform-local-account';
import { exchangePlatformCode, verifyPortalLaunch } from '@/lib/platform-oidc';
import { transactionCookieName } from '@/lib/platform-oidc-store';
import { createPlatformSessionToken } from '@/lib/platform-session';

vi.mock('@/lib/platform-access');
vi.mock('@/lib/platform-local-account');
vi.mock('@/lib/platform-oidc', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/platform-oidc')>(),
  exchangePlatformCode: vi.fn(),
  verifyPortalLaunch: vi.fn(),
}));
vi.mock('@/lib/platform-session', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/platform-session')>(),
  createPlatformSessionToken: vi.fn(),
}));

const origin = 'https://act.example';
const issuer = 'https://auth.example/realms/platform';
const reference = 'r'.repeat(43);
const identity = { issuer, subject: 'central-user', personId: 'person' };

async function startLogin(launchReference?: string, reauthenticate = false) {
  const response = await start(new NextRequest(`${origin}/api/auth/platform/transactions?return_to=%2Fprofile`, {
    method: 'POST',
    headers: { origin, host: 'act.example', 'x-forwarded-proto': 'https' },
    body: JSON.stringify({ launchReference, reauthenticate }),
  }));
  expect(response.status).toBe(200);
  const { transactionId, authorizeUrl } = await response.json();
  const cookie = `${transactionCookieName(transactionId)}=${transactionId}`;
  const finishAuthorization = () => callback(new NextRequest(
    `${origin}/api/auth/platform/callback?${new URLSearchParams({ state: transactionId, code: 'code', iss: issuer })}`,
    { headers: { host: 'act.example', 'x-forwarded-proto': 'https', cookie } },
  ));
  const finishLogin = (cookieHeader: string) => complete(new NextRequest(`${origin}/api/auth/platform/complete`, {
    method: 'POST',
    headers: { origin, host: 'act.example', 'x-forwarded-proto': 'https', cookie: cookieHeader },
    body: JSON.stringify({ transactionId }),
  }));
  return { authorize: new URL(authorizeUrl), cookie, finishAuthorization, finishLogin };
}

describe('ACT unified login', () => {
  beforeEach(() => {
    vi.stubEnv('PLATFORM_OIDC_ISSUER', issuer);
    vi.stubEnv('PLATFORM_OIDC_CLIENT_ID', 'act');
    vi.stubEnv('PLATFORM_OIDC_CLIENT_SECRET', 'test-secret');
    vi.mocked(exchangePlatformCode).mockResolvedValue(identity);
    vi.mocked(authorizeActIdentity).mockResolvedValue({ allow: true, reason: 'grant', personId: 'person', sessionVersion: 1 });
    vi.mocked(resolveLocalPlatformUser).mockResolvedValue({ id: 'local-user', role: 'TEACHER', email: null, name: null });
    vi.mocked(createPlatformSessionToken).mockResolvedValue('new-session');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it('replaces a previous ACT session after verifying the identity from the portal', async () => {
    vi.mocked(verifyPortalLaunch).mockResolvedValue(true);
    const { authorize, cookie, finishAuthorization, finishLogin } = await startLogin(reference);
    expect(authorize.searchParams.get('prompt')).toBe('none');
    expect(authorize.href).not.toContain(reference);
    expect(await (await finishAuthorization()).text()).toContain('act-login-complete');
    expect(verifyPortalLaunch).toHaveBeenCalledWith(identity, reference);
    expect((await finishLogin('__Secure-next-auth.session-token=previous-session')).status).toBe(409);
    const response = await finishLogin(`${cookie}; __Secure-next-auth.session-token=previous-session`);
    expect(response.cookies.get('__Secure-next-auth.session-token')?.value).toBe('new-session');
    expect((await response.json()).returnTo).toBe('/profile');
    expect((await finishLogin(cookie)).status).toBe(409);
  });

  it('stops when the central identity does not match the portal launch', async () => {
    vi.mocked(verifyPortalLaunch).mockResolvedValue(false);
    const { cookie, finishAuthorization, finishLogin } = await startLogin(reference);
    expect(await (await finishAuthorization()).text()).toContain('act-login-error');
    expect(resolveLocalPlatformUser).not.toHaveBeenCalled();
    expect((await finishLogin(cookie)).status).toBe(409);
  });

  it('can ask for credentials on direct login and reports a missing ACT mapping', async () => {
    vi.mocked(resolveLocalPlatformUser).mockResolvedValue(null);
    const { authorize, finishAuthorization } = await startLogin();
    expect(authorize.searchParams.has('prompt')).toBe(false);
    expect(await (await finishAuthorization()).text()).toContain('account-pending');
    expect(verifyPortalLaunch).not.toHaveBeenCalled();
  });

  it('asks for credentials again when the user explicitly switches accounts', async () => {
    const { authorize } = await startLogin(undefined, true);
    expect(authorize.searchParams.get('prompt')).toBe('login');
  });
});
