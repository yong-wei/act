import { ChallengeDetail } from '@/features/arena/challenge-detail';
import { ArenaRouteRecovery } from '@/features/arena/arena-route-recovery';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterArenaSubmissionsForHiddenPublicationPolicy,
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaLeaderboardPolicy,
  getArenaMetricProfile,
  toArenaStatsPublicationContext,
} from '@/features/arena/domain';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  ArenaPublicationAccessError,
  resolveAccessibleArenaPublicationForStudent,
  type ArenaResolvedSubmissionContext,
} from '@/features/arena/teacher/publication-store';

export const dynamic = 'force-dynamic';

function formatPublicationDeadline(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function buildStudentLeaderboardBoundary(publication: ArenaResolvedSubmissionContext): string {
  if (publication.visibility === 'public' || publication.studentVisibility === 'public') {
    return '公开榜单只统计服务端 ArenaSubmission 官方提交；LearningFact 仅作为学习证据。';
  }
  if (publication.visibility === 'course') {
    return '课程任务榜单只统计本发布的 ArenaSubmission 官方提交，迟交、零分和无效尝试按提交口径处理。';
  }
  return '班级榜单只统计本发布的 ArenaSubmission 官方提交。';
}

export default async function ArenaChallengePage(
  props: {
    params: Promise<{ taskId: string }>;
    searchParams?: Promise<{ publicationId?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const task = getArenaChallengeTask(params.taskId);
  if (!task) {
    return (
      <ArenaRouteRecovery
        kind="invalid-object-route"
        sourceRoute="/arena/challenges/[taskId]"
        targetLabel="Arena 挑战"
        displayReference={params.taskId}
        message="Arena 挑战链接无法识别。"
        recoveryAction="返回 Arena 挑战列表并重新选择任务"
        primaryHref="/arena"
        primaryLabel="返回 Arena"
        surface="challenge-task"
      />
    );
  }

  const object = getArenaChallengeObject(task.objectId);
  const metricProfile = getArenaMetricProfile(task.metricProfileId);
  const leaderboardPolicy = getArenaLeaderboardPolicy(task.leaderboardPolicyId);

  if (!object || !metricProfile || !leaderboardPolicy) {
    return (
      <ArenaRouteRecovery
        kind="missing-object"
        sourceRoute="/arena/challenges/[taskId]"
        targetLabel="Arena 挑战配置"
        displayReference={params.taskId}
        message="Arena 挑战配置缺少对象、指标或榜单策略。"
        recoveryAction="返回 Arena 挑战列表并选择其他任务"
        primaryHref="/arena"
        primaryLabel="返回 Arena"
        surface="challenge-config"
      />
    );
  }
  const publicationId = typeof searchParams?.publicationId === 'string' && searchParams.publicationId.trim().length > 0
    ? searchParams.publicationId
    : undefined;
  let publicationContext: ArenaResolvedSubmissionContext | null = null;
  let viewerUserId: string | undefined;
  if (publicationId) {
    const session = await getServerAuthSession();
    if (!session?.user?.id || session.user.role !== 'STUDENT') {
      return (
        <ArenaRouteRecovery
          kind="permission-boundary"
          sourceRoute="/arena/challenges/[taskId]?publicationId"
          targetLabel="Arena 发布挑战"
          displayReference={publicationId}
          message="请使用有权限的学生账号打开该 Arena 发布挑战。"
          recoveryAction="登录学生账号或返回 Arena 挑战列表"
          primaryHref={session?.user?.id ? '/dashboard' : '/login'}
          primaryLabel={session?.user?.id ? '返回工作台' : '去登录'}
          surface="student-publication-permission"
        />
      );
    }
    viewerUserId = session.user.id;
    try {
      publicationContext = await resolveAccessibleArenaPublicationForStudent(prisma as any, {
        publicationId,
        studentId: session.user.id,
        taskId: task.id,
        now: new Date(),
        allowAfterDeadline: true,
      });
    } catch (error) {
      if (error instanceof ArenaPublicationAccessError) {
        return (
          <ArenaRouteRecovery
            kind="missing-object"
            sourceRoute="/arena/challenges/[taskId]?publicationId"
            targetLabel="Arena 发布挑战"
            message="Arena 发布挑战不存在或当前账号不可见。"
            recoveryAction="返回 Arena 挑战列表并从可见发布入口重新进入"
            primaryHref="/arena"
            primaryLabel="返回 Arena"
            surface="student-publication-access"
          />
        );
      }
      throw error;
    }
  }

  const submissions = await prismaArenaSubmissionStore.listSubmissions({
    taskId: task.id,
    publicationId,
    ...(publicationContext?.visibility === 'class' && publicationContext.classId ? { classId: publicationContext.classId } : {}),
  });
  const submissionPublicationIds = publicationId
    ? []
    : Array.from(
      new Set(
        submissions
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
  const hideFullPublicationLeaderboard =
    publicationContext?.gradingPolicy.hideFullLeaderboardBeforeDeadline === true &&
    publicationContext.isLate !== true;
  const taskVisibleSubmissions = publicationId
    ? submissions
    : filterArenaSubmissionsForHiddenPublicationPolicy(
      submissions,
      publicationRows.map(toArenaStatsPublicationContext),
      new Date(),
    );
  const visibleSubmissions = hideFullPublicationLeaderboard && viewerUserId
    ? taskVisibleSubmissions.filter((submission) => submission.userId === viewerUserId)
    : taskVisibleSubmissions;

  return (
    <ChallengeDetail
      task={task}
      object={object}
      metricProfile={metricProfile}
      leaderboardPolicy={leaderboardPolicy}
      submissions={visibleSubmissions}
      publicationId={publicationId}
      classId={publicationContext?.classId}
      seasonId={publicationContext?.seasonId}
      publicationContext={publicationContext ? {
        assignmentTitle: publicationContext.displayContext?.assignmentTitle ?? (
          publicationContext.visibility === 'public' ? '公开 Arena 挑战' : 'Arena 发布挑战'
        ),
        classTitle: publicationContext.displayContext?.classTitle ?? (
          publicationContext.visibility === 'public'
            ? '公开挑战'
            : publicationContext.visibility === 'class'
              ? '班级范围'
              : '课程范围'
        ),
        teacherLabel: publicationContext.displayContext?.teacherName ?? '教师发布',
        sourceLabel: publicationContext.displayContext?.sourceLabel ?? (
          publicationContext.visibility === 'public' ? '公开 Arena' : '课堂发布'
        ),
        deadlineLabel: formatPublicationDeadline(publicationContext.deadline),
        lifecycleLabel: publicationContext.isLate ? '已截止' : '进行中',
        leaderboardBoundary: buildStudentLeaderboardBoundary(publicationContext),
      } : undefined}
    />
  );
}
