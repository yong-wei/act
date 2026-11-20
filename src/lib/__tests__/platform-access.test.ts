import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizeActIdentity, platformAccountId } from '@/lib/platform-access';

const identity = { issuer: 'https://auth.example/realms/platform', subject: 'subject-1', sessionVersion: 2 };

beforeEach(() => {
  vi.unstubAllEnvs();
  process.env.PLATFORM_ACCESS_URL = 'https://auth.example/access';
  process.env.PLATFORM_APP_TOKEN = 'synthetic-token';
});

describe('central ACT access decisions', () => {
  it('binds issuer and subject into the account key', () => {
    expect(platformAccountId(identity.issuer, identity.subject)).toBe(`${identity.issuer}\0${identity.subject}`);
  });

  it('accepts an authoritative grant and returns person/session data', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      allow: true, reason: 'grant', personId: 'person-1', sessionVersion: 3,
    }), { status: 200 }));
    const result = await authorizeActIdentity(identity, fetchImpl as typeof fetch);
    expect(result).toEqual({ allow: true, reason: 'grant', personId: 'person-1', sessionVersion: 3 });
    const request = fetchImpl.mock.calls[0][1];
    expect(JSON.parse(String(request?.body))).toMatchObject({ requestedAppId: 'act', sessionVersion: 2 });
  });

  it('distinguishes a real 403 denial from upstream unavailability', async () => {
    const denied = await authorizeActIdentity(identity, vi.fn(async () => new Response(JSON.stringify({ allow: false, reason: 'no-eligibility' }), { status: 403 })) as typeof fetch);
    expect(denied.allow).toBe(false);
    expect(denied.reason).toBe('no-eligibility');
    const unavailable = await authorizeActIdentity(identity, vi.fn(async () => new Response(JSON.stringify({ message: 'down' }), { status: 503 })) as typeof fetch);
    expect(unavailable.reason).toBe('unavailable');
  });

  it('fails closed on non-authoritative or malformed responses', async () => {
    const result = await authorizeActIdentity(identity, vi.fn(async () => new Response(JSON.stringify({ message: 'bad gateway' }), { status: 200 })) as typeof fetch);
    expect(result.allow).toBe(false);
    expect(result.reason).toBe('unavailable');
  });
});
