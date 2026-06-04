import { EvidenceTimelineBrowser } from '@/features/data-governance/evidence-timeline-browser';

export default async function TeacherClassStudentEvidencePage(
  props: {
    params: Promise<{ classId: string; studentId: string }>;
  }
) {
  const params = await props.params;
  return (
    <EvidenceTimelineBrowser
      apiPath={`/api/teacher/classes/${params.classId}/students/${params.studentId}/evidence`}
      backHref={`/teacher/classes/${params.classId}/students/${params.studentId}`}
      emptyBackLabel="返回学生详情"
      title="学生证据"
      subtitle="按时间查看该学生的学习事实和作答摘要"
    />
  );
}
