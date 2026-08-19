import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DiagnosisReportDeliveryView } from '@/features/teacher/diagnosis-report-delivery-view';
import type { TeacherDiagnosisDeliveryProjection } from '@/lib/diagnosis-report-delivery-projection';

const projection: TeacherDiagnosisDeliveryProjection = {
  reportId: 'report-1',
  projectionVersion: 'diagnosis-delivery.v1',
  roleVersion: 'teacher-report.v1',
  audienceUserId: null,
  role: 'teacher',
  scopeType: 'student',
  classId: 'class-1',
  targetUserId: 'student-1',
  title: '学生学情诊断报告（教师版）',
  summary: '稳定性分析需要加强。',
  findings: [{
    targetKey: 'finding:1',
    title: '稳定裕度判断薄弱',
    evidence: {
      state: 'available',
      total: 1,
      sources: [{ kind: 'progress', label: '知识点学习进度', count: 1 }],
    },
    hasPreparationEntry: true,
  }],
  confidence: 'medium',
  limitations: ['作业证据未接入。'],
  evidenceCutoff: '2026-08-19T08:00:00.000Z',
  generatedAt: '2026-08-19T08:05:00.000Z',
  generatorVersion: 'teacher-diagnosis.v1',
  ruleVersion: 'teacher-diagnosis-preflight.v1',
  privacyNotice: '教师内部受控材料。',
  riskSummary: {
    total: 1,
    byType: { stagnation: 0, constraint: 1, cross_domain: 0 },
    bySeverity: { low: 0, medium: 1, high: 0 },
  },
  generationReason: 'new-evidence',
  forceReason: null,
};

describe('DiagnosisReportDeliveryView', () => {
  it('renders fixed delivery, print/PDF, safe evidence and auditable actions', () => {
    const html = renderToStaticMarkup(
      <DiagnosisReportDeliveryView
        projection={projection}
        actions={[
          { kind: 'preparation', label: '进入备课工作台', href: '/teacher/preparation', targetKey: 'finding:1' },
          { kind: 'remediation', label: '已注册补练资源', href: '/teacher/resources/resource-nodes?q=margin', targetKey: 'finding:1' },
        ]}
        dispositionEvents={[]}
        pdfHref="/api/pdf"
        dispositionHref="/api/dispositions"
        returnHref="/teacher/classes/class-1"
        teacherMode
      />,
    );
    expect(html).toContain('data-diagnosis-delivery-role="teacher"');
    expect(html).toContain('查看允许的证据摘要');
    expect(html).toContain('导出 PDF');
    expect(html).toContain('标记已安排干预');
    expect(html).toContain('处置不会清除风险');
    expect(html).toContain('报告版本：report-1');
  });

  it('keeps the student surface free of teacher disposition controls', () => {
    const html = renderToStaticMarkup(
      <DiagnosisReportDeliveryView
        projection={{
          ...projection,
          role: 'student',
          roleVersion: 'student-safe-report.v1',
          audienceUserId: 'student-1',
          title: '个人学情诊断报告',
          privacyNotice: '只包含个人安全摘要。',
        } as never}
        actions={[]}
        dispositionEvents={[]}
        pdfHref="/api/student-pdf"
        returnHref="/dashboard"
        teacherMode={false}
      />,
    );
    expect(html).toContain('data-diagnosis-delivery-role="student"');
    expect(html).not.toContain('报告处置');
    expect(html).not.toContain('标记已安排干预');
  });

  it('projects the newest append-only disposition as current', () => {
    const html = renderToStaticMarkup(
      <DiagnosisReportDeliveryView
        projection={projection}
        actions={[]}
        dispositionEvents={[
          { id: 'new', targetKind: 'finding', targetKey: 'finding:1', action: 'pending', actionRef: null, result: 'recorded', createdAt: '2026-08-19T10:00:00.000Z' },
          { id: 'old', targetKind: 'finding', targetKey: 'finding:1', action: 'completed', actionRef: null, result: 'recorded', createdAt: '2026-08-19T09:00:00.000Z' },
        ]}
        pdfHref="/api/pdf"
        dispositionHref="/api/dispositions"
        returnHref="/teacher/classes/class-1"
        teacherMode
      />,
    );
    expect(html).toContain('当前处置：待处理。处置不会清除风险。');
  });
});
