import { EvidenceTimelineBrowser } from '@/features/data-governance/evidence-timeline-browser';
import { resolveTeacherReturnTo } from '@/lib/teacher-report-grading-contracts';

export default async function TeacherClassStudentEvidencePage(
  props: {
    params: Promise<{ classId: string; studentId: string }>;
    searchParams?: Promise<{ returnTo?: string; gradingRunId?: string; reportId?: string; source?: string }>;
  }
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const safeBackHref = resolveTeacherReturnTo(
    searchParams?.returnTo,
    `/teacher/classes/${params.classId}/students/${params.studentId}`,
  );
  const contextParts = [
    searchParams?.gradingRunId ? `评分运行 ${searchParams.gradingRunId}` : null,
    searchParams?.reportId ? `报告 ${searchParams.reportId}` : null,
    searchParams?.source ? `来源 ${searchParams.source}` : null,
  ].filter((part): part is string => Boolean(part));
  const backHref = mergeTeacherEvidenceContext(safeBackHref, {
    gradingRunId: searchParams?.gradingRunId,
    reportId: searchParams?.reportId,
    source: searchParams?.source,
  });
  return (
    <EvidenceTimelineBrowser
      apiPath={`/api/teacher/classes/${params.classId}/students/${params.studentId}/evidence`}
      backHref={backHref}
      contextBadges={contextParts}
      emptyBackLabel="返回学生详情"
      title="学生证据"
      subtitle={contextParts.length > 0
        ? `保留教师上下文：${contextParts.join(' · ')}`
        : '按时间查看该学生的学习事实和作答摘要'}
    />
  );
}

function mergeTeacherEvidenceContext(
  href: string,
  context: { gradingRunId?: string; reportId?: string; source?: string },
) {
  const url = new URL(href, 'http://local.teacher');
  if (context.gradingRunId && !url.searchParams.has('gradingRunId')) {
    url.searchParams.set('gradingRunId', context.gradingRunId);
  }
  if (context.reportId && !url.searchParams.has('reportId')) {
    url.searchParams.set('reportId', context.reportId);
  }
  if (context.source && !url.searchParams.has('source')) {
    url.searchParams.set('source', context.source);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
