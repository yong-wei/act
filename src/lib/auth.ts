import { UserRole } from '@prisma/client';
import { compare } from 'bcryptjs';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { sessionProfileCache, sessionRequestDeduplicator } from '@/lib/lru-cache';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
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

        const userId = token.id as string;
        const cachedProfile = sessionProfileCache.get(userId);
        const profile =
          cachedProfile ??
          (await sessionRequestDeduplicator.execute(userId, async () => {
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
          }));

        if (profile) {
          session.user.profile = profile;
        }
      }
      return session;
    },
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
