import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectFromRequest } from '@/lib/auth-request-redirect';
import { getPlatformCockpitHref } from '@/lib/platform-role-navigation';

export default async function DashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect(await buildLoginRedirectFromRequest());
  }

  if (session.user.role === 'ADMIN' || session.user.role === 'TEACHER') {
    redirect(getPlatformCockpitHref(session.user.role));
  }

  redirect('/profile');
}
