import { describe, expect, it } from 'vitest';

import { sourceBindingFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import {
  SmartCoursewareError,
  deriveCoursewareModuleMetadata,
  projectCoursewareForStudent,
  projectCoursewareForTeacher,
  validateCoursewareComposition,
} from '../domain';
import type { CoursewareModuleMetadataInput } from '../schema';
import { validCompositionInput, validCoursewareManifest, validPlan } from './fixtures';

describe('smart courseware domain', () => {
  it('accepts a plan-bound shared-runtime composition with exact metadata coverage', () => {
    const result = validateCoursewareComposition(validCompositionInput(), validPlan());
    expect(result.validation).toMatchObject({ valid: true, issues: [] });
  });

  it('rejects plan timing changes and prose-only required activity stages', () => {
    const timing = validCompositionInput();
    timing.runtimeManifest.stages[0].durationSeconds = 301;
    timing.runtimeManifest.stages[0].steps[0].durationSeconds = 301;
    timing.runtimeManifest.durationSeconds = 1_801;
    expect(() => validateCoursewareComposition(timing, validPlan()))
      .toThrowError(expect.objectContaining({ code: 'plan-duration-changed' }));

    const missingActivity = validCompositionInput();
    const module = missingActivity.runtimeManifest.stages[2].steps[0].modules[0];
    Object.assign(module, {
      canonicalClass: 'content.rich',
      payload: { text: '仅有活动建议' },
      roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'none' },
    });
    delete module.responseKind;
    delete module.evidencePath;
    expect(() => validateCoursewareComposition(missingActivity, validPlan()))
      .toThrowError(expect.objectContaining({ code: 'required-activity-missing:pre-assessment' }));
  });

  it('requires one sidecar record for every runtime module', () => {
    const input = validCompositionInput();
    input.moduleMetadata.pop();
    expect(() => validateCoursewareComposition(input, validPlan()))
      .toThrowError(expect.objectContaining({ code: 'module-metadata-coverage-invalid' }));
  });

  it('requires response-kind-specific teacher evidence for objective and open activities', () => {
    const objective = validCompositionInput();
    delete objective.moduleMetadata[2].teacherFields.scoring;
    expect(() => validateCoursewareComposition(objective, validPlan()))
      .toThrowError(expect.objectContaining({ code: 'objective-activity-teacher-evidence-required:module-3' }));

    const open = validCompositionInput();
    const openModule = open.runtimeManifest.stages[2].steps[0].modules[0];
    openModule.responseKind = 'text.long';
    openModule.payload = { prompt: '请说明判断过程。' };
    const openMetadata = open.moduleMetadata[2] as CoursewareModuleMetadataInput;
    openMetadata.teacherFields = { expectedOutput: '说明特征根均位于左半平面。', reviewPoints: ['结论', '理由'] };
    expect(() => validateCoursewareComposition(open, validPlan())).not.toThrow();
    delete openMetadata.teacherFields.reviewPoints;
    expect(() => validateCoursewareComposition(open, validPlan()))
      .toThrowError(expect.objectContaining({ code: 'open-activity-teacher-evidence-required:module-3' }));
  });

  it.each([
    ['choice.single', { prompt: '单选', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }, 'a'],
    ['choice.multi', { prompt: '多选', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }, 'a,b'],
    ['ordering.sequence', { prompt: '排序', items: ['第一步', '第二步'] }, '第一步|第二步'],
    ['matching.pairs', {
      prompt: '匹配',
      left: [{ value: 'l1', label: '左一' }, { value: 'l2', label: '左二' }],
      right: [{ value: 'r1', label: '右一' }, { value: 'r2', label: '右二' }],
    }, 'l1:r1|l2:r2'],
  ] as const)('normalizes bounded string referenceAnswer for objective kind %s', (responseKind, payload, answer) => {
    const input = validCompositionInput();
    const module = input.runtimeManifest.stages[2].steps[0].modules[0];
    module.responseKind = responseKind;
    module.payload = payload;
    input.moduleMetadata[2].teacherFields.referenceAnswer = `  ${answer}  `;

    const result = validateCoursewareComposition(input, validPlan());
    expect(result.moduleMetadata[2].teacherFields.referenceAnswer).toBe(answer);
  });

  it.each([
    ['null', null],
    ['blank', '   '],
    ['object', { answer: 'a' }],
    ['array', ['a']],
    ['over-limit', 'a'.repeat(5_001)],
  ])('rejects invalid objective referenceAnswer: %s', (_label, invalid) => {
    const input = validCompositionInput();
    const teacherFields = input.moduleMetadata[2].teacherFields as Record<string, unknown>;
    teacherFields.referenceAnswer = invalid;
    expect(() => validateCoursewareComposition(input, validPlan())).toThrow();
  });

  it.each([
    ['choice.single not an option', 'choice.single', {
      prompt: '单选', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    }, 'not-an-option'],
    ['choice.multi partially invalid', 'choice.multi', {
      prompt: '多选', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    }, 'a,not-an-option'],
    ['ordering incomplete', 'ordering.sequence', {
      prompt: '排序', items: ['第一步', '第二步'],
    }, '第一步'],
    ['ordering malformed order', 'ordering.sequence', {
      prompt: '排序', items: ['第一步', '第二步'],
    }, '第二步|第一步'],
    ['matching incomplete', 'matching.pairs', {
      prompt: '匹配',
      left: [{ value: 'l1', label: '左一' }, { value: 'l2', label: '左二' }],
      right: [{ value: 'r1', label: '右一' }, { value: 'r2', label: '右二' }],
    }, 'l1:r1'],
    ['matching malformed target', 'matching.pairs', {
      prompt: '匹配',
      left: [{ value: 'l1', label: '左一' }, { value: 'l2', label: '左二' }],
      right: [{ value: 'r1', label: '右一' }, { value: 'r2', label: '右二' }],
    }, 'l1:r1|l2:not-an-option'],
  ] as const)('rejects semantically invalid objective reference: %s', (_label, responseKind, payload, referenceAnswer) => {
    const input = validCompositionInput();
    const module = input.runtimeManifest.stages[2].steps[0].modules[0];
    module.responseKind = responseKind;
    module.payload = payload;
    input.moduleMetadata[2].teacherFields.referenceAnswer = referenceAnswer;
    expect(() => validateCoursewareComposition(input, validPlan()))
      .toThrowError(expect.objectContaining({ code: 'objective-reference-invalid:module-3' }));
  });

  it('keeps pending gap identity stable until a defining field changes', () => {
    const runtimeModule = validCoursewareManifest().stages[0].steps[0].modules[0];
    const requested = {
      moduleId: runtimeModule.id,
      sourceState: 'ai_generated_source_pending' as const,
      sourceBindings: [],
      teacherFields: {},
    };
    const first = deriveCoursewareModuleMetadata({
      authoringLineageRoot: 'lineage-1', runtimeModule, requested, allowedSourceBindings: [],
    });
    const same = deriveCoursewareModuleMetadata({
      authoringLineageRoot: 'lineage-1', runtimeModule, requested, allowedSourceBindings: [],
      existing: {
        moduleInstanceLineage: first.moduleInstanceLineage,
        contentHash: first.moduleContentHash,
        sourceState: 'AI_GENERATED_SOURCE_PENDING',
        sourceBindingSetHash: first.sourceBindingSetHash,
        gapIdentity: first.gapIdentity,
        provenance: 'TEACHER_CREATED',
        originalAttemptId: null,
      },
    });
    expect(same.gapIdentity).toBe(first.gapIdentity);

    runtimeModule.payload = { text: 'Teacher changed content' };
    const changed = deriveCoursewareModuleMetadata({
      authoringLineageRoot: 'lineage-1', runtimeModule, requested, allowedSourceBindings: [],
      existing: {
        moduleInstanceLineage: first.moduleInstanceLineage,
        contentHash: first.moduleContentHash,
        sourceState: 'AI_GENERATED_SOURCE_PENDING',
        sourceBindingSetHash: first.sourceBindingSetHash,
        gapIdentity: first.gapIdentity,
        provenance: 'AI_GENERATED',
        originalAttemptId: 'attempt-1',
      },
    });
    expect(changed.gapIdentity).not.toBe(first.gapIdentity);
    expect(changed.provenance).toBe('ai_generated_teacher_edited');
    expect(changed.originalAttemptId).toBe('attempt-1');
  });

  it('rejects verified bindings outside the approved plan', () => {
    const runtimeModule = validCoursewareManifest().stages[0].steps[0].modules[0];
    expect(() => deriveCoursewareModuleMetadata({
      authoringLineageRoot: 'lineage-1',
      runtimeModule,
      requested: { moduleId: runtimeModule.id, sourceState: 'verified', sourceBindings: [sourceBindingFixture], teacherFields: {} },
      allowedSourceBindings: [],
    })).toThrowError(expect.objectContaining({ code: 'source-binding-not-in-approved-plan' }));
  });

  it('marks AI output teacher-edited when only auditable sidecar fields change', () => {
    const runtimeModule = validCoursewareManifest().stages[2].steps[0].modules[0];
    const first = deriveCoursewareModuleMetadata({
      authoringLineageRoot: 'lineage-1',
      runtimeModule,
      requested: {
        moduleId: runtimeModule.id,
        sourceState: 'verified',
        sourceBindings: [sourceBindingFixture],
        teacherFields: { referenceAnswer: 'a', explanation: '原解释', scoring: { maxPoints: 1 } },
      },
      allowedSourceBindings: [sourceBindingFixture],
      newProvenance: 'ai_generated',
      originalAttemptId: 'attempt-1',
    });
    const changed = deriveCoursewareModuleMetadata({
      authoringLineageRoot: 'lineage-1',
      runtimeModule,
      requested: {
        moduleId: runtimeModule.id,
        sourceState: 'verified',
        sourceBindings: [sourceBindingFixture],
        teacherFields: { referenceAnswer: 'a', explanation: '教师修订解释', scoring: { maxPoints: 1 } },
      },
      allowedSourceBindings: [sourceBindingFixture],
      existing: {
        moduleInstanceLineage: first.moduleInstanceLineage,
        contentHash: first.moduleContentHash,
        sourceState: 'VERIFIED',
        sourceBindingSetHash: first.sourceBindingSetHash,
        gapIdentity: first.gapIdentity,
        provenance: 'AI_GENERATED',
        originalAttemptId: 'attempt-1',
        teacherMetadata: first.teacherFields,
      },
    });
    expect(changed.moduleContentHash).toBe(first.moduleContentHash);
    expect(changed.provenance).toBe('ai_generated_teacher_edited');
    expect(changed.originalAttemptId).toBe('attempt-1');
  });

  it('never serializes the teacher sidecar into the student projection', () => {
    const composition = validCompositionInput();
    const validated = validateCoursewareComposition(composition, validPlan());
    const moduleMetadata = validated.moduleMetadata.map((requested, index) => deriveCoursewareModuleMetadata({
      authoringLineageRoot: 'lineage-1',
      runtimeModule: validated.runtimeManifest.stages[index].steps[0].modules[0],
      requested,
      allowedSourceBindings: [sourceBindingFixture],
    }));
    const teacher = projectCoursewareForTeacher({
      draftId: 'draft-1', version: 2, planRevisionId: 'plan-1', planContentHash: 'hash',
      runtimeManifest: validated.runtimeManifest, moduleMetadata,
      planLimitations: ['教师限制'],
      aiReview: { findings: [], suggestions: [] },
      generationAudit: [],
    });
    const student = projectCoursewareForStudent({ draftId: 'draft-1', version: 2, runtimeManifest: validated.runtimeManifest });
    expect(JSON.stringify(teacher)).toContain('教师专用解释');
    expect(JSON.stringify(student)).not.toContain('教师专用解释');
    expect(JSON.stringify(student)).not.toContain('referenceAnswer');
  });
});
