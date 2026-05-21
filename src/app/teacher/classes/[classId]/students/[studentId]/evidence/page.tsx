import { EvidenceTimelineBrowser } from '@/features/data-governance/evidence-timeline-browser';

export default function TeacherClassStudentEvidencePage({
  params,
}: {
  params: { classId: string; studentId: string };
}) {
  return (
    <EvidenceTimelineBrowser
      apiPath={`/api/teacher/classes/${params.classId}/students/${params.studentId}/evidence`}
      backHref={`/teacher/classes/${params.classId}/students/${params.studentId}`}
      title="学生证据"
      subtitle="按时间查看该学生的学习事实和作答摘要"
    />
  );
}
