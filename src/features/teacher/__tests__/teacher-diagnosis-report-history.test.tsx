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
        classId="class-1"
      />,
    );

    expect(html).toContain('班级在稳定裕度判断上需要补强。');
    expect(html).toContain('稳定裕度判断');
    expect(html).toContain('班级范围');
    expect(html).toContain('纳入 24/30 人');
    expect(html).toContain('作业');
    expect(html).toContain('测验');
    expect(html).toContain('学习行为');
    expect(html).toContain('当前报告尚未纳入作业证据。');
    expect(html).toContain('尚无历史比较基线。');
    expect(html).toContain('2 条');
    expect(html).toContain('1 条受治理证据');
    expect(html).not.toContain('打开对应备课位置');
    expect(html).not.toContain('/teacher/preparation?knowledgeNodeId=node-1&amp;classId=class-1');
    expect(html).toContain('data-diagnosis-delivery-primary="true"');
    expect(html).toContain('bg-primary');
    expect(html).toContain('/teacher/classes/class-1/diagnosis-reports/report-1');
    expect(html).toContain('打开教师交付版');
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
    expect(html).toContain('证据受限');
    expect(html).toContain('当前只有部分学生形成了可用证据。');
    expect(html).toContain('报告状态：证据受限');
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

  it('renders deterministic preflight states and keeps completed feedback collapsed', () => {
    const preflightHtml = renderToStaticMarkup(
      <TeacherDiagnosisReportHistoryView
        state="ready"
        reports={[report]}
        subjectLabel="控制 1 班 · 班级范围"
        generationPreflight={{
          status: 'NO_EFFECTIVE_CHANGE',
          canGenerate: false,
          canForce: true,
          evidenceCutoff: '2026-08-19T03:00:00.000Z',
          generatorVersion: 'teacher-diagnosis.v1',
          ruleVersion: 'teacher-diagnosis-preflight.v1',
          previousReport: {
            id: 'report-1',
            evidenceCutoff: '2026-07-30T08:00:00.000Z',
            generatedAt: '2026-07-30T08:05:00.000Z',
          },
          activeJob: null,
          categories: {
            assignment: { availability: 'unavailable', currentCount: null, changedCount: null },
            assessment: { availability: 'unavailable', currentCount: null, changedCount: null },
            learningBehavior: { availability: 'available', currentCount: 4, changedCount: 0 },
            risk: { availability: 'available', currentCount: 1, changedCount: 0 },
            eligibility: { availability: 'available', currentCount: 30, changedCount: 0 },
          },
        }}
      />,
    );
    const completedHtml = renderToStaticMarkup(
      <TeacherDiagnosisReportHistoryView
        state="ready"
        reports={[report]}
        subjectLabel="控制 1 班 · 班级范围"
        generationJob={{
          id: 'job-completed',
          classId: 'class-1',
          targetStudentId: null,
          scopeType: 'class',
          scopeId: 'class-1',
          state: 'COMPLETED',
          evidenceCutoff: '2026-08-19T03:00:00.000Z',
          generatorVersion: 'teacher-diagnosis.v1',
          generationReason: 'new-evidence',
          failureCode: null,
          failureMessage: null,
          retryable: false,
          reportId: 'report-2',
          createdAt: '2026-08-19T03:00:00.000Z',
          startedAt: '2026-08-19T03:00:01.000Z',
          completedAt: '2026-08-19T03:00:10.000Z',
        }}
      />,
    );

    expect(preflightHtml).toContain('data-diagnosis-preflight-status="NO_EFFECTIVE_CHANGE"');
    expect(preflightHtml).toContain('没有有效变化');
    expect(preflightHtml).toContain('强制生成理由');
    expect(preflightHtml).toContain('作业');
    expect(preflightHtml).toContain('未接入');
    expect(completedHtml).toContain('<details');
    expect(completedHtml).not.toContain('<details open=""');
    expect(completedHtml).toContain('诊断生成完成，报告历史已更新');
  });

  it('renders only a compatible adjacent-report comparison and keeps generated prose out of the comparison key', () => {
    const olderReport: DiagnosisReportApiItem = {
      ...report,
      id: 'report-older',
      generatedAt: '2026-07-24T08:05:00.000Z',
      reportBody: {
        ...report.reportBody,
        summary: '旧摘要使用了不同措辞。',
        findings: [{
          ...report.reportBody.findings[0],
          title: '旧标题',
          severity: 'high',
        }],
      },
    };
    const html = renderToStaticMarkup(
      <TeacherDiagnosisReportHistoryView
        state="ready"
        reports={[report, olderReport]}
        selectedReportId={report.id}
        subjectLabel="控制 1 班 · 班级范围"
      />,
    );

    expect(html).toContain('相邻报告变化');
    expect(html).toContain('摘要文字变化不会被视为学情变化。');
    expect(html).toContain('改善／风险降级');
    expect(html).toContain('风险降级');
  });

  it('marks missing severity as a comparison limit instead of a risk downgrade', () => {
    const currentReport: DiagnosisReportApiItem = {
      ...report,
      id: 'report-current-missing-severity',
      reportBody: {
        ...report.reportBody,
        findings: [{ ...report.reportBody.findings[0], severity: undefined }],
      },
    };
    const olderReport: DiagnosisReportApiItem = {
      ...report,
      id: 'report-older-high-severity',
      generatedAt: '2026-07-24T08:05:00.000Z',
      reportBody: {
        ...report.reportBody,
        findings: [{ ...report.reportBody.findings[0], severity: 'high' }],
      },
    };

    const html = renderToStaticMarkup(
      <TeacherDiagnosisReportHistoryView
        state="ready"
        reports={[currentReport, olderReport]}
        selectedReportId={currentReport.id}
        subjectLabel="控制 1 班 · 班级范围"
      />,
    );

    expect(html).toContain('缺少风险等级，未计算风险升级、降级或改善。');
  });
});
