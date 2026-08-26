import { describe, expect, it } from 'vitest';

import { readTeacherDiagnosisReportHistory } from '@/features/teacher/diagnosis/application/read-report-history';
import type { TeacherDiagnosisReportRecord } from '@/features/teacher/diagnosis/ports/report-reader';

const record: TeacherDiagnosisReportRecord = {
  id: 'report-1',
  scopeType: 'class',
  scopeId: 'class-1',
  classId: 'class-1',
  targetUserId: null,
  reportBody: {
    summary: 'ok',
    findings: [],
    evidenceRefs: ['knowledge-progress:node-1'],
    evidenceCutoff: '2026-01-01T00:00:00.000Z',
    sourceCoverage: { includedStudents: 1 },
    confidence: 'high',
    limitations: [],
  },
  riskSummary: {
    total: 0,
    byType: { stagnation: 0, constraint: 0, cross_domain: 0 },
    bySeverity: { low: 0, medium: 0, high: 0 },
  },
  evidenceCutoff: new Date('2026-01-01T00:00:00.000Z'),
  generatorVersion: 'teacher-diagnosis.v1',
  ruleVersion: 'r1',
  generationReason: 'scheduled',
  forceReason: null,
  previousReportId: null,
  generatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('readTeacherDiagnosisReportHistory', () => {
  it('serializes dates and omits inputSummary', async () => {
    const payload = await readTeacherDiagnosisReportHistory({
      reader: { read: async () => [record] },
      teacherId: 'teacher-1',
      classId: 'class-1',
    });
    expect(payload.reports).toHaveLength(1);
    expect(payload.reports[0].evidenceCutoff).toBe('2026-01-01T00:00:00.000Z');
    expect(payload.reports[0].generatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(JSON.stringify(payload)).not.toContain('inputSummary');
  });
});
