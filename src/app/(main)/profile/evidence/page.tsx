import { EvidenceTimelineBrowser } from '@/features/data-governance/evidence-timeline-browser';
import { buildLearnerDataRouteShell } from '@/features/adaptive/adaptive-learning-center-contracts';

const learnerDataShell = buildLearnerDataRouteShell('/profile/evidence');

export default function StudentEvidencePage() {
  return (
    <div data-route-family={learnerDataShell.routeFamily} data-route-identity={learnerDataShell.routeIdentity}>
      <EvidenceTimelineBrowser
        apiPath="/api/student/evidence"
        backHref="/profile/growth"
        title="学习证据"
        subtitle="按时间查看课堂作答、仿真和学习事实"
      />
    </div>
  );
}
