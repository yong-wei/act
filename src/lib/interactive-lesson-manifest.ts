export type InteractiveTeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct';

export type InteractiveInteractionKind =
  | 'none'
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'parameter_slider'
  | 'triple_match'
  | 'card_sort'
  | 'structured_compare'
  | 'quiz_group'
  | 'multi_select_matrix'
  | 'quiz_card_grid'
  | 'activity_card_set'
  | 'table_builder'
  | 'teacher_reveal_only'
  | 'single_choice'
  | 'worked_example_reveal'
  | 'task_card_workspace'
  | 'row_focus_toggle'
  | 'curve_compare_panel'
  | 'activity_cards'
  | 'step_reveal'
  | 'reason_chain'
  | 'matrix_choice_cards'
  | 'card_sort'
  | 'hotspot_labeling'
  | 'band_focus_panel'
  | 'goal_cards'
  | 'goal_cards_plus_ai'
  | 'evidence_mark_cards'
  | 'structured_compare'
  | 'scheme_vote_cards'
  | 'reflection_card';

export interface InteractiveRuntimeLayoutRegion {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface InteractiveRuntimeModuleManifest {
  id: string;
  title?: string;
  region: string;
  kind: string;
  mustBeVisible: boolean;
  payload: Record<string, unknown>;
}

export interface InteractiveRuntimeChoiceOptionManifest {
  value: string;
  label: string;
}

export interface InteractiveRuntimeActivityCardManifest {
  id: string;
  title?: string;
  prompt: string;
  referenceAnswer?: string;
  responseKind: string;
  submitScope: string;
  layoutSpan: string;
  options: InteractiveRuntimeChoiceOptionManifest[];
}

export interface InteractiveRuntimeStepManifest {
  id: string;
  title: string;
  layout: {
    template: string;
    regions: InteractiveRuntimeLayoutRegion[];
  };
  modules: InteractiveRuntimeModuleManifest[];
  contentBlocks: Record<string, unknown>;
  evidenceSequence: string[];
  interactionSpec: {
    interactionKind: InteractiveInteractionKind;
    studentTask?: string;
    activityCards?: InteractiveRuntimeActivityCardManifest[];
    stepRevealPolicy?: Record<string, unknown>;
    answerReveal?: string;
  };
  teacherControls: {
    releaseActivity: InteractiveTeacherControlMode;
    openBrowse: InteractiveTeacherControlMode;
    teacherStepReveal: InteractiveTeacherControlMode;
    revealReferenceAnswer: InteractiveTeacherControlMode;
  };
  studentAccess: Record<string, unknown>;
  teacherInsightSpec: {
    widgets: string[];
  };
  telemetrySpec: {
    summaryFields: string[];
    misconceptionTags: string[];
  };
  aiContextSpec: {
    pageGoal: string;
    deliveryMode: string;
  };
  interactiveFigureSpec: {
    layoutMirror?: string;
    controlsPlacement?: string;
    controlsCollapsedByDefault?: boolean;
  };
  previewContract: {
    demoPath: string;
  };
  acceptanceChecks: string[];
}

export interface InteractiveRuntimeManifest {
  lessonId: string;
  courseTitle: string;
  courseRouteSegment: string;
  previewMode: Record<string, unknown>;
  mediaPolicy: Record<string, unknown>;
  telemetryStrategy: string;
  teacherInsightStrategy: string;
  requiredStepFields: string[];
  stepOrder: string[];
  steps: InteractiveRuntimeStepManifest[];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeContentBlocks(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map((item) => {
          const block = asRecord(item);
          const blockId = typeof block.id === 'string' ? block.id : '';
          if (!blockId) return null;
          const content = { ...block };
          delete content.id;
          return [blockId, content] as const;
        })
        .filter((item): item is readonly [string, Record<string, unknown>] => Boolean(item)),
    );
  }

  return asRecord(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function normalizeRegion(value: unknown): InteractiveRuntimeLayoutRegion {
  const region = asRecord(value);
  const width = region.width === 'half' ? 'half' : 'full';
  const order = Number(region.order ?? 0);
  return {
    id: String(region.id ?? ''),
    width,
    order,
  };
}

function normalizeModule(value: unknown): InteractiveRuntimeModuleManifest {
  const moduleRecord = asRecord(value);
  return {
    id: String(moduleRecord.id ?? ''),
    title: moduleRecord.title ? String(moduleRecord.title) : undefined,
    region: String(moduleRecord.region ?? ''),
    kind: String(moduleRecord.kind ?? ''),
    mustBeVisible: Boolean(moduleRecord.must_be_visible ?? moduleRecord.mustBeVisible),
    payload: asRecord(moduleRecord.payload),
  };
}

function normalizeChoiceOption(value: unknown): InteractiveRuntimeChoiceOptionManifest | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value);
    return { value: text, label: text };
  }

  const option = asRecord(value);
  const rawLabel = option.label ?? option.text ?? option.value ?? option.id;
  const rawValue = option.value ?? option.id ?? rawLabel;
  const label = String(rawLabel ?? '');
  const optionValue = String(rawValue ?? label);

  if (!label.trim() && !optionValue.trim()) {
    return null;
  }

  return {
    value: optionValue,
    label: label || optionValue,
  };
}

function normalizeChoiceOptions(value: unknown): InteractiveRuntimeChoiceOptionManifest[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeChoiceOption)
    .filter((item): item is InteractiveRuntimeChoiceOptionManifest => Boolean(item));
}

function normalizeActivityCard(value: unknown): InteractiveRuntimeActivityCardManifest {
  const card = asRecord(value);
  return {
    id: String(card.id ?? ''),
    title: card.title ? String(card.title) : undefined,
    prompt: String(card.prompt ?? ''),
    referenceAnswer: card.reference_answer
      ? String(card.reference_answer)
      : card.referenceAnswer
        ? String(card.referenceAnswer)
        : undefined,
    responseKind: String(card.response_kind ?? card.responseKind ?? ''),
    submitScope: String(card.submit_scope ?? card.submitScope ?? ''),
    layoutSpan: String(card.layout_span ?? card.layoutSpan ?? ''),
    options: normalizeChoiceOptions(card.options),
  };
}

function normalizeStep(stepId: string, value: unknown): InteractiveRuntimeStepManifest {
  const step = asRecord(value);
  const layout = asRecord(step.layout);
  const interactionSpec = asRecord(step.interaction_spec);
  const interactionKind = String(
    interactionSpec.interaction_kind ?? interactionSpec.interactionKind ?? 'none',
  ) as InteractiveInteractionKind;
  const teacherControls = asRecord(step.teacher_controls);
  const teacherInsightSpec = asRecord(step.teacher_insight_spec);
  const telemetrySpec = asRecord(step.telemetry_spec);
  const aiContextSpec = asRecord(step.ai_context_spec);
  const interactiveFigureSpec = asRecord(step.interactive_figure_spec);
  const figureControls = asRecord(interactiveFigureSpec.controls);
  const previewContract = asRecord(step.preview_contract);

  return {
    id: stepId,
    title: String(step.title ?? stepId),
    layout: {
      template: String(layout.template ?? 'stacked_regions'),
      regions: Array.isArray(layout.regions) ? layout.regions.map(normalizeRegion) : [],
    },
    modules: Array.isArray(step.modules) ? step.modules.map(normalizeModule) : [],
    contentBlocks: normalizeContentBlocks(step.content_blocks),
    evidenceSequence: asStringArray(step.evidence_sequence),
    interactionSpec: {
      interactionKind,
      studentTask: interactionSpec.student_task ? String(interactionSpec.student_task) : undefined,
      activityCards: Array.isArray(interactionSpec.activity_cards)
        ? interactionSpec.activity_cards.map(normalizeActivityCard)
        : undefined,
      stepRevealPolicy: interactionSpec.step_reveal_policy
        ? asRecord(interactionSpec.step_reveal_policy)
        : undefined,
      answerReveal: interactionSpec.answer_reveal ? String(interactionSpec.answer_reveal) : undefined,
    },
    teacherControls: {
      releaseActivity: String(
        teacherControls.release_activity
        ?? teacherControls.releaseActivity
        ?? (isInteractiveRuntimePageType(interactionKind) ? 'teacher_toggle' : 'not_applicable'),
      ) as InteractiveTeacherControlMode,
      openBrowse: String(
        teacherControls.open_browse ?? teacherControls.openBrowse ?? 'not_applicable',
      ) as InteractiveTeacherControlMode,
      teacherStepReveal: String(
        teacherControls.teacher_step_reveal ?? teacherControls.teacherStepReveal ?? 'not_applicable',
      ) as InteractiveTeacherControlMode,
      revealReferenceAnswer: String(
        teacherControls.reveal_reference_answer
        ?? teacherControls.revealReferenceAnswer
        ?? (interactionKind === 'quiz_group' || interactionKind === 'single_choice' ? 'teacher_toggle' : 'not_applicable'),
      ) as InteractiveTeacherControlMode,
    },
    studentAccess: asRecord(step.student_access),
    teacherInsightSpec: {
      widgets: asStringArray(teacherInsightSpec.widgets),
    },
    telemetrySpec: {
      summaryFields: asStringArray(telemetrySpec.summary_fields ?? telemetrySpec.summaryFields),
      misconceptionTags: asStringArray(
        telemetrySpec.misconception_tags ?? telemetrySpec.misconceptionTags,
      ),
    },
    aiContextSpec: {
      pageGoal: String(aiContextSpec.page_goal ?? aiContextSpec.pageGoal ?? ''),
      deliveryMode: String(aiContextSpec.delivery_mode ?? aiContextSpec.deliveryMode ?? ''),
    },
    interactiveFigureSpec: {
      layoutMirror: typeof interactiveFigureSpec.layout_mirror === 'string'
        ? interactiveFigureSpec.layout_mirror
        : typeof interactiveFigureSpec.layoutMirror === 'string'
          ? interactiveFigureSpec.layoutMirror
          : undefined,
      controlsPlacement: typeof figureControls.placement === 'string'
        ? figureControls.placement
        : undefined,
      controlsCollapsedByDefault: typeof figureControls.collapsed_by_default === 'boolean'
        ? figureControls.collapsed_by_default
        : typeof figureControls.collapsedByDefault === 'boolean'
          ? figureControls.collapsedByDefault
          : undefined,
    },
    previewContract: {
      demoPath: String(previewContract.demo_path ?? previewContract.demoPath ?? ''),
    },
    acceptanceChecks: asStringArray(step.acceptance_checks),
  };
}

export function normalizeInteractiveRuntimeManifest(raw: unknown): InteractiveRuntimeManifest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const manifest = raw as Record<string, unknown>;
  const rawSteps = asRecord(manifest.steps);
  const stepOrder = Object.keys(rawSteps);
  const steps = stepOrder.map((stepId) => normalizeStep(stepId, rawSteps[stepId]));

  return {
    lessonId: String(manifest.lesson_id ?? manifest.lessonId ?? ''),
    courseTitle: String(manifest.course_title ?? manifest.courseTitle ?? ''),
    courseRouteSegment: String(manifest.course_route_segment ?? manifest.courseRouteSegment ?? ''),
    previewMode: asRecord(manifest.preview_mode ?? manifest.previewMode),
    mediaPolicy: asRecord(manifest.media_policy ?? manifest.mediaPolicy),
    telemetryStrategy: String(manifest.telemetry_strategy ?? manifest.telemetryStrategy ?? ''),
    teacherInsightStrategy: String(
      manifest.teacher_insight_strategy ?? manifest.teacherInsightStrategy ?? '',
    ),
    requiredStepFields: asStringArray(
      manifest.required_step_fields ?? manifest.requiredStepFields,
    ),
    stepOrder,
    steps,
  };
}

export function getInteractiveRuntimeStep(
  manifest: InteractiveRuntimeManifest,
  stepId: string,
): InteractiveRuntimeStepManifest | null {
  return manifest.steps.find((step) => step.id === stepId) ?? null;
}

export function getInteractiveRuntimeStepIndex(
  manifest: InteractiveRuntimeManifest,
  stepId: string,
): number {
  return manifest.steps.findIndex((step) => step.id === stepId);
}

export function isInteractiveRuntimePageType(pageType: string) {
  return pageType !== 'display' && pageType !== 'summary' && pageType !== 'none';
}
