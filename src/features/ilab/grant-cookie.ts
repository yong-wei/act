import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { NextResponse } from 'next/server';

export const ILAB_GRANT_COOKIE_NAME = 'act_ilab_grant';
export const ILAB_GRANT_MAX_AGE_SECONDS = 24 * 60 * 60;
const ILAB_GRANT_HARD_TTL_MS = 72 * 60 * 60 * 1000;

export interface IlabGrantPayload {
  v: 1;
  appId: string;
  username: string;
  displayName: string;
  accessToken: string;
  issuedAtMs: number;
  expiresAtMs: number | null;
  bypass: boolean;
}

export interface IlabGrantPublicView {
  connected: boolean;
  displayName: string;
  expiresAtMs: number | null;
  bypass: boolean;
}

function resolveGrantKey(): Buffer | null {
  const rawSecret =
    process.env.ILAB_SECRET?.trim()
    || process.env.NEXTAUTH_SECRET?.trim()
    || (process.env.ILAB_DEV_BYPASS === '1' ? 'act-ilab-dev-bypass-cookie-key' : '');
  if (!rawSecret) return null;
  return createHash('sha256').update(`act-ilab-grant-v1:${rawSecret}`, 'utf8').digest();
}

/** 将实验空间授权载荷加密封装为 HttpOnly Cookie 值。 */
export function sealIlabGrant(payload: IlabGrantPayload): string {
  const key = resolveGrantKey();
  if (!key) {
    throw new Error('服务端未配置实验空间授权密钥，无法签发会话凭证。');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(encoded), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function isValidPayload(value: unknown): value is IlabGrantPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<IlabGrantPayload>;
  return candidate.v === 1
    && typeof candidate.appId === 'string' && candidate.appId.length > 0
    && typeof candidate.username === 'string' && candidate.username.length > 0
    && typeof candidate.displayName === 'string'
    && typeof candidate.accessToken === 'string' && candidate.accessToken.length > 0
    && typeof candidate.issuedAtMs === 'number' && Number.isFinite(candidate.issuedAtMs)
    && (candidate.expiresAtMs === null || (typeof candidate.expiresAtMs === 'number' && Number.isFinite(candidate.expiresAtMs)))
    && typeof candidate.bypass === 'boolean';
}

/** 验签并解密 HttpOnly 授权凭证；无效、篡改或超过 72 小时硬有效期均返回 null。 */
export function unsealIlabGrant(cookieValue: string | undefined | null, nowMs = Date.now()): IlabGrantPayload | null {
  if (!cookieValue || typeof cookieValue !== 'string') return null;
  const key = resolveGrantKey();
  if (!key) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const ciphertext = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext) as unknown;
    if (!isValidPayload(parsed)) return null;
    if (nowMs - parsed.issuedAtMs > ILAB_GRANT_HARD_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 仅向客户端返回非敏感连接摘要，严禁暴露 accessToken、username 与 appId。 */
export function toPublicGrantView(grant: IlabGrantPayload | null): IlabGrantPublicView {
  if (!grant) {
    return { connected: false, displayName: '', expiresAtMs: null, bypass: false };
  }
  return {
    connected: true,
    displayName: grant.displayName,
    expiresAtMs: grant.expiresAtMs,
    bypass: grant.bypass,
  };
}

export function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const segment of cookieHeader.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (key !== name) continue;
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

export function readIlabGrantFromRequest(request: Request, nowMs = Date.now()): IlabGrantPayload | null {
  const raw = readCookieValue(request.headers.get('cookie'), ILAB_GRANT_COOKIE_NAME);
  return unsealIlabGrant(raw, nowMs);
}

export function applyIlabGrantCookie(response: NextResponse, grant: IlabGrantPayload): NextResponse {
  response.cookies.set(ILAB_GRANT_COOKIE_NAME, sealIlabGrant(grant), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ILAB_GRANT_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearIlabGrantCookie(response: NextResponse): NextResponse {
  response.cookies.set(ILAB_GRANT_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
  return response;
}
