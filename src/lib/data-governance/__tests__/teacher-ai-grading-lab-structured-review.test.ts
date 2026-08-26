import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appendTeacherAiGradingStructuredReviewVersion,
  getTeacherAiGradingPdfVerificationAggregate,
  materializeTeacherAiGradingStructuredResult,
  recordTeacherAiGradingPdfVerification,
  registerTeacherAiGradingHiddenPdfSet,
} from '../teacher-ai-grading-lab-structured-review';

function createMemoryDb(seedSelections = false) {
  const execution = {
    id: 'execution-a',
    splitId: 'split-a',
    sampleId: 'sample-a',
    state: 'SUCCEEDED',
    gradingRun: {
      rubricSnapshot: { criteria: [{ id: 'criterion-a', maxPoints: 5 }] },
      assessments: [{ id: 'assessment-a', criterionId: 'criterion-a', score: 4, rationale: 'AI rationale' }],
      annotations: [{
        id: 'annotation-a', criterionId: 'criterion-a', comment: 'AI original', pageNumber: 1,
        blockId: 'block-a', bbox: [1, 2, 3, 4], precision: 'EXACT', block: { coordinateProvenance: null },
      }],
    },
  };
  const executionB = {
    ...structuredClone(execution),
    id: 'execution-b',
    sampleId: 'sample-b',
    gradingRun: {
      rubricSnapshot: { criteria: [{ id: 'criterion-b', maxPoints: 5 }] },
      assessments: [{ id: 'assessment-b', criterionId: 'criterion-b', score: 3, rationale: 'AI rationale B' }],
      annotations: [{
        id: 'annotation-b', criterionId: 'criterion-b', comment: 'AI original B', pageNumber: 1,
        blockId: 'block-b', bbox: [1, 2, 3, 4], precision: 'EXACT', block: { coordinateProvenance: null },
      }],
    },
  };
  const reviewVersions: any[] = [];
  const derivatives: any[] = [];
  const derivativeLinks: any[] = [];
  const verifications: any[] = [];
  let transactionTail = Promise.resolve();
  const db: any = {
    execution,
    reviewVersions,
    derivatives,
    derivativeLinks,
    verifications,
    $queryRawUnsafe: async () => [],
    $transaction: async (operation: (tx: any) => Promise<any>) => {
      const previous = transactionTail;
      let release = () => {};
      transactionTail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try { return await operation(db); } finally { release(); }
    },
    documentConversion: {
      findUnique: async ({ where }: any) => where.id === 'conversion-a' ? {
        id: 'conversion-a', version: 1, adapterVersion: 'adapter.v1', state: 'SUCCEEDED',
        renderedObjectKey: 'rendered/source.pdf', renderedChecksum: `sha256:${'1'.repeat(64)}`,
      } : null,
    },
    teacherAiGradingExperimentExecution: {
      findUnique: async ({ where }: any) => where.id === execution.id ? structuredClone(execution) : null,
    },
    teacherAiGradingStructuredReviewVersion: {
      findFirst: async ({ where }: any) => reviewVersions
        .filter((row) => row.executionId === where.executionId)
        .sort((left, right) => right.version - left.version)[0] ?? null,
      create: async ({ data }: any) => {
        const row = { id: `review-${data.version}`, ...structuredClone(data) };
        reviewVersions.push(row);
        return structuredClone(row);
      },
      findMany: async ({ where }: any) => {
        if (where.id) return reviewVersions.filter((row) => where.id.in.includes(row.id)).map((row) => ({
          id: row.id,
          executionId: row.executionId,
          execution: structuredClone(row.executionId === 'execution-b' ? executionB : execution),
        }));
        const executionIds = Array.isArray(where.executionId?.in) ? where.executionId.in : [where.executionId];
        return reviewVersions.filter((row) => executionIds.includes(row.executionId)).map((row) => structuredClone(row));
      },
    },
    teacherAiGradingHiddenAcceptance: {
      findUnique: async ({ where, select }: any) => {
        if (where.id !== 'acceptance-a') return null;
        if (select.split) return {
          state: 'CONSUMED',
          split: { hiddenCount: 2, members: [{ sampleId: 'sample-a' }, { sampleId: 'sample-b' }] },
        };
        return { id: 'acceptance-a', splitId: 'split-a', state: 'CONSUMED' };
      },
    },
    teacherAiGradingLabSplit: {
      findUnique: async () => ({ members: [{ sampleId: 'sample-a' }, { sampleId: 'sample-b' }] }),
    },
    teacherAiGradingEvaluationDerivative: {
      create: async ({ data }: any) => { derivatives.push(structuredClone(data)); return data; },
      findMany: async ({ where }: any) => derivatives.filter((row) => where.id.in.includes(row.id)).map((row) => ({
        ...structuredClone(row),
        reviewVersions: derivativeLinks.filter((link) => link.derivativeId === row.id)
          .sort((left, right) => left.ordinal - right.ordinal),
        sourceConversion: {
          id: 'conversion-a', version: 1, adapterVersion: 'adapter.v1', state: 'SUCCEEDED',
          renderedObjectKey: 'rendered/source.pdf', renderedChecksum: `sha256:${'1'.repeat(64)}`,
        },
      })),
    },
    teacherAiGradingDerivativeReviewVersion: {
      createMany: async ({ data }: any) => { derivativeLinks.push(...structuredClone(data)); return { count: data.length }; },
    },
    teacherAiGradingPdfVerification: {
      create: async ({ data }: any) => {
        const row = {
          id: `verification-${data.sampleId}`,
          ...structuredClone(data),
          originalLayoutComplete: null,
          pageMarksComplete: null,
          nativeAnnotationsComplete: null,
          positioningCorrect: null,
          summaryPageCorrect: null,
          blockingDefect: null,
          reviewedAt: null,
          operatorUserId: null,
          revision: 0,
        };
        verifications.push(row);
        return structuredClone(row);
      },
      findMany: async ({ where, select }: any) => verifications
        .filter((row) => row.acceptanceId === where.acceptanceId)
        .map((row) => select ? {
          sampleId: row.sampleId,
          derivativeId: row.derivativeId,
        } : structuredClone(row)),
      updateMany: async ({ where, data }: any) => {
        const row = verifications.find((item) => item.acceptanceId === where.acceptanceId
          && item.sampleId === where.sampleId && item.derivativeId === where.derivativeId
          && item.revision === where.revision);
        if (!row) return { count: 0 };
        Object.assign(row, structuredClone(data), { revision: row.revision + data.revision.increment });
        return { count: 1 };
      },
      findUnique: async ({ where }: any) => structuredClone(verifications.find((row) => row.derivativeId === where.derivativeId) ?? null),
    },
  };
  if (seedSelections) reviewVersions.push(reviewRow('selected-a', 'execution-a'), reviewRow('selected-b', 'execution-b'));
  return db;
}

function reviewRow(id: string, executionId: string) {
  const createdAt = new Date('2026-07-28T00:00:00.000Z');
  const content = {
    executionId,
    version: 1,
    parentVersionId: null,
    decision: 'ACCEPTED',
    scoreCorrections: [],
    annotationCorrections: [],
    operatorUserId: 'teacher-a',
    createdAt: createdAt.toISOString(),
  };
  return { id, ...content, createdAt, contentHash: hashJson(content) };
}

async function seedGeneratedDerivatives(db: any, structuredHashPatch?: string) {
  for (const [sampleId, derivativeId, reviewVersionId] of [
    ['sample-a', 'pdf-a', 'selected-a'],
    ['sample-b', 'pdf-b', 'selected-b'],
  ] as const) {
    const materialized = await materializeTeacherAiGradingStructuredResult({ db, selectedReviewVersionIds: [reviewVersionId] });
    db.derivatives.push({
      id: derivativeId,
      splitId: 'split-a',
      sampleId,
      sourceConversionId: 'conversion-a',
      sourcePdfChecksum: `sha256:${'1'.repeat(64)}`,
      sourcePdfObjectKey: 'rendered/source.pdf',
      sourcePdfSizeBytes: 100,
      conversionVersion: 1,
      conversionAdapterVersion: 'adapter.v1',
      generatorVersion: 'teacher-ai-grading-lab-pdf.v1',
      anchorVersion: 'anchors.v1',
      structuredResultHash: structuredHashPatch ?? materialized.structuredResult.checksum,
      semanticIdentity: `semantic-${sampleId}`,
      contentChecksum: `sha256:${sampleId === 'sample-a' ? 'a' : 'b'}`,
      contentSizeBytes: 200,
    });
    db.derivativeLinks.push({ derivativeId, reviewVersionId, ordinal: 0 });
  }
}

const completeChecks = {
  originalLayoutComplete: true,
  pageMarksComplete: true,
  nativeAnnotationsComplete: true,
  positioningCorrect: true,
  summaryPageCorrect: true,
};

describe('teacher AI grading structured review versions', () => {
  it('appends correction versions without changing AI source rows and rejects a stale parent', async () => {
    const db = createMemoryDb();
    const source = structuredClone(db.execution.gradingRun);

    const first = await appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: null,
      decision: 'correct',
      scoreCorrections: [{ criterionId: 'criterion-a', score: 3 }],
      annotationCorrections: [{ action: 'revise-text', sourceAnnotationId: 'annotation-a', comment: 'Teacher correction' }],
      operatorUserId: 'teacher-a',
      now: new Date('2026-07-28T01:00:00.000Z'),
    });
    const second = await appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: first.id,
      decision: 'correct',
      scoreCorrections: [],
      annotationCorrections: [{ action: 'revise-location', sourceAnnotationId: 'annotation-a', location: { pageNumber: 2 } }],
      operatorUserId: 'teacher-b',
    });

    expect(first).toMatchObject({ version: 1, parentVersionId: null, operatorUserId: 'teacher-a' });
    expect(second).toMatchObject({ version: 2, parentVersionId: first.id, operatorUserId: 'teacher-b' });
    expect(db.execution.gradingRun).toEqual(source);
    await expect(appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: first.id,
      decision: 'correct',
      scoreCorrections: [{ criterionId: 'criterion-a', score: 2 }],
      annotationCorrections: [],
      operatorUserId: 'teacher-c',
    })).rejects.toThrow('teacher-ai-grading-review-parent-conflict');
  });

  it('rejects corrections that do not belong to the immutable grading run', async () => {
    const db = createMemoryDb();
    await expect(appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: null,
      decision: 'correct',
      scoreCorrections: [],
      annotationCorrections: [{ action: 'delete', sourceAnnotationId: 'foreign-annotation' }],
      operatorUserId: 'teacher-a',
    })).rejects.toThrow('teacher-ai-grading-review-annotation-mismatch');
  });

  it('requires an independent reason for added annotations', async () => {
    const db = createMemoryDb();
    await expect(appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: null,
      decision: 'correct',
      scoreCorrections: [],
      annotationCorrections: [{
        action: 'add', annotationKey: 'added-a', criterionId: 'criterion-a',
        comment: 'Teacher correction', location: { pageNumber: 1 },
      } as any],
      operatorUserId: 'teacher-a',
    })).rejects.toThrow('teacher-ai-grading-review-deduction-reason-missing');
  });

  it('requires a physical page for added annotations', async () => {
    const db = createMemoryDb();
    await expect(appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: null,
      decision: 'correct',
      scoreCorrections: [],
      annotationCorrections: [{
        action: 'add', annotationKey: 'added-without-page', criterionId: 'criterion-a',
        reason: 'A deduction requires a physical placement.', comment: 'Show the missing step.', location: { blockId: 'block-a' },
      }],
      operatorUserId: 'teacher-a',
    })).rejects.toThrow('teacher-ai-grading-review-location-page-missing');
  });

  it('requires score and annotation corrections to form a consistent review state', async () => {
    const db = createMemoryDb();
    await expect(appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: null,
      decision: 'correct',
      scoreCorrections: [{ criterionId: 'criterion-a', score: 5 }],
      annotationCorrections: [],
      operatorUserId: 'teacher-a',
    })).rejects.toThrow('teacher-ai-grading-review-annotation-without-deduction');

    const corrected = await appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: null,
      decision: 'correct',
      scoreCorrections: [{ criterionId: 'criterion-a', score: 5 }],
      annotationCorrections: [{ action: 'delete', sourceAnnotationId: 'annotation-a' }],
      operatorUserId: 'teacher-a',
    });
    const materialized = await materializeTeacherAiGradingStructuredResult({ db, selectedReviewVersionIds: [corrected.id] });
    expect(materialized.structuredResult.feedback).toEqual([]);
  });

  it('allows a later review version to revise an annotation added by its parent', async () => {
    const db = createMemoryDb();
    const first = await appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: null,
      decision: 'correct',
      scoreCorrections: [],
      annotationCorrections: [{
        action: 'add', annotationKey: 'added-a', criterionId: 'criterion-a',
        reason: 'An additional deduction has an omitted justification.',
        comment: 'State the omitted justification.', location: { pageNumber: 1 },
      }],
      operatorUserId: 'teacher-a',
    });
    const second = await appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: first.id,
      decision: 'correct',
      scoreCorrections: [],
      annotationCorrections: [{
        action: 'revise-text', sourceAnnotationId: `${first.id}:added-a`, comment: 'Explain the omitted justification.',
      }],
      operatorUserId: 'teacher-a',
    });

    const materialized = await materializeTeacherAiGradingStructuredResult({ db, selectedReviewVersionIds: [second.id] });
    expect(materialized.structuredResult.feedback).toEqual(expect.arrayContaining([
      expect.objectContaining({ correction: 'Explain the omitted justification.' }),
    ]));
  });

  it('fails closed when a pre-existing review chain leaves a full-score annotation', async () => {
    const db = createMemoryDb();
    const createdAt = new Date('2026-07-28T00:00:00.000Z');
    const content = {
      executionId: 'execution-a', version: 1, parentVersionId: null, decision: 'CORRECTED',
      scoreCorrections: [{ criterionId: 'criterion-a', score: 5 }], annotationCorrections: [],
      operatorUserId: 'teacher-a', createdAt: createdAt.toISOString(),
    };
    db.reviewVersions.push({ id: 'invalid-full-score', ...content, createdAt, contentHash: hashJson(content) });

    await expect(materializeTeacherAiGradingStructuredResult({ db, selectedReviewVersionIds: ['invalid-full-score'] }))
      .rejects.toThrow('teacher-ai-grading-review-annotation-without-deduction');
  });

  it('records an explicit acceptance without inventing corrections', async () => {
    const db = createMemoryDb();
    const accepted = await appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: null,
      decision: 'accept',
      scoreCorrections: [],
      annotationCorrections: [],
      operatorUserId: 'teacher-a',
    });

    expect(accepted).toMatchObject({ decision: 'ACCEPTED', scoreCorrections: [], annotationCorrections: [] });
    await expect(appendTeacherAiGradingStructuredReviewVersion({
      db,
      executionId: 'execution-a',
      parentVersionId: accepted.id,
      decision: 'accept',
      scoreCorrections: [{ criterionId: 'criterion-a', score: 3 }],
      annotationCorrections: [],
      operatorUserId: 'teacher-a',
    })).rejects.toThrow('teacher-ai-grading-review-accepted-corrections-forbidden');
  });
});

describe('teacher AI grading hidden PDF verification', () => {
  it('requires the complete hidden set and binds every derivative to selected review versions', async () => {
    const db = createMemoryDb(true);
    await expect(registerTeacherAiGradingHiddenPdfSet({
      db,
      acceptanceId: 'acceptance-a',
      derivatives: [{ derivativeId: 'pdf-a', sampleId: 'sample-a' }],
    })).rejects.toThrow('teacher-ai-grading-pdf-hidden-set-incomplete');

    await expect(registerTeacherAiGradingHiddenPdfSet({
      db,
      acceptanceId: 'acceptance-a',
      derivatives: [
        { derivativeId: 'pdf-a', sampleId: 'sample-a', contentChecksum: 'sha256:arbitrary', selectedReviewVersionIds: ['selected-a'] } as any,
        { derivativeId: 'pdf-b', sampleId: 'sample-b', contentChecksum: 'sha256:arbitrary', selectedReviewVersionIds: ['selected-b'] } as any,
      ],
    })).rejects.toThrow('teacher-ai-grading-pdf-derivative-not-generated');
    await seedGeneratedDerivatives(db);

    const result = await registerTeacherAiGradingHiddenPdfSet({
      db,
      acceptanceId: 'acceptance-a',
      derivatives: [
        { derivativeId: 'pdf-a', sampleId: 'sample-a' },
        { derivativeId: 'pdf-b', sampleId: 'sample-b' },
      ],
    });
    expect(result).toEqual({ acceptanceId: 'acceptance-a', splitId: 'split-a', count: 2, replay: false });
    expect(db.derivativeLinks).toEqual([
      { derivativeId: 'pdf-a', reviewVersionId: 'selected-a', ordinal: 0 },
      { derivativeId: 'pdf-b', reviewVersionId: 'selected-b', ordinal: 0 },
    ]);
    await expect(getTeacherAiGradingPdfVerificationAggregate({ db, acceptanceId: 'acceptance-a' })).resolves.toMatchObject({
      status: 'pending', expectedCount: 2, registeredCount: 2, reviewedCount: 0,
    });
  });

  it('fences concurrent checklist updates and blocks the aggregate on any failed item', async () => {
    const db = createMemoryDb(true);
    await seedGeneratedDerivatives(db);
    await registerTeacherAiGradingHiddenPdfSet({
      db,
      acceptanceId: 'acceptance-a',
      derivatives: [
        { derivativeId: 'pdf-a', sampleId: 'sample-a' },
        { derivativeId: 'pdf-b', sampleId: 'sample-b' },
      ],
    });
    await recordTeacherAiGradingPdfVerification({
      db, acceptanceId: 'acceptance-a', sampleId: 'sample-a', derivativeId: 'pdf-a', expectedRevision: 0,
      checks: completeChecks, blockingDefect: false, operatorUserId: 'teacher-a',
    });
    await expect(recordTeacherAiGradingPdfVerification({
      db, acceptanceId: 'acceptance-a', sampleId: 'sample-a', derivativeId: 'pdf-a', expectedRevision: 0,
      checks: completeChecks, blockingDefect: false, operatorUserId: 'teacher-b',
    })).rejects.toThrow('teacher-ai-grading-pdf-verification-conflict');
    await recordTeacherAiGradingPdfVerification({
      db, acceptanceId: 'acceptance-a', sampleId: 'sample-b', derivativeId: 'pdf-b', expectedRevision: 0,
      checks: { ...completeChecks, nativeAnnotationsComplete: false }, blockingDefect: true,
      defectCode: 'native-annotations-missing', operatorUserId: 'teacher-a',
    });
    await expect(getTeacherAiGradingPdfVerificationAggregate({ db, acceptanceId: 'acceptance-a' })).resolves.toEqual({
      status: 'failed', expectedCount: 2, registeredCount: 2, reviewedCount: 2, failedCount: 1,
    });
  });

  it('rejects a persisted derivative whose structured hash does not match its selected review chain', async () => {
    const db = createMemoryDb(true);
    await seedGeneratedDerivatives(db, `sha256:${'f'.repeat(64)}`);

    await expect(registerTeacherAiGradingHiddenPdfSet({
      db,
      acceptanceId: 'acceptance-a',
      derivatives: [
        { derivativeId: 'pdf-a', sampleId: 'sample-a' },
        { derivativeId: 'pdf-b', sampleId: 'sample-b' },
      ],
    })).rejects.toThrow('teacher-ai-grading-pdf-structured-result-mismatch');
  });

  it('passes only after all five checks pass for every hidden PDF', async () => {
    const db = createMemoryDb(true);
    await seedGeneratedDerivatives(db);
    await registerTeacherAiGradingHiddenPdfSet({
      db,
      acceptanceId: 'acceptance-a',
      derivatives: [
        { derivativeId: 'pdf-a', sampleId: 'sample-a' },
        { derivativeId: 'pdf-b', sampleId: 'sample-b' },
      ],
    });
    for (const [sampleId, derivativeId] of [['sample-a', 'pdf-a'], ['sample-b', 'pdf-b']]) {
      await recordTeacherAiGradingPdfVerification({
        db, acceptanceId: 'acceptance-a', sampleId, derivativeId, expectedRevision: 0,
        checks: completeChecks, blockingDefect: false, operatorUserId: 'teacher-a',
      });
    }
    await expect(getTeacherAiGradingPdfVerificationAggregate({ db, acceptanceId: 'acceptance-a' })).resolves.toMatchObject({ status: 'passed' });
  });

  it('enforces append-only structured versions in the migration', () => {
    const migration = readFileSync(join(process.cwd(), 'prisma/migrations/20260728110000_add_teacher_ai_grading_structured_review_pdf_verification/migration.sql'), 'utf8');
    expect(migration).toContain('TeacherAiGradingStructuredReviewVersion_immutable');
    expect(migration).toContain("\"decision\" IN ('ACCEPTED', 'CORRECTED')");
    expect(migration).toContain('BEFORE INSERT OR UPDATE OR DELETE ON "GradingCriterionAssessment"');
    expect(migration).toContain('BEFORE INSERT OR UPDATE OR DELETE ON "GradingAnnotation"');
    expect(migration).toContain("IF TG_OP <> 'INSERT' THEN old_grading_run_id := OLD.\"gradingRunId\"");
    expect(migration).toContain("IF TG_OP <> 'DELETE' THEN new_grading_run_id := NEW.\"gradingRunId\"");
    expect(migration).toContain('WHERE "gradingRunId" IN (old_grading_run_id, new_grading_run_id) AND "state" = \'SUCCEEDED\'');
    expect(migration).toContain("IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;");
    expect(migration).toContain('RETURN NEW;');
    expect(migration).toContain('CompletedTeacherAiGradingRun_immutable');
    expect(migration).toContain('CompletedTeacherAiGradingAssessment_immutable');
    expect(migration).toContain('CompletedTeacherAiGradingAnnotation_immutable');
    expect(migration).toContain('TeacherAiGradingPdfVerification_acceptance_sample_key');
  });
});

function hashJson(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  return value;
}
