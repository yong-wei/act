import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { DiagnosisReportApiItem } from '@/app/api/teacher/classes/[classId]/diagnosis-reports/route';
import { TeacherDiagnosisReportHistoryView } from '@/features/teacher/teacher-diagnosis-report-history';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

const report: DiagnosisReportApiItem = {
  id: 'report-1',
  scopeType: 'class',
  scopeId: 'class-1',
  classId: 'class-1',
  targetUserId: null,
  reportBody: {
    summary: '班级在稳定裕度判断上需要补强。',
    findings: [{
      title: '稳定裕度判断',
      summary: '多数证据集中在单一知识节点。',
      knowledgeNodeId: 'node-1',
      riskType: 'constraint',
      severity: 'medium',
      evidenceRefs: ['knowledge-progress:private-row-2'],
      confidence: 'medium',
      prepLink: '/teacher/preparation?knowledgeNodeId=node-1&classId=class-1',
    }],
    evidenceRefs: ['knowledge-progress:private-row-1'],
    evidenceCutoff: '2026-07-30T08:00:00.000Z',
    sourceCoverage: { classMembers: 30, includedStudents: 24, coverage: 0.8 },
    confidence: 'medium',
    limitations: [],
  },
  riskSummary: {
    total: 1,
    byType: { stagnation: 0, constraint: 1, cross_domain: 0 },
    bySeverity: { low: 0, medium: 1, high: 0 },
  },
  evidenceCutoff: '2026-07-30T08:00:00.000Z',
  generatorVersion: 'teacher-diagnosis.v1',
  generatedAt: '2026-07-30T08:05:00.000Z',
};

describe('TeacherDiagnosisReportHistoryView', () => {
  it('renders the governed report surface without exposing evidence identifiers', () => {
    const html = renderToStaticMarkup(
      <TeacherDiagnosisReportHistoryView
        state="ready"
        reports={[report]}
        selectedReportId={report.id}
        subjectLabel="控制 1 班 · 班级范围"
      />,
    );

    expect(html).toContain('班级在稳定裕度判断上需要补强。');
    expect(html).toContain('稳定裕度判断');
    expect(html).toContain('80%');
    expect(html).toContain('2 条');
    expect(html).toContain('1 条受治理证据');
    expect(html).toContain('/teacher/preparation?knowledgeNodeId=node-1&amp;classId=class-1');
    expect(html).not.toContain('private-row-1');
    expect(html).not.toContain('private-row-2');
  });

  it('marks low-confidence reports with limitations as degraded', () => {
    const degradedReport: DiagnosisReportApiItem = {
      ...report,
      id: 'report-degraded',
      reportBody: {
        ...report.reportBody,
        confidence: 'low',
        limitations: ['当前只有部分学生形成了可用证据。'],
      },
    };
    const html = renderToStaticMarkup(
      <TeacherDiagnosisReportHistoryView
        state="ready"
        reports={[degradedReport]}
        subjectLabel="控制 1 班 · 班级范围"
      />,
    );

    expect(html).toContain('data-report-degraded="true"');
    expect(html).toContain('受限快照');
    expect(html).toContain('当前只有部分学生形成了可用证据。');
  });

  it('distinguishes an empty history from an unavailable history', () => {
    const emptyHtml = renderToStaticMarkup(
      <TeacherDiagnosisReportHistoryView
        state="ready"
        reports={[]}
        subjectLabel="控制 1 班 · 班级范围"
      />,
    );
    const errorHtml = renderToStaticMarkup(
      <TeacherDiagnosisReportHistoryView
        state="error"
        reports={[]}
        subjectLabel="控制 1 班 · 班级范围"
        errorMessage="读取超时"
      />,
    );

    expect(emptyHtml).toContain('尚无持久化诊断报告');
    expect(emptyHtml).toContain('不代表班级或学生没有学习风险');
    expect(errorHtml).toContain('报告历史暂时不可用');
    expect(errorHtml).toContain('读取超时');
  });

  it('renders active and retryable diagnosis generation states', () => {
    const runningHtml = renderToStaticMarkup(
      <TeacherDiagnosisReportHistoryView
        state="ready"
        reports={[]}
        subjectLabel="控制 1 班 · 班级范围"
        generationJob={{
          id: 'job-1',
          classId: 'class-1',
          targetStudentId: null,
          scopeType: 'class',
          scopeId: 'class-1',
          state: 'RUNNING',
          evidenceCutoff: '2026-08-08T08:00:00.000Z',
          generatorVersion: 'teacher-diagnosis.v1',
          failureCode: null,
          failureMessage: null,
          retryable: false,
          reportId: null,
          createdAt: '2026-08-08T08:00:00.000Z',
          startedAt: '2026-08-08T08:00:01.000Z',
          completedAt: null,
        }}
      />,
    );
    const failedHtml = renderToStaticMarkup(
      <TeacherDiagnosisReportHistoryView
        state="ready"
        reports={[]}
        subjectLabel="控制 1 班 · 班级范围"
        generationJob={{
          id: 'job-1',
          classId: 'class-1',
          targetStudentId: null,
          scopeType: 'class',
          scopeId: 'class-1',
          state: 'TIMED_OUT',
          evidenceCutoff: '2026-08-08T08:00:00.000Z',
          generatorVersion: 'teacher-diagnosis.v1',
          failureCode: 'diagnosis-generation-timeout',
          failureMessage: '模型响应超时',
          retryable: true,
          reportId: null,
          createdAt: '2026-08-08T08:00:00.000Z',
          startedAt: '2026-08-08T08:00:01.000Z',
          completedAt: '2026-08-08T08:02:01.000Z',
        }}
      />,
    );

    expect(runningHtml).toContain('data-diagnosis-generation-state="RUNNING"');
    expect(runningHtml).toContain('正在依据固定证据快照生成诊断');
    expect(failedHtml).toContain('data-diagnosis-generation-state="TIMED_OUT"');
    expect(failedHtml).toContain('重试原任务');
    expect(failedHtml).toContain('模型响应超时');
  });
});
