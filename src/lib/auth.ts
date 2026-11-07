import { UserRole } from '@prisma/client';
import { compare } from 'bcryptjs';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import KeycloakProvider from 'next-auth/providers/keycloak';

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
        return true; // 本地凭据路径维持现状。
      }
      const personId = String(profile.sub);
      const prisma = await getPrismaClient();

      // 1) 既有映射直登。
      const existing = await prisma.account.findFirst({
        where: { provider: PLATFORM_ACCOUNT_PROVIDER, providerAccountId: personId },
        select: { userId: true },
      });
      if (existing) {
        const local = await prisma.user.findUnique({
          where: { id: existing.userId },
          select: { role: true, email: true, name: true },
        });
        if (!local) {
          return false; // 映射指向已删除用户：拒绝（不自动改绑）。
        }
        applyLocalIdentity(user, existing.userId, { id: existing.userId, role: local.role, email: local.email, name: local.name });
        return true;
      }

      // 2) 声明匹配（email / preferred_username 学号工号）→ 建立关联。
      const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
      const username = typeof (profile as { preferred_username?: unknown }).preferred_username === 'string'
        ? String((profile as { preferred_username?: string }).preferred_username).trim()
        : '';
      // email 优先；未命中继续学号/工号（本地账号可能无邮箱或邮箱与 IdP 不同）。
      const byIdentifier = async () => {
        if (email) {
          const byEmail = await prisma.user.findFirst({
            where: { email },
            select: { id: true, role: true, email: true, name: true },
          });
          if (byEmail) return byEmail;
        }
        if (username) {
          return prisma.user.findFirst({
            where: {
              OR: [
                { employeeNumber: { equals: username, mode: 'insensitive' } },
                { profile: { is: { studentNumber: { equals: username, mode: 'insensitive' } } } },
              ],
            },
            select: { id: true, role: true, email: true, name: true },
          });
        }
        return null;
      };
      const matched = await byIdentifier();
      if (!matched) {
        // 未知身份拒绝：不自动建号（账号由管理员预建或按学号匹配）。
        return false;
      }
      await prisma.account.create({
        data: {
          userId: matched.id,
          type: 'oauth',
          provider: PLATFORM_ACCOUNT_PROVIDER,
          providerAccountId: personId,
        },
      });
      applyLocalIdentity(user, matched.id, matched as LocalIdentity);
      return true;
    },
    async jwt({ token, user }) {
      // 首次登录时，user 对象存在
      if (user) {
        token.id = user.id;
        token.email = user.email ?? '';
        token.role = user.role ?? UserRole.STUDENT;
      }
      return token;
    },
    async session({ session, token }) {
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
