'use client';

/**
 * NextAuth SessionProvider 包装组件
 * 必须是客户端组件才能使用 SessionProvider
 */

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { type Session } from 'next-auth';

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>;
}
