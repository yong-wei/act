import dynamicImport from 'next/dynamic';
import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { ArenaBlackBoxSubmissionPanel } from '@/features/arena/submissions/arena-blackbox-submission-panel';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  ArenaPublicationAccessError,
  resolveAccessibleArenaPublicationForStudent,
  type ArenaResolvedSubmissionContext,
} from '@/features/arena/teacher/publication-store';
import { resolveArenaWorkbenchContext } from '@/features/arena/workbench/context';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CruiseSimulation = dynamicImport(
  () => import('@/resources/simulations/simulations/cruise-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-slate-300">
        正在加载爱达·魔都号邮轮仿真场景...
      </div>
    ),
  },
);

type CruiseSimulationPageProps = {
  searchParams?: {
    arenaTask?: string | string[];
    mode?: string | string[];
    publicationId?: string | string[];
  };
};

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CruiseSimulationPage({ searchParams }: CruiseSimulationPageProps) {
  const arenaTaskId = getSingleSearchParam(searchParams?.arenaTask);
  const requestedPublicationId = getSingleSearchParam(searchParams?.publicationId)?.trim() || undefined;
  const arenaContext = arenaTaskId ? resolveArenaWorkbenchContext(arenaTaskId) : null;
  const blackBoxTask = arenaContext?.task.workspaceMode === 'black-box-identification'
    ? arenaContext.task
    : null;
  const session = blackBoxTask && requestedPublicationId ? await getServerAuthSession() : null;
  let publicationContext: ArenaResolvedSubmissionContext | null = null;
  if (blackBoxTask && requestedPublicationId && session?.user?.id && session.user.role === 'STUDENT') {
    try {
      publicationContext = await resolveAccessibleArenaPublicationForStudent(prisma as any, {
        publicationId: requestedPublicationId,
        studentId: session.user.id,
        taskId: blackBoxTask.id,
        now: new Date(),
        allowAfterDeadline: true,
      });
    } catch (error) {
      if (!(error instanceof ArenaPublicationAccessError)) {
        throw error;
      }
    }
  }
  const canRenderBlackBoxPanel = Boolean(blackBoxTask) && (!requestedPublicationId || Boolean(publicationContext));
  const blackBoxSubmissions = blackBoxTask && canRenderBlackBoxPanel
    ? await prismaArenaSubmissionStore.listSubmissions({
      taskId: blackBoxTask.id,
      ...(publicationContext ? { publicationId: publicationContext.id } : {}),
      ...(publicationContext?.visibility === 'class' && publicationContext.classId ? { classId: publicationContext.classId } : {}),
    })
    : [];
  const visibleBlackBoxSubmissions =
    publicationContext?.gradingPolicy.hideFullLeaderboardBeforeDeadline === true &&
    publicationContext.isLate !== true &&
    session?.user?.id
      ? blackBoxSubmissions.filter((submission) => submission.userId === session.user.id)
      : blackBoxSubmissions;

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="邮轮仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <CruiseSimulation />
      {blackBoxTask && canRenderBlackBoxPanel ? (
        <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
          <ArenaBlackBoxSubmissionPanel
            task={blackBoxTask}
            initialSubmissions={visibleBlackBoxSubmissions}
            publicationId={publicationContext?.id}
          />
        </div>
      ) : null}
    </div>
  );
}
