import { describe, expect, it } from 'vitest';

import {
  DiagnosisDeliveryProjectionError,
  diagnosisArtifactIdentity,
  diagnosisProjectionContentHash,
  projectStudentSafeDiagnosisReport,
  projectTeacherDiagnosisReport,
} from '@/lib/diagnosis-report-delivery-projection';

const report = {
  id: 'report-1',
  scopeType: 'student',
  scopeId: 'student-1',
  classId: 'class-1',
  targetUserId: 'student-1',
  reportBody: {
    summary: '当前需要加强稳定裕度判断。',
    findings: [{
      title: '稳定裕度判断薄弱',
      summary: '建议复核相位裕度定义。',
      knowledgeNodeId: 'node-margin',
      riskType: 'constraint',
      severity: 'medium',
      confidence: 'medium',
      evidenceRefs: ['student-risk-flag:risk-secret', 'knowledge-progress:progress-secret'],
    }],
    evidenceRefs: ['student-risk-flag:risk-secret'],
    evidenceCutoff: '2026-08-19T08:00:00.000Z',
    sourceCoverage: { classMembers: 1, includedStudents: 1, progressRows: 1, coverage: 1 },
    confidence: 'medium',
    limitations: ['尚未接入作业和测验证据。'],
  },
  riskSummary: {
    total: 1,
    byType: { stagnation: 0, constraint: 1, cross_domain: 0 },
    bySeverity: { low: 0, medium: 1, high: 0 },
  },
  evidenceCutoff: new Date('2026-08-19T08:00:00.000Z'),
  generatorVersion: 'teacher-diagnosis.v1',
  ruleVersion: 'teacher-diagnosis-preflight.v1',
  generationReason: 'teacher-forced',
  forceReason: '教师内部复盘原因',
  generatedAt: new Date('2026-08-19T08:05:00.000Z'),
};

describe('diagnosis report delivery projection', () => {
  it('projects safe evidence counts without opaque evidence references', () => {
    const projection = projectTeacherDiagnosisReport(report);
    expect(projection.findings[0].evidence).toEqual({
      state: 'available',
      total: 2,
      sources: [
        { kind: 'risk', label: '受治理风险证据', count: 1 },
        { kind: 'progress', label: '知识点学习进度', count: 1 },
      ],
    });
    expect(JSON.stringify(projection)).not.toContain('risk-secret');
    expect(JSON.stringify(projection)).not.toContain('progress-secret');
  });

  it('removes teacher-only and peer fields from the student-safe projection', () => {
    const projection = projectStudentSafeDiagnosisReport(report);
    const serialized = JSON.stringify(projection);
    expect(projection.role).toBe('student');
    expect(projection.audienceUserId).toBe('student-1');
    expect(projection.findings[0].hasPreparationEntry).toBe(false);
    expect(projection.suggestions).toEqual([{
      targetKey: 'finding:1',
      source: 'finding',
      text: '建议围绕“稳定裕度判断薄弱”复核关联知识点，并完成一次针对性练习后查看新的诊断。',
    }]);
    expect(serialized).not.toContain('教师内部复盘原因');
    expect(serialized).not.toContain('riskSummary');
    expect(serialized).not.toContain('generationReason');
    expect(serialized).not.toContain('evidenceRefs');
    expect(serialized).not.toContain('risk-secret');
  });

  it('derives a deterministic report-level suggestion when no structured finding exists', () => {
    const projection = projectStudentSafeDiagnosisReport({
      ...report,
      reportBody: { ...report.reportBody, findings: [] },
    });
    expect(projection.suggestions).toEqual([{
      targetKey: 'report',
      source: 'summary',
      text: '建议根据当前诊断摘要复核已学内容，并在补充可核验证据后查看新的诊断。',
    }]);
  });

  it('fails closed when a class report requests a student projection', () => {
    expect(() => projectStudentSafeDiagnosisReport({
      ...report,
      scopeType: 'class',
      scopeId: 'class-1',
      targetUserId: null,
    })).toThrowError(DiagnosisDeliveryProjectionError);
  });

  it('keeps content and artifact identities deterministic', () => {
    const first = projectTeacherDiagnosisReport(report);
    const second = projectTeacherDiagnosisReport({ ...report });
    expect(diagnosisProjectionContentHash(first)).toBe(diagnosisProjectionContentHash(second));
    expect(diagnosisArtifactIdentity(first)).toBe(diagnosisArtifactIdentity(second));
  });
});
