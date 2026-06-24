import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { getDataCenterShowDemoSourceLabels } from '@/lib/platform-settings';
import { PresentationDataCenter } from '@/features/data-center/presentation-data-center';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

export const metadata = {
  title: '数据中心 - 平台教学运行全景视图',
  description: '平台数据中心展示聚合教学运行指标、模块活动、学习轨迹和仿真活动',
};

type DataCenterPageProps = {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
};

function mapUserRoleToPlatformRole(userRole: string): PlatformRole | null {
  if (userRole === 'TEACHER') return 'teacher';
  if (userRole === 'ADMIN') return 'admin';
  return null;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveLearnerRedirectTarget(returnTo: string | undefined): string {
  if (!returnTo) return '/profile/evidence';
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/profile/evidence';
  if (returnTo === '/data-center' || returnTo.startsWith('/data-center?') || returnTo.startsWith('/data-center/')) {
    return '/profile/evidence';
  }
  return returnTo;
}

export default async function DataCenterPage({ searchParams }: DataCenterPageProps = {}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect(buildLoginRedirectForPath('/data-center'));
  }

  const platformRole = mapUserRoleToPlatformRole(session.user.role ?? '');

  if (!platformRole) {
    const params = await searchParams;
    redirect(resolveLearnerRedirectTarget(firstValue(params?.returnTo)));
  }

  const showDemoSourceLabels = await getDataCenterShowDemoSourceLabels(false);

  return <PresentationDataCenter role={platformRole} showDemoSourceLabels={showDemoSourceLabels} />;
}
