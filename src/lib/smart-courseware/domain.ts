import { randomUUID } from 'node:crypto';

import {
  adaptGeneratedSlideManifestToInteractiveRuntime,
  computeGeneratedSlideContentHash,
  validateGeneratedSlideManifest,
  type GeneratedSlideManifest,
  type GeneratedSlideModule,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { isObjectiveInteractiveResponseKind, isSubjectiveInteractiveResponseKind } from '@/lib/interactive-response-contracts';
import { contentHash, normalizeSourceBindings } from '@/lib/smart-lesson-plan/domain';
import type { SmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

import {
  COURSEWARE_AUTHORING_SCHEMA_VERSION,
  coursewareCompositionInputSchema,
  coursewareModuleMetadataSchema,
  coursewareTeacherProjectionSchema,
  type CoursewareCompositionInput,
  type CoursewareModuleMetadata,
  type CoursewareModuleMetadataInput,
} from './schema';

export type SmartCoursewareActor = { id: string; role: 'TEACHER' | 'ADMIN' };

export class SmartCoursewareError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
    this.name = 'SmartCoursewareError';
  }
}

type PersistedModuleState = {
  moduleInstanceLineage: string;
  contentHash: string;
  sourceState: string;
  sourceBindingSetHash: string;
  gapIdentity: string | null;
  provenance: string;
  originalAttemptId: string | null;
  teacherMetadata?: unknown;
};

const PLAN_STAGE_KEYS = [
  'bridgeIn',
  'objectives',
  'preAssessment',
  'participatoryLearning',
  'postAssessment',
  'summary',
] as const;

const REQUIRED_ACTIVITY_STAGES = new Set([
  'pre-assessment',
  'participatory-learning',
  'post-assessment',
]);

export function validateCoursewareComposition(
  value: unknown,
  plan: SmartLessonPlan,
): CoursewareCompositionInput & { validation: ReturnType<typeof validateGeneratedSlideManifest> } {
  const input = coursewareCompositionInputSchema.parse(value);
  const validation = validateGeneratedSlideManifest(input.runtimeManifest);
  if (!validation.valid) {
    const first = validation.issues.find((issue) => issue.severity === 'error');
    throw new SmartCoursewareError(`runtime-manifest-invalid:${first?.code ?? 'unknown'}`, 409);
  }
  if (input.runtimeManifest.durationSeconds !== plan.durationMinutes * 60) {
    throw new SmartCoursewareError('plan-duration-changed', 409);
  }
  input.runtimeManifest.stages.forEach((stage, index) => {
    const planStage = plan.boppps[PLAN_STAGE_KEYS[index]];
    if (!planStage || stage.durationSeconds !== planStage.minutes * 60) {
      throw new SmartCoursewareError(`plan-stage-timing-changed:${stage.stage}`, 409);
    }
    if (REQUIRED_ACTIVITY_STAGES.has(stage.stage)
      && !stage.steps.some((step) => step.modules.some((module) => module.canonicalClass === 'activity.panel'))) {
      throw new SmartCoursewareError(`required-activity-missing:${stage.stage}`, 409);
    }
  });
  assertExactMetadataCoverage(input.runtimeManifest, input.moduleMetadata);
  assertActivityTeacherEvidence(input.runtimeManifest, input.moduleMetadata);
  return { ...input, validation };
}

export function assertCoursewareManifestIdentity(input: {
  draftId: string;
  approvedPlanTitle: string;
  manifest: GeneratedSlideManifest;
}) {
  if (input.manifest.lessonId !== input.draftId || input.manifest.title !== input.approvedPlanTitle) {
    throw new SmartCoursewareError('courseware-manifest-identity-mismatch', 409);
  }
}

export function assertPersistedCoursewareManifest(input: {
  draftId: string;
  approvedPlanTitle: string;
  manifest: GeneratedSlideManifest | null;
  contentHash: string | null;
}) {
  if (!input.manifest) {
    if (input.contentHash) throw new SmartCoursewareError('courseware-content-hash-mismatch', 409);
    return;
  }
  assertCoursewareManifestIdentity({
    draftId: input.draftId,
    approvedPlanTitle: input.approvedPlanTitle,
    manifest: input.manifest,
  });
  if (!input.contentHash || coursewareManifestHash(input.manifest) !== input.contentHash) {
    throw new SmartCoursewareError('courseware-content-hash-mismatch', 409);
  }
}

export function deriveCoursewareModuleMetadata(input: {
  authoringLineageRoot: string;
  runtimeModule: GeneratedSlideModule;
  requested: CoursewareModuleMetadataInput;
  allowedSourceBindings: readonly ReturnType<typeof normalizeSourceBindings>[number][];
  existing?: PersistedModuleState;
  newProvenance?: CoursewareModuleMetadata['provenance'];
  originalAttemptId?: string | null;
}): CoursewareModuleMetadata {
  const sourceBindings = normalizeSourceBindings(input.requested.sourceBindings);
  const allowed = new Set(input.allowedSourceBindings.map(sourceBindingKey));
  if (sourceBindings.some((binding) => !allowed.has(sourceBindingKey(binding)))) {
    throw new SmartCoursewareError('source-binding-not-in-approved-plan', 409);
  }
  if (input.requested.sourceState === 'verified' && sourceBindings.length === 0) {
    throw new SmartCoursewareError('verified-source-binding-required', 409);
  }

  const moduleContentHash = contentHash(input.runtimeModule);
  const sourceBindingSetHash = contentHash(sourceBindings);
  const persistenceSourceState = persistenceSourceStateFor(input.requested.sourceState);
  const existing = input.existing;
  const moduleInstanceLineage = existing?.moduleInstanceLineage ?? randomUUID();
  const definingStateUnchanged = existing
    && existing.contentHash === moduleContentHash
    && existing.sourceState === persistenceSourceState
    && existing.sourceBindingSetHash === sourceBindingSetHash;
  const gapIdentity = input.requested.sourceState === 'verified'
    ? null
    : definingStateUnchanged && existing.gapIdentity
      ? existing.gapIdentity
      : `courseware-gap:${contentHash({
          authoringLineageRoot: input.authoringLineageRoot,
          moduleId: input.runtimeModule.id,
          moduleInstanceLineage,
          moduleContentHash,
          sourceState: input.requested.sourceState,
          sourceBindingSetHash,
        })}`;
  const auditableStateChanged = existing && (
    existing.contentHash !== moduleContentHash
    || existing.sourceState !== persistenceSourceState
    || existing.sourceBindingSetHash !== sourceBindingSetHash
    || contentHash(existing.teacherMetadata ?? null) !== contentHash(input.requested.teacherFields)
  );
  const provenance = input.newProvenance
    ? input.newProvenance
    : !existing
      ? 'teacher_created'
    : existing.provenance === 'AI_GENERATED' && auditableStateChanged
      ? 'ai_generated_teacher_edited'
      : publicProvenance(existing.provenance);

  return coursewareModuleMetadataSchema.parse({
    ...input.requested,
    sourceBindings,
    moduleInstanceLineage,
    moduleContentHash,
    sourceBindingSetHash,
    gapIdentity,
    provenance,
    originalAttemptId: input.originalAttemptId !== undefined
      ? input.originalAttemptId
      : existing?.originalAttemptId ?? null,
  });
}

export function projectCoursewareForTeacher(input: {
  draftId: string;
  version: number;
  planRevisionId: string;
  planContentHash: string;
  runtimeManifest: GeneratedSlideManifest;
  moduleMetadata: CoursewareModuleMetadata[];
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
}) {
  return coursewareTeacherProjectionSchema.parse({
    schemaVersion: COURSEWARE_AUTHORING_SCHEMA_VERSION,
    ...input,
    validation: validateGeneratedSlideManifest(input.runtimeManifest),
  });
}

export function projectCoursewareForStudent(input: {
  draftId: string;
  version: number;
  runtimeManifest: GeneratedSlideManifest;
}) {
  const adapted = adaptGeneratedSlideManifestToInteractiveRuntime(input.runtimeManifest);
  return {
    schemaVersion: COURSEWARE_AUTHORING_SCHEMA_VERSION,
    draftId: input.draftId,
    version: input.version,
    runtimeManifest: studentRuntimeProjection(adapted.runtimeManifest, input.runtimeManifest),
    notice: 'ai-assisted-teacher-reviewed' as const,
  };
}

export function coursewareManifestHash(manifest: GeneratedSlideManifest) {
  return computeGeneratedSlideContentHash(manifest);
}

export function coursewareModuleGenerationInputHash(input: {
  draftId: string;
  draftVersion: number;
  planRevisionId: string;
  planContentHash: string;
  moduleId: string;
  moduleHash: string;
}) {
  return contentHash(input);
}

export function persistenceSourceStateFor(value: CoursewareModuleMetadataInput['sourceState']) {
  if (value === 'verified') return 'VERIFIED' as const;
  if (value === 'ai_generated_source_pending') return 'AI_GENERATED_SOURCE_PENDING' as const;
  return 'TEACHER_CREATED_SOURCE_PENDING' as const;
}

export function persistenceProvenanceFor(value: CoursewareModuleMetadata['provenance']) {
  if (value === 'ai_generated') return 'AI_GENERATED' as const;
  if (value === 'ai_generated_teacher_edited') return 'AI_GENERATED_TEACHER_EDITED' as const;
  return 'TEACHER_CREATED' as const;
}

function publicProvenance(value: string): CoursewareModuleMetadata['provenance'] {
  if (value === 'AI_GENERATED') return 'ai_generated';
  if (value === 'AI_GENERATED_TEACHER_EDITED') return 'ai_generated_teacher_edited';
  return 'teacher_created';
}

function assertExactMetadataCoverage(
  manifest: GeneratedSlideManifest,
  metadata: CoursewareModuleMetadataInput[],
) {
  const manifestIds = manifest.stages.flatMap((stage) => stage.steps.flatMap((step) => step.modules.map((module) => module.id)));
  const metadataIds = metadata.map((item) => item.moduleId);
  if (new Set(metadataIds).size !== metadataIds.length
    || manifestIds.length !== metadataIds.length
    || manifestIds.some((id) => !metadataIds.includes(id))) {
    throw new SmartCoursewareError('module-metadata-coverage-invalid', 409);
  }
}

function assertActivityTeacherEvidence(
  manifest: GeneratedSlideManifest,
  metadata: CoursewareModuleMetadataInput[],
) {
  const metadataById = new Map(metadata.map((item) => [item.moduleId, item]));
  for (const module of manifest.stages.flatMap((stage) => stage.steps.flatMap((step) => step.modules))) {
    const teacherFields = metadataById.get(module.id)!.teacherFields;
    if (module.canonicalClass !== 'activity.panel') {
      if (hasAnyTeacherField(teacherFields, ['referenceAnswer', 'explanation', 'scoring', 'expectedOutput', 'reviewPoints'])) {
        throw new SmartCoursewareError(`content-module-teacher-evidence-forbidden:${module.id}`, 409);
      }
      continue;
    }
    if (isObjectiveInteractiveResponseKind(module.responseKind)) {
      if (hasAnyTeacherField(teacherFields, ['expectedOutput', 'reviewPoints'])) {
        throw new SmartCoursewareError(`objective-activity-open-evidence-forbidden:${module.id}`, 409);
      }
      if (teacherFields.referenceAnswer === undefined || !teacherFields.explanation || !teacherFields.scoring) {
        throw new SmartCoursewareError(`objective-activity-teacher-evidence-required:${module.id}`, 409);
      }
      assertObjectiveReferenceSemantics(module, teacherFields.referenceAnswer);
      continue;
    }
    if (isSubjectiveInteractiveResponseKind(module.responseKind)) {
      if (hasAnyTeacherField(teacherFields, ['referenceAnswer', 'explanation', 'scoring'])) {
        throw new SmartCoursewareError(`open-activity-objective-evidence-forbidden:${module.id}`, 409);
      }
      if (!teacherFields.expectedOutput || !teacherFields.reviewPoints?.length) {
        throw new SmartCoursewareError(`open-activity-teacher-evidence-required:${module.id}`, 409);
      }
    }
  }
}

function hasAnyTeacherField(
  fields: CoursewareModuleMetadataInput['teacherFields'],
  keys: Array<keyof CoursewareModuleMetadataInput['teacherFields']>,
) {
  return keys.some((key) => fields[key] !== undefined);
}

function assertObjectiveReferenceSemantics(module: GeneratedSlideModule, referenceAnswer: string) {
  const payload = module.payload as Record<string, unknown>;
  const kind = module.responseKind;
  if (kind === 'choice.single' || kind === 'choice.binary' || kind === 'choice.multi') {
    const options = optionValues(payload.options);
    const tokens = referenceTokens(referenceAnswer);
    const resolved = tokens.map((token) => resolveAllowedToken(options, token));
    const valid = kind === 'choice.multi'
      ? tokens.length > 0 && resolved.every(Boolean) && new Set(resolved).size === resolved.length
      : tokens.length === 1 && Boolean(resolved[0]);
    if (!valid) throw new SmartCoursewareError(`objective-reference-invalid:${module.id}`, 409);
    return;
  }
  if (kind === 'ordering.sequence') {
    const items = Array.isArray(payload.items) ? payload.items.map((item) => String(item).trim()).filter(Boolean) : [];
    const tokens = referenceTokens(referenceAnswer);
    if (tokens.length !== items.length || tokens.some((token, index) => normalizeToken(token) !== normalizeToken(items[index]))) {
      throw new SmartCoursewareError(`objective-reference-invalid:${module.id}`, 409);
    }
    return;
  }
  if (kind === 'matching.pairs') {
    const left = optionValues(payload.left);
    const right = optionValues(payload.right);
    const pairs = referenceAnswer.split(/\s*(?:\||[,，;；])\s*/).filter(Boolean).map((token) => {
      const match = token.match(/^\s*(.+?)\s*(?:->|=>|:|=|→)\s*(.+?)\s*$/);
      return match ? [resolveAllowedToken(left, match[1]), resolveAllowedToken(right, match[2])] as const : null;
    });
    const leftValues = pairs.map((pair) => pair?.[0]);
    const rightValues = pairs.map((pair) => pair?.[1]);
    if (pairs.length !== left.length || pairs.some((pair) => !pair?.[0] || !pair[1])
      || new Set(leftValues).size !== left.length || new Set(rightValues).size !== right.length) {
      throw new SmartCoursewareError(`objective-reference-invalid:${module.id}`, 409);
    }
  }
}

function referenceTokens(value: string) {
  return value
    .replace(/^\s*(?:选|答案|正确答案)\s*[:：]?\s*/i, '')
    .split(/\s*(?:\|+|[,，、;；/])\s*/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function optionValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return [{ value: item, label: item }];
    if (!item || typeof item !== 'object') return [];
    const option = item as { value?: unknown; label?: unknown };
    const optionValue = String(option.value ?? '').trim();
    const label = String(option.label ?? '').trim();
    return optionValue && label ? [{ value: optionValue, label }] : [];
  });
}

function resolveAllowedToken(options: Array<{ value: string; label: string }>, token: string) {
  const normalized = normalizeToken(token);
  return options.find((option) => normalizeToken(option.value) === normalized || normalizeToken(option.label) === normalized)?.value ?? null;
}

function normalizeToken(value: string) { return value.trim().toLowerCase(); }

function sourceBindingKey(binding: { citationId: string; sourceVersionId: string; anchor: string; contentHash: string }) {
  return `${binding.sourceVersionId}\u0000${binding.anchor}\u0000${binding.contentHash}\u0000${binding.citationId}`;
}

function studentRuntimeProjection(
  runtime: InteractiveRuntimeManifest,
  generated: GeneratedSlideManifest,
): InteractiveRuntimeManifest {
  const sourceSteps = new Map(generated.stages.flatMap((stage) => stage.steps).map((step) => [step.id, step]));
  return {
    ...runtime,
    steps: runtime.steps.map((step) => {
      const source = sourceSteps.get(step.id);
      if (!source) return step;
      const visible = new Set(source.modules.filter((module) => module.roleMetadata.studentVisible).map((module) => module.id));
      const activityCards = (step.interactionSpec.activityCards ?? [])
        .filter((card) => visible.has(card.id))
        .map(({ referenceAnswer: _answer, referenceMatches: _matches, ...card }) => card);
      const evidencePaths = source.modules
        .filter((module) => visible.has(module.id) && module.canonicalClass === 'activity.panel')
        .flatMap((module) => module.evidencePath ? [module.evidencePath] : []);
      return {
        ...step,
        modules: step.modules.filter((module) => visible.has(module.id)),
        evidenceSequence: evidencePaths,
        interactionSpec: {
          ...step.interactionSpec,
          interactionKind: activityCards.length ? step.interactionSpec.interactionKind : 'display',
          studentTask: activityCards[0]?.prompt,
          activityCards,
          submitFields: evidencePaths,
          answerReveal: undefined,
        },
        telemetrySpec: { ...step.telemetrySpec, summaryFields: evidencePaths },
      };
    }),
  };
}
