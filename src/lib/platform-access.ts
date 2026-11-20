export interface CentralIdentity {
  issuer: string;
  subject: string;
  sessionVersion?: number;
}

export interface CentralDecision {
  allow: boolean;
  reason: string;
  personId: string | null;
  sessionVersion: number;
}

export function platformAccountId(issuer: string, subject: string): string {
  return `${issuer}\0${subject}`;
}

export async function authorizeActIdentity(
  identity: CentralIdentity,
  fetchImpl: typeof fetch = fetch,
): Promise<CentralDecision> {
  const endpoint = process.env.PLATFORM_ACCESS_URL?.trim() ?? '';
  const token = process.env.PLATFORM_APP_TOKEN?.trim() ?? '';
  if (!endpoint || !token || !identity.issuer || !identity.subject) {
    return { allow: false, reason: 'unavailable', personId: null, sessionVersion: identity.sessionVersion ?? 0 };
  }
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        issuer: identity.issuer,
        subject: identity.subject,
        requestedAppId: 'act',
        sessionVersion: identity.sessionVersion ?? 0,
      }),
      signal: AbortSignal.timeout(3000),
    });
    const body = await response.json() as {
      allow?: unknown;
      reason?: unknown;
      personId?: unknown;
      sessionVersion?: unknown;
    };
    if (![200, 403].includes(response.status) || typeof body.allow !== 'boolean') {
      return { allow: false, reason: 'unavailable', personId: null, sessionVersion: identity.sessionVersion ?? 0 };
    }
    return {
      allow: body.allow,
      reason: typeof body.reason === 'string' ? body.reason : body.allow ? 'grant' : 'no-eligibility',
      personId: typeof body.personId === 'string' ? body.personId : null,
      sessionVersion: typeof body.sessionVersion === 'number' ? body.sessionVersion : identity.sessionVersion ?? 0,
    };
  } catch {
    return { allow: false, reason: 'unavailable', personId: null, sessionVersion: identity.sessionVersion ?? 0 };
  }
}
