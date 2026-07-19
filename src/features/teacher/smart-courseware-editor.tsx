'use client';

import { useMemo, useState, type ReactNode } from 'react';

import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  renderStudentInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  type GeneratedSlideActivityRenderer,
  renderGeneratedSlideManifestStep,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import {
  GENERATED_ACTIVITY_CLASS,
  GENERATED_CONTENT_CLASSES,
  GENERATED_RESPONSE_KINDS,
  GENERATED_SLIDE_LAYOUT_REGISTRY,
  validateGeneratedSlideManifest,
  type GeneratedSlideManifest,
  type GeneratedSlideModule,
  type GeneratedResponseKind,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { renderInteractiveManifestStep } from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import { useManifestSubmissionController } from '@/features/interactive/shared/manifest-runtime/submission-controller';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { isObjectiveInteractiveResponseKind, isSubjectiveInteractiveResponseKind } from '@/lib/interactive-response-contracts';

export type SmartCoursewareSourceState =
  | 'verified'
  | 'ai_generated_source_pending'
  | 'teacher_created_source_pending';

export type SmartCoursewareTeacherModuleMetadata = {
  moduleId: string;
  moduleContentHash?: string;
  correctAnswer?: string;
  explanation?: string;
  expectedOutput?: string;
  reviewPoints?: string[];
  scoring?: Record<string, unknown>;
  sourceState: SmartCoursewareSourceState;
  citationTitles: string[];
  provenance: 'ai-generated' | 'ai-generated-teacher-edited' | 'teacher-created';
  validationNotes: string[];
};

export type SmartCoursewareDraftShell = {
  draftId: string;
  planRevisionId: string | null;
  state: 'waiting-for-generation' | 'generating' | 'ready' | 'accepted';
  version: number;
  manifest: GeneratedSlideManifest | null;
  stalePlan: boolean;
};

export type SmartCoursewareCompositionMetadata = {
  moduleId: string;
  sourceState: SmartCoursewareSourceState;
  sourceBindings: Array<{ sourceVersionId: string; anchor: string; contentHash: string; citationId: string }>;
  teacherFields: {
    referenceAnswer?: unknown;
    explanation?: string;
    expectedOutput?: string;
    reviewPoints?: string[];
    scoring?: Record<string, unknown>;
    inclusionRationale?: string;
  };
};

export type SmartCoursewareJobView = {
  id: string;
  draftId: string;
  state: string;
  mode?: string;
  targetModuleId?: string;
  targetModuleHash?: string;
  candidateRuntimeModule?: unknown;
  candidateModuleMetadata?: unknown;
  candidateHash?: string;
  acceptedAt?: string | null;
  firstIncompleteUnitKey?: string;
  failureCode?: string | null;
  units?: Array<{ id: string; unitKey: string; orderIndex: number; state: string; failureCode?: string | null }>;
};

export type SmartCoursewareTeacherEnvelope = SmartCoursewareDraftShell & {
  teacherModules: Record<string, SmartCoursewareTeacherModuleMetadata>;
  compositionMetadata: SmartCoursewareCompositionMetadata[];
  planLimitations: string[];
  aiReview: SmartCoursewareTeacherProjectionInput['aiReview'];
  generationAudit: SmartCoursewareTeacherProjectionInput['generationAudit'];
};

export type SmartCoursewareStudentPreviewEnvelope = {
  draftId: string;
  version: number;
  manifest: InteractiveRuntimeManifest;
  sourceContentHash: string;
  notice: string;
};

export type SmartCoursewareTeacherProjectionInput = {
  draftId: string;
  version: number;
  planRevisionId: string;
  runtimeManifest: GeneratedSlideManifest;
  moduleMetadata: Array<{
    moduleId: string;
    moduleContentHash?: string;
    sourceState: SmartCoursewareSourceState;
    sourceBindings: Array<{
      sourceVersionId?: string;
      anchor?: string;
      contentHash?: string;
      citationId?: string;
    }>;
    provenance: 'ai_generated' | 'ai_generated_teacher_edited' | 'teacher_created';
    teacherFields: {
      referenceAnswer?: unknown;
      explanation?: string;
      expectedOutput?: string;
      reviewPoints?: string[];
      scoring?: Record<string, unknown>;
      inclusionRationale?: string;
    };
  }>;
  planLimitations: string[];
  aiReview: {
    findings: Array<{ category: string; severity: string; message: string; path: string | null }>;
    suggestions: string[];
  } | null;
  generationAudit: Array<{
    jobId: string;
    mode: string;
    state: string;
    attempts: Array<{ attemptNumber: number; serviceId: string; providerKind: string; model: string; outcome: string }>;
  }>;
  validation: { issues: unknown[] };
};

export type SmartCoursewareStudentProjectionReceipt = {
  draftId: string;
  version: number;
  runtimeManifest: unknown;
  notice: 'ai-assisted-teacher-reviewed';
};

export function createSmartCoursewareDraftShell({
  draftId,
  planRevisionId,
}: {
  draftId: string;
  planRevisionId: string | null;
}): SmartCoursewareTeacherEnvelope {
  return {
    draftId,
    planRevisionId,
    state: 'waiting-for-generation',
    version: 1,
    manifest: null,
    stalePlan: false,
    teacherModules: {},
    compositionMetadata: [],
    planLimitations: [],
    aiReview: null,
    generationAudit: [],
  };
}

export function createSmartCoursewareTeacherEnvelopeFromProjection(
  projection: SmartCoursewareTeacherProjectionInput,
): SmartCoursewareTeacherEnvelope {
  const validationNotes = projection.validation.issues.map((issue) => {
    if (issue && typeof issue === 'object' && 'message' in issue) return String(issue.message);
    return String(issue);
  });
  return {
    draftId: projection.draftId,
    planRevisionId: projection.planRevisionId,
    state: 'ready',
    version: projection.version,
    manifest: projection.runtimeManifest,
    stalePlan: false,
    planLimitations: projection.planLimitations,
    aiReview: projection.aiReview,
    generationAudit: projection.generationAudit,
    compositionMetadata: projection.moduleMetadata.map((module) => ({
      moduleId: module.moduleId,
      moduleContentHash: module.moduleContentHash,
      sourceState: module.sourceState,
      sourceBindings: module.sourceBindings.filter((binding): binding is SmartCoursewareCompositionMetadata['sourceBindings'][number] => (
        typeof binding.sourceVersionId === 'string'
        && typeof binding.anchor === 'string'
        && typeof binding.contentHash === 'string'
        && typeof binding.citationId === 'string'
      )),
      teacherFields: module.teacherFields,
    })),
    teacherModules: Object.fromEntries(projection.moduleMetadata.map((module) => [module.moduleId, {
      moduleId: module.moduleId,
      correctAnswer: displayTeacherValue(module.teacherFields.referenceAnswer),
      explanation: module.teacherFields.explanation,
      expectedOutput: module.teacherFields.expectedOutput,
      reviewPoints: module.teacherFields.reviewPoints,
      scoring: module.teacherFields.scoring,
      sourceState: module.sourceState,
      citationTitles: module.sourceBindings.flatMap((binding) => binding.citationId ? [binding.citationId] : []),
      provenance: module.provenance === 'ai_generated'
        ? 'ai-generated'
        : module.provenance === 'ai_generated_teacher_edited'
          ? 'ai-generated-teacher-edited'
          : 'teacher-created',
      validationNotes,
    }])),
  };
}

export function createSmartCoursewareStudentPreviewFromService(
  envelope: SmartCoursewareTeacherEnvelope,
  receipt: SmartCoursewareStudentProjectionReceipt,
) {
  if (receipt.draftId !== envelope.draftId || receipt.version !== envelope.version) return null;
  if (!isInteractiveRuntimeManifest(receipt.runtimeManifest) || !envelope.manifest) return null;
  return {
    draftId: receipt.draftId,
    version: receipt.version,
    manifest: receipt.runtimeManifest,
    sourceContentHash: validateGeneratedSlideManifest(envelope.manifest).contentHash,
    notice: '本课件由 AI 辅助生成，并由教师复核。',
  };
}

export function SmartCoursewareProjectionEditor({
  teacherProjection,
  studentProjection,
  state,
  stalePlan,
  initialJob,
}: {
  teacherProjection: SmartCoursewareTeacherProjectionInput;
  studentProjection: SmartCoursewareStudentProjectionReceipt;
  state: SmartCoursewareTeacherEnvelope['state'];
  stalePlan: boolean;
  initialJob?: SmartCoursewareJobView | null;
}) {
  const initialEnvelope = createSmartCoursewareTeacherEnvelopeFromProjection(teacherProjection);
  initialEnvelope.state = state;
  initialEnvelope.stalePlan = stalePlan;
  const initialStudentPreview = createSmartCoursewareStudentPreviewFromService(initialEnvelope, studentProjection);

  return (
    <SmartCoursewareEditor
      initialEnvelope={initialEnvelope}
      initialStudentPreview={initialStudentPreview}
      initialJob={initialJob}
    />
  );
}

function isInteractiveRuntimeManifest(value: unknown): value is InteractiveRuntimeManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const manifest = value as Partial<InteractiveRuntimeManifest>;
  return typeof manifest.lessonId === 'string'
    && Array.isArray(manifest.stepOrder)
    && Array.isArray(manifest.steps)
    && manifest.steps.length > 0
    && manifest.steps.every((step) => Boolean(step && typeof step.id === 'string' && Array.isArray(step.modules)));
}

export function splitCoursewareStep(input: {
  manifest: GeneratedSlideManifest;
  moduleMetadata: SmartCoursewareCompositionMetadata[];
  stepId: string;
  newStepId: string;
  newModuleIds: string[];
}) {
  const sourceStep = input.manifest.stages.flatMap((stage) => stage.steps).find((step) => step.id === input.stepId);
  if (!sourceStep || sourceStep.durationSeconds < 120 || sourceStep.modules.length < 1 || sourceStep.modules.length > 3) return null;
  if (input.newModuleIds.length !== sourceStep.modules.length || new Set(input.newModuleIds).size !== input.newModuleIds.length) return null;
  const metadataById = new Map(input.moduleMetadata.map((metadata) => [metadata.moduleId, metadata]));
  if (sourceStep.modules.some((module) => !metadataById.has(module.id))) return null;
  const firstDuration = Math.floor(sourceStep.durationSeconds / 2);
  const secondDuration = sourceStep.durationSeconds - firstDuration;
  const copiedModules = sourceStep.modules.map((module, index) => {
    const id = input.newModuleIds[index];
    return {
      ...module,
      id,
      ...(module.canonicalClass === GENERATED_ACTIVITY_CLASS ? { evidencePath: `responses.${id}` } : {}),
    } as GeneratedSlideModule;
  });
  const manifest = {
    ...input.manifest,
    stages: input.manifest.stages.map((stage) => ({
      ...stage,
      steps: stage.steps.flatMap((step) => step.id === sourceStep.id
        ? [
            { ...step, durationSeconds: firstDuration },
            { ...step, id: input.newStepId, title: `${step.title}（续）`, durationSeconds: secondDuration, modules: copiedModules },
          ]
        : [step]),
    })),
  } satisfies GeneratedSlideManifest;
  const copiedMetadata = sourceStep.modules.map((module, index) => ({
    moduleId: input.newModuleIds[index],
    sourceState: 'teacher_created_source_pending' as const,
    sourceBindings: [],
    teacherFields: metadataById.get(module.id)!.teacherFields,
  }));
  return { manifest, moduleMetadata: [...input.moduleMetadata, ...copiedMetadata] };
}

export function mergeAndDeleteCoursewareStep(input: {
  manifest: GeneratedSlideManifest;
  moduleMetadata: SmartCoursewareCompositionMetadata[];
  stepId: string;
}) {
  const stageIndex = input.manifest.stages.findIndex((stage) => stage.steps.some((step) => step.id === input.stepId));
  if (stageIndex < 0) return null;
  const stage = input.manifest.stages[stageIndex];
  const removedIndex = stage.steps.findIndex((step) => step.id === input.stepId);
  if (stage.steps.length < 2 || removedIndex < 0) return null;
  const retainedIndex = removedIndex > 0 ? removedIndex - 1 : removedIndex + 1;
  const removed = stage.steps[removedIndex];
  const retained = stage.steps[retainedIndex];
  const removedModuleIds = new Set(removed.modules.map((module) => module.id));
  const steps = stage.steps
    .filter((_, index) => index !== removedIndex)
    .map((step) => step.id === retained.id ? { ...step, durationSeconds: step.durationSeconds + removed.durationSeconds } : step);
  return {
    retainedStepId: retained.id,
    manifest: {
      ...input.manifest,
      stages: input.manifest.stages.map((candidate, index) => index === stageIndex ? { ...candidate, steps } : candidate),
    } satisfies GeneratedSlideManifest,
    moduleMetadata: input.moduleMetadata.filter((metadata) => !removedModuleIds.has(metadata.moduleId)),
  };
}

export function SmartCoursewareEditor({
  initialEnvelope,
  initialStudentPreview,
  initialJob = null,
}: {
  initialEnvelope: SmartCoursewareTeacherEnvelope;
  initialStudentPreview?: SmartCoursewareStudentPreviewEnvelope | null;
  initialJob?: SmartCoursewareJobView | null;
}) {
  const [envelope, setEnvelope] = useState(initialEnvelope);
  const [previewRole, setPreviewRole] = useState<'teacher' | 'student'>('teacher');
  const [studentPreview, setStudentPreview] = useState(initialStudentPreview ?? null);
  const [job, setJob] = useState<SmartCoursewareJobView | null>(initialJob);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState(initialEnvelope.manifest?.stages[0]?.steps[0]?.id ?? '');
  const [selectedModuleId, setSelectedModuleId] = useState(initialEnvelope.manifest?.stages[0]?.steps[0]?.modules[0]?.id ?? '');
  const [newModuleClass, setNewModuleClass] = useState<string>('content.rich');
  const validation = envelope.manifest
    ? validateGeneratedSlideManifest(envelope.manifest)
    : null;
  const selectedStep = envelope.manifest?.stages.flatMap((stage) => stage.steps).find((step) => step.id === selectedStepId);
  const selectedModule = selectedStep?.modules.find((module) => module.id === selectedModuleId);

  async function startGeneration() {
    setBusy(true);
    try {
      const response = await fetch(`/api/teacher/smart-courseware/drafts/${envelope.draftId}/generation`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: `courseware-start:${envelope.draftId}:${crypto.randomUUID()}` }),
      });
      const payload = await response.json();
      setMessage(response.ok ? '课件生成任务已进入队列。' : errorMessage(payload));
      if (response.ok) setJob(payload.job);
    } finally {
      setBusy(false);
    }
  }

  async function refreshJob() {
    if (!job) return;
    const response = await fetch(`/api/teacher/smart-courseware/jobs/${job.id}`, { cache: 'no-store' });
    const payload = await response.json();
    setMessage(response.ok ? '生成状态已刷新。' : errorMessage(payload));
    if (response.ok) {
      setJob(payload.job);
      if (payload.job.state === 'COMPLETED') window.location.reload();
    }
  }

  async function runJobAction(action: 'resume' | 'retry' | 'cancel') {
    if (!job) return;
    const response = await fetch(`/api/teacher/smart-courseware/jobs/${job.id}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, idempotencyKey: `courseware-${action}:${job.id}:${crypto.randomUUID()}` }),
    });
    const payload = await response.json();
    setMessage(response.ok ? `生成任务已${action === 'cancel' ? '取消' : action === 'retry' ? '重试' : '恢复'}。` : errorMessage(payload));
    if (response.ok) setJob(payload.job);
  }

  async function persistComposition(
    runtimeManifest: GeneratedSlideManifest,
    moduleMetadata: SmartCoursewareCompositionMetadata[] = envelope.compositionMetadata,
  ) {
    setBusy(true);
    try {
      const response = await fetch(`/api/teacher/smart-courseware/drafts/${envelope.draftId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: envelope.version, runtimeManifest, moduleMetadata }),
      });
      const payload = await response.json();
      if (!response.ok) return setMessage(errorMessage(payload));
      const next = createSmartCoursewareTeacherEnvelopeFromProjection(payload.preview);
      setEnvelope(next);
      setStudentPreview(await fetchStudentPreview(next));
      setMessage('组合已保存，并通过服务器共享运行时校验。');
    } finally {
      setBusy(false);
    }
  }

  async function fetchStudentPreview(next: SmartCoursewareTeacherEnvelope) {
    const response = await fetch(`/api/teacher/smart-courseware/drafts/${next.draftId}/previews/student`, { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json();
    return createSmartCoursewareStudentPreviewFromService(next, payload.preview);
  }

  function replaceSelectedStep(change: (step: NonNullable<typeof selectedStep>) => NonNullable<typeof selectedStep>) {
    if (!envelope.manifest || !selectedStep) return null;
    return {
      ...envelope.manifest,
      stages: envelope.manifest.stages.map((stage) => ({
        ...stage,
        steps: stage.steps.map((step) => step.id === selectedStep.id ? change(selectedStep) : step),
      })),
    } satisfies GeneratedSlideManifest;
  }

  async function addModule() {
    if (!selectedStep) return;
    const layout = GENERATED_SLIDE_LAYOUT_REGISTRY[selectedStep.layoutId as keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY];
    const occupied = new Set(selectedStep.modules.map((module) => module.slotId));
    const slot = layout?.slots.find((candidate) => !occupied.has(candidate.id));
    if (!slot) return setMessage('当前布局没有可用 slot；请先切换布局或删除模块。');
    const id = `module-${crypto.randomUUID()}`;
    const module = defaultGeneratedModule(id, newModuleClass, slot.id, slot.sizeId);
    const nextManifest = replaceSelectedStep((step) => ({ ...step, modules: [...step.modules, module] }));
    if (!nextManifest) return;
    setSelectedModuleId(id);
    await persistComposition(nextManifest, [...envelope.compositionMetadata, {
      moduleId: id,
      sourceState: 'teacher_created_source_pending',
      sourceBindings: [],
      teacherFields: module.canonicalClass === GENERATED_ACTIVITY_CLASS
        ? defaultTeacherFieldsForActivity(module)
        : {},
    }]);
  }

  async function splitSelectedStep() {
    if (!envelope.manifest || !selectedStep) return;
    const newStepId = `step-${crypto.randomUUID()}`;
    const newModuleIds = selectedStep.modules.map(() => `module-${crypto.randomUUID()}`);
    const result = splitCoursewareStep({
      manifest: envelope.manifest,
      moduleMetadata: envelope.compositionMetadata,
      stepId: selectedStep.id,
      newStepId,
      newModuleIds,
    });
    if (!result) return setMessage('只能拆分时长至少 2 分钟、且包含 1–3 个合法模块的步骤。');
    setSelectedStepId(newStepId);
    setSelectedModuleId(newModuleIds[0] ?? '');
    await persistComposition(result.manifest, result.moduleMetadata);
  }

  async function editStep() {
    if (!selectedStep) return;
    const title = window.prompt('编辑步骤标题', selectedStep.title)?.trim();
    if (!title) return;
    const next = replaceSelectedStep((step) => ({ ...step, title }));
    if (next) await persistComposition(next);
  }

  async function deleteStep() {
    if (!envelope.manifest || !selectedStep) return;
    const result = mergeAndDeleteCoursewareStep({
      manifest: envelope.manifest,
      moduleMetadata: envelope.compositionMetadata,
      stepId: selectedStep.id,
    });
    if (!result) return setMessage('当前教学阶段没有可合并的相邻步骤。');
    const retained = result.manifest.stages.flatMap((stage) => stage.steps).find((step) => step.id === result.retainedStepId)!;
    setSelectedStepId(retained.id);
    setSelectedModuleId(retained.modules[0]?.id ?? '');
    await persistComposition(result.manifest, result.moduleMetadata);
  }

  async function moveStep(offset: -1 | 1) {
    if (!envelope.manifest || !selectedStep) return;
    const next = {
      ...envelope.manifest,
      stages: envelope.manifest.stages.map((stage) => {
        const index = stage.steps.findIndex((step) => step.id === selectedStep.id);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= stage.steps.length) return stage;
        const steps = [...stage.steps];
        [steps[index], steps[target]] = [steps[target], steps[index]];
        return { ...stage, steps };
      }),
    } satisfies GeneratedSlideManifest;
    await persistComposition(next);
  }

  async function editSelectedModule() {
    if (!selectedModule) return;
    const metadata = envelope.compositionMetadata.find((item) => item.moduleId === selectedModule.id);
    if (!metadata) return;
    const activity = selectedModule.canonicalClass === GENERATED_ACTIVITY_CLASS;
    const edited = window.prompt(
      activity ? '原子编辑活动 JSON（responseKind、payload、teacherFields）' : '编辑模块 payload JSON',
      JSON.stringify(activity ? {
        responseKind: selectedModule.responseKind,
        payload: selectedModule.payload,
        teacherFields: metadata.teacherFields,
      } : selectedModule.payload, null, 2),
    );
    if (!edited) return;
    let payload: Record<string, unknown>;
    let responseKind = selectedModule.responseKind;
    let teacherFields = metadata.teacherFields;
    try {
      const value = JSON.parse(edited);
      if (activity) {
        if (!value || typeof value !== 'object' || Array.isArray(value)
          || !GENERATED_RESPONSE_KINDS.includes(value.responseKind as GeneratedResponseKind)
          || !value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)
          || !value.teacherFields || typeof value.teacherFields !== 'object' || Array.isArray(value.teacherFields)) {
          throw new Error('invalid');
        }
        responseKind = value.responseKind;
        payload = value.payload;
        teacherFields = teacherFieldsForResponseKind(responseKind, value.teacherFields);
      } else {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
        payload = value;
      }
    } catch {
      return setMessage(activity ? '活动编辑 JSON 无效。' : '模块 payload JSON 无效。');
    }
    const next = replaceSelectedStep((step) => ({
      ...step,
      modules: step.modules.map((module) => module.id === selectedModule.id
        ? { ...module, payload, ...(activity ? { responseKind } : {}) }
        : module),
    }));
    if (next) await persistComposition(next, envelope.compositionMetadata.map((item) => (
      item.moduleId === selectedModule.id ? { ...item, teacherFields } : item
    )));
  }

  async function deleteModule() {
    if (!selectedModule) return;
    const next = replaceSelectedStep((step) => ({ ...step, modules: step.modules.filter((module) => module.id !== selectedModule.id) }));
    if (!next) return;
    await persistComposition(next, envelope.compositionMetadata.filter((metadata) => metadata.moduleId !== selectedModule.id));
    setSelectedModuleId(selectedStep?.modules.find((module) => module.id !== selectedModule.id)?.id ?? '');
  }

  async function moveModule(offset: -1 | 1) {
    if (!selectedStep || !selectedModule) return;
    const index = selectedStep.modules.findIndex((module) => module.id === selectedModule.id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= selectedStep.modules.length) return;
    const modules = [...selectedStep.modules];
    [modules[index], modules[target]] = [modules[target], modules[index]];
    const next = replaceSelectedStep((step) => ({ ...step, modules }));
    if (next) await persistComposition(next);
  }

  async function updateModuleSlot(slotId: string) {
    if (!selectedModule || !selectedStep) return;
    const layout = GENERATED_SLIDE_LAYOUT_REGISTRY[selectedStep.layoutId as keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY];
    const slot = layout?.slots.find((candidate) => candidate.id === slotId);
    if (!slot) return setMessage('当前布局不存在该 slot。');
    const next = replaceSelectedStep((step) => ({
      ...step,
      modules: step.modules.map((module) => module.id === selectedModule.id
        ? { ...module, slotId: slot.id, sizeId: slot.sizeId }
        : module),
    }));
    if (next) await persistComposition(next);
  }

  async function switchLayout(layoutId: keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY) {
    if (!selectedStep) return;
    const layout = GENERATED_SLIDE_LAYOUT_REGISTRY[layoutId];
    const next = replaceSelectedStep((step) => ({
      ...step,
      layoutId,
      modules: step.modules.map((module, index) => {
        const slot = layout.slots[index];
        return slot ? { ...module, slotId: slot.id, sizeId: slot.sizeId } : module;
      }),
    }));
    if (next) await persistComposition(next);
  }

  async function requestModuleRegeneration() {
    if (!selectedModule) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/teacher/smart-courseware/drafts/${envelope.draftId}/modules/${selectedModule.id}/regeneration`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: `courseware-module:${envelope.draftId}:${selectedModule.id}:${crypto.randomUUID()}` }),
      });
      const payload = await response.json();
      setMessage(response.ok ? '模块重生成任务已进入队列；请刷新任务状态查看候选。' : errorMessage(payload));
      if (response.ok) setJob(payload.job);
    } finally {
      setBusy(false);
    }
  }

  async function acceptModuleCandidate() {
    if (!job?.targetModuleHash) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/teacher/smart-courseware/jobs/${job.id}/accept`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedDraftVersion: envelope.version,
          expectedModuleHash: job.targetModuleHash,
          idempotencyKey: `courseware-module-accept:${job.id}:${crypto.randomUUID()}`,
        }),
      });
      const payload = await response.json();
      if (!response.ok) return setMessage(errorMessage(payload));
      const next = createSmartCoursewareTeacherEnvelopeFromProjection(payload.preview);
      setEnvelope(next);
      setStudentPreview(await fetchStudentPreview(next));
      setJob(payload.job);
      setMessage('候选模块已接受；其余模块与步骤保持不变。');
    } finally {
      setBusy(false);
    }
  }

  async function approveCourseware() {
    setBusy(true);
    try {
      const response = await fetch(`/api/teacher/smart-courseware/drafts/${envelope.draftId}/approve`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: `courseware-approve:${envelope.draftId}:${crypto.randomUUID()}` }),
      });
      const payload = await response.json();
      if (!response.ok) return setMessage(errorMessage(payload));
      setEnvelope((current) => ({ ...current, state: 'accepted' }));
      const pendingGapCount = Object.values(envelope.teacherModules).filter((module) => module.sourceState !== 'verified').length;
      setMessage(`课件版本 ${payload.revision.revisionNumber} 已批准；${pendingGapCount} 个来源待补项继续保留。`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-5" data-smart-courseware-editor data-courseware-draft-id={envelope.draftId}>
      <header className="rounded-xl border border-border bg-background p-5">
        <p className="text-sm font-medium text-primary">智能备课 · 互动课件</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">课件编辑与角色预览</h1>
            <p className="mt-1 text-sm text-subtle">
              草稿 {envelope.draftId} · 版本 {envelope.version}
              {envelope.planRevisionId ? ` · 教案修订 ${envelope.planRevisionId}` : ''}
            </p>
          </div>
          <div className="flex rounded-lg border border-border p-1" aria-label="预览角色">
            {(['teacher', 'student'] as const).map((role) => (
              <button
                key={role}
                type="button"
                aria-pressed={previewRole === role}
                onClick={() => setPreviewRole(role)}
                className={`rounded px-3 py-1.5 text-sm ${previewRole === role ? 'bg-primary text-primary-foreground' : 'text-subtle'}`}
              >
                {role === 'teacher' ? '教师预览' : '学生预览'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {message ? <p className="rounded-lg bg-muted px-4 py-3 text-sm" role="status">{message}</p> : null}

      {envelope.manifest ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4" data-courseware-approval>
          <div>
            <h2 className="font-semibold">整课批准</h2>
            <p className="text-sm text-subtle">批准冻结当前有效组合；来源待补项保留在版本快照中，不创建已确认记录。</p>
          </div>
          <button type="button" disabled={busy || envelope.state === 'accepted' || Boolean(validation && !validation.valid)} onClick={() => void approveCourseware()} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {envelope.state === 'accepted' ? '已批准' : '批准整课版本'}
          </button>
        </section>
      ) : null}

      {envelope.stalePlan ? (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground" role="status">
          关联教案已有更新；当前草稿仍可预览，不会自动重新生成。
        </p>
      ) : null}

      {envelope.state === 'accepted' ? (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm" data-courseware-read-only>
          已批准课件为只读版本；教师与学生预览及审计记录继续保留。
        </p>
      ) : null}

      {envelope.state !== 'accepted' && job ? <CoursewareJobPanel job={job} onRefresh={refreshJob} onAction={runJobAction} /> : null}
      {envelope.state !== 'accepted' && job?.mode === 'MODULE' && job.candidateRuntimeModule ? <CoursewareModuleCandidateDiff
        job={job}
        currentModule={envelope.manifest?.stages.flatMap((stage) => stage.steps).flatMap((step) => step.modules).find((module) => module.id === job.targetModuleId)}
        busy={busy}
        onAccept={acceptModuleCandidate}
      /> : null}

      {!envelope.manifest ? (
        <section className="rounded-xl border border-dashed border-border p-8 text-center" data-courseware-empty-state>
          <h2 className="font-semibold">课件草稿尚未生成</h2>
          <p className="mt-2 text-sm text-subtle">
            地址和教案修订绑定已建立。生成服务接入后，本页将显示阶段进度、共享校验结果和可编辑课件。
          </p>
          <button type="button" disabled={busy || Boolean(job && !['FAILED', 'CANCELLED'].includes(job.state))} onClick={() => void startGeneration()} className="mt-4 rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">开始生成课件</button>
        </section>
      ) : previewRole === 'teacher' ? (
        <TeacherCoursewarePreview envelope={envelope} />
      ) : studentPreview ? (
        <StudentCoursewarePreview preview={studentPreview} />
      ) : null}

      {envelope.manifest && envelope.state !== 'accepted' ? <CoursewareCompositionControls
        busy={busy}
        manifest={envelope.manifest}
        selectedStepId={selectedStepId}
        selectedModuleId={selectedModuleId}
        newModuleClass={newModuleClass}
        onSelectStep={(stepId) => {
          setSelectedStepId(stepId);
          const step = envelope.manifest?.stages.flatMap((stage) => stage.steps).find((candidate) => candidate.id === stepId);
          setSelectedModuleId(step?.modules[0]?.id ?? '');
        }}
        onSelectModule={setSelectedModuleId}
        onNewModuleClass={setNewModuleClass}
        onAdd={addModule}
        onAddStep={splitSelectedStep}
        onEditStep={editStep}
        onDeleteStep={deleteStep}
        onMoveStep={moveStep}
        onEdit={editSelectedModule}
        onDelete={deleteModule}
        onMove={moveModule}
        onSlot={updateModuleSlot}
        onLayout={switchLayout}
        onRegenerate={requestModuleRegeneration}
      /> : null}

      {validation ? (
        <section className="rounded-xl border border-border p-4" data-courseware-validation-state={validation.valid ? 'valid' : 'invalid'}>
          <h2 className="font-semibold">共享运行时校验</h2>
          <p className="mt-1 text-sm text-subtle">内容哈希：{validation.contentHash}</p>
          {validation.issues.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {validation.issues.map((issue, index) => <li key={`${issue.code}:${index}`}>{issue.code}：{issue.message}</li>)}
            </ul>
          ) : <p className="mt-3 text-sm text-primary">课件符合共享 slide runtime。</p>}
        </section>
      ) : null}
    </main>
  );
}

export function TeacherCoursewarePreview({
  envelope,
}: {
  envelope: SmartCoursewareTeacherEnvelope;
}) {
  if (!envelope.manifest) return null;
  return (
    <section
      className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"
      data-courseware-preview="teacher"
      data-courseware-source-content-hash={validateGeneratedSlideManifest(envelope.manifest).contentHash}
    >
      <CoursewareManifestPreview manifest={envelope.manifest} projection="teacher" />
      <aside className="space-y-3 rounded-xl border border-border p-4" data-courseware-teacher-inspector>
        <h2 className="font-semibold">教师审阅信息</h2>
        <section className="space-y-1 text-sm" data-courseware-generation-audit>
          <h3 className="font-medium">生成审计</h3>
          {envelope.generationAudit.length ? envelope.generationAudit.map((job) => (
            <div key={job.jobId}>
              <p>{job.mode} · {job.state}</p>
              {job.attempts.map((attempt) => <p key={`${job.jobId}:${attempt.attemptNumber}`} className="text-subtle">
                {attempt.serviceId} / {attempt.providerKind} / {attempt.model} · {attempt.outcome}
              </p>)}
            </div>
          )) : <p className="text-subtle">尚无 provider/model 调用记录。</p>}
        </section>
        <section className="space-y-1 text-sm" data-courseware-plan-limitations>
          <h3 className="font-medium">教案限制</h3>
          {envelope.planLimitations.length ? <ul className="list-disc pl-5">{envelope.planLimitations.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="text-subtle">无已记录限制。</p>}
        </section>
        <section className="space-y-1 text-sm" data-courseware-ai-review>
          <h3 className="font-medium">AI 审阅意见</h3>
          {envelope.aiReview?.findings.length ? <ul className="list-disc pl-5">{envelope.aiReview.findings.map((finding, index) => <li key={`${finding.category}:${index}`}>{finding.message}</li>)}</ul> : <p className="text-subtle">无已记录审阅意见。</p>}
          {envelope.aiReview?.suggestions.length ? <p><strong>建议：</strong>{envelope.aiReview.suggestions.join('；')}</p> : null}
        </section>
        {Object.values(envelope.teacherModules).length ? Object.values(envelope.teacherModules).map((module) => (
          <article key={module.moduleId} className="rounded-lg border border-border p-3 text-sm">
            <h3 className="font-medium">{module.moduleId}</h3>
            <p className="mt-1"><SourceStateBadge state={module.sourceState} /></p>
            {module.correctAnswer ? <p className="mt-2"><strong>参考答案：</strong>{module.correctAnswer}</p> : null}
            {module.explanation ? <p><strong>解释：</strong>{module.explanation}</p> : null}
            {module.expectedOutput ? <p><strong>预期产出：</strong>{module.expectedOutput}</p> : null}
            {module.reviewPoints?.length ? <p><strong>复核要点：</strong>{module.reviewPoints.join('；')}</p> : null}
            {module.scoring ? <p><strong>评分：</strong>{displayTeacherValue(module.scoring)}</p> : null}
            {module.citationTitles.length ? <p><strong>引用：</strong>{module.citationTitles.join('；')}</p> : null}
            <p><strong>来源：</strong>{provenanceLabel(module.provenance)}</p>
            {module.validationNotes.length ? <p><strong>校验：</strong>{module.validationNotes.join('；')}</p> : null}
          </article>
        )) : <p className="text-sm text-subtle">当前草稿没有模块审阅信息。</p>}
      </aside>
    </section>
  );
}

export function StudentCoursewarePreview({
  preview,
}: {
  preview: SmartCoursewareStudentPreviewEnvelope;
}) {
  const [responses, setResponses] = useState<Record<string, ManifestStepResponse>>({});
  const moduleRegistry = useMemo(() => createManifestContentModuleRegistry({ revealProgress: 0, allowInlineReveal: false }), []);
  const activityRegistry = useMemo(() => createManifestStudentActivityRegistry<{ id: string; title: string }>(), []);
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent: () => undefined });
  return (
    <section
      className="space-y-3"
      data-courseware-preview="student"
      data-courseware-source-content-hash={preview.sourceContentHash}
    >
      <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground" data-courseware-ai-notice>
        {preview.notice}
      </p>
      <div className="space-y-4" data-courseware-student-runtime>
        {preview.manifest.steps.map((step) => (
          <section key={step.id} className="rounded-xl border border-border p-4">
            {renderInteractiveManifestStep({
              manifest: preview.manifest,
              step,
              moduleRegistry,
              extra: { revealProgress: 0, allowInlineReveal: false },
            })}
            <div data-courseware-student-activity={step.id}>
              {renderStudentInteractiveActivity({
                registry: activityRegistry,
                step: { id: step.id, title: step.title },
                stepManifest: step,
                savedResponse: responses[step.id],
                released: true,
                browseEnabled: true,
                answerVisible: false,
                revealProgress: 0,
                onSubmit: (response) => {
                  submitManifestStepResponse({ stepId: step.id, isResubmit: Boolean(responses[step.id]), response, stepManifest: step });
                  setResponses((current) => ({ ...current, [step.id]: response }));
                },
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function CoursewareManifestPreview({
  manifest,
  projection,
}: {
  manifest: GeneratedSlideManifest;
  projection: 'teacher' | 'student';
}) {
  const extra = useMemo(() => ({ revealProgress: 0, allowInlineReveal: false, interactionMode: 'readonly' as const }), []);
  const moduleRegistry = useMemo(() => createManifestContentModuleRegistry(extra), [extra]);
  const activityRenderer: GeneratedSlideActivityRenderer<typeof extra> = ({ module }) => (
    <div className="space-y-2" data-courseware-preview-activity={module.id}>
      <p>{String(module.payload.prompt ?? '')}</p>
      <ActivityControl payload={module.payload} />
    </div>
  );

  return (
    <div className="space-y-4 overflow-hidden" data-courseware-manifest-preview data-projection={projection}>
      {manifest.stages.flatMap((stage) => stage.steps).map((step) => (
        <section key={step.id} className="overflow-hidden rounded-xl border border-border bg-muted/20 p-3">
          {renderGeneratedSlideManifestStep({
            generatedManifest: manifest,
            generatedStep: step,
            projection,
            moduleRegistry,
            activityRenderer,
            extra,
          })}
        </section>
      ))}
    </div>
  );
}

function ActivityControl({ payload }: { payload: Record<string, unknown> }): ReactNode {
  const options = Array.isArray(payload.options) ? payload.options : [];
  if (options.length) {
    return <div className="flex flex-wrap gap-2">{options.map((option, index) => {
      const item = option as { value?: unknown; label?: unknown };
      return <button type="button" disabled key={`${String(item.value)}:${index}`} className="rounded border border-border px-2 py-1 text-sm">{String(item.label ?? item.value ?? '')}</button>;
    })}</div>;
  }
  return <textarea aria-label="学生作答预览" disabled rows={2} className="w-full rounded border border-border bg-background p-2" />;
}

function CoursewareJobPanel({
  job,
  onRefresh,
  onAction,
}: {
  job: SmartCoursewareJobView;
  onRefresh: () => Promise<void>;
  onAction: (action: 'resume' | 'retry' | 'cancel') => Promise<void>;
}) {
  return <section className="rounded-xl border border-border p-4" data-courseware-job-state={job.state}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">生成任务 {job.state}</h2><p className="text-sm text-subtle">当前单元：{job.firstIncompleteUnitKey ?? '—'}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void onRefresh()} className="rounded border border-border px-3 py-1.5 text-sm">刷新状态</button>
        {['FAILED', 'RETRYABLE'].includes(job.state) ? <button type="button" onClick={() => void onAction('retry')} className="rounded border border-border px-3 py-1.5 text-sm">重试</button> : null}
        {['FAILED', 'RETRYABLE', 'CANCELLED'].includes(job.state) ? <button type="button" onClick={() => void onAction('resume')} className="rounded border border-border px-3 py-1.5 text-sm">恢复</button> : null}
        {['QUEUED', 'RUNNING', 'RETRYABLE'].includes(job.state) ? <button type="button" onClick={() => void onAction('cancel')} className="rounded border border-destructive px-3 py-1.5 text-sm text-destructive">取消</button> : null}
      </div>
    </div>
    {job.failureCode ? <p className="mt-2 text-sm text-destructive">{job.failureCode}</p> : null}
    {job.units?.length ? <ol className="mt-3 grid gap-2 md:grid-cols-3">{job.units.map((unit) => <li key={unit.id} className="rounded bg-muted px-3 py-2 text-xs">{unit.unitKey} · {unit.state}</li>)}</ol> : null}
  </section>;
}

function CoursewareCompositionControls({
  busy,
  manifest,
  selectedStepId,
  selectedModuleId,
  newModuleClass,
  onSelectStep,
  onSelectModule,
  onNewModuleClass,
  onAdd,
  onAddStep,
  onEditStep,
  onDeleteStep,
  onMoveStep,
  onEdit,
  onDelete,
  onMove,
  onSlot,
  onLayout,
  onRegenerate,
}: {
  busy: boolean;
  manifest: GeneratedSlideManifest;
  selectedStepId: string;
  selectedModuleId: string;
  newModuleClass: string;
  onSelectStep: (value: string) => void;
  onSelectModule: (value: string) => void;
  onNewModuleClass: (value: string) => void;
  onAdd: () => Promise<void>;
  onAddStep: () => Promise<void>;
  onEditStep: () => Promise<void>;
  onDeleteStep: () => Promise<void>;
  onMoveStep: (offset: -1 | 1) => Promise<void>;
  onEdit: () => Promise<void>;
  onDelete: () => Promise<void>;
  onMove: (offset: -1 | 1) => Promise<void>;
  onSlot: (slotId: string) => Promise<void>;
  onLayout: (layout: keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY) => Promise<void>;
  onRegenerate: () => Promise<void>;
}) {
  const steps = manifest.stages.flatMap((stage) => stage.steps);
  const step = steps.find((candidate) => candidate.id === selectedStepId) ?? steps[0];
  const module = step?.modules.find((candidate) => candidate.id === selectedModuleId) ?? step?.modules[0];
  const layout = step ? GENERATED_SLIDE_LAYOUT_REGISTRY[step.layoutId as keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY] : null;
  const registeredSizeId = layout?.slots.find((slot) => slot.id === module?.slotId)?.sizeId ?? module?.sizeId ?? '';
  return <section className="space-y-3 rounded-xl border border-border p-4" data-courseware-composition-controls>
    <h2 className="font-semibold">组合编辑</h2>
    <p className="text-sm text-subtle">所有动作提交到服务器，并由共享 slide runtime 校验；无效组合不会写入。</p>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label className="grid gap-1 text-sm">步骤<select value={step?.id ?? ''} onChange={(event) => onSelectStep(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5">{steps.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select></label>
      <label className="grid gap-1 text-sm">模块<select value={module?.id ?? ''} onChange={(event) => onSelectModule(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5">{step?.modules.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.id}</option>)}</select></label>
      <label className="grid gap-1 text-sm">布局<select value={step?.layoutId ?? ''} disabled={busy} onChange={(event) => void onLayout(event.target.value as keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY)} className="rounded border border-border bg-background px-2 py-1.5">{Object.keys(GENERATED_SLIDE_LAYOUT_REGISTRY).map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
      <label className="grid gap-1 text-sm">slot<select value={module?.slotId ?? ''} disabled={!module || busy} onChange={(event) => void onSlot(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5">{layout?.slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.id}</option>)}</select></label>
      <label className="grid gap-1 text-sm">注册尺寸<select aria-label="注册尺寸（随 slot）" value={registeredSizeId} disabled className="rounded border border-border bg-background px-2 py-1.5"><option value={registeredSizeId}>{registeredSizeId}</option></select></label>
      <label className="grid gap-1 text-sm">新增模块类型<select value={newModuleClass} onChange={(event) => onNewModuleClass(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5">{[...GENERATED_CONTENT_CLASSES, GENERATED_ACTIVITY_CLASS].map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void onAddStep()} className="rounded border border-primary px-3 py-1.5 text-sm text-primary">拆分当前步骤</button>
      <button type="button" disabled={!step || busy} onClick={() => void onEditStep()} className="rounded border border-border px-3 py-1.5 text-sm">编辑步骤</button>
      <button type="button" disabled={!step || busy} onClick={() => void onMoveStep(-1)} className="rounded border border-border px-3 py-1.5 text-sm">步骤前移</button>
      <button type="button" disabled={!step || busy} onClick={() => void onMoveStep(1)} className="rounded border border-border px-3 py-1.5 text-sm">步骤后移</button>
      <button type="button" disabled={!step || busy} onClick={() => void onDeleteStep()} className="rounded border border-destructive px-3 py-1.5 text-sm text-destructive">合并并删除步骤</button>
      <button type="button" disabled={busy} onClick={() => void onAdd()} className="rounded border border-primary px-3 py-1.5 text-sm text-primary">添加模块</button>
      <button type="button" disabled={!module || busy} onClick={() => void onEdit()} className="rounded border border-border px-3 py-1.5 text-sm">{module?.canonicalClass === GENERATED_ACTIVITY_CLASS ? '编辑活动' : '编辑内容'}</button>
      <button type="button" disabled={!module || busy} onClick={() => void onMove(-1)} className="rounded border border-border px-3 py-1.5 text-sm">前移</button>
      <button type="button" disabled={!module || busy} onClick={() => void onMove(1)} className="rounded border border-border px-3 py-1.5 text-sm">后移</button>
      <button type="button" disabled={!module || busy} onClick={() => void onDelete()} className="rounded border border-destructive px-3 py-1.5 text-sm text-destructive">删除模块</button>
      <button type="button" disabled={!module || busy} onClick={() => void onRegenerate()} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">重新生成所选模块</button>
    </div>
  </section>;
}

function CoursewareModuleCandidateDiff({
  job,
  currentModule,
  busy,
  onAccept,
}: {
  job: SmartCoursewareJobView;
  currentModule?: GeneratedSlideModule;
  busy: boolean;
  onAccept: () => Promise<void>;
}) {
  return <section className="rounded-xl border border-primary/40 p-4" data-courseware-module-candidate={job.targetModuleId}>
    <h2 className="font-semibold">所选模块候选差异</h2>
    <p className="mt-1 text-sm text-subtle">候选哈希：{job.candidateHash ?? '—'}。接受动作由服务器确认只改变目标模块。</p>
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <div><h3 className="text-sm font-medium">当前模块</h3><pre className="mt-1 max-h-72 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(currentModule ?? null, null, 2)}</pre></div>
      <div><h3 className="text-sm font-medium">候选模块</h3><pre className="mt-1 max-h-72 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(job.candidateRuntimeModule, null, 2)}</pre></div>
    </div>
    <button type="button" disabled={busy || Boolean(job.acceptedAt)} onClick={() => void onAccept()} className="mt-3 rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">接受候选模块</button>
  </section>;
}

function defaultGeneratedModule(
  id: string,
  canonicalClass: string,
  slotId: string,
  sizeId: string,
): GeneratedSlideModule {
  const common = {
    id, canonicalClass, slotId, sizeId,
    roleMetadata: { studentVisible: true, teacherVisible: true as const, referenceAnswerVisibility: 'none' as const },
  };
  if (canonicalClass === GENERATED_ACTIVITY_CLASS) return {
    ...common,
    canonicalClass: GENERATED_ACTIVITY_CLASS,
    responseKind: 'text.long',
    evidencePath: `responses.${id}`,
    payload: { prompt: '请输入活动题目。' },
    roleMetadata: { ...common.roleMetadata, referenceAnswerVisibility: 'teacher-only' },
  };
  const payload: Record<string, unknown> = canonicalClass === 'content.cardSet'
    ? { items: [{ title: '新卡片', body: '请输入内容。' }] }
    : canonicalClass === 'content.formula'
      ? { formulas: ['x = 0'] }
      : canonicalClass === 'content.table'
        ? { columns: ['列'], rows: [['内容']] }
        : canonicalClass === 'content.code'
          ? { language: 'text', code: '请输入代码。' }
          : canonicalClass === 'content.reveal'
            ? { items: [{ body: '请输入内容。' }] }
            : { text: '请输入内容。' };
  return { ...common, payload } as GeneratedSlideModule;
}

export function defaultTeacherFieldsForActivity(
  module: GeneratedSlideModule,
): SmartCoursewareCompositionMetadata['teacherFields'] {
  if (!isObjectiveInteractiveResponseKind(module.responseKind)) {
    return {
      expectedOutput: '学生提交与活动题目相符的完整作答。',
      reviewPoints: ['检查作答是否回应题目要求。'],
    };
  }
  const payload = module.payload as Record<string, unknown>;
  let referenceAnswer = '';
  if (module.responseKind === 'ordering.sequence') {
    referenceAnswer = Array.isArray(payload.items) ? payload.items.map(String).join(' | ') : '';
  } else if (module.responseKind === 'matching.pairs') {
    const left = Array.isArray(payload.left) ? payload.left : [];
    const right = Array.isArray(payload.right) ? payload.right : [];
    referenceAnswer = left.map((item, index) => {
      const leftValue = String((item as { value?: unknown }).value ?? '');
      const rightValue = String((right[index] as { value?: unknown } | undefined)?.value ?? '');
      return `${leftValue}->${rightValue}`;
    }).join(' | ');
  } else {
    const options = Array.isArray(payload.options) ? payload.options : [];
    referenceAnswer = String((options[0] as { value?: unknown } | undefined)?.value ?? '');
  }
  return {
    referenceAnswer,
    explanation: '教师需在授课前核对参考答案与题目内容。',
    scoring: { strategy: 'exact-match', maxPoints: 1 },
  };
}

export function teacherFieldsForResponseKind(
  responseKind: string | undefined,
  fields: SmartCoursewareCompositionMetadata['teacherFields'],
): SmartCoursewareCompositionMetadata['teacherFields'] {
  const inclusionRationale = fields.inclusionRationale;
  if (isObjectiveInteractiveResponseKind(responseKind)) {
    return {
      ...(fields.referenceAnswer !== undefined ? { referenceAnswer: fields.referenceAnswer } : {}),
      ...(fields.explanation ? { explanation: fields.explanation } : {}),
      ...(fields.scoring ? { scoring: fields.scoring } : {}),
      ...(inclusionRationale ? { inclusionRationale } : {}),
    };
  }
  if (isSubjectiveInteractiveResponseKind(responseKind)) {
    return {
      ...(fields.expectedOutput ? { expectedOutput: fields.expectedOutput } : {}),
      ...(fields.reviewPoints ? { reviewPoints: fields.reviewPoints } : {}),
      ...(inclusionRationale ? { inclusionRationale } : {}),
    };
  }
  throw new Error('unsupported-courseware-response-kind');
}

function SourceStateBadge({ state }: { state: SmartCoursewareSourceState }) {
  const label = state === 'verified'
    ? '来源已验证'
    : state === 'ai_generated_source_pending'
      ? 'AI 生成，来源待补'
      : '教师创建，来源待补';
  return <span className="rounded bg-muted px-2 py-0.5 text-xs" data-courseware-source-state={state}>{label}</span>;
}

function provenanceLabel(value: SmartCoursewareTeacherModuleMetadata['provenance']) {
  if (value === 'ai-generated') return 'AI 生成';
  if (value === 'ai-generated-teacher-edited') return 'AI 生成后由教师编辑';
  return '教师创建';
}

function displayTeacherValue(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function errorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '操作失败';
  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'code' in error) return String(error.code);
  return '操作失败';
}
