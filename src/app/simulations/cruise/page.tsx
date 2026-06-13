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
import { SimulationShell } from '../_components/simulation-shell';

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

function buildArenaReturnHref(baseHref: string, publicationId?: string) {
  if (!publicationId) return baseHref;
  const [basePath, query = ''] = baseHref.split('?');
  const params = new URLSearchParams(query);
  params.set('publicationId', publicationId);
  return `${basePath}?${params.toString()}`;
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

  const returnHref = blackBoxTask && arenaContext
    ? buildArenaReturnHref(arenaContext.returnHref, publicationContext?.id)
    : '/simulations';

  return (
    <SimulationShell
      title="邮轮仿真"
      subtitle="舒适性导向控制 · 减摇稳定与黑箱识别任务"
      activeHref="/simulations/cruise"
      returnHref={returnHref}
      returnLabel={blackBoxTask ? '竞技场' : '虚拟仿真'}
      launchProvenance={launchKind}
      localToolTemplate="comfort-frequency"
      contextStrip={(
        <div className="text-xs leading-5 text-platform-fg-secondary" data-commercial-workspace-zone="context-strip">
          <div className="font-semibold text-platform-fg-primary">{launchDescription.label}</div>
          <div className="mt-1">{launchDescription.summary}</div>
        </div>
      )}
      commandBar={(
        <div
          className="text-xs leading-5 text-platform-fg-secondary"
          data-commercial-workspace-zone="command-bar"
        >
          场景相机、参数和任务工具属于仿真局部控制；Konling、角色座舱和账户设置属于全局外层控制。
        </div>
      )}
      supportDrawer={(
        <details className="text-xs leading-5 text-platform-fg-secondary" data-commercial-workspace-zone="support-drawer">
          <summary className="cursor-pointer font-semibold text-platform-fg-primary">支持与证据状态</summary>
          <p className="mt-2">
            仿真模型、回放、Arena 预览和官方评价边界由场景与 Arena 域提供；当前无可回放记录时以预览或不可用状态呈现。
          </p>
        </details>
      )}
      evidenceRail={blackBoxTask && canRenderBlackBoxPanel ? (
        <div data-commercial-workspace-zone="evidence-rail">
          <ArenaBlackBoxSubmissionPanel
            task={blackBoxTask}
            initialSubmissions={visibleBlackBoxSubmissions}
            publicationId={publicationContext?.id}
            viewerUserId={session?.user?.id}
          />
        </div>
      ) : null}
    >
      <CruiseSimulation />
      <section className="sr-only" data-simulation-local-note="scene-controls">
        相机、视角和场景工具为任务局部控制。
      </section>
      <section className="sr-only" data-task-workspace-zone="floating-dock-safe-area">
        移动端底部说明条不固定覆盖场景；桌面浮层避让全局 dock 和场景局部工具。
      </section>
    </SimulationShell>
  );
}
