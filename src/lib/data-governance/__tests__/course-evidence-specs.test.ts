import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getCourseEvidenceSummaryStepId,
  listCourseEvidenceObjectiveStepIds,
  listCourseEvidenceParameterStepIds,
  listCourseEvidenceResponseStepIds,
  resolveCourseEvidenceSpec,
} from '../course-evidence-specs';
import {
  type InteractiveRuntimeManifest,
  normalizeInteractiveRuntimeManifest,
} from '../../interactive-lesson-manifest';

const repoRoot = process.cwd();

function readManifest(lessonId: string): InteractiveRuntimeManifest {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, 'course-content/runtime/lessons', lessonId, 'interactive-manifest.json'), 'utf8'),
  );
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  if (!manifest) throw new Error(`${lessonId} interactive manifest is invalid`);
  return manifest;
}

describe('course evidence specs', () => {
  it('resolves module 5 evidence mappings from centralized overrides', () => {
    const expected = {
      '5-3': {
        lessonKey: 'unit-5-3-mass-coordination-chain-v1',
        studentStateKind: 'unit53_student_state',
        teacherSyncKind: 'teacher_sync_unit53',
        preAssessmentStepId: 'step-03',
        postAssessmentStepId: 'step-14',
        summaryStepId: 'step-15',
      },
      '5-4': {
        lessonKey: 'unit-5-4-data-driven-mpc-transition-v1',
        studentStateKind: 'unit54_student_state',
        teacherSyncKind: 'teacher_sync_unit54',
        preAssessmentStepId: 'step-03',
        postAssessmentStepId: 'step-16',
        summaryStepId: 'step-17',
      },
      '5-5': {
        lessonKey: 'unit-5-5-policy-learning-entry-risk-v1',
        studentStateKind: 'unit55_student_state',
        teacherSyncKind: 'teacher_sync_unit55',
        preAssessmentStepId: 'step-03',
        postAssessmentStepId: 'step-16',
        summaryStepId: 'step-17',
      },
      '5-6': {
        lessonKey: 'unit-5-6-method-comparison-cold-chain-v1',
        studentStateKind: 'unit56_student_state',
        teacherSyncKind: 'teacher_sync_unit56',
        preAssessmentStepId: 'step-03',
        postAssessmentStepId: 'step-17',
        summaryStepId: 'step-18',
      },
    } as const;

    for (const [lessonId, mapping] of Object.entries(expected)) {
      const resolved = resolveCourseEvidenceSpec({ manifest: readManifest(lessonId) });

      expect(resolved.status, lessonId).toBe('supported');
      if (resolved.status !== 'supported') throw new Error(`${lessonId} did not resolve`);
      expect(resolved.spec).toMatchObject({
        lessonId,
        ...mapping,
      });
      expect(listCourseEvidenceResponseStepIds(resolved.spec)).toEqual(
        expect.arrayContaining([mapping.preAssessmentStepId, mapping.postAssessmentStepId]),
      );
      expect(listCourseEvidenceObjectiveStepIds(resolved.spec)).toEqual(
        expect.arrayContaining([mapping.preAssessmentStepId, mapping.postAssessmentStepId]),
      );
      expect(getCourseEvidenceSummaryStepId(resolved.spec)).toBe(mapping.summaryStepId);
    }
  });

  it('exposes parameter evidence helpers for investigated module 5 fixtures', () => {
    const resolved = resolveCourseEvidenceSpec({ manifest: readManifest('5-3') });

    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('5-3 did not resolve');
    expect(listCourseEvidenceParameterStepIds(resolved.spec)).toEqual(['step-11']);
    expect(resolved.spec.parameterEvidenceKeys).toEqual(
      expect.arrayContaining([
        'R_m',
        'max_delta_deg',
        'delta_d_deg',
        'saturation_active',
        'safety_constraint_satisfied',
        'chain_judgment',
      ]),
    );
  });

  it('infers a non-module-5 manifest when no override is registered', () => {
    const resolved = resolveCourseEvidenceSpec({ manifest: readManifest('4-7') });

    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('4-7 did not resolve');
    expect(resolved.spec).toMatchObject({
      lessonId: '4-7',
      lessonKey: 'unit-4-7-destroyer-hifi-design-closure-v1',
      routeSegment: 'unit-4-7-destroyer-hifi-design-closure',
      studentStateKind: 'unit47_student_state',
      teacherSyncKind: 'teacher_sync_unit47',
      preAssessmentStepId: 'step-02',
      postAssessmentStepId: 'step-11',
      summaryStepId: 'step-12',
    });
    expect(listCourseEvidenceObjectiveStepIds(resolved.spec)).toEqual(
      expect.arrayContaining(['step-02', 'step-11']),
    );
  });

  it('does not treat teacher reveal pages as response-producing evidence steps', () => {
    const resolved = resolveCourseEvidenceSpec({ manifest: readManifest('4-7') });

    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('4-7 did not resolve');
    expect(listCourseEvidenceResponseStepIds(resolved.spec)).toEqual(
      expect.arrayContaining(['step-02', 'step-04', 'step-11']),
    );
    expect(listCourseEvidenceResponseStepIds(resolved.spec)).not.toEqual(
      expect.arrayContaining(['step-03', 'step-05', 'step-06', 'step-08']),
    );
  });

  it('resolves override-backed specs when manifests are not loaded yet', () => {
    const resolved = resolveCourseEvidenceSpec({ lessonId: '5-3' });

    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('5-3 override did not resolve');
    expect(resolved.spec).toMatchObject({
      lessonId: '5-3',
      lessonKey: 'unit-5-3-mass-coordination-chain-v1',
      routeSegment: 'unit-5-3-mass-coordination-chain',
      studentStateKind: 'unit53_student_state',
      teacherSyncKind: 'teacher_sync_unit53',
      source: 'override',
    });
    expect(listCourseEvidenceResponseStepIds(resolved.spec)).toEqual(['step-03', 'step-14']);
    expect(listCourseEvidenceObjectiveStepIds(resolved.spec)).toEqual(['step-03', 'step-14']);
    expect(listCourseEvidenceParameterStepIds(resolved.spec)).toEqual([]);
  });

  it('does not match override optional keys when both sides are absent', () => {
    const resolved = resolveCourseEvidenceSpec({
      lessonId: 'target',
      overrides: [
        {
          lessonId: 'other',
          studentStateKind: 'other_student_state',
          teacherSyncKind: 'teacher_sync_other',
          preAssessmentStepId: 'wrong-pre',
          postAssessmentStepId: 'wrong-post',
        },
        {
          lessonId: 'target',
          lessonKey: 'target-key',
          routeSegment: 'target-route',
          studentStateKind: 'target_student_state',
          teacherSyncKind: 'teacher_sync_target',
          preAssessmentStepId: 'target-pre',
          postAssessmentStepId: 'target-post',
        },
      ],
    });

    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('target override did not resolve');
    expect(resolved.spec).toMatchObject({
      lessonId: 'target',
      lessonKey: 'target-key',
      routeSegment: 'target-route',
      studentStateKind: 'target_student_state',
      teacherSyncKind: 'teacher_sync_target',
    });
    expect(listCourseEvidenceResponseStepIds(resolved.spec)).toEqual(['target-pre', 'target-post']);
  });

  it('does not select overrides from inconsistent identifiers', () => {
    const resolved = resolveCourseEvidenceSpec({
      lessonId: '5-3',
      routeSegment: 'unit-5-4-data-driven-mpc-transition',
    });

    expect(resolved).toEqual({
      status: 'unsupported',
      lessonId: '5-3',
      routeSegment: 'unit-5-4-data-driven-mpc-transition',
      reason: 'missing_manifest_metadata',
    });
  });

  it('collects parameter evidence keys from activity card parameter fields', () => {
    const manifest = normalizeInteractiveRuntimeManifest({
      lesson_id: '9-1',
      course_route_segment: 'unit-9-1-parameter-fields',
      steps: {
        'step-01': {
          title: '参数提交',
          interaction_spec: {
            interaction_kind: 'activity_card_set',
            activity_cards: [
              {
                id: 'parameter-card',
                prompt: '提交参数。',
                response_kind: 'parameter_set',
                submit_scope: 'per_card',
                parameter_fields: [
                  { key: 'gain', label: '增益' },
                  { key: 'time_constant', label: '时间常数', unit: 's' },
                ],
              },
            ],
          },
        },
      },
    });

    expect(manifest).not.toBeNull();
    const resolved = resolveCourseEvidenceSpec({ manifest });

    expect(resolved.status).toBe('supported');
    if (resolved.status !== 'supported') throw new Error('parameter fields manifest did not resolve');
    expect(listCourseEvidenceParameterStepIds(resolved.spec)).toEqual(['step-01']);
    expect(resolved.spec.parameterEvidenceKeys).toEqual(['gain', 'time_constant']);
  });

  it('classifies missing manifest metadata explicitly', () => {
    const resolved = resolveCourseEvidenceSpec({ lessonId: 'legacy-fixture' });

    expect(resolved).toEqual({
      status: 'unsupported',
      lessonId: 'legacy-fixture',
      reason: 'missing_manifest_metadata',
    });
  });
});
