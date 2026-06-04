import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import {
  filterArenaSubmissionsForHiddenPublicationPolicy,
  toArenaStatsPublicationContext,
} from '@/features/arena/domain';
import { ArenaBlackBoxSubmissionPanel } from '@/features/arena/submissions/arena-blackbox-submission-panel';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  ArenaPublicationAccessError,
  resolveAccessibleArenaPublicationForStudent,
  type ArenaResolvedSubmissionContext,
} from '@/features/arena/teacher/publication-store';
import { resolveArenaWorkbenchContext } from '@/features/arena/workbench/context';
import { describeExperienceLaunch } from '@/features/simulation-arena-workbench/experience-shell-contracts';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CruiseSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

type CruiseSimulationPageProps = {
  searchParams?: Promise<{
    arenaTask?: string | string[];
    mode?: string | string[];
    publicationId?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CruiseSimulationPage(props: CruiseSimulationPageProps) {
  const searchParams = await props.searchParams;
  const arenaTaskId = getSingleSearchParam(searchParams?.arenaTask);
  const requestedPublicationId = getSingleSearchParam(searchParams?.publicationId)?.trim() || undefined;
  const arenaContext = arenaTaskId ? resolveArenaWorkbenchContext(arenaTaskId) : null;
  const blackBoxTask = arenaContext?.task.workspaceMode === 'black-box-identification'
    ? arenaContext.task
    : null;
  const session = blackBoxTask ? await getServerAuthSession() : null;
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
  const launchKind = blackBoxTask ? (publicationContext ? 'official-evaluation' : 'arena-preview') : 'standalone';
  const launchDescription = describeExperienceLaunch({
    kind: launchKind,
    arena: blackBoxTask
      ? {
        taskId: blackBoxTask.id,
        publicationId: publicationContext?.id,
        classId: publicationContext?.classId,
        seasonId: publicationContext?.seasonId,
      }
      : undefined,
  });
  const blackBoxSubmissions = blackBoxTask && canRenderBlackBoxPanel
    ? await prismaArenaSubmissionStore.listSubmissions({
      taskId: blackBoxTask.id,
      ...(publicationContext ? { publicationId: publicationContext.id } : {}),
      ...(publicationContext?.visibility === 'class' && publicationContext.classId ? { classId: publicationContext.classId } : {}),
    })
    : [];
  const submissionPublicationIds = requestedPublicationId
    ? []
    : Array.from(
      new Set(
        blackBoxSubmissions
          .map((submission) => submission.publicationId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    );
  const publicationRows = submissionPublicationIds.length > 0
    ? await prisma.arenaChallengePublication.findMany({
      where: { id: { in: submissionPublicationIds } },
      select: { id: true, deadline: true, gradingPolicy: true },
    })
    : [];
  const taskVisibleBlackBoxSubmissions = requestedPublicationId
    ? blackBoxSubmissions
    : filterArenaSubmissionsForHiddenPublicationPolicy(
      blackBoxSubmissions,
      publicationRows.map(toArenaStatsPublicationContext),
      new Date(),
    );
  const visibleBlackBoxSubmissions =
    publicationContext?.gradingPolicy.hideFullLeaderboardBeforeDeadline === true &&
    publicationContext.isLate !== true &&
    session?.user?.id
      ? taskVisibleBlackBoxSubmissions.filter((submission) => submission.userId === session.user.id)
      : taskVisibleBlackBoxSubmissions;

  return (
    <div
      className="relative min-h-screen bg-slate-950 text-slate-100"
      data-commercial-workspace="simulation-scene"
      data-task-workspace-archetype="immersive-scene"
      data-launch-provenance={launchKind}
      data-return-target="/simulations"
    >
      <FeaturePageNav title="邮轮仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <section
        className="pointer-events-none absolute left-4 top-20 z-20 max-w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-white/15 bg-slate-950/70 px-4 py-3 text-xs text-slate-200 shadow-2xl backdrop-blur md:left-6 md:top-24"
        data-commercial-workspace-zone="context-strip"
      >
        <div className="font-semibold text-white">{launchDescription.label}</div>
        <div className="mt-1 leading-5 text-slate-300">{launchDescription.summary}</div>
      </section>
      <section data-commercial-workspace-zone="instrument-area">
        <CruiseSimulation />
      </section>
      {blackBoxTask && canRenderBlackBoxPanel ? (
        <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8" data-commercial-workspace-zone="evidence-rail">
          <ArenaBlackBoxSubmissionPanel
            task={blackBoxTask}
            initialSubmissions={visibleBlackBoxSubmissions}
            publicationId={publicationContext?.id}
            viewerUserId={session?.user?.id}
          />
        </div>
      ) : null}
      <section
        className="pointer-events-none fixed bottom-5 left-4 z-20 max-w-[min(30rem,calc(100vw-2rem))] rounded-lg border border-cyan-300/20 bg-cyan-950/70 px-4 py-2 text-xs leading-5 text-cyan-50 shadow-2xl backdrop-blur md:left-6"
        data-commercial-workspace-zone="command-bar"
        data-task-workspace-zone="bottom-tools"
      >
        场景相机、参数和任务工具属于仿真局部控制；Konling、角色座舱和账户设置属于全局外层控制。
      </section>
      <section className="sr-only" data-commercial-workspace-zone="support-drawer">
        仿真模型、回放、Arena 预览和官方评价边界由场景与 Arena 域提供。
      </section>
      <section className="sr-only" data-commercial-workspace-zone="bottom-tools">
        相机、视角和场景工具为任务局部控制。
      </section>
    </div>
  );
}
