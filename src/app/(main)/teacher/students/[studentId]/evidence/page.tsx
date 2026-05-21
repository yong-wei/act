import { EvidenceTimelineBrowser } from '@/features/data-governance/evidence-timeline-browser';

export default function TeacherStudentEvidencePage({
  params,
}: {
  params: { studentId: string };
}) {
  return (
    <EvidenceTimelineBrowser
      apiPath={`/api/teacher/students/${params.studentId}/evidence`}
      backHref={`/teacher/students/${params.studentId}/diagnosis`}
      title="学生证据"
      subtitle="按时间查看该学生的学习事实和作答摘要"
    />
  );
}
