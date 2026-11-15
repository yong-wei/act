import { randomBytes } from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import { encode } from 'next-auth/jwt';
import type { NextResponse } from 'next/server';

import { sessionProfileCache } from '@/lib/lru-cache';
import { prisma } from '@/lib/prisma';
import { initializeUserProgress } from '@/lib/user-sync';

import type { IlabGrantPayload } from '../grant-cookie';
import type { IlabTokenResult, IlabUserProfileClaims } from '../ilab-client';

export const ILAB_ACCOUNT_PROVIDER = 'ilab-x';
export const ACCOUNT_SOURCE_ILAB = 'ILAB';
export const ACCOUNT_SOURCE_PLATFORM = 'PLATFORM';

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface IlabAuthUserSummary {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  accountSource: string;
}

export interface EnsureIlabUserResult {
  user: IlabAuthUserSummary;
  ilabUsername: string;
  created: boolean;
}

function buildIlabProviderAccountId(appId: string, username: string): string {
  return `${appId.trim() || 'default'}:${username.trim()}`;
}

function resolveValidEmail(raw: string | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (!SIMPLE_EMAIL_REGEX.test(normalized) || normalized.length > 180) return null;
  return normalized;
}

function buildSessionStateMetadata(username: string, displayName: string, claims?: IlabUserProfileClaims): string {
  return JSON.stringify({
    username,
    displayName,
    school: claims?.school ?? null,
    department: claims?.department ?? null,
    major: claims?.major ?? null,
    className: claims?.className ?? null,
    studentNumber: claims?.studentNumber ?? null,
    phone: claims?.phone ?? null,
    gender: claims?.gender ?? null,
    year: claims?.year ?? null,
    rawAttributes: claims?.rawAttributes ?? {},
    syncedAt: new Date().toISOString(),
  });
}

async function resolveAvailableStudentNumber(
  tx: Prisma.TransactionClient,
  appId: string,
  username: string,
  preferred: string | undefined,
): Promise<string> {
  const candidates = [
    preferred?.trim(),
    username.trim(),
    `ilab-${appId}-${username}`.slice(0, 64),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const taken = await tx.studentProfile.findFirst({
      where: { studentNumber: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `ilab-${appId}-${username}-${randomBytes(3).toString('hex')}`.slice(0, 64);
}

/** 根据实验空间 token 与附加声明幂等创建或同步本平台学生账号。 */
export async function ensureIlabPlatformUser(input: {
  appId: string;
  token: IlabTokenResult;
}): Promise<EnsureIlabUserResult> {
  const appId = input.appId.trim() || (input.token.bypass ? 'dev' : 'default');
  const username = input.token.username.trim();
  if (!username) {
    throw new Error('实验空间未返回有效用户标识，无法建立平台账号。');
  }

  const claims = input.token.profileClaims;
  const resolvedName = (claims?.displayName || input.token.displayName || username).trim().slice(0, 80);
  const resolvedEmail = resolveValidEmail(claims?.email);
  const resolvedClassName = (
    claims?.className?.trim()
    || (claims?.school ? `${claims.school.trim()}（实验空间）` : '实验空间')
  ).slice(0, 80);
  const resolvedMajor = (claims?.major?.trim() || claims?.department?.trim() || '船舶与海洋工程（实验空间）').slice(0, 80);
  const resolvedYear = String(
    claims?.year && claims.year >= 2000 && claims.year <= 2100
      ? claims.year
      : new Date().getFullYear(),
  );
  const providerAccountId = buildIlabProviderAccountId(appId, username);
  const expiresAtSeconds = input.token.expiresAtMs ? Math.floor(input.token.expiresAtMs / 1000) : null;
  const sessionState = buildSessionStateMetadata(username, resolvedName, claims);

  const upsertOnce = () => prisma.$transaction(async (tx) => {
    const existingAccount = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: ILAB_ACCOUNT_PROVIDER,
          providerAccountId,
        },
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (existingAccount?.user) {
      const current = existingAccount.user;
      let nextEmail = current.email;
      if (!nextEmail && resolvedEmail) {
        const occupied = await tx.user.findUnique({
          where: { email: resolvedEmail },
          select: { id: true },
        });
        if (!occupied) {
          nextEmail = resolvedEmail;
        }
      }

      const updatedUser = await tx.user.update({
        where: { id: current.id },
        data: {
          accountSource: ACCOUNT_SOURCE_ILAB,
          ...(resolvedName && resolvedName !== current.name ? { name: resolvedName } : {}),
          ...(nextEmail !== current.email ? { email: nextEmail } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          accountSource: true,
        },
      });

      if (current.profile) {
        const profileUpdate: Prisma.StudentProfileUpdateInput = {};
        if ((!current.profile.className || current.profile.className === '实验空间') && resolvedClassName !== '实验空间') {
          profileUpdate.className = resolvedClassName;
        } else if (!current.profile.className) {
          profileUpdate.className = resolvedClassName;
        }
        if ((!current.profile.major || current.profile.major.includes('实验空间')) && claims?.major) {
          profileUpdate.major = resolvedMajor;
        } else if (!current.profile.major) {
          profileUpdate.major = resolvedMajor;
        }
        if (!current.profile.year) {
          profileUpdate.year = resolvedYear;
        }
        if (!current.profile.studentNumber) {
          profileUpdate.studentNumber = await resolveAvailableStudentNumber(tx, appId, username, claims?.studentNumber);
        }
        if (Object.keys(profileUpdate).length > 0) {
          await tx.studentProfile.update({
            where: { id: current.profile.id },
            data: profileUpdate,
          });
        }
      } else {
        const studentNumber = await resolveAvailableStudentNumber(tx, appId, username, claims?.studentNumber);
        await tx.studentProfile.create({
          data: {
            userId: current.id,
            studentNumber,
            className: resolvedClassName,
            major: resolvedMajor,
            year: resolvedYear,
            techScore: 0,
            ethicsScore: 100,
          },
        });
      }

      await tx.account.update({
        where: { id: existingAccount.id },
        data: {
          expires_at: expiresAtSeconds,
          session_state: sessionState,
        },
      });

      return { user: updatedUser, ilabUsername: username, created: false };
    }

    let safeEmail: string | null = null;
    if (resolvedEmail) {
      const occupied = await tx.user.findUnique({
        where: { email: resolvedEmail },
        select: { id: true },
      });
      if (!occupied) safeEmail = resolvedEmail;
    }

    const studentNumber = await resolveAvailableStudentNumber(tx, appId, username, claims?.studentNumber);
    const createdUser = await tx.user.create({
      data: {
        name: resolvedName,
        email: safeEmail,
        role: UserRole.STUDENT,
        accountSource: ACCOUNT_SOURCE_ILAB,
        profile: {
          create: {
            studentNumber,
            className: resolvedClassName,
            major: resolvedMajor,
            year: resolvedYear,
            techScore: 0,
            ethicsScore: 100,
          },
        },
        accounts: {
          create: {
            type: 'oauth',
            provider: ILAB_ACCOUNT_PROVIDER,
            providerAccountId,
            expires_at: expiresAtSeconds,
            session_state: sessionState,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountSource: true,
      },
    });

    return { user: createdUser, ilabUsername: username, created: true };
  });

  let result: EnsureIlabUserResult;
  try {
    result = await upsertOnce();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      result = await upsertOnce();
    } else {
      throw error;
    }
  }

  sessionProfileCache.delete(result.user.id);
  await initializeUserProgress(result.user.id).catch(() => undefined);
  return result;
}

/** 当仅持有已验签的 iLab HttpOnly Grant Cookie 时，查找或补建对应的平台实验空间账号。 */
export async function ensureIlabUserFromGrant(grant: IlabGrantPayload): Promise<EnsureIlabUserResult> {
  if (grant.userId) {
    const existing = await prisma.user.findUnique({
      where: { id: grant.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountSource: true,
      },
    });
    if (existing) {
      if (existing.accountSource !== ACCOUNT_SOURCE_ILAB) {
        const updated = await prisma.user.update({
          where: { id: existing.id },
          data: { accountSource: ACCOUNT_SOURCE_ILAB },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            accountSource: true,
          },
        });
        return { user: updated, ilabUsername: grant.username, created: false };
      }
      return { user: existing, ilabUsername: grant.username, created: false };
    }
  }

  return ensureIlabPlatformUser({
    appId: grant.appId,
    token: {
      accessToken: grant.accessToken,
      username: grant.username,
      displayName: grant.displayName,
      expiresAtMs: grant.expiresAtMs,
      bypass: grant.bypass,
    },
  });
}

export function resolveNextAuthSessionCookieConfig(request?: Request): {
  cookieName: string;
  secure: boolean;
} {
  let requestHttps = false;
  if (request?.url) {
    try {
      requestHttps = new URL(request.url).protocol === 'https:';
    } catch {
      requestHttps = false;
    }
  }
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  const useSecureCookies = nextAuthUrl
    ? nextAuthUrl.startsWith('https://')
    : Boolean(process.env.VERCEL) || requestHttps;

  return {
    cookieName: useSecureCookies ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
    secure: useSecureCookies,
  };
}

/** 为自动建立/同步的实验空间用户在响应上种下标准 NextAuth JWT Cookie，使平台 API 与控灵助教生效。 */
export async function applyIlabNextAuthSessionCookie(
  response: NextResponse,
  user: Pick<IlabAuthUserSummary, 'id' | 'name' | 'email' | 'role'>,
  request?: Request,
): Promise<NextResponse> {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
    || (process.env.NODE_ENV !== 'production' ? 'act-nextauth-dev-fallback-secret' : '');
  if (!secret) {
    console.warn('[ilab] NEXTAUTH_SECRET 未配置，无法签发实验空间用户登录态 Cookie');
    return response;
  }

  const jwt = await encode({
    token: {
      sub: user.id,
      id: user.id,
      name: user.name ?? undefined,
      email: user.email ?? '',
      role: user.role,
    },
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const { cookieName, secure } = resolveNextAuthSessionCookieConfig(request);
  response.cookies.set(cookieName, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
