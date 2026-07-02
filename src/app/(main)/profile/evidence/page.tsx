import { AppShell } from '@/components/platform/app-shell';
import { EvidenceTimelineBrowser } from '@/features/data-governance/evidence-timeline-browser';
import { buildLearnerDataRouteShell } from '@/features/adaptive/adaptive-learning-center-contracts';
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildFeedbackTaskContext,
  resolveVerifiedTeacherInterventionId,
  type FeedbackTaskQuery,
} from '@/lib/student-feedback-task-contract';

const learnerDataShell = buildLearnerDataRouteShell('/profile/evidence');

interface StudentEvidencePageProps {
  searchParams?: Promise<{
    lessonId?: string | string[];
    sessionId?: string | string[];
  } & FeedbackTaskQuery>;
}

function readSingleSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function StudentEvidencePage({ searchParams }: StudentEvidencePageProps) {
  const params = await searchParams;
  const session = await getServerAuthSession();
  const initialLessonId = readSingleSearchParam(params?.lessonId);
  const initialSessionId = readSingleSearchParam(params?.sessionId);
  const verifiedTeacherInterventionId = await resolveVerifiedTeacherInterventionId({
    db: prisma,
    userId: session?.user?.id,
    teacherInterventionId: params?.teacherInterventionId,
    assignment: params?.assignment,
  });
  const feedbackContext = buildFeedbackTaskContext(params ?? {}, { verifiedTeacherInterventionId });

  return (
    <AppShell
      viewerRole="student"
      title="学习证据"
      subtitle="来源质量、时间线与隐私范围"
      activeHref="/profile/evidence"
      className="surface-page"
    >
      <section
        data-route-family={learnerDataShell.routeFamily}
        data-route-identity={learnerDataShell.routeIdentity}
        data-learner-record-surface={learnerDataShell.archetype}
        data-learner-record-next-action="evidence-review"
        data-commercial-workspace="knowledge-data-map"
        data-commercial-workspace-zone="instrument-area"
        data-knowledge-data-map-surface="evidence-browser"
        data-evidence-map-semantics="source-quality freshness privacy confidence status"
      >
        <StudentFeedbackTaskPanel context={feedbackContext} surface="evidence" className="mb-6" />
        <EvidenceTimelineBrowser
          apiPath={feedbackContext ? '/api/learning-evidence' : '/api/student/evidence'}
          backHref="/profile/growth"
          chrome="embedded"
          initialLessonId={initialLessonId}
          initialSessionId={initialSessionId}
          assignment={feedbackContext?.assignmentId}
          criterion={feedbackContext?.criterionId ?? undefined}
          assignmentStatus={feedbackContext?.lifecycleState}
          assignmentSource={feedbackContext?.source ?? undefined}
          returnTo={feedbackContext?.returnTo ?? undefined}
          title="学习证据"
          subtitle={feedbackContext?.summary ?? '按时间查看课堂作答、仿真和学习事实'}
          contextBadges={feedbackContext?.badges ?? []}
        />
      </section>
    </AppShell>
  );
}
