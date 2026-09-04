import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { TeacherDashboard } from '@/features/teacher/teacher-dashboard';
import { loadTeacherDashboardData } from '@/features/teacher/teacher-dashboard-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TeacherPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect(buildLoginRedirectForPath('/teacher'));
  }

  if (session.user.role !== UserRole.TEACHER) {
    if (session.user.role === UserRole.ADMIN) {
      redirect('/admin');
    }
    redirect('/dashboard');
  }

  const dashboardData = await loadTeacherDashboardData({
    id: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  });

  return (
    <TeacherDashboard
      user={session.user}
      mode={dashboardData.mode}
      stats={dashboardData.stats}
      recentClasses={dashboardData.recentClasses}
      recentPlans={dashboardData.recentPlans}
      activeSessions={dashboardData.activeSessions}
    />
  );
}
