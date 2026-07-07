import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { getPlatformCockpitHref } from '@/lib/platform-role-navigation';

export default async function DashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role === 'ADMIN' || session.user.role === 'TEACHER') {
    redirect(getPlatformCockpitHref(session.user.role));
  }

  redirect('/profile');
}
