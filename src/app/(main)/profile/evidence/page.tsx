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
    <div data-route-family={learnerDataShell.routeFamily} data-route-identity={learnerDataShell.routeIdentity}>
      <EvidenceTimelineBrowser
        apiPath="/api/student/evidence"
        backHref="/profile/growth"
        initialLessonId={initialLessonId}
        title="学习证据"
        subtitle="按时间查看课堂作答、仿真和学习事实"
      />
    </div>
  );
}
