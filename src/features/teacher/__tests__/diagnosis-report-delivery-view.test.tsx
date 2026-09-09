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
  suggestions: [{
    targetKey: 'finding:1',
    source: 'finding',
    text: '建议围绕“稳定裕度判断薄弱”复核关联知识点，并完成一次针对性练习后查看新的诊断。',
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
  it('keeps teacher delivery print-only while preserving safe evidence and auditable actions', () => {
    const html = renderToStaticMarkup(
      <DiagnosisReportDeliveryView
        projection={projection}
        actions={[
          { kind: 'preparation', label: '进入备课工作台', href: '/teacher/smart-prep', targetKey: 'report' },
          { kind: 'preparation', label: '进入备课工作台', href: '/teacher/preparation', targetKey: 'finding:1' },
        ]}
        dispositionEvents={[]}
        dispositionHref="/api/dispositions"
        returnHref="/teacher/classes/class-1"
        teacherMode
      />,
    );
    expect(html).toContain('data-diagnosis-delivery-role="teacher"');
    expect(html).toContain('查看允许的证据摘要');
    expect(html).toContain('打印');
    expect(html).not.toContain('导出 PDF');
    expect(html).not.toContain('标记已安排干预');
    expect(html).not.toContain('暂无已注册补练资源');
    expect(html).toContain('btn-disposition-pending');
    expect(html).toContain('btn-disposition-success');
    expect(html).toContain('btn-disposition-neutral');
    expect(html).toContain('学习建议');
    expect(html).toContain('完成一次针对性练习');
    expect(html).toContain('处置不会清除风险');
    expect(html).toContain('href="/teacher/smart-prep"');
    expect(html).toContain('报告版本：report-1');
  });

  it('presents the governed-report eyebrow in Simplified Chinese', () => {
    const html = renderToStaticMarkup(
      <DiagnosisReportDeliveryView
        projection={projection}
        actions={[]}
        dispositionEvents={[]}
        returnHref="/teacher/classes/class-1"
        teacherMode
      />,
    );
    expect(html).toContain('固定治理报告');
    expect(html).not.toContain('Fixed governed report');
  });

  it('keeps the student surface print-only and free of teacher disposition controls', () => {
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
        returnHref="/dashboard"
        teacherMode={false}
      />,
    );
    expect(html).toContain('data-diagnosis-delivery-role="student"');
    expect(html).toContain('打印');
    expect(html).not.toContain('导出 PDF');
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
        dispositionHref="/api/dispositions"
        returnHref="/teacher/classes/class-1"
        teacherMode
      />,
    );
    expect(html).toContain('当前处置：待处理。处置不会清除风险。');
  });
});
