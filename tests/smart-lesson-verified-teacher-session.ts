import { encode } from 'next-auth/jwt';
import type { BrowserContext } from '@playwright/test';

import { accountByKey } from '../scripts/db/verified-test-accounts.mjs';

export async function addVerifiedTeacherSession(context: BrowserContext, teacherId: string) {
  const teacher = accountByKey('teacher');
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error('NEXTAUTH_SECRET-required');
  const token = await encode({
    secret,
    token: {
      id: teacherId,
      email: teacher.email,
      name: teacher.name,
      role: 'TEACHER',
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 3_600,
  }]);
}
