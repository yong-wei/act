import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  diagnosisReportFindFirst: vi.fn(),
  studentProfileFindFirst: vi.fn(),
  dispositionFindMany: vi.fn(),
  dispositionUpsert: vi.fn(),
  artifactUpsert: vi.fn(),
  exportCreate: vi.fn(),
  teachingResourceFindMany: vi.fn(),
  renderPdf: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    diagnosisReport: { findFirst: mocks.diagnosisReportFindFirst },
    studentProfile: { findFirst: mocks.studentProfileFindFirst },
    diagnosisReportDispositionEvent: {
      findMany: mocks.dispositionFindMany,
      upsert: mocks.dispositionUpsert,
    },
    diagnosisReportExportArtifact: { upsert: mocks.artifactUpsert },
    diagnosisReportExportEvent: { create: mocks.exportCreate },
    teachingResource: { findMany: mocks.teachingResourceFindMany },
  },
}));

vi.mock('@/lib/resource-registry-metadata', () => ({
  getAllRegisteredResourceMetadata: () => [{ id: 'registered-remediation' }],
}));

vi.mock('@/lib/diagnosis-report-pdf', () => ({
  renderDiagnosisReportPdf: mocks.renderPdf,
}));

import {
  exportTeacherDiagnosisPdf,
  readStudentDiagnosisDelivery,
  readTeacherDiagnosisDelivery,
  recordDiagnosisDisposition,
} from '@/lib/diagnosis-report-delivery';

const report = {
  id: 'report-1',
  scopeType: 'student',
  scopeId: 'student-1',
  classId: 'class-1',
  targetUserId: 'student-1',
  reportBody: {
    summary: '需要加强稳定性分析。',
    findings: [{
      title: '稳定裕度判断薄弱',
      knowledgeNodeId: 'node-margin',
      evidenceRefs: ['knowledge-progress:row-1'],
    }],
    evidenceRefs: ['knowledge-progress:row-1'],
    evidenceCutoff: '2026-08-19T08:00:00.000Z',
    sourceCoverage: { includedStudents: 1 },
    confidence: 'medium',
    limitations: [],
  },
  riskSummary: null,
  evidenceCutoff: new Date('2026-08-19T08:00:00.000Z'),
  generatorVersion: 'teacher-diagnosis.v1',
  ruleVersion: 'teacher-diagnosis-preflight.v1',
  generationReason: 'new-evidence',
  forceReason: null,
  generatedAt: new Date('2026-08-19T08:05:00.000Z'),
};

describe('diagnosis report delivery service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.diagnosisReportFindFirst.mockResolvedValue(report);
    mocks.studentProfileFindFirst.mockResolvedValue({ id: 'profile-1' });
    mocks.dispositionFindMany.mockResolvedValue([]);
    mocks.teachingResourceFindMany.mockResolvedValue([{
      title: '稳定裕度补练',
      registryId: 'registered-remediation',
      knowledgeNodes: [{ id: 'node-margin' }],
    }]);
    mocks.dispositionUpsert.mockResolvedValue({
      id: 'event-1',
      targetKind: 'finding',
      targetKey: 'finding:1',
      action: 'completed',
      actionRef: null,
      result: 'recorded',
      createdAt: new Date('2026-08-19T09:00:00.000Z'),
    });
    mocks.renderPdf.mockResolvedValue({
      bytes: Uint8Array.from([37, 80, 68, 70, 45]),
      artifactHash: 'artifact-hash',
      contentHash: 'content-hash',
      pageCount: 1,
    });
    mocks.artifactUpsert.mockResolvedValue({
      id: 'artifact-1',
      contentHash: 'content-hash',
      artifactHash: 'artifact-hash',
      artifactBytes: Uint8Array.from([37, 80, 68, 70, 45]),
      roleVersion: 'teacher-report.v1',
    });
    mocks.exportCreate.mockResolvedValue({ id: 'export-1' });
  });

  it('authorizes student reads only through the server-owned target identity', async () => {
    await readStudentDiagnosisDelivery({ studentId: 'student-1', reportId: 'report-1' });
    expect(mocks.diagnosisReportFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'report-1',
        scopeType: 'student',
        scopeId: 'student-1',
        targetUserId: 'student-1',
      },
    }));
  });

  it('returns only registered remediation destinations and existing student/preparation routes', async () => {
    const delivery = await readTeacherDiagnosisDelivery({
      teacherId: 'teacher-1', classId: 'class-1', reportId: 'report-1', role: 'teacher',
    });
    expect(delivery.actions.map((action) => action.kind)).toEqual(['student', 'preparation', 'remediation']);
    expect(delivery.actions.find((action) => action.kind === 'preparation')?.href).toBe('/teacher/smart-prep');
    expect(delivery.actions.find((action) => action.kind === 'remediation')?.href).toContain('/teacher/resources/resource-nodes?q=');
  });

  it('keeps teacher-only actions and dispositions out of the student-safe preview payload', async () => {
    const delivery = await readTeacherDiagnosisDelivery({
      teacherId: 'teacher-1', classId: 'class-1', reportId: 'report-1', role: 'student',
    });
    expect(delivery.actions).toEqual([]);
    expect(delivery.dispositionEvents).toEqual([]);
    expect(mocks.teachingResourceFindMany).not.toHaveBeenCalled();
    expect(mocks.dispositionFindMany).not.toHaveBeenCalled();
  });

  it('appends an idempotent disposition without mutating diagnosis or risk truth', async () => {
    await recordDiagnosisDisposition({
      teacherId: 'teacher-1',
      classId: 'class-1',
      reportId: 'report-1',
      disposition: {
        targetKind: 'finding',
        targetKey: 'finding:1',
        action: 'completed',
        actionRef: null,
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      },
    });
    expect(mocks.dispositionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {},
      create: expect.objectContaining({ action: 'completed', targetKey: 'finding:1' }),
    }));
  });

  it('rejects invented intervention references', async () => {
    await expect(recordDiagnosisDisposition({
      teacherId: 'teacher-1',
      classId: 'class-1',
      reportId: 'report-1',
      disposition: {
        targetKind: 'finding',
        targetKey: 'finding:1',
        action: 'intervention-arranged',
        actionRef: '/invented-intervention',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
      },
    })).rejects.toMatchObject({
      code: 'diagnosis-disposition-action-ref-forbidden',
    });
    expect(mocks.dispositionUpsert).not.toHaveBeenCalled();
  });

  it('fails closed when an idempotency key is replayed with different semantics', async () => {
    mocks.dispositionUpsert.mockResolvedValueOnce({
      id: 'event-existing', targetKind: 'finding', targetKey: 'finding:1', action: 'pending',
      actionRef: null, result: 'recorded', idempotencyKey: '33333333-3333-4333-8333-333333333333',
      createdAt: new Date('2026-08-19T09:00:00.000Z'),
    });
    await expect(recordDiagnosisDisposition({
      teacherId: 'teacher-1', classId: 'class-1', reportId: 'report-1',
      disposition: {
        targetKind: 'finding', targetKey: 'finding:1', action: 'completed', actionRef: null,
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
      },
    })).rejects.toMatchObject({ code: 'diagnosis-disposition-idempotency-conflict' });
  });

  it('reuses the stable artifact identity and records each successful export', async () => {
    await exportTeacherDiagnosisPdf({
      teacherId: 'teacher-1', classId: 'class-1', reportId: 'report-1', role: 'teacher',
    });
    await exportTeacherDiagnosisPdf({
      teacherId: 'teacher-1', classId: 'class-1', reportId: 'report-1', role: 'teacher',
    });
    expect(mocks.artifactUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.artifactUpsert).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { reportId_projectionVersion_roleVersion_audienceUserId: expect.objectContaining({ reportId: 'report-1', audienceUserId: '' }) },
      update: {},
    }));
    expect(mocks.exportCreate).toHaveBeenCalledTimes(2);
  });
});
