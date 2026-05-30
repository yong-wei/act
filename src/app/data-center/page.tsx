import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { PresentationDataCenter } from '@/features/data-center/presentation-data-center';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

export const metadata = {
  title: '数据中心 - 平台教学运行全景视图',
  description: '平台数据中心展示聚合教学运行指标、模块活动、学习轨迹和仿真活动',
};

function mapUserRoleToPlatformRole(userRole: string): PlatformRole {
  if (userRole === 'TEACHER') return 'teacher';
  if (userRole === 'ADMIN') return 'admin';
  return 'student';
}

export default async function DataCenterPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect(buildLoginRedirectForPath('/data-center'));
  }

  const platformRole: PlatformRole = mapUserRoleToPlatformRole(session.user.role ?? 'STUDENT');

  return <PresentationDataCenter role={platformRole} />;
}
