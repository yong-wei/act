import { UserRole } from '@prisma/client';
import { encode } from 'next-auth/jwt';

export async function createPlatformSessionToken(input: {
  user: { id: string; role: UserRole; email: string | null; name: string | null };
  issuer: string;
  subject: string;
  personId: string;
  sessionVersion: number;
}): Promise<string> {
  return encode({
    secret: process.env.NEXTAUTH_SECRET ?? '',
    maxAge: 7 * 24 * 60 * 60,
    token: {
      id: input.user.id,
      role: input.user.role,
      email: input.user.email ?? '',
      name: input.user.name ?? '',
      platformIssuer: input.issuer,
      platformSubject: input.subject,
      platformPersonId: input.personId,
      centralSessionVersion: input.sessionVersion,
    },
  });
}

export function sessionCookieName(origin: string): string {
  return origin.startsWith('https://') ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}
