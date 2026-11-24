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
  actProvisioning?: ActProvisioning;
}

type OrdinaryRole = 'STUDENT' | 'TEACHER';

export interface ActProvisioning {
  displayName: string;
  rosterKind: 'teacher' | 'student' | 'external';
  initialRole: OrdinaryRole;
  overrideRole: OrdinaryRole | null;
  staffNumbers: string[];
  studentNumbers: string[];
  localUserId: string | null;
}

function isOrdinaryRole(value: unknown): value is OrdinaryRole {
  return value === 'STUDENT' || value === 'TEACHER';
}

function validActProvisioning(value: unknown): value is ActProvisioning {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  const validNumbers = (numbers: unknown) => Array.isArray(numbers)
    && numbers.every((number) => typeof number === 'string' && number.length > 0);
  return typeof data.displayName === 'string' && isOrdinaryRole(data.initialRole)
    && (data.rosterKind === 'teacher' || data.rosterKind === 'student' || data.rosterKind === 'external')
    && (data.overrideRole === null || isOrdinaryRole(data.overrideRole))
    && validNumbers(data.staffNumbers) && validNumbers(data.studentNumbers)
    && (data.localUserId === null || (typeof data.localUserId === 'string' && data.localUserId.length > 0));
}

export function platformAccountId(issuer: string, subject: string): string {
  return `${issuer}|${subject}`;
}

export async function authorizeActIdentity(
  identity: CentralIdentity,
  fetchImpl: typeof fetch = fetch,
  options: { allowSessionRenewal?: boolean } = {},
): Promise<CentralDecision> {
  const endpoint = process.env.PLATFORM_ACCESS_URL?.trim() ?? '';
  const token = process.env.PLATFORM_APP_TOKEN?.trim() ?? '';
  if (!endpoint || !token || !identity.issuer || !identity.subject) {
    return { allow: false, reason: 'unavailable', personId: null, sessionVersion: identity.sessionVersion ?? 0 };
  }
  const request = async (sessionVersion: number): Promise<CentralDecision> => {
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
        sessionVersion,
        ...(options.allowSessionRenewal ? { includeActProvisioning: true } : {}),
      }),
      // Leave time for the classroom's 7 s browser deadline after a slow session check.
      signal: AbortSignal.timeout(identity.sessionVersion === undefined ? 3000 : 5000),
    });
    const body = await response.json() as {
      allow?: unknown;
      reason?: unknown;
      personId?: unknown;
      sessionVersion?: unknown;
      actProvisioning?: unknown;
    };
    if (![200, 403].includes(response.status) || typeof body.allow !== 'boolean') {
      return { allow: false, reason: 'unavailable', personId: null, sessionVersion: identity.sessionVersion ?? 0 };
    }
    if (body.actProvisioning !== undefined && !validActProvisioning(body.actProvisioning)) {
      return { allow: false, reason: 'unavailable', personId: null, sessionVersion };
    }
    return {
      allow: body.allow,
      reason: typeof body.reason === 'string' ? body.reason : body.allow ? 'grant' : 'no-eligibility',
      personId: typeof body.personId === 'string' ? body.personId : null,
      sessionVersion: typeof body.sessionVersion === 'number' ? body.sessionVersion : sessionVersion,
      ...(body.actProvisioning ? { actProvisioning: body.actProvisioning } : {}),
    };
  };
  try {
    const initial = await request(identity.sessionVersion ?? 0);
    if (
      options.allowSessionRenewal
      && initial.reason === 'session'
      && initial.sessionVersion > (identity.sessionVersion ?? 0)
    ) {
      return request(initial.sessionVersion);
    }
    return initial;
  } catch {
    return { allow: false, reason: 'unavailable', personId: null, sessionVersion: identity.sessionVersion ?? 0 };
  }
}

export async function confirmActLocalAccount(
  identity: Required<CentralIdentity>, localUserId: string,
): Promise<boolean> {
  const endpoint = process.env.PLATFORM_ACCESS_URL?.trim();
  const token = process.env.PLATFORM_APP_TOKEN?.trim();
  if (!endpoint || !token) return false;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...identity, requestedAppId: 'act', actLocalUserId: localUserId }),
      signal: AbortSignal.timeout(3000),
    });
    return response.ok && (await response.json() as { linked?: boolean }).linked === true;
  } catch {
    return false;
  }
}
