import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { SystemConfigDashboard } from '@/features/admin/system-config-dashboard';
import { getServerAuthSession } from '@/lib/auth';

export default async function AdminConfigPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== UserRole.ADMIN) {
    redirect('/');
  }

  return (
    <SystemConfigDashboard
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: 'ADMIN',
      }}
    />
  );
}
