import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { DataGovernanceDashboard } from '@/features/admin/data-governance-dashboard';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectFromRequest } from '@/lib/auth-request-redirect';

export default async function AdminDataGovernancePage({
  searchParams,
}: {
  searchParams?: Promise<{
    action?: string;
    riskId?: string;
    assignee?: string;
    format?: string;
    surface?: string;
    tab?: string;
    lessonPlanId?: string;
    graphNodeId?: string;
    audit?: string;
  }>;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect(await buildLoginRedirectFromRequest());
  }

  if (session.user.role !== UserRole.ADMIN) {
    redirect('/');
  }

  const params = await searchParams;

  return (
    <DataGovernanceDashboard
      initialActionQuery={params ?? null}
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: 'ADMIN',
      }}
    />
  );
}
