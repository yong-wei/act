import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { projectStudentSafeDiagnosisReport } from '@/lib/diagnosis-report-delivery-projection';
import { renderDiagnosisReportPdf } from '@/lib/diagnosis-report-pdf';

describe('diagnosis report PDF', () => {
  it('renders deterministic Chinese-capable A4 bytes with a version footer', async () => {
    const projection = projectStudentSafeDiagnosisReport({
      id: 'report-pdf-1',
      scopeType: 'student',
      scopeId: 'student-1',
      classId: 'class-1',
      targetUserId: 'student-1',
      reportBody: {
        summary: '稳定性分析需要继续练习。',
        findings: [{
          title: '稳定裕度判断薄弱',
          summary: '复核相位裕度与增益裕度。',
          severity: 'medium',
          evidenceRefs: ['knowledge-progress:row-1'],
        }],
        evidenceRefs: ['knowledge-progress:row-1'],
        evidenceCutoff: '2026-08-19T08:00:00.000Z',
        sourceCoverage: { includedStudents: 1 },
        confidence: 'medium',
        limitations: ['作业证据未接入。'],
      },
      riskSummary: null,
      evidenceCutoff: new Date('2026-08-19T08:00:00.000Z'),
      generatorVersion: 'teacher-diagnosis.v1',
      ruleVersion: 'teacher-diagnosis-preflight.v1',
      generationReason: 'new-evidence',
      forceReason: null,
      generatedAt: new Date('2026-08-19T08:05:00.000Z'),
    });

    const first = await renderDiagnosisReportPdf(projection);
    const second = await renderDiagnosisReportPdf(projection);
    const document = await PDFDocument.load(first.bytes, { updateMetadata: false });

    expect(first.bytes.slice(0, 5)).toEqual(Uint8Array.from([37, 80, 68, 70, 45]));
    expect(first.pageCount).toBeGreaterThan(0);
    expect(document.getPageCount()).toBe(first.pageCount);
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.artifactHash).toBe(second.artifactHash);
    expect(first.bytes).toEqual(second.bytes);
  }, 30_000);
});
