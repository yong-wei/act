import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  canonicalizeTextbookCoachIdentity,
  type StructuredTextbookUnitIdentity,
} from './identity';
import { extractVersionBoundHandle } from './href';

export { extractVersionBoundHandle };

const HANDLE_TTL_MS = 8 * 60 * 60 * 1000;

interface HandlePayload {
  identity: StructuredTextbookUnitIdentity;
  issuedAt: string;
  expiresAt: string;
}

export function issueTextbookVersionBoundHref(
  identity: StructuredTextbookUnitIdentity,
  structuralPath: readonly string[],
  now = Date.now(),
): string | null {
  const token = issueTextbookVersionBoundHandle(identity, now);
  if (!token) return null;
  const pathname = [
    '/textbooks',
    encodeURIComponent(identity.bookId),
    encodeURIComponent(identity.edition),
    ...structuralPath.map((segment) => encodeURIComponent(segment)),
  ].join('/');
  const href = `${pathname}?vbh=${encodeURIComponent(token)}`;
  return identity.anchorId ? `${href}#${encodeURIComponent(identity.anchorId)}` : href;
}

export function issueTextbookVersionBoundHandle(
  identity: StructuredTextbookUnitIdentity,
  now = Date.now(),
): string | null {
  const secret = resolveHandleSecret();
  if (!secret) return null;
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + HANDLE_TTL_MS).toISOString();
  const encoded = Buffer.from(JSON.stringify({ identity, issuedAt, expiresAt } satisfies HandlePayload), 'utf8')
    .toString('base64url');
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyTextbookVersionBoundHandle(
  token: string | null | undefined,
  now = Date.now(),
): StructuredTextbookUnitIdentity | null {
  if (!token) return null;
  const secret = resolveHandleSecret();
  if (!secret) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  let payload: HandlePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as HandlePayload;
  } catch {
    return null;
  }
  const expiresAt = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return canonicalizeTextbookCoachIdentity(payload.identity);
}

function sign(encoded: string, secret: string): string {
  return createHmac('sha256', secret).update(encoded).digest('base64url');
}

function resolveHandleSecret(): string | null {
  const secret = (
    process.env.KONLING_SERVER_MODE_CONTEXT_SECRET
    || process.env.KONLING_MODE_CONTEXT_SECRET
    || process.env.NEXTAUTH_SECRET
    || ''
  ).trim();
  if (!secret) return null;
  const normalized = secret.toLowerCase();
  if (
    normalized === 'konling-mode-context-development-secret'
    || normalized === 'replace-with-strong-konling-context-secret'
    || normalized === 'development-secret'
    || normalized === 'your-secret-key'
    || normalized === 'changeme'
    || normalized === 'secret'
  ) {
    return null;
  }
  return secret;
}
