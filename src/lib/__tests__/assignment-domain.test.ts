import { describe, expect, it } from 'vitest';

import { buildRubricBackedSubjectiveAssignmentFixture } from '../assignments/assignment-fixtures';
import {
  AssignmentDomainError,
  analyticRubricSchema,
  assignmentDraftSchema,
  assertMutationRequest,
  canStudentReadCurrentDelivery,
  canStudentReadHistory,
  canTeacherReadHistory,
  createQuestionSnapshot,
  projectRevisionForStudent,
  stableHash,
  validatePublicationSchedule,
  validatePublicationScores,
  type AssignmentRevisionRecord,
} from '../assignments/assignment-domain';

describe('assignment authoring domain', () => {
  it('builds a rubric-backed fixture without identifiable student content', () => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    expect(validatePublicationScores(fixture)).toEqual([]);
    expect(JSON.stringify(fixture)).not.toMatch(/studentId|studentName|submissionContent|email|学号/);
  });

  it('creates immutable manual and governed catalog snapshots with stable hashes', () => {
    const manual = createQuestionSnapshot(buildRubricBackedSubjectiveAssignmentFixture().questions[0]);
    expect(Object.isFrozen(manual)).toBe(true);
    const { contentHash: _contentHash, ...manualInput } = manual;
    const catalog = createQuestionSnapshot({
      ...manualInput,
      stableQuestionId: 'catalog-question',
      source: {
        family: 'ADAPTIVE_ASSESSMENT_CATALOG',
        sourceId: 'item-1',
        sourceVersion: 'algorithm-v1',
        sourceHash: stableHash({ prompt: manual.prompt }),
        reviewState: 'approved',
        lineage: { questionId: 'question-1' },
      },
    });
    expect(catalog.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(() => { (catalog as { prompt: string }).prompt = 'mutated'; }).toThrow();
  });

  it('rejects duplicate criterion ids and out-of-range rubric levels', () => {
    const rubric = buildRubricBackedSubjectiveAssignmentFixture().questions[0].rubric;
    const result = analyticRubricSchema.safeParse({
      ...rubric,
      criteria: [rubric.criteria[0], { ...rubric.criteria[0], levels: [{ ...rubric.criteria[0].levels[0], maxPoints: 99 }] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate stable question ids and non-contiguous rubric score bands', () => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    expect(assignmentDraftSchema.safeParse({ ...fixture, questions: [fixture.questions[0], fixture.questions[0]] }).success).toBe(false);
    const rubric = fixture.questions[0].rubric;
    expect(analyticRubricSchema.safeParse({
      ...rubric,
      criteria: [{ ...rubric.criteria[0], levels: [
        { id: 'high', label: '高', minPoints: 6, maxPoints: 8, description: '高档。' },
        { id: 'low', label: '低', minPoints: 0, maxPoints: 4, description: '低档。' },
      ] }],
    }).success).toBe(false);
  });

  it('accepts two-decimal score bands on a contiguous 0.01 grid', () => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    const question = fixture.questions[0];
    const result = assignmentDraftSchema.safeParse({
      ...fixture,
      totalPoints: 2.5,
      questions: [{ ...question, points: 2.5, rubric: { ...question.rubric, criteria: [{
        ...question.rubric.criteria[0], maxPoints: 2.5, levels: [
          { id: 'high', label: '高', minPoints: 1.26, maxPoints: 2.5, description: '高档证据。' },
          { id: 'low', label: '低', minPoints: 0, maxPoints: 1.25, description: '低档证据。' },
        ],
      }] } }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts v2 scoring-standard-only items and enforces one-decimal values', () => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    const question = fixture.questions[0];
    const v2 = {
      schemaVersion: 'assignment-scoring-rubric.v2' as const,
      criteria: [{
        id: 'quality',
        label: '完成质量',
        maxPoints: 10,
        scoringStandard: '依据解题过程的正确性、完整性和可验证证据评分。',
        detailedRubricEnabled: false,
        levels: [],
      }],
    };
    expect(assignmentDraftSchema.safeParse({
      ...fixture,
      totalPoints: 10,
      questions: [{ ...question, points: 10, rubric: v2 }],
    }).success).toBe(true);
    expect(assignmentDraftSchema.safeParse({
      ...fixture,
      totalPoints: 10.01,
      questions: [{ ...question, points: 10.01, rubric: { ...v2, criteria: [{ ...v2.criteria[0], maxPoints: 10.01 }] } }],
    }).success).toBe(false);
  });

  it('enforces the unique v2 publication contract for standard and detailed modes', () => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    const question = fixture.questions[0];
    const build = (criterion: Record<string, unknown>) => ({
      ...fixture,
      totalPoints: 10,
      questions: [{
        ...question,
        points: 10,
        rubric: {
          schemaVersion: 'assignment-scoring-rubric.v2' as const,
          criteria: [{
            id: 'quality',
            label: '完成质量',
            maxPoints: 10,
            levels: [],
            ...criterion,
          }],
        },
      }],
    });
    const standard = assignmentDraftSchema.parse(build({
      scoringStandard: '',
      detailedRubricEnabled: false,
    }));
    expect(validatePublicationScores(standard)).toContain('scoring-standard-required:control-correction-analysis:quality');

    const detailed = assignmentDraftSchema.parse(build({
      scoringStandard: '',
      detailedRubricEnabled: true,
      levels: [
        { id: 'high', label: '优秀', maxPoints: 10, guideline: '完整达到要求。' },
        { id: 'pass', label: '及格', maxPoints: 6, guideline: '' },
      ],
    }));
    expect(validatePublicationScores(detailed)).toContain('level-guideline-required:control-correction-analysis:quality');
  });

  it('retains legacy response fields without restricting the unified answer contract', () => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    fixture.questions[0] = { ...fixture.questions[0], responseType: 'SUBJECTIVE_FILE' };
    const result = assignmentDraftSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it.each([
    { name: 'gap', levels: [{ id: 'high', label: '高', minPoints: 1.27, maxPoints: 2.5, description: '高档。' }, { id: 'low', label: '低', minPoints: 0, maxPoints: 1.25, description: '低档。' }] },
    { name: 'overlap', levels: [{ id: 'high', label: '高', minPoints: 1.25, maxPoints: 2.5, description: '高档。' }, { id: 'low', label: '低', minPoints: 0, maxPoints: 1.25, description: '低档。' }] },
    { name: 'three decimals', levels: [{ id: 'all', label: '全部', minPoints: 0, maxPoints: 2.555, description: '非法精度。' }] },
  ])('rejects $name in decimal score bands', ({ levels }) => {
    const criterion = buildRubricBackedSubjectiveAssignmentFixture().questions[0].rubric.criteria[0];
    expect(analyticRubricSchema.safeParse({ schemaVersion: 'assignment-analytic-rubric.v1', criteria: [{ ...criterion, maxPoints: levels[0].maxPoints, levels }] }).success).toBe(false);
  });

  it.each([
    { assignment: 10, question: 20, rubric: 20, expected: 'assignment-total-mismatch:10:20' },
    { assignment: 20, question: 20, rubric: 25, expected: 'question-rubric-total-mismatch' },
    { assignment: 25, question: 20, rubric: 10, expected: 'assignment-total-mismatch:25:20' },
  ])('blocks the conflicting 10/20/25 score scales without rescaling', ({ assignment, question, rubric, expected }) => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    const legacyRubric = fixture.questions[0].rubric;
    if (legacyRubric.schemaVersion !== 'assignment-analytic-rubric.v1') throw new Error('fixture-rubric-version');
    fixture.totalPoints = assignment;
    fixture.questions[0] = {
      ...fixture.questions[0],
      points: question,
      rubric: {
        ...legacyRubric,
        criteria: [{ ...legacyRubric.criteria[0], maxPoints: rubric, levels: [{ id: 'ok', label: '合格', minPoints: 0, maxPoints: rubric, description: '可复核。' }] }],
      },
    };
    expect(validatePublicationScores(fixture).some((issue) => issue.startsWith(expected))).toBe(true);
    expect(fixture.questions[0].points).toBe(question);
  });

  it('requires authorized current delivery while historical access uses frozen ownership or explicit grants', () => {
    expect(canStudentReadCurrentDelivery({
      studentId: 'student-1', audienceClassId: 'class-1', currentMemberships: [{ studentId: 'student-1', classId: 'class-1' }],
      audiences: [{ classId: 'class-1', availableAt: '2026-07-10T00:00:00Z', dueAt: '2026-07-12T00:00:00Z' }],
      now: new Date('2026-07-11T00:00:00Z'),
    })).toBe(true);
    expect(canStudentReadCurrentDelivery({
      studentId: 'student-1', audienceClassId: 'class-1', currentMemberships: [],
      audiences: [{ classId: 'class-1', availableAt: '2026-07-10T00:00:00Z', dueAt: '2026-07-12T00:00:00Z' }],
      now: new Date('2026-07-11T00:00:00Z'),
    })).toBe(false);
    expect(canStudentReadHistory({ studentId: 'student-1', assignmentRevisionId: 'revision-1', ownerships: [{ studentId: 'student-1', assignmentRevisionId: 'revision-1' }] })).toBe(true);
    expect(canTeacherReadHistory({ assignmentAuthorId: 'old-teacher', teacherId: 'new-teacher', grants: [], now: new Date('2026-07-11T00:00:00Z') })).toBe(false);
    expect(canTeacherReadHistory({ assignmentAuthorId: 'old-teacher', teacherId: 'new-teacher', grants: [{ teacherId: 'new-teacher', expiresAt: '2026-07-12T00:00:00Z' }], now: new Date('2026-07-11T00:00:00Z') })).toBe(true);
  });

  it('keeps answers and teacher-only rubric guidance out of student projections until a scoped policy releases them', () => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    const draft = { ...fixture, questions: fixture.questions.map(createQuestionSnapshot) };
    const revision = {
      ...draft,
      id: 'revision-1', assignmentId: 'assignment-1', revisionNumber: 1, version: 2, state: 'PUBLISHED',
      contentHash: stableHash(draft), publishedAt: '2026-07-11T00:00:00Z', frozenAt: '2026-07-11T00:00:00Z',
    } satisfies AssignmentRevisionRecord;
    const privateProjection = projectRevisionForStudent({ revision, audienceClassId: 'class-1', now: new Date('2026-07-12T00:00:00Z') });
    expect(JSON.stringify(privateProjection)).not.toContain('referenceAnswer');
    expect(JSON.stringify(privateProjection)).not.toContain('feedbackGuidance');
    const released = projectRevisionForStudent({
      revision: { ...revision, solutionReleasePolicy: { version: 1, mode: 'AT_TIME', releaseAt: '2026-07-11T00:00:00Z', audienceClassIds: ['class-1'], includeReferenceAnswer: true, includeStudentVisibleGuidance: true } },
      audienceClassId: 'class-1', now: new Date('2026-07-12T00:00:00Z'),
    });
    expect(JSON.stringify(released)).toContain('referenceAnswer');
    expect(JSON.stringify(released)).not.toContain('feedbackGuidance');
  });

  it('validates schedules and strict mutation origin/body bounds', () => {
    expect(validatePublicationSchedule([{ classId: 'class-1', availableAt: '2026-07-12T00:00:00Z', dueAt: '2026-07-13T00:00:00Z' }], new Date('2026-07-11T00:00:00Z'))).toEqual([]);
    expect(() => assertMutationRequest({ method: 'POST', requestOrigin: 'https://evil.example', allowedOrigin: 'https://act.example', contentLength: 100 })).toThrowError(new AssignmentDomainError('invalid-origin'));
    expect(() => assertMutationRequest({ method: 'POST', requestOrigin: 'https://act.example', allowedOrigin: 'https://act.example', contentLength: 300_000 })).toThrowError(new AssignmentDomainError('payload-too-large'));
  });
});
