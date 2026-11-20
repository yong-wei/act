import { UserRole } from '@prisma/client';
import { compare } from 'bcryptjs';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import KeycloakProvider from 'next-auth/providers/keycloak';
import { authorizeActIdentity } from '@/lib/platform-access';
import { resolveLocalPlatformUser } from '@/lib/platform-local-account';

/**
 * 统一身份（platform Keycloak）受控接入（issue-2164 阶段 A）：
 * issuer/client id/secret 三者齐备才启用；未配置时认证行为与现状一致。
 * 正式授权地址 https://auth.adapt-learn.online（DNS 切换前生产保持未配置）。
 */
const platformIssuer = process.env.PLATFORM_OIDC_ISSUER?.trim() ?? '';
const platformClientId = process.env.PLATFORM_OIDC_CLIENT_ID?.trim() ?? '';
const platformClientSecret = process.env.PLATFORM_OIDC_CLIENT_SECRET?.trim() ?? '';
const platformOidcEnabled = Boolean(platformIssuer && platformClientId && platformClientSecret);
const platformOidcEnforced = process.env.PLATFORM_OIDC_ENFORCED === 'true';
const PLATFORM_ACCOUNT_PROVIDER = 'platform';

export const isPlatformOidcEnabled = platformOidcEnabled;

type LocalIdentity = { id: string; role: UserRole; email: string | null; name: string | null };

/** 把本地身份（含 DB 角色）写入认证用户对象——jwt 回调据此生成 token。 */
function applyLocalIdentity(user: unknown, id: string, local: LocalIdentity): void {
  const target = user as { id?: string; role?: string; email?: string | null; name?: string | null };
  target.id = id;
  target.role = local.role;
  target.email = local.email ?? undefined;
  target.name = local.name ?? undefined;
}

import { sessionProfileCache, sessionRequestDeduplicator } from '@/lib/lru-cache';
import { isDatabaseConnectivityError } from '@/lib/service-availability';

type PrismaModule = typeof import('@/lib/prisma');

async function getPrismaClient(): Promise<PrismaModule['prisma']> {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    ...(platformOidcEnabled
      ? [
          KeycloakProvider({
            clientId: platformClientId,
            clientSecret: platformClientSecret,
            issuer: platformIssuer,
            idToken: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: '学号/工号', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const identifier = credentials?.email?.trim();
        const password = credentials?.password;

        if (!identifier || !password) {
          return null;
        }

        const prisma = await getPrismaClient();
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              {
                profile: {
                  is: {
                    studentNumber: { equals: identifier, mode: 'insensitive' },
                  },
                },
              },
              { employeeNumber: { equals: identifier, mode: 'insensitive' } },
            ],
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // issue-2164：收紧模式下已迁移统一身份的用户不再接受本地密码
        // （与密码错误不可区分，不泄露存在性）。
        if (platformOidcEnforced) {
          const mapped = await prisma.account.count({
            where: { userId: user.id, provider: PLATFORM_ACCOUNT_PROVIDER },
          });
          if (mapped > 0) {
            return null;
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'keycloak' || !profile?.sub) {
        return true;
      }
      const subject = String(profile.sub);
      const decision = await authorizeActIdentity({ issuer: platformIssuer, subject });
      if (!decision.allow || !decision.personId) {
        return false;
      }
      const local = await resolveLocalPlatformUser({
        issuer: platformIssuer,
        subject,
        personId: decision.personId,
      });
      if (!local) {
        return false;
      }
      applyLocalIdentity(user, local.id, { id: local.id, role: local.role, email: local.email, name: local.name });
      Object.assign(user, {
        platformIssuer,
        platformSubject: subject,
        platformPersonId: decision.personId,
        centralSessionVersion: decision.sessionVersion,
      });
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email ?? '';
        token.role = user.role ?? UserRole.STUDENT;
        const central = user as {
          platformIssuer?: string;
          platformSubject?: string;
          platformPersonId?: string;
          centralSessionVersion?: number;
        };
        token.platformIssuer = central.platformIssuer;
        token.platformSubject = central.platformSubject;
        token.platformPersonId = central.platformPersonId;
        token.centralSessionVersion = central.centralSessionVersion;
      }
      if (platformOidcEnforced && token.platformIssuer && token.platformSubject) {
        const decision = await authorizeActIdentity({
          issuer: String(token.platformIssuer),
          subject: String(token.platformSubject),
          sessionVersion: Number(token.centralSessionVersion ?? 0),
        });
        token.centralAccessDenied = !decision.allow;
        if (decision.allow) {
          token.centralSessionVersion = decision.sessionVersion;
          token.platformPersonId = decision.personId ?? undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.centralAccessDenied) {
        session.user = undefined as never;
        (session as typeof session & { error?: string }).error = 'ACT_ACCESS_DENIED';
        return session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole) ?? UserRole.STUDENT;

        if (session.user.role !== UserRole.STUDENT) {
          return session;
        }

        const userId = token.id as string;
        const cachedProfile = sessionProfileCache.get(userId);
        let profile = cachedProfile;

        if (!profile) {
          try {
            const fetchedProfile = await sessionRequestDeduplicator.execute(userId, async () => {
              const prisma = await getPrismaClient();
              const fetchedProfile = await prisma.studentProfile.findUnique({
                where: { userId },
                select: {
                  studentNumber: true,
                  classId: true,
                  techScore: true,
                  ethicsScore: true,
                  major: true,
                  className: true,
                },
              });

              if (fetchedProfile) {
                sessionProfileCache.set(userId, fetchedProfile);
              }

              return fetchedProfile;
            });
            profile = fetchedProfile ?? undefined;
          } catch (error) {
            if (isDatabaseConnectivityError(error)) {
              console.error('[auth] student profile enrichment skipped due to database connectivity issue', {
                userId,
                error,
              });
              return session;
            }

            throw error;
          }
        }

        if (profile) {
          session.user.profile = profile;
        }
      }
      return session;
    },
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
