import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { resolveCourseEvidenceSpec } from '../course-evidence-specs';
import {
  inferCourseReviewLessonIdFromLessonKey,
  inferCourseReviewLessonIdFromStateData,
  parseCourseReviewPrepostRecord,
  type CourseReviewPrepostSubmissionRow,
} from '../course-review-prepost-tracking';

function readManifest(lessonId: string) {
  const manifest = normalizeInteractiveRuntimeManifest(
    JSON.parse(fs.readFileSync(path.join(process.cwd(), `course-content/runtime/lessons/${lessonId}/interactive-manifest.json`), 'utf8')),
  );
  if (!manifest) throw new Error(`Missing manifest for ${lessonId}`);
  return manifest;
}

const user = {
  id: 'student-1',
  name: '张同学',
  profile: {
    studentNumber: '20260001',
  },
};

function richSubmission(stepId: string, score: number): CourseReviewPrepostSubmissionRow {
  return {
    stepId,
    responseData: {
      schemaVersion: 'manifest-submission-v2',
      stepId,
      answers: { q1: 'A' },
      questionSummaries: [{
        questionId: 'q1',
        studentAnswer: 'A',
        referenceValue: 'A',
        isCorrect: true,
      }],
      score,
    },
  };
}

describe('course review pre/post tracking parser', () => {
  it.each([
    ['5-3', 'unit53_student_state', 'step-03', 'step-14'],
    ['5-4', 'unit54_student_state', 'step-03', 'step-16'],
    ['5-5', 'unit55_student_state', 'step-03', 'step-16'],
    ['5-6', 'unit56_student_state', 'step-03', 'step-17'],
  ])('derives module %s pre/post delta from CourseEvidenceSpec and durable submissions', (lessonId, stateKind, preStepId, postStepId) => {
    const manifest = readManifest(lessonId);
    const resolved = resolveCourseEvidenceSpec({ manifest });
    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error(`${lessonId} did not resolve`);

    const record = parseCourseReviewPrepostRecord({
      user,
      stateData: {
        kind: stateKind,
        version: 1,
        responses: {},
      },
      manifest,
      spec: resolved.spec,
      submissions: [
        richSubmission(preStepId, 40),
        richSubmission(postStepId, 85),
      ],
    });

    expect(record).toMatchObject({
      userId: 'student-1',
      studentNumber: '20260001',
      pre: { stepId: preStepId, score: 40, evidenceQuality: 'rich' },
      post: { stepId: postStepId, score: 85, evidenceQuality: 'rich' },
      delta: 45,
      evidenceQuality: 'rich',
      recoverability: 'complete',
      stepIds: {
        pre: preStepId,
        post: postStepId,
      },
    });
    expect(record?.questionSummaries).toHaveLength(2);
  });

  it('infers a non-module-5 lesson through manifest metadata instead of a unit-specific branch', () => {
    const manifest = readManifest('4-7');
    const resolved = resolveCourseEvidenceSpec({ manifest });
    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('4-7 did not resolve');

    const record = parseCourseReviewPrepostRecord({
      user,
      stateData: {
        kind: 'unit47_student_state',
        version: 1,
        responses: {},
      },
      manifest,
      spec: resolved.spec,
      submissions: [
        richSubmission('step-02', 55),
        richSubmission('step-11', 75),
      ],
    });

    expect(record).toMatchObject({
      pre: { stepId: 'step-02', score: 55 },
      post: { stepId: 'step-11', score: 75 },
      delta: 20,
      recoverability: 'complete',
      evidenceQuality: 'rich',
    });
  });

  it('marks unrecoverable legacy state as limited without fabricated question summaries', () => {
    const manifest = readManifest('5-3');
    const resolved = resolveCourseEvidenceSpec({ manifest });
    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('5-3 did not resolve');

    const record = parseCourseReviewPrepostRecord({
      user,
      stateData: {
        kind: 'unit53_student_state',
        version: 1,
        responses: {
          'step-03': {
            stepId: 'step-03',
            submittedAt: 1,
            answers: {},
          },
        },
      },
      manifest,
      spec: resolved.spec,
      submissions: [],
    });

    expect(record).toMatchObject({
      recoverability: 'limited',
      evidenceQuality: 'legacy',
      pre: { stepId: 'step-03', score: null, evidenceQuality: 'legacy' },
      post: { stepId: 'step-14', score: null, evidenceQuality: 'missing' },
      delta: null,
      questionSummaries: [],
    });
  });

  it('excludes initialized student state when no pre/post evidence exists', () => {
    const manifest = readManifest('5-3');
    const resolved = resolveCourseEvidenceSpec({ manifest });
    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('5-3 did not resolve');

    const record = parseCourseReviewPrepostRecord({
      user,
      stateData: {
        kind: 'unit53_student_state',
        version: 1,
        responses: {},
      },
      manifest,
      spec: resolved.spec,
      submissions: [],
    });

    expect(record).toBeNull();
  });

  it('ignores teacher sync state even when durable submissions use matching step ids', () => {
    const manifest = readManifest('5-3');
    const resolved = resolveCourseEvidenceSpec({ manifest });
    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('5-3 did not resolve');

    const record = parseCourseReviewPrepostRecord({
      user,
      stateData: {
        kind: 'teacher_sync_unit53',
        activeStepId: 'step-03',
      },
      lessonKey: 'unit-5-3-mass-coordination-chain-v1',
      manifest,
      spec: resolved.spec,
      submissions: [
        { ...richSubmission('step-03', 40), lessonKey: 'unit-5-3-mass-coordination-chain-v1' },
        { ...richSubmission('step-14', 85), lessonKey: 'unit-5-3-mass-coordination-chain-v1' },
      ],
    });

    expect(record).toBeNull();
  });

  it('infers lesson id from two-digit lesson student state kinds', () => {
    expect(inferCourseReviewLessonIdFromStateData({ kind: 'unit53_student_state' })).toBe('5-3');
    expect(inferCourseReviewLessonIdFromStateData({ kind: 'unit410_student_state' })).toBe('4-10');
  });

  it('infers the cruise comfort lesson id from standard-course state and lesson keys', () => {
    expect(inferCourseReviewLessonIdFromStateData({ kind: 'cruise_student_state' })).toBe('cruise-comfort-boppps');
    expect(inferCourseReviewLessonIdFromLessonKey('cruise-comfort-v1')).toBe('cruise-comfort-boppps');
    expect(inferCourseReviewLessonIdFromLessonKey('unit-5-3-mass-coordination-chain-v1')).toBe('5-3');
  });

  it('derives cruise comfort pre/post delta after inferring the standard-course lesson id', () => {
    const lessonId = inferCourseReviewLessonIdFromStateData({ kind: 'cruise_student_state' });
    expect(lessonId).toBe('cruise-comfort-boppps');
    if (!lessonId) throw new Error('cruise comfort lesson id did not resolve');

    const manifest = readManifest(lessonId);
    const resolved = resolveCourseEvidenceSpec({ manifest });
    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('cruise comfort did not resolve');

    const record = parseCourseReviewPrepostRecord({
      user,
      lessonKey: 'cruise-comfort-v1',
      stateData: {
        kind: 'cruise_student_state',
        version: 1,
        responses: {},
      },
      manifest,
      spec: resolved.spec,
      submissions: [
        { ...richSubmission('precheck', 35), lessonKey: 'cruise-comfort-v1' },
        { ...richSubmission('consistency', 82), lessonKey: 'cruise-comfort-v1' },
      ],
    });

    expect(record).toMatchObject({
      pre: { stepId: 'precheck', score: 35, evidenceQuality: 'rich' },
      post: { stepId: 'consistency', score: 82, evidenceQuality: 'rich' },
      delta: 47,
      recoverability: 'complete',
      evidenceQuality: 'rich',
      stepIds: {
        pre: 'precheck',
        post: 'consistency',
        summary: 'summary',
      },
    });
  });

  it('keeps course_review and showcase_review compatibility tracking paths', () => {
    const courseReview = parseCourseReviewPrepostRecord({
      user,
      stateData: {
        kind: 'course_review',
        tracking: {
          pre: { computational: 20, crossDomain: 30 },
          post: { computational: 70, crossDomain: 80 },
          focusDimensions: ['computational'],
        },
        reinforcementPaths: [{ title: '补强路径', description: '完成针对性练习。', estimatedTime: 10 }],
        recommendedQuestions: [{ stem: '为什么闭环会改变稳态误差？', difficulty: 2, knowledgeTags: ['feedback'] }],
      },
      submissions: [],
    });
    const showcaseReview = parseCourseReviewPrepostRecord({
      user,
      stateData: {
        kind: 'showcase_review',
        tracking: {
          pre: { designTradeoff: 35 },
          post: { designTradeoff: 65 },
        },
      },
      submissions: [],
    });

    expect(courseReview).toMatchObject({
      compatibilityTracking: {
        pre: { computational: 20, crossDomain: 30 },
        post: { computational: 70, crossDomain: 80 },
      },
      recoverability: 'complete',
      evidenceQuality: 'rich',
    });
    expect(showcaseReview).toMatchObject({
      compatibilityKind: 'showcase_review',
      recoverability: 'complete',
      evidenceQuality: 'rich',
    });
  });

  it('infers compatibility weak tag from the post ability vector when no legacy weakTag is stored', () => {
    const record = parseCourseReviewPrepostRecord({
      user,
      stateData: {
        kind: 'course_review',
        tracking: {
          pre: {
            computational: 45,
            crossDomain: 55,
            designTradeoff: 35,
            poleTimeMapping: 50,
            frequencyStability: 60,
          },
          post: {
            computational: 80,
            crossDomain: 65,
            designTradeoff: 10,
            poleTimeMapping: 70,
            frequencyStability: 75,
          },
        },
      },
      submissions: [],
    });

    expect(record?.weakTag).toBe('design-tradeoff');
  });
});
