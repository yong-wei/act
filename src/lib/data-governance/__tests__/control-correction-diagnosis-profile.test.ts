import { describe, expect, it } from 'vitest';

import {
  CONTROL_CORRECTION_DIAGNOSIS_DIMENSIONS,
  CONTROL_CORRECTION_DIAGNOSIS_INDICATORS,
  CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION,
  createInMemoryDiagnosisReportSnapshotStore,
  createPrismaDiagnosisReportSnapshotStore,
  materializeControlCorrectionDiagnosisReport,
  readLatestControlCorrectionDiagnosisReportSnapshot,
  readLatestControlCorrectionDiagnosisReportSnapshotFromPersistence,
  validateControlCorrectionDiagnosisProfile,
  validateDiagnosisIndicatorDefinition,
} from '../control-correction-diagnosis-profile';

const now = new Date('2026-06-05T00:00:00.000Z');

describe('control-correction diagnosis profile', () => {
  it('registers nine governed dimensions with at least three query-backed indicators each', () => {
    expect(CONTROL_CORRECTION_DIAGNOSIS_DIMENSIONS.map((dimension) => dimension.id)).toEqual([
      'time-domain-analysis',
      'root-locus-reasoning',
      'frequency-domain-margin-analysis',
      'method-selection',
      'constraint-tradeoff',
      'simulation-validation',
      'arena-transfer',
      'reflection',
      'ai-collaboration',
    ]);
    for (const dimension of CONTROL_CORRECTION_DIAGNOSIS_DIMENSIONS) {
      expect(CONTROL_CORRECTION_DIAGNOSIS_INDICATORS.filter((indicator) => indicator.dimensionId === dimension.id).length).toBeGreaterThanOrEqual(3);
    }
    expect(validateControlCorrectionDiagnosisProfile()).toEqual([]);
  });

  it('rejects indicator definitions without query specs or evidence thresholds', () => {
    const [valid] = CONTROL_CORRECTION_DIAGNOSIS_INDICATORS;
    expect(validateDiagnosisIndicatorDefinition({
      ...valid,
      querySpec: { ...valid.querySpec, selectors: [] },
      confidencePolicy: { ...valid.confidencePolicy, minimumEvidenceCount: 0 },
    })).toEqual(expect.arrayContaining([
      'indicator-missing-query-spec',
      'indicator-missing-evidence-threshold',
    ]));
  });

  it('materializes indicator and report snapshots from governed multi-source evidence', () => {
    const report = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [
        {
          id: 'fact-rise-time',
          sourceFamily: 'adaptive-assessment',
          indicatorIds: ['time-response-settling-control'],
          value: 0.84,
          confidence: 'high',
          updatedAt: now.toISOString(),
          provenance: { classId: 'class-1', userId: 'student-1', goalId: 'control-correction', materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION },
          evidenceRef: { chunkId: 'chunk-rise-time', sourceType: 'path-summary', title: '时域响应作答证据' },
        },
        {
          id: 'sim-overshoot',
          sourceFamily: 'simulation-summary',
          indicatorIds: ['simulation-terminal-validation'],
          value: 0.42,
          confidence: 'low',
          updatedAt: '2026-04-01T00:00:00.000Z',
          provenance: { classId: 'class-1', userId: 'student-1', goalId: 'control-correction', materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION },
          evidenceRef: { chunkId: 'chunk-sim', sourceType: 'simulation-summary', title: '终端仿真摘要' },
        },
      ],
      now,
    });

    expect(report.materializerVersion).toBe(CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION);
    expect(report.indicators.find((item) => item.indicatorId === 'time-response-settling-control')).toEqual(expect.objectContaining({
      score: 0.84,
      confidence: expect.objectContaining({ state: 'medium' }),
      evidenceCount: 1,
    }));
    expect(report.indicators.find((item) => item.indicatorId === 'simulation-terminal-validation')?.limitations.map((item) => item.reason)).toEqual(expect.arrayContaining([
      'stale-source',
      'low-confidence-source',
    ]));
    expect(report.dimensions.find((item) => item.dimensionId === 'time-domain-analysis')).toEqual(expect.objectContaining({
      judgment: expect.stringMatching(/stable|developing|needs-attention/),
    }));
    expect(report.limitations.map((item) => item.reason)).toContain('missing-source');
  });

  it('calculates cohort percentiles and keeps growth percentile cold-start explicit', () => {
    const report = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [{
        id: 'arena-transfer',
        sourceFamily: 'arena-summary',
        indicatorIds: ['arena-official-transfer'],
        value: 0.75,
        confidence: 'high',
        updatedAt: now.toISOString(),
        provenance: { sourceModel: 'ArenaSubmission', official: true, classId: 'class-1', userId: 'student-1', goalId: 'control-correction', materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION },
        evidenceRef: { chunkId: 'chunk-arena', sourceType: 'arena-summary', title: '竞技场正式榜单' },
      }],
      cohortIndicatorScores: [
        { subjectId: 'student-1', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: now.toISOString(), score: 0.75 },
        { subjectId: 'student-2', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: now.toISOString(), score: 0.3 },
        { subjectId: 'student-3', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: now.toISOString(), score: 0.6 },
        { subjectId: 'student-4', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: now.toISOString(), score: 0.9 },
        { subjectId: 'external-1', classId: 'class-2', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: now.toISOString(), score: 0.99 },
      ],
      priorIndicatorScores: [
        { subjectId: 'student-2', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: '2026-05-01T00:00:00.000Z', score: 0.2 },
        { subjectId: 'student-3', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: '2026-05-01T00:00:00.000Z', score: 0.55 },
      ],
      now,
    });

    const indicator = report.indicators.find((item) => item.indicatorId === 'arena-official-transfer');
    expect(indicator?.percentile).toEqual(expect.objectContaining({
      state: 'available',
      sampleSize: 4,
    }));
    expect(indicator?.growthPercentile).toEqual(expect.objectContaining({
      state: 'unavailable',
      fallback: 'cold-start',
    }));
    expect(indicator?.limitations.map((item) => item.reason)).toContain('cold-start');
  });

  it('rejects non-official Arena summaries for Arena-backed indicators and downgrades conflicting sources', () => {
    const report = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [
        {
          id: 'arena-preview',
          sourceFamily: 'arena-summary',
          indicatorIds: ['arena-official-transfer', 'arena-method-ranking', 'constraint-hard-boundary-pass'],
          value: 0.9,
          confidence: 'high',
          updatedAt: now.toISOString(),
          provenance: { sourceModel: 'LearningFact', official: false, classId: 'class-1', materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION },
          evidenceRef: { chunkId: 'chunk-preview-arena', sourceType: 'arena-summary', title: '预览 Arena 摘要' },
        },
        {
          id: 'conflict-high',
          sourceFamily: 'adaptive-assessment',
          indicatorIds: ['time-response-settling-control'],
          value: 1,
          confidence: 'high',
          updatedAt: now.toISOString(),
          provenance: { classId: 'class-1', userId: 'student-1', goalId: 'control-correction', materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION },
          evidenceRef: { chunkId: 'chunk-high', sourceType: 'path-summary', title: '高分证据' },
        },
        {
          id: 'conflict-low',
          sourceFamily: 'path-evidence',
          indicatorIds: ['time-response-settling-control'],
          value: 0,
          confidence: 'high',
          updatedAt: now.toISOString(),
          provenance: { classId: 'class-1', userId: 'student-1', goalId: 'control-correction', materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION },
          evidenceRef: { chunkId: 'chunk-low', sourceType: 'path-summary', title: '低分证据' },
        },
      ],
      now,
    });

    const arena = report.indicators.find((item) => item.indicatorId === 'arena-official-transfer');
    const arenaMethod = report.indicators.find((item) => item.indicatorId === 'arena-method-ranking');
    const constraint = report.indicators.find((item) => item.indicatorId === 'constraint-hard-boundary-pass');
    const time = report.indicators.find((item) => item.indicatorId === 'time-response-settling-control');
    expect(arena?.score).toBeNull();
    expect(arenaMethod?.score).toBeNull();
    expect(constraint?.score).toBeNull();
    expect(arena?.limitations.map((item) => item.reason)).toContain('missing-source');
    expect(time?.confidence.state).toBe('medium');
    expect(time?.limitations.map((item) => item.reason)).toContain('conflicting-source');
  });

  it('rejects non-Arena records without governed subject provenance', () => {
    const report = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [
        {
          id: 'unscoped-assessment',
          sourceFamily: 'adaptive-assessment',
          indicatorIds: ['time-response-settling-control'],
          value: 1,
          confidence: 'high',
          updatedAt: now.toISOString(),
          evidenceRef: { chunkId: 'chunk-unscoped', sourceType: 'path-summary', title: '无归因证据' },
        },
        {
          id: 'wrong-user-assessment',
          sourceFamily: 'adaptive-assessment',
          indicatorIds: ['time-response-settling-control'],
          value: 1,
          confidence: 'high',
          updatedAt: now.toISOString(),
          provenance: { classId: 'class-1', userId: 'student-2', goalId: 'control-correction', materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION },
          evidenceRef: { chunkId: 'chunk-wrong-user', sourceType: 'path-summary', title: '他人证据' },
        },
      ],
      now,
    });

    const indicator = report.indicators.find((item) => item.indicatorId === 'time-response-settling-control');
    expect(indicator?.score).toBeNull();
    expect(indicator?.evidenceRefs).toEqual([]);
  });

  it('does not calculate growth percentile when the target prior snapshot is not earlier than current', () => {
    const report = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [{
        id: 'arena-transfer',
        sourceFamily: 'arena-summary',
        indicatorIds: ['arena-official-transfer'],
        value: 0.75,
        confidence: 'high',
        updatedAt: now.toISOString(),
        provenance: { sourceModel: 'ArenaSubmission', official: true, classId: 'class-1', userId: 'student-1', goalId: 'control-correction', materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION },
      }],
      cohortIndicatorScores: [
        { subjectId: 'student-1', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: now.toISOString(), score: 0.75 },
        { subjectId: 'student-2', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: now.toISOString(), score: 0.5 },
        { subjectId: 'student-3', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: now.toISOString(), score: 0.6 },
      ],
      priorIndicatorScores: [
        { subjectId: 'student-1', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: now.toISOString(), score: 0.3 },
        { subjectId: 'student-2', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: '2026-05-01T00:00:00.000Z', score: 0.2 },
        { subjectId: 'student-3', classId: 'class-1', indicatorId: 'arena-official-transfer', indicatorVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION, snapshotAt: '2026-05-01T00:00:00.000Z', score: 0.2 },
      ],
      now,
    });

    const indicator = report.indicators.find((item) => item.indicatorId === 'arena-official-transfer');
    expect(indicator?.growthPercentile).toEqual(expect.objectContaining({
      state: 'unavailable',
      fallback: 'cold-start',
    }));
  });

  it('reads latest snapshots only for authorized student, teacher, or service scopes', () => {
    const studentReport = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [],
      now,
    });
    const classReport = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'class', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: new Date(now.getTime() + 1000),
      evidenceRecords: [],
      now,
    });
    const otherClassReport = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'class', classId: 'class-2' },
      goalId: 'control-correction',
      generatedAt: new Date(now.getTime() + 2000),
      evidenceRecords: [],
      now,
    });
    const store = createInMemoryDiagnosisReportSnapshotStore([studentReport, classReport, otherClassReport]);

    expect(readLatestControlCorrectionDiagnosisReportSnapshot(store, {
      view: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
    })?.id).toBe(studentReport.id);
    expect(readLatestControlCorrectionDiagnosisReportSnapshot(store, {
      view: 'student',
      userId: 'student-2',
      targetUserId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
    })).toBeNull();
    expect(readLatestControlCorrectionDiagnosisReportSnapshot(store, {
      view: 'student',
      userId: 'student-2',
      targetUserId: 'student-2',
      classId: 'class-1',
      goalId: 'control-correction',
    })).toBeNull();
    expect(readLatestControlCorrectionDiagnosisReportSnapshot(store, {
      view: 'teacher-class',
      userId: 'teacher-1',
      classId: 'class-1',
      teacherClassIds: ['class-1', 'class-2'],
      goalId: 'control-correction',
    })?.id).toBe(classReport.id);
    expect(readLatestControlCorrectionDiagnosisReportSnapshot(store, {
      view: 'teacher-class',
      userId: 'teacher-1',
      classId: 'class-1',
      teacherClassIds: ['class-2'],
      goalId: 'control-correction',
    })).toBeNull();
  });

  it('materializes zero feature-cache completion as an explicit low score', () => {
    const report = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      featureCache: {
        userId: 'student-1',
        features: {
          pathExecution: {
            allTime: {
              evidenceCount: 4,
              terminalValidation: { completedCount: 0 },
              confidence: { level: 'high' },
            },
          },
        },
        freshness: { sourceLastUpdatedAt: now.toISOString(), stale: false },
      },
      now,
    });

    expect(report.indicators.find((item) => item.indicatorId === 'simulation-terminal-validation')).toEqual(expect.objectContaining({
      score: 0,
      evidenceCount: 1,
    }));
    expect(report.indicators.find((item) => item.indicatorId === 'time-response-parameter-link')).toEqual(expect.objectContaining({
      score: null,
      evidenceCount: 0,
    }));
  });

  it('rejects feature-cache payloads owned by another student', () => {
    const report = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      featureCache: {
        userId: 'student-2',
        features: {
          pathExecution: {
            allTime: {
              evidenceCount: 4,
              terminalValidation: { completedCount: 4 },
              confidence: { level: 'high' },
            },
          },
        },
        freshness: { sourceLastUpdatedAt: now.toISOString(), stale: false },
      },
      now,
    });

    expect(report.indicators.find((item) => item.indicatorId === 'simulation-terminal-validation')).toEqual(expect.objectContaining({
      score: null,
      evidenceCount: 0,
    }));
    expect(report.sourceWindows).toEqual({});
  });

  it('does not expose rejected records in report source windows', () => {
    const report = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [
        {
          id: 'wrong-user-assessment',
          sourceFamily: 'adaptive-assessment',
          indicatorIds: ['time-response-settling-control'],
          value: 1,
          confidence: 'high',
          updatedAt: now.toISOString(),
          provenance: { classId: 'class-1', userId: 'student-2', goalId: 'control-correction', materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION },
        },
        {
          id: 'arena-preview',
          sourceFamily: 'arena-summary',
          indicatorIds: ['arena-official-transfer'],
          value: 1,
          confidence: 'high',
          updatedAt: now.toISOString(),
          provenance: { sourceModel: 'LearningFact', official: false, classId: 'class-1', userId: 'student-1', goalId: 'control-correction', materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION },
        },
      ],
      now,
    });

    expect(report.sourceWindows).toEqual({});
  });

  it('persists and reads latest snapshots through a Prisma-style delegate', async () => {
    const rows: Array<{ id: string; goalId: string; subjectKind: string; userId: string | null; classId: string | null; generatedAt: Date; snapshot: unknown }> = [];
    const findManyCalls: Array<{ where: Record<string, unknown> }> = [];
    const store = createPrismaDiagnosisReportSnapshotStore({
      upsert: async ({ where, create, update }) => {
        const index = rows.findIndex((row) => row.id === where.id);
        if (index >= 0) rows[index] = { ...rows[index], ...update };
        else rows.push(create);
      },
      findMany: async ({ where }) => {
        findManyCalls.push({ where });
        return rows.filter((row) =>
        row.goalId === where.goalId &&
        (!where.classId || row.classId === where.classId) &&
        (!where.userId || row.userId === where.userId) &&
        (!where.subjectKind || row.subjectKind === where.subjectKind)
        ).sort((left, right) => right.generatedAt.getTime() - left.generatedAt.getTime());
      },
    });
    const snapshot = materializeControlCorrectionDiagnosisReport({
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      goalId: 'control-correction',
      generatedAt: now,
      evidenceRecords: [],
      now,
    });

    await store.add(snapshot);

    await expect(readLatestControlCorrectionDiagnosisReportSnapshotFromPersistence(store, {
      view: 'student',
      userId: 'student-1',
      targetUserId: 'student-1',
      classId: 'class-1',
      goalId: 'control-correction',
    })).resolves.toEqual(expect.objectContaining({ id: snapshot.id }));
    expect(findManyCalls.at(-1)?.where).toEqual(expect.objectContaining({
      goalId: 'control-correction',
      userId: 'student-1',
      classId: 'class-1',
      subjectKind: 'student',
    }));
  });
});
