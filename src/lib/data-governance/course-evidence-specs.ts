import type {
  InteractiveRuntimeActivityCardManifest,
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '../interactive-lesson-manifest';
import {
  listInteractiveLessonIdentityRecords,
  resolveInteractiveLessonIdentity,
  type InteractiveLessonIdentityAliasKind,
  type InteractiveLessonIdentityRecord,
} from '../interactive-lesson-identity';
import {
  isObjectiveInteractiveResponseKind,
  isParameterSetResponseKind,
} from '../interactive-response-contracts';

export type CourseEvidenceSpecSource = 'manifest' | 'override' | 'manifest+override';

export interface CourseEvidenceSpec {
  lessonId: string;
  lessonKey: string;
  routeSegment: string;
  studentStateKind: string;
  teacherSyncKind: string;
  preAssessmentStepId?: string;
  postAssessmentStepId?: string;
  summaryStepId?: string;
  responseProducingStepIds: string[];
  objectiveStepIds: string[];
  parameterStepIds: string[];
  parameterEvidenceKeys: string[];
  source: CourseEvidenceSpecSource;
}

export type CourseEvidenceSpecUnsupportedReason =
  | 'missing_manifest_metadata'
  | 'missing_lesson_id'
  | 'missing_route_segment'
  | 'missing_state_kind'
  | 'no_response_producing_steps';

export type CourseEvidenceSpecResolution =
  | { status: 'supported'; spec: CourseEvidenceSpec }
  | {
    status: 'unsupported';
    lessonId?: string;
    lessonKey?: string;
    routeSegment?: string;
    reason: CourseEvidenceSpecUnsupportedReason;
  };

export interface CourseEvidenceSpecOverride {
  lessonId: string;
  lessonKey?: string;
  routeSegment?: string;
  studentStateKind?: string;
  teacherSyncKind?: string;
  preAssessmentStepId?: string;
  postAssessmentStepId?: string;
  summaryStepId?: string;
  responseProducingStepIds?: string[];
  objectiveStepIds?: string[];
  parameterStepIds?: string[];
  parameterEvidenceKeys?: string[];
}

export interface ResolveCourseEvidenceSpecInput {
  manifest?: InteractiveRuntimeManifest | null;
  lessonId?: string;
  lessonKey?: string;
  routeSegment?: string;
  overrides?: readonly CourseEvidenceSpecOverride[];
}

type CourseEvidenceSemanticOverride = Omit<CourseEvidenceSpecOverride, 'lessonId' | 'lessonKey' | 'routeSegment'>;

const COURSE_EVIDENCE_SEMANTIC_OVERRIDES: Record<string, CourseEvidenceSemanticOverride> = {
  '5-3': {
    studentStateKind: 'unit53_student_state',
    teacherSyncKind: 'teacher_sync_unit53',
    preAssessmentStepId: 'step-03',
    postAssessmentStepId: 'step-14',
    summaryStepId: 'step-15',
  },
  '5-4': {
    studentStateKind: 'unit54_student_state',
    teacherSyncKind: 'teacher_sync_unit54',
    preAssessmentStepId: 'step-03',
    postAssessmentStepId: 'step-16',
    summaryStepId: 'step-17',
  },
  '5-5': {
    studentStateKind: 'unit55_student_state',
    teacherSyncKind: 'teacher_sync_unit55',
    preAssessmentStepId: 'step-03',
    postAssessmentStepId: 'step-16',
    summaryStepId: 'step-17',
  },
  '5-6': {
    studentStateKind: 'unit56_student_state',
    teacherSyncKind: 'teacher_sync_unit56',
    preAssessmentStepId: 'step-03',
    postAssessmentStepId: 'step-17',
    summaryStepId: 'step-18',
  },
  'cruise-comfort-boppps': {
    studentStateKind: 'cruise_student_state',
    teacherSyncKind: 'teacher_sync_cruise',
    preAssessmentStepId: 'precheck',
    postAssessmentStepId: 'consistency',
    summaryStepId: 'summary',
  },
};

function buildIdentityEvidenceOverride(record: InteractiveLessonIdentityRecord): CourseEvidenceSpecOverride {
  return {
    lessonId: record.canonicalId,
    ...(record.lessonKeys[0] ? { lessonKey: record.lessonKeys[0] } : {}),
    ...(record.routeSegments[0] ? { routeSegment: record.routeSegments[0] } : {}),
    ...COURSE_EVIDENCE_SEMANTIC_OVERRIDES[record.canonicalId],
  };
}

export const COURSE_EVIDENCE_SPEC_OVERRIDES: readonly CourseEvidenceSpecOverride[] =
  listInteractiveLessonIdentityRecords().map(buildIdentityEvidenceOverride);

const PARAMETER_INTERACTION_KINDS = new Set([
  'parameter_slider',
  'interactive_figure_submit',
]);

function compactUnsupported(value: {
  lessonId?: string;
  lessonKey?: string;
  routeSegment?: string;
  reason: CourseEvidenceSpecUnsupportedReason;
}): CourseEvidenceSpecResolution {
  return {
    status: 'unsupported',
    ...(value.lessonId ? { lessonId: value.lessonId } : {}),
    ...(value.lessonKey ? { lessonKey: value.lessonKey } : {}),
    ...(value.routeSegment ? { routeSegment: value.routeSegment } : {}),
    reason: value.reason,
  };
}

function unique(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function resolveEvidenceIdentityRecord(input: ResolveCourseEvidenceSpecInput): InteractiveLessonIdentityRecord | null {
  const manifest = input.manifest ?? null;
  const identifiers: Array<{ kind?: InteractiveLessonIdentityAliasKind; value: string | undefined }> = [
    { value: input.lessonId ?? manifest?.lessonId },
    { kind: 'lessonKey', value: input.lessonKey },
    { kind: 'routeSegment', value: input.routeSegment ?? manifest?.courseRouteSegment },
  ];

  const resolvedRecords = new Map<string, InteractiveLessonIdentityRecord>();
  for (const identifier of identifiers) {
    if (!identifier.value) continue;
    const resolved = identifier.kind
      ? resolveInteractiveLessonIdentity({ kind: identifier.kind, value: identifier.value })
      : resolveInteractiveLessonIdentity(identifier.value);
    if (resolved.status !== 'resolved') {
      return null;
    }
    resolvedRecords.set(resolved.record.canonicalId, resolved.record);
  }

  return resolvedRecords.size === 1
    ? Array.from(resolvedRecords.values())[0]
    : null;
}

function findOverrideByComparableIdentifiers(
  input: ResolveCourseEvidenceSpecInput,
  overrides: readonly CourseEvidenceSpecOverride[],
) {
  const manifest = input.manifest ?? null;
  const lessonId = input.lessonId ?? manifest?.lessonId;
  const lessonKey = input.lessonKey ?? (manifest?.courseRouteSegment ? `${manifest.courseRouteSegment}-v1` : undefined);
  const routeSegment = input.routeSegment ?? manifest?.courseRouteSegment;

  return overrides.find((override) => {
    const comparableIdentifiers = [
      [lessonId, override.lessonId],
      [lessonKey, override.lessonKey],
      [routeSegment, override.routeSegment],
    ].filter((pair): pair is [string, string] => Boolean(pair[0]) && Boolean(pair[1]));

    return comparableIdentifiers.some(([requested, registered]) => requested === registered)
      && comparableIdentifiers.every(([requested, registered]) => requested === registered);
  });
}

function findOverride(input: ResolveCourseEvidenceSpecInput) {
  if (input.overrides) {
    return findOverrideByComparableIdentifiers(input, input.overrides);
  }

  const record = resolveEvidenceIdentityRecord(input);
  if (!record) return undefined;
  return COURSE_EVIDENCE_SPEC_OVERRIDES.find((override) => override.lessonId === record.canonicalId);
}

function inferStateKinds(lessonId: string) {
  const match = /^(\d+)-(\d+)$/.exec(lessonId);
  if (!match) return null;
  const [, chapter, unit] = match;
  return {
    studentStateKind: `unit${chapter}${unit}_student_state`,
    teacherSyncKind: `teacher_sync_unit${chapter}${unit}`,
  };
}

function hasSemanticOverride(override: CourseEvidenceSpecOverride | undefined): boolean {
  if (!override) return false;
  return Boolean(
    override.studentStateKind
    || override.teacherSyncKind
    || override.preAssessmentStepId
    || override.postAssessmentStepId
    || override.summaryStepId
    || override.responseProducingStepIds
    || override.objectiveStepIds
    || override.parameterStepIds
    || override.parameterEvidenceKeys,
  );
}

function orderedSteps(manifest: InteractiveRuntimeManifest): InteractiveRuntimeStepManifest[] {
  const byId = new Map(manifest.steps.map((step) => [step.id, step]));
  const ordered = manifest.stepOrder
    .map((stepId) => byId.get(stepId))
    .filter((step): step is InteractiveRuntimeStepManifest => Boolean(step));
  return ordered.length > 0 ? ordered : manifest.steps;
}

function hasActivityCards(step: InteractiveRuntimeStepManifest): boolean {
  return (step.interactionSpec.activityCards ?? []).length > 0;
}

function isResponseProducingStep(step: InteractiveRuntimeStepManifest): boolean {
  if (step.interactionSpec.interactionKind === 'teacher_reveal_only') return false;
  return hasActivityCards(step)
    || (step.interactionSpec.submitFields ?? []).length > 0
    || PARAMETER_INTERACTION_KINDS.has(step.interactionSpec.interactionKind)
    || step.interactionSpec.interactionKind === 'rust_toy_training_panel'
    || step.interactionSpec.interactionKind === 'rust_heading_rl_training_panel';
}

function isObjectiveCard(card: InteractiveRuntimeActivityCardManifest): boolean {
  return isObjectiveInteractiveResponseKind(card.responseKind);
}

function isObjectiveStep(step: InteractiveRuntimeStepManifest): boolean {
  return (step.interactionSpec.activityCards ?? []).some(isObjectiveCard);
}

function parameterKeysFromCard(card: InteractiveRuntimeActivityCardManifest): string[] {
  return [
    ...(card.structuredFields ?? []),
    ...(card.parameterFields ?? []).map((field) => field.key),
  ];
}

function parameterKeysFromStep(step: InteractiveRuntimeStepManifest): string[] {
  return unique([
    ...(step.interactionSpec.submitFields ?? []),
    ...(step.interactionSpec.activityCards ?? []).flatMap(parameterKeysFromCard),
  ]);
}

function isParameterStep(step: InteractiveRuntimeStepManifest): boolean {
  return PARAMETER_INTERACTION_KINDS.has(step.interactionSpec.interactionKind)
    || parameterKeysFromStep(step).length > 0
    || (step.interactionSpec.activityCards ?? []).some((card) => isParameterSetResponseKind(card.responseKind));
}

function inferFirstQuizStepId(steps: InteractiveRuntimeStepManifest[]): string | undefined {
  return steps.find((step) => step.interactionSpec.interactionKind === 'quiz_group')?.id;
}

function inferLastQuizStepId(steps: InteractiveRuntimeStepManifest[], preStepId?: string): string | undefined {
  const quizSteps = steps.filter((step) => step.interactionSpec.interactionKind === 'quiz_group');
  const lastQuizStep = quizSteps.at(-1)?.id;
  return lastQuizStep && lastQuizStep !== preStepId ? lastQuizStep : undefined;
}

function inferSummaryStepId(steps: InteractiveRuntimeStepManifest[]): string | undefined {
  return [...steps].reverse().find((step) => (
    step.interactionSpec.interactionKind === 'summary'
    || step.interactionSpec.interactionKind === 'none'
    || step.title.includes('总结')
    || step.title.toLowerCase().includes('summary')
  ))?.id;
}

function buildSpecFromManifest(
  manifest: InteractiveRuntimeManifest,
  override: CourseEvidenceSpecOverride | undefined,
): CourseEvidenceSpecResolution {
  const lessonId = override?.lessonId ?? manifest.lessonId;
  const routeSegment = override?.routeSegment ?? manifest.courseRouteSegment;
  const lessonKey = override?.lessonKey ?? (routeSegment ? `${routeSegment}-v1` : '');
  const stateKinds = lessonId ? inferStateKinds(lessonId) : null;
  const studentStateKind = override?.studentStateKind ?? stateKinds?.studentStateKind;
  const teacherSyncKind = override?.teacherSyncKind ?? stateKinds?.teacherSyncKind;

  if (!lessonId) return compactUnsupported({ reason: 'missing_lesson_id' });
  if (!routeSegment) return compactUnsupported({ lessonId, lessonKey, reason: 'missing_route_segment' });
  if (!studentStateKind || !teacherSyncKind) {
    return compactUnsupported({ lessonId, lessonKey, routeSegment, reason: 'missing_state_kind' });
  }

  const steps = orderedSteps(manifest);
  const inferredResponseStepIds = steps.filter(isResponseProducingStep).map((step) => step.id);
  const responseProducingStepIds = override?.responseProducingStepIds ?? inferredResponseStepIds;
  if (responseProducingStepIds.length === 0) {
    return compactUnsupported({ lessonId, lessonKey, routeSegment, reason: 'no_response_producing_steps' });
  }

  const preAssessmentStepId = override?.preAssessmentStepId ?? inferFirstQuizStepId(steps);
  const postAssessmentStepId = override?.postAssessmentStepId ?? inferLastQuizStepId(steps, preAssessmentStepId);
  const parameterStepIds = override?.parameterStepIds ?? steps.filter(isParameterStep).map((step) => step.id);
  const parameterEvidenceKeys = override?.parameterEvidenceKeys
    ?? unique(steps.filter(isParameterStep).flatMap(parameterKeysFromStep));

  return {
    status: 'supported',
    spec: {
      lessonId,
      lessonKey,
      routeSegment,
      studentStateKind,
      teacherSyncKind,
      preAssessmentStepId,
      postAssessmentStepId,
      summaryStepId: override?.summaryStepId ?? inferSummaryStepId(steps),
      responseProducingStepIds,
      objectiveStepIds: override?.objectiveStepIds ?? steps.filter(isObjectiveStep).map((step) => step.id),
      parameterStepIds,
      parameterEvidenceKeys,
      source: hasSemanticOverride(override) ? 'manifest+override' : 'manifest',
    },
  };
}

function buildSpecFromOverride(
  input: ResolveCourseEvidenceSpecInput,
  override: CourseEvidenceSpecOverride,
): CourseEvidenceSpecResolution {
  const lessonId = override.lessonId ?? input.lessonId;
  const lessonKey = input.lessonKey ?? override.lessonKey ?? '';
  const routeSegment = input.routeSegment ?? override.routeSegment;
  const stateKinds = lessonId ? inferStateKinds(lessonId) : null;
  const studentStateKind = override.studentStateKind ?? stateKinds?.studentStateKind;
  const teacherSyncKind = override.teacherSyncKind ?? stateKinds?.teacherSyncKind;

  if (!lessonId) return compactUnsupported({ lessonKey, routeSegment, reason: 'missing_lesson_id' });
  if (!routeSegment) return compactUnsupported({ lessonId, lessonKey, reason: 'missing_route_segment' });
  if (!studentStateKind || !teacherSyncKind) {
    return compactUnsupported({ lessonId, lessonKey, routeSegment, reason: 'missing_state_kind' });
  }
  if (!override.responseProducingStepIds && !override.preAssessmentStepId && !override.postAssessmentStepId) {
    return compactUnsupported({ lessonId, lessonKey, routeSegment, reason: 'missing_manifest_metadata' });
  }

  const responseProducingStepIds = override.responseProducingStepIds
    ?? unique([override.preAssessmentStepId, override.postAssessmentStepId]);
  if (responseProducingStepIds.length === 0) {
    return compactUnsupported({ lessonId, lessonKey, routeSegment, reason: 'no_response_producing_steps' });
  }

  return {
    status: 'supported',
    spec: {
      lessonId,
      lessonKey,
      routeSegment,
      studentStateKind,
      teacherSyncKind,
      preAssessmentStepId: override.preAssessmentStepId,
      postAssessmentStepId: override.postAssessmentStepId,
      summaryStepId: override.summaryStepId,
      responseProducingStepIds,
      objectiveStepIds: override.objectiveStepIds ?? responseProducingStepIds,
      parameterStepIds: override.parameterStepIds ?? [],
      parameterEvidenceKeys: override.parameterEvidenceKeys ?? [],
      source: 'override',
    },
  };
}

export function resolveCourseEvidenceSpec(input: ResolveCourseEvidenceSpecInput): CourseEvidenceSpecResolution {
  const manifest = input.manifest ?? null;
  const override = findOverride(input);
  if (!manifest) {
    if (override) return buildSpecFromOverride(input, override);
    return compactUnsupported({
      lessonId: input.lessonId,
      lessonKey: input.lessonKey,
      routeSegment: input.routeSegment,
      reason: 'missing_manifest_metadata',
    });
  }

  return buildSpecFromManifest(manifest, override);
}

export function listCourseEvidenceResponseStepIds(spec: CourseEvidenceSpec): string[] {
  return [...spec.responseProducingStepIds];
}

export function listCourseEvidenceObjectiveStepIds(spec: CourseEvidenceSpec): string[] {
  return [...spec.objectiveStepIds];
}

export function listCourseEvidenceParameterStepIds(spec: CourseEvidenceSpec): string[] {
  return [...spec.parameterStepIds];
}

export function getCourseEvidenceSummaryStepId(spec: CourseEvidenceSpec): string | undefined {
  return spec.summaryStepId;
}
