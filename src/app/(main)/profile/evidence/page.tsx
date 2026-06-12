import { AppShell } from '@/components/platform/app-shell';
import { EvidenceTimelineBrowser } from '@/features/data-governance/evidence-timeline-browser';
import { buildLearnerDataRouteShell } from '@/features/adaptive/adaptive-learning-center-contracts';

const learnerDataShell = buildLearnerDataRouteShell('/profile/evidence');

interface StudentEvidencePageProps {
  searchParams?: Promise<{ lessonId?: string | string[] }>;
}

function readSingleSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function StudentEvidencePage({ searchParams }: StudentEvidencePageProps) {
  const params = await searchParams;
  const initialLessonId = readSingleSearchParam(params?.lessonId);

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
        <EvidenceTimelineBrowser
          apiPath="/api/student/evidence"
          backHref="/profile/growth"
          chrome="embedded"
          initialLessonId={initialLessonId}
          title="学习证据"
          subtitle="按时间查看课堂作答、仿真和学习事实"
        />
      </section>
    </AppShell>
  );
}
