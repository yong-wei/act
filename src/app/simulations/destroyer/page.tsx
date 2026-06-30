import { SimulationShell } from '../_components/simulation-shell';
import { DestroyerSimulation } from '../_components/simulation-loaders';
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildFeedbackTaskContext,
  resolveVerifiedTeacherInterventionId,
  type FeedbackTaskQuery,
} from '@/lib/student-feedback-task-contract';
import type { SimulationTaskContext } from '../_components/simulation-shell';

export const dynamic = 'force-dynamic';

export default async function DestroyerSimulationPage({
  searchParams,
}: {
  searchParams?: Promise<FeedbackTaskQuery & { mission?: string | string[] }>;
}) {
  const params = await searchParams;
  const session = await getServerAuthSession();
  const verifiedTeacherInterventionId = await resolveVerifiedTeacherInterventionId({
    db: prisma,
    userId: session?.user?.id,
    teacherInterventionId: params?.teacherInterventionId,
    assignment: params?.assignment,
  });
  const feedbackContext = buildFeedbackTaskContext(params ?? {}, { verifiedTeacherInterventionId });
  const missionId = firstQueryValue(params?.mission);
  const simulationTaskContext = missionId || feedbackContext
    ? buildDestroyerTaskContext({ missionId, feedbackContext })
    : null;

  return (
    <SimulationShell
      title="军用驱逐舰战术机动仿真"
      subtitle="Nomoto 船舶运动模型 · 航向保持与战术机动"
      activeHref="/simulations/destroyer"
      localToolTemplate="heading-control"
      returnHref={simulationTaskContext?.returnHref}
      returnLabel={simulationTaskContext?.returnLabel}
      taskContext={simulationTaskContext}
    >
      <StudentFeedbackTaskPanel context={feedbackContext} surface="simulation-destroyer" className="mb-4" />
      <DestroyerSimulation />
    </SimulationShell>
  );
}

function firstQueryValue(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function buildDestroyerTaskContext({
  missionId,
  feedbackContext,
}: {
  missionId?: string;
  feedbackContext: ReturnType<typeof buildFeedbackTaskContext>;
}): SimulationTaskContext {
  const taskId = missionId ?? feedbackContext?.assignmentId ?? 'destroyer-standalone';
  const criterion = feedbackContext?.criterionLabel ?? '航向误差收敛、扰动恢复和观察记录完整';

  return {
    taskId,
    taskTitle: buildDestroyerTaskTitle({ missionId, feedbackContext }),
    objective: feedbackContext?.summary
      ?? '完成航向保持与战术机动观察，记录 PID 参数变化对响应质量的影响。',
    completionCriteria: `完成标准：${criterion}`,
    returnHref: feedbackContext?.returnHref ?? '/missions',
    returnLabel: feedbackContext ? '返回反馈任务' : '返回任务大厅',
    saveBackTarget: feedbackContext?.completionTarget === 'evidence-growth-portfolio'
      ? '学习证据、成长记录和作品集候选'
      : '当前任务暂不支持自动写回',
    saveBackStatus: resolveDestroyerSaveBackStatus(feedbackContext),
    returnFlowState: feedbackContext?.lifecycleState ?? 'mission-linked',
  };
}

function buildDestroyerTaskTitle({
  missionId,
  feedbackContext,
}: {
  missionId?: string;
  feedbackContext: ReturnType<typeof buildFeedbackTaskContext>;
}): string {
  if (feedbackContext) return `${feedbackContext.assignmentTitle} · 驱逐舰航向控制`;
  if (missionId) return `任务 ${missionId} · 驱逐舰航向控制`;
  return '驱逐舰航向控制任务';
}

function resolveDestroyerSaveBackStatus(
  feedbackContext: ReturnType<typeof buildFeedbackTaskContext>,
): SimulationTaskContext['saveBackStatus'] {
  if (feedbackContext?.completionTarget !== 'evidence-growth-portfolio') return 'unsupported';
  if (feedbackContext.lifecycleState === 'written-back' || feedbackContext.lifecycleState === 'teacher-visible') {
    return 'saved';
  }
  return 'queued';
}
