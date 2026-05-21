import { EvidenceTimelineBrowser } from '@/features/data-governance/evidence-timeline-browser';

export default function StudentEvidencePage() {
  return (
    <EvidenceTimelineBrowser
      apiPath="/api/student/evidence"
      backHref="/profile/growth"
      title="学习证据"
      subtitle="按时间查看课堂作答、仿真和学习事实"
    />
  );
}
