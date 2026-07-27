import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  createSmartCoursewareStudentPreviewFromService,
  createSmartCoursewareTeacherEnvelopeFromProjection,
  defaultTeacherFieldsForActivity,
  StudentCoursewarePreview,
  SmartCoursewareEditor,
  SmartCoursewareProjectionEditor,
  splitCoursewareStep,
  mergeAndDeleteCoursewareStep,
  TeacherCoursewarePreview,
  teacherFieldsForResponseKind,
  type SmartCoursewareTeacherEnvelope,
} from '@/features/teacher/smart-courseware-editor';
import {
  BOPPPS_STAGES,
  GENERATED_SLIDE_SCHEMA_VERSION,
  type GeneratedSlideManifest,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { projectCoursewareForStudent } from '@/lib/smart-courseware';
import { validateCoursewareComposition } from '@/lib/smart-courseware';
import { validCompositionInput, validPlan } from '@/lib/smart-courseware/__tests__/fixtures';

const orderingPermutationSecret = 'smart-courseware-ordering-ui-test-secret-v1';

const manifest: GeneratedSlideManifest = {
  schemaVersion: GENERATED_SLIDE_SCHEMA_VERSION,
  lessonId: 'courseware-editor-test',
  title: '角色预览测试',
  durationSeconds: 360,
  stages: BOPPPS_STAGES.map((stage, index) => ({
    stage,
    durationSeconds: 60,
    steps: [{
      id: `step-${index + 1}`,
      title: `步骤 ${index + 1}`,
      durationSeconds: 60,
      layoutId: index === 0 ? 'two-column' : 'single',
      modules: [{
        id: `module-${index + 1}`,
        canonicalClass: 'content.rich',
        slotId: index === 0 ? 'left' : 'main',
        sizeId: index === 0 ? 'half' : 'full',
        payload: { text: `学生内容 ${index + 1}` },
        roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'none' },
      }, ...(index === 0 ? [{
        id: 'teacher-only-module',
        canonicalClass: 'content.code' as const,
        slotId: 'right',
        sizeId: 'half',
        payload: { language: 'text', code: 'TEACHER_MANIFEST_SECRET' },
        roleMetadata: { studentVisible: false, teacherVisible: true as const, referenceAnswerVisibility: 'none' as const },
      }] : [])],
    }],
  })),
};

const teacherEnvelope: SmartCoursewareTeacherEnvelope & { manifest: GeneratedSlideManifest } = {
  draftId: 'draft-1',
  planRevisionId: 'revision-1',
  state: 'ready',
  version: 2,
  manifest,
  stalePlan: false,
  planLimitations: ['PRIVATE_PLAN_LIMITATION'],
  aiReview: {
    findings: [{ category: 'CONTENT_QUALITY', severity: 'WARNING', message: 'PRIVATE_AI_FINDING', path: null }],
    suggestions: ['PRIVATE_AI_SUGGESTION'],
  },
  generationAudit: [{
    jobId: 'job-1', mode: 'INITIAL', state: 'COMPLETED',
    attempts: [
      { attemptId: 'attempt-unit-1', attemptNumber: 1, serviceId: 'PRIVATE_SERVICE', providerKind: 'PRIVATE_PROVIDER', model: 'PRIVATE_MODEL', outcome: 'SUCCEEDED' },
      { attemptId: 'attempt-unit-2', attemptNumber: 1, serviceId: 'PRIVATE_SERVICE_2', providerKind: 'PRIVATE_PROVIDER', model: 'PRIVATE_MODEL', outcome: 'SUCCEEDED' },
    ],
  }],
  compositionMetadata: [],
  teacherModules: {
    'module-1': {
      moduleId: 'module-1',
      correctAnswer: 'PRIVATE_CORRECT_ANSWER',
      explanation: 'PRIVATE_EXPLANATION',
      reviewPoints: ['PRIVATE_REVIEW_POINT'],
      sourceState: 'verified',
      citationTitles: ['教师引用审计'],
      provenance: 'ai-generated',
      validationNotes: ['PRIVATE_VALIDATION_NOTE'],
    },
  },
};

describe('smart courseware role previews', () => {
  it('renders teacher metadata only in the teacher preview', () => {
    const html = renderToStaticMarkup(<TeacherCoursewarePreview envelope={teacherEnvelope} />);
    expect(html).toContain('PRIVATE_CORRECT_ANSWER');
    expect(html).toContain('PRIVATE_REVIEW_POINT');
    expect(html).toContain('TEACHER_MANIFEST_SECRET');
    expect(html).toContain('PRIVATE_PROVIDER');
    expect(html).toContain('PRIVATE_MODEL');
    expect(html).toContain('PRIVATE_PLAN_LIMITATION');
    expect(html).toContain('PRIVATE_AI_FINDING');
    expect(html).toContain('PRIVATE_VALIDATION_NOTE');
    expect(html).toContain('data-courseware-preview="teacher"');
    expect(html).toContain('data-generation-attempt-id="attempt-unit-1"');
    expect(html).toContain('data-generation-attempt-id="attempt-unit-2"');
    expect(html.match(/data-generation-attempt-id=/g)).toHaveLength(2);
  });

  it('projects a student envelope that cannot carry teacher metadata', () => {
    const receipt = projectCoursewareForStudent({
      draftId: 'draft-1', version: 2, runtimeManifest: manifest, orderingPermutationSecret,
    });
    const preview = createSmartCoursewareStudentPreviewFromService(teacherEnvelope, receipt);
    expect(preview).not.toBeNull();
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toContain('teacherModules');
    expect(serialized).not.toContain('PRIVATE_');
    expect(serialized).not.toContain('generationAudit');
    expect(serialized).not.toContain('TEACHER_MANIFEST_SECRET');
    expect(preview!.manifest).toEqual(receipt.runtimeManifest);

    const html = renderToStaticMarkup(<StudentCoursewarePreview preview={preview!} />);
    expect(html).toContain('data-courseware-preview="student"');
    expect(html).toContain('AI 辅助生成');
    expect(html).not.toContain('PRIVATE_');
    expect(html).not.toContain('TEACHER_MANIFEST_SECRET');
    expect(html).toContain(preview!.sourceContentHash);
  });

  it('renders ordering controls from the stable scrambled student adapter projection', () => {
    const composition = validCompositionInput();
    const ordering = composition.runtimeManifest.stages[2].steps[0].modules[0];
    ordering.responseKind = 'ordering.sequence';
    ordering.payload = { prompt: '请排序', items: ['ORDER_FIRST', 'ORDER_SECOND', 'ORDER_THIRD'] };
    const first = projectCoursewareForStudent({
      draftId: 'draft-1', version: 2, runtimeManifest: composition.runtimeManifest, orderingPermutationSecret,
    });
    const second = projectCoursewareForStudent({
      draftId: 'draft-1', version: 2, runtimeManifest: composition.runtimeManifest, orderingPermutationSecret,
    });
    const preview = createSmartCoursewareStudentPreviewFromService(teacherEnvelope, first)!;
    const card = preview.manifest.steps.flatMap((step) => step.interactionSpec.activityCards ?? [])
      .find((candidate) => candidate.id === ordering.id)!;

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(card.options.map((option) => option.value)).not.toEqual(['ORDER_FIRST', 'ORDER_SECOND', 'ORDER_THIRD']);
    const html = renderToStaticMarkup(<StudentCoursewarePreview preview={preview} />);
    const projectedOrder = card.options.map((option) => html.indexOf(option.label));
    expect(projectedOrder).toEqual([...projectedOrder].sort((left, right) => left - right));
    expect(html).not.toContain('referenceAnswer');
  });

  it('maps the service teacher projection and requires a matching student receipt', () => {
    const envelope = createSmartCoursewareTeacherEnvelopeFromProjection({
      draftId: 'draft-1',
      version: 2,
      planRevisionId: 'revision-1',
      runtimeManifest: manifest,
      moduleMetadata: [{
        moduleId: 'module-1',
        sourceState: 'verified',
        sourceBindings: [{ citationId: 'citation-1' }],
        provenance: 'ai_generated_teacher_edited',
        teacherFields: { referenceAnswer: { value: 'PRIVATE_OBJECT_ANSWER' }, reviewPoints: ['检查极点'] },
      }],
      validation: { issues: [{ message: '教师校验备注' }] },
      planLimitations: ['待核对课堂设备'],
      aiReview: { findings: [], suggestions: ['补充形成性评价'] },
      generationAudit: [{
        jobId: 'job-1', mode: 'INITIAL', state: 'COMPLETED',
        attempts: [{ attemptId: 'attempt-1', attemptNumber: 1, serviceId: 'service-1', providerKind: 'openai-compatible', model: 'model-1', outcome: 'SUCCEEDED' }],
      }],
    });
    expect(envelope.teacherModules['module-1']).toMatchObject({
      correctAnswer: '{"value":"PRIVATE_OBJECT_ANSWER"}',
      citationTitles: ['citation-1'],
      provenance: 'ai-generated-teacher-edited',
    });
    expect(envelope.planLimitations).toEqual(['待核对课堂设备']);
    expect(envelope.generationAudit[0].attempts[0].model).toBe('model-1');
    expect(createSmartCoursewareStudentPreviewFromService(envelope, {
      draftId: 'other-draft', version: 2, runtimeManifest: {}, notice: 'ai-assisted-teacher-reviewed',
    })).toBeNull();
    expect(createSmartCoursewareStudentPreviewFromService(envelope, {
      draftId: 'draft-1', version: 2, runtimeManifest: {}, notice: 'ai-assisted-teacher-reviewed',
    })).toBeNull();
    expect(createSmartCoursewareStudentPreviewFromService(envelope, projectCoursewareForStudent({
      draftId: 'draft-1', version: 2, runtimeManifest: manifest, orderingPermutationSecret,
    }))).not.toBeNull();
  });

  it('renders stale-plan and whole-course approval controls without clearing pending gaps', () => {
    const html = renderToStaticMarkup(<SmartCoursewareEditor initialEnvelope={{
      ...teacherEnvelope,
      stalePlan: true,
      teacherModules: {
        ...teacherEnvelope.teacherModules,
        'module-pending': {
          moduleId: 'module-pending', sourceState: 'teacher_created_source_pending', citationTitles: [],
          provenance: 'teacher-created', validationNotes: [],
        },
      },
    }} />);
    expect(html).toContain('关联教案已有更新');
    expect(html).toContain('批准整课版本');
    expect(html).toContain('来源待补项保留在版本快照中');
    expect(html).not.toContain('acknowledgement');
  });

  it('keeps teacher editing available when the student projection is unavailable', () => {
    const html = renderToStaticMarkup(<SmartCoursewareProjectionEditor
      teacherProjection={{
        draftId: teacherEnvelope.draftId, version: teacherEnvelope.version,
        planRevisionId: teacherEnvelope.planRevisionId!, runtimeManifest: teacherEnvelope.manifest!,
        moduleMetadata: [], planLimitations: [], aiReview: null, generationAudit: [], validation: { issues: [] },
      }}
      studentProjection={null}
      state="ready"
      stalePlan={false}
    />);
    expect(html).toContain('教师预览');
    expect(html).toContain('学生预览暂不可用');
    expect(html).toContain('学生预览</button>');
  });

  it('preserves stale-plan state when rebuilding an envelope after save', () => {
    const projection = {
      schemaVersion: 'smart-courseware-authoring.v1' as const,
      draftId: teacherEnvelope.draftId,
      version: teacherEnvelope.version,
      planRevisionId: teacherEnvelope.planRevisionId!,
      planContentHash: 'plan-hash',
      runtimeManifest: teacherEnvelope.manifest!,
      moduleMetadata: [], planLimitations: [], aiReview: null, generationAudit: [], validation: { issues: [] },
    };
    expect(createSmartCoursewareTeacherEnvelopeFromProjection(projection, true).stalePlan).toBe(true);
  });

  it('disables a new start for a FAILED job and exposes recovery controls', () => {
    const html = renderToStaticMarkup(<SmartCoursewareEditor
      initialEnvelope={{ ...teacherEnvelope, state: 'waiting-for-generation', manifest: null }}
      initialJob={{ id: 'job-failed', draftId: teacherEnvelope.draftId, state: 'FAILED', firstIncompleteUnitKey: 'bridge-in' }}
    />);
    expect(html).toContain('开始生成课件</button>');
    expect(html).toContain('disabled=""');
    expect(html).toContain('重试');
    expect(html).toContain('恢复');
    expect(html).toContain('取消');
  });

  it('renders ACCEPTED courseware as preview-only while retaining teacher audit evidence', () => {
    const html = renderToStaticMarkup(<SmartCoursewareEditor
      initialEnvelope={{ ...teacherEnvelope, state: 'accepted' }}
      initialJob={{
        id: 'job-candidate', draftId: teacherEnvelope.draftId, state: 'COMPLETED', mode: 'MODULE',
        targetModuleId: 'module-1', targetModuleHash: 'hash-1', candidateRuntimeModule: { id: 'candidate' },
      }}
    />);
    expect(html).toContain('data-courseware-read-only');
    expect(html).toContain('PRIVATE_CORRECT_ANSWER');
    expect(html).toContain('PRIVATE_PROVIDER');
    expect(html).not.toContain('data-courseware-composition-controls');
    expect(html).not.toContain('重新生成所选模块');
    expect(html).not.toContain('接受候选模块');
    expect(html).not.toContain('刷新状态');
    expect(html).not.toContain('编辑活动');
  });

  it('splits a step without changing total durations and creates non-empty new module instances', () => {
    const composition = validCompositionInput();
    const splittableManifest = composition.runtimeManifest;
    const beforeStageDuration = splittableManifest.stages[0].durationSeconds;
    const result = splitCoursewareStep({
      manifest: splittableManifest,
      moduleMetadata: composition.moduleMetadata,
      stepId: 'step-1',
      newStepId: 'step-split',
      newModuleIds: ['module-split-1'],
    });
    expect(result).not.toBeNull();
    expect(result!.manifest.durationSeconds).toBe(splittableManifest.durationSeconds);
    expect(result!.manifest.stages[0].durationSeconds).toBe(beforeStageDuration);
    const steps = result!.manifest.stages[0].steps;
    expect(steps.map((step) => step.durationSeconds).reduce((sum, value) => sum + value, 0)).toBe(beforeStageDuration);
    expect(steps[1].modules).toHaveLength(1);
    expect(steps[1].modules.map((module) => module.id)).toEqual(['module-split-1']);
    expect(result!.moduleMetadata.slice(-1)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        moduleId: 'module-split-1',
        copiedFromModuleId: 'module-1',
        sourceState: composition.moduleMetadata[0].sourceState,
        sourceBindings: composition.moduleMetadata[0].sourceBindings,
      }),
    ]));
    expect(validateCoursewareComposition({
      expectedVersion: 1, runtimeManifest: result!.manifest, moduleMetadata: result!.moduleMetadata,
    }, validPlan()).validation.valid).toBe(true);
  });

  it('fails closed when a step is too short or lacks metadata coverage', () => {
    const short = { ...manifest, stages: manifest.stages.map((stage, index) => index === 0
      ? { ...stage, steps: stage.steps.map((step) => ({ ...step, durationSeconds: 119 })) }
      : stage) };
    expect(splitCoursewareStep({ manifest: short, moduleMetadata: [], stepId: 'step-1', newStepId: 'step-split', newModuleIds: ['one', 'two'] })).toBeNull();
    expect(splitCoursewareStep({ manifest, moduleMetadata: [], stepId: 'step-1', newStepId: 'step-split', newModuleIds: ['one', 'two'] })).toBeNull();
  });

  it('merges a deleted step duration into its adjacent survivor without changing course totals', () => {
    const composition = validCompositionInput();
    const split = splitCoursewareStep({
      manifest: composition.runtimeManifest,
      moduleMetadata: composition.moduleMetadata,
      stepId: 'step-1',
      newStepId: 'step-split-delete',
      newModuleIds: ['module-split-delete'],
    })!;
    const merged = mergeAndDeleteCoursewareStep({
      manifest: split.manifest,
      moduleMetadata: split.moduleMetadata,
      stepId: 'step-split-delete',
    });
    expect(merged).not.toBeNull();
    expect(merged!.manifest.durationSeconds).toBe(composition.runtimeManifest.durationSeconds);
    expect(merged!.manifest.stages[0].durationSeconds).toBe(composition.runtimeManifest.stages[0].durationSeconds);
    expect(merged!.manifest.stages[0].steps).toHaveLength(1);
    expect(merged!.manifest.stages[0].steps[0].durationSeconds).toBe(300);
    expect(merged!.moduleMetadata.some((metadata) => metadata.moduleId === 'module-split-delete')).toBe(false);
    expect(validateCoursewareComposition({
      expectedVersion: 1, runtimeManifest: merged!.manifest, moduleMetadata: merged!.moduleMetadata,
    }, validPlan()).validation.valid).toBe(true);
  });

  it('fails closed when merge-delete has no adjacent step', () => {
    const composition = validCompositionInput();
    expect(mergeAndDeleteCoursewareStep({
      manifest: composition.runtimeManifest, moduleMetadata: composition.moduleMetadata, stepId: 'step-1',
    })).toBeNull();
  });

  it('builds server-valid teacher evidence from each activity response contract', () => {
    const composition = validCompositionInput();
    const activity = composition.runtimeManifest.stages[2].steps[0].modules[0];
    const teacherFields = defaultTeacherFieldsForActivity(activity);
    expect(teacherFields).toMatchObject({
      referenceAnswer: 'a',
      explanation: expect.any(String),
      scoring: expect.objectContaining({ maxPoints: 1 }),
    });
    expect(validateCoursewareComposition({
      ...composition,
      moduleMetadata: composition.moduleMetadata.map((metadata, index) => (
        index === 2 ? {
          ...metadata,
          teacherFields: { ...teacherFields, inclusionRationale: metadata.teacherFields.inclusionRationale },
        } : metadata
      )),
    }, validPlan()).validation.valid).toBe(true);
  });

  it('rejects an edited ordering activity with normalized duplicate items', () => {
    const composition = validCompositionInput();
    const activity = composition.runtimeManifest.stages[2].steps[0].modules[0];
    activity.responseKind = 'ordering.sequence';
    activity.payload = { prompt: '排序', items: ['Step A', ' step a '] };
    composition.moduleMetadata[2].teacherFields = {
      referenceAnswer: 'Step A|step a', explanation: '按顺序评分。', scoring: { strategy: 'exact-order', maxPoints: 1 },
      inclusionRationale: '该来源支撑步骤顺序。',
    };

    expect(() => validateCoursewareComposition(composition, validPlan())).toThrowError(expect.objectContaining({
      code: 'runtime-manifest-invalid:module.payload-invalid',
    }));
  });

  it('clears incompatible teacher evidence when switching objective and open response kinds', () => {
    expect(teacherFieldsForResponseKind('text.long', {
      referenceAnswer: 'a', explanation: '旧解释', scoring: { maxPoints: 1 },
      expectedOutput: '开放作答', reviewPoints: ['理由'], inclusionRationale: '覆盖目标',
    })).toEqual({ expectedOutput: '开放作答', reviewPoints: ['理由'], inclusionRationale: '覆盖目标' });
    expect(teacherFieldsForResponseKind('choice.single', {
      referenceAnswer: 'a', explanation: '新解释', scoring: { maxPoints: 1 },
      expectedOutput: '旧开放作答', reviewPoints: ['旧标准'], inclusionRationale: '覆盖目标',
    })).toEqual({
      referenceAnswer: 'a', explanation: '新解释', scoring: { maxPoints: 1 }, inclusionRationale: '覆盖目标',
    });
  });
});
