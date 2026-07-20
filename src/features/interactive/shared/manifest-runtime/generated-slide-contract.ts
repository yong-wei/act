import { z } from 'zod';

import {
  normalizeInteractiveRuntimeManifest,
  type InteractiveRuntimeActivityCardManifest,
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeModuleManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import {
  resolveInteractiveResponseKind,
  type InteractiveResponseKind,
} from '@/lib/interactive-response-contracts';

export const GENERATED_SLIDE_SCHEMA_VERSION = 'generated-slide-v1' as const;
export const GENERATED_SLIDE_ASPECT_RATIO = '16:9' as const;

export const BOPPPS_STAGES = [
  'bridge-in',
  'objective',
  'pre-assessment',
  'participatory-learning',
  'post-assessment',
  'summary',
] as const;
export type BopppsStage = (typeof BOPPPS_STAGES)[number];

export const GENERATED_CONTENT_CLASSES = [
  'content.rich',
  'content.cardSet',
  'content.formula',
  'content.table',
  'content.code',
  'content.reveal',
] as const;
export type GeneratedContentClass = (typeof GENERATED_CONTENT_CLASSES)[number];

export const GENERATED_ACTIVITY_CLASS = 'activity.panel' as const;
export const GENERATED_RESPONSE_KINDS = [
  'choice.single',
  'choice.multi',
  'text.short',
  'text.long',
  'ordering.sequence',
  'matching.pairs',
] as const satisfies readonly InteractiveResponseKind[];
export type GeneratedResponseKind = (typeof GENERATED_RESPONSE_KINDS)[number];
export type GeneratedModuleClass = GeneratedContentClass | typeof GENERATED_ACTIVITY_CLASS;

const CANVAS_COLUMNS = 12;
const CANVAS_ROWS = 9;

export const GENERATED_SLIDE_SIZE_REGISTRY = deepFreeze({
  full: { columns: 12, rows: 9, textCapacity: 1 },
  'two-thirds': { columns: 8, rows: 9, textCapacity: 0.67 },
  half: { columns: 6, rows: 9, textCapacity: 0.5 },
  third: { columns: 4, rows: 9, textCapacity: 0.34 },
  banner: { columns: 12, rows: 4, textCapacity: 0.44 },
  footer: { columns: 12, rows: 5, textCapacity: 0.56 },
} as const);
export type GeneratedSlideSizeId = keyof typeof GENERATED_SLIDE_SIZE_REGISTRY;

type RegisteredSlot = {
  readonly id: string;
  readonly sizeId: GeneratedSlideSizeId;
  readonly cells: readonly string[];
};

function cells(columnStart: number, columnCount: number, rowStart: number, rowCount: number): string[] {
  return Array.from({ length: columnCount * rowCount }, (_, index) => {
    const column = columnStart + (index % columnCount);
    const row = rowStart + Math.floor(index / columnCount);
    return `${column}:${row}`;
  });
}

export const GENERATED_SLIDE_LAYOUT_REGISTRY = deepFreeze({
  single: {
    aspectRatio: GENERATED_SLIDE_ASPECT_RATIO,
    columns: CANVAS_COLUMNS,
    rows: CANVAS_ROWS,
    slots: [{ id: 'main', sizeId: 'full', cells: cells(0, 12, 0, 9) }],
  },
  'two-column': {
    aspectRatio: GENERATED_SLIDE_ASPECT_RATIO,
    columns: CANVAS_COLUMNS,
    rows: CANVAS_ROWS,
    slots: [
      { id: 'left', sizeId: 'half', cells: cells(0, 6, 0, 9) },
      { id: 'right', sizeId: 'half', cells: cells(6, 6, 0, 9) },
    ],
  },
  'main-sidebar': {
    aspectRatio: GENERATED_SLIDE_ASPECT_RATIO,
    columns: CANVAS_COLUMNS,
    rows: CANVAS_ROWS,
    slots: [
      { id: 'main', sizeId: 'two-thirds', cells: cells(0, 8, 0, 9) },
      { id: 'sidebar', sizeId: 'third', cells: cells(8, 4, 0, 9) },
    ],
  },
  stacked: {
    aspectRatio: GENERATED_SLIDE_ASPECT_RATIO,
    columns: CANVAS_COLUMNS,
    rows: CANVAS_ROWS,
    slots: [
      { id: 'top', sizeId: 'banner', cells: cells(0, 12, 0, 4) },
      { id: 'bottom', sizeId: 'footer', cells: cells(0, 12, 4, 5) },
    ],
  },
  'three-column': {
    aspectRatio: GENERATED_SLIDE_ASPECT_RATIO,
    columns: CANVAS_COLUMNS,
    rows: CANVAS_ROWS,
    slots: [
      { id: 'left', sizeId: 'third', cells: cells(0, 4, 0, 9) },
      { id: 'center', sizeId: 'third', cells: cells(4, 4, 0, 9) },
      { id: 'right', sizeId: 'third', cells: cells(8, 4, 0, 9) },
    ],
  },
} as const satisfies Record<string, {
  aspectRatio: typeof GENERATED_SLIDE_ASPECT_RATIO;
  columns: number;
  rows: number;
  slots: readonly RegisteredSlot[];
}>);
export type GeneratedSlideLayoutId = keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY;

export const GENERATED_SLIDE_TEXT_BUDGET_REGISTRY = deepFreeze({
  'content.rich': { suggestedCharactersAtFullSize: 900, minimumFontPx: 24, normalFontPx: 32 },
  'content.cardSet': { suggestedCharactersAtFullSize: 720, minimumFontPx: 22, normalFontPx: 28 },
  'content.formula': { suggestedCharactersAtFullSize: 520, minimumFontPx: 24, normalFontPx: 32 },
  'content.table': { suggestedCharactersAtFullSize: 640, minimumFontPx: 20, normalFontPx: 26 },
  'content.code': { suggestedCharactersAtFullSize: 1_000, minimumFontPx: 18, normalFontPx: 24 },
  'content.reveal': { suggestedCharactersAtFullSize: 760, minimumFontPx: 22, normalFontPx: 28 },
  'activity.panel': { suggestedCharactersAtFullSize: 700, minimumFontPx: 22, normalFontPx: 28 },
} as const satisfies Record<GeneratedModuleClass, {
  suggestedCharactersAtFullSize: number;
  minimumFontPx: number;
  normalFontPx: number;
}>);
export const GENERATED_SLIDE_MINIMUM_VISUAL_SCALE = 0.8 as const;

const idSchema = z.string().trim().min(1).max(96).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
const nonEmptyText = z.string().trim().min(1);
const roleMetadataSchema = z.object({
  studentVisible: z.boolean(),
  teacherVisible: z.literal(true),
  referenceAnswerVisibility: z.enum(['none', 'teacher-only']),
}).strict();

const moduleSchema = z.object({
  id: idSchema,
  canonicalClass: z.string().trim().min(1),
  slotId: idSchema,
  sizeId: z.string().trim().min(1),
  payload: z.record(z.unknown()),
  responseKind: z.string().trim().min(1).optional(),
  evidencePath: z.string().trim().regex(/^responses\.[a-z0-9]+(?:[._-][a-z0-9]+)*$/).optional(),
  roleMetadata: roleMetadataSchema,
}).strict();

const stepSchema = z.object({
  id: idSchema,
  title: nonEmptyText,
  durationSeconds: z.number().int().positive(),
  layoutId: z.string().trim().min(1),
  modules: z.array(moduleSchema),
}).strict();

const stageSchema = z.object({
  stage: z.string().trim().min(1),
  durationSeconds: z.number().int().positive(),
  steps: z.array(stepSchema).min(1),
}).strict();

export const generatedSlideManifestSchema = z.object({
  schemaVersion: z.literal(GENERATED_SLIDE_SCHEMA_VERSION),
  lessonId: idSchema,
  title: nonEmptyText,
  durationSeconds: z.number().int().positive(),
  stages: z.array(stageSchema),
}).strict();

export type GeneratedSlideManifest = z.infer<typeof generatedSlideManifestSchema>;
export type GeneratedSlideManifestStep = GeneratedSlideManifest['stages'][number]['steps'][number];
export type GeneratedSlideModule = GeneratedSlideManifest['stages'][number]['steps'][number]['modules'][number];
export const GENERATED_SLIDE_MAX_STEPS = 24;

export type GeneratedSlideTypographyFitState = 'normal' | 'adapted' | 'unfit';

export function resolveGeneratedSlideTypographyFit(module: GeneratedSlideModule): {
  state: GeneratedSlideTypographyFitState;
  fontSizePx: number;
  actualCharacters: number;
  suggestedCharacters: number;
} {
  const budget = GENERATED_SLIDE_TEXT_BUDGET_REGISTRY[module.canonicalClass as GeneratedModuleClass];
  const size = sizeFor(module.sizeId);
  const actualCharacters = countPayloadCharacters(module.payload);
  if (!budget || !size) {
    return { state: 'unfit', fontSizePx: 0, actualCharacters, suggestedCharacters: 0 };
  }

  const suggestedCharacters = Math.floor(budget.suggestedCharactersAtFullSize * size.textCapacity);
  const minimumCanvasFontPx = Math.ceil(
    budget.minimumFontPx / GENERATED_SLIDE_MINIMUM_VISUAL_SCALE,
  );
  if (actualCharacters <= suggestedCharacters) {
    return { state: 'normal', fontSizePx: budget.normalFontPx, actualCharacters, suggestedCharacters };
  }

  const minimumCapacity = Math.floor(
    suggestedCharacters * (budget.normalFontPx / minimumCanvasFontPx),
  );
  if (actualCharacters > minimumCapacity) {
    return { state: 'unfit', fontSizePx: minimumCanvasFontPx, actualCharacters, suggestedCharacters };
  }

  return {
    state: 'adapted',
    fontSizePx: Math.max(
      minimumCanvasFontPx,
      Math.floor(budget.normalFontPx * (suggestedCharacters / actualCharacters)),
    ),
    actualCharacters,
    suggestedCharacters,
  };
}

export interface GeneratedSlideRuntimeStepMapping {
  generatedStep: GeneratedSlideManifestStep;
  runtimeStep: InteractiveRuntimeStepManifest;
}

export interface GeneratedSlideRuntimeAdapterResult {
  generatedManifest: GeneratedSlideManifest;
  runtimeManifest: InteractiveRuntimeManifest;
  stepMappings: GeneratedSlideRuntimeStepMapping[];
}

const richPayloadSchema = z.object({ text: nonEmptyText, bullets: z.array(nonEmptyText).max(8).optional() }).strict();
const cardSetPayloadSchema = z.object({
  items: z.array(z.object({ title: nonEmptyText, body: nonEmptyText }).strict()).min(1).max(6),
}).strict();
const formulaPayloadSchema = z.object({
  formulas: z.array(nonEmptyText).min(1).max(8),
  notes: z.array(nonEmptyText).max(8).optional(),
}).strict();
const tableCellSchema = z.union([nonEmptyText, z.object({ kind: z.literal('math'), value: nonEmptyText }).strict()]);
const tablePayloadSchema = z.object({
  columns: z.array(nonEmptyText).min(1).max(8),
  rows: z.array(z.array(tableCellSchema).min(1).max(8)).min(1).max(12),
}).strict();
const codePayloadSchema = z.object({ language: nonEmptyText, code: nonEmptyText, note: nonEmptyText.optional() }).strict();
const revealPayloadSchema = z.object({
  items: z.array(z.object({ title: nonEmptyText.optional(), body: nonEmptyText, formula: nonEmptyText.optional() }).strict()).min(1).max(8),
}).strict();

export const GENERATED_CONTENT_PAYLOAD_SCHEMAS = Object.freeze({
  'content.rich': richPayloadSchema,
  'content.cardSet': cardSetPayloadSchema,
  'content.formula': formulaPayloadSchema,
  'content.table': tablePayloadSchema,
  'content.code': codePayloadSchema,
  'content.reveal': revealPayloadSchema,
} as const satisfies Record<GeneratedContentClass, z.ZodTypeAny>);

const optionSchema = z.object({ value: nonEmptyText, label: nonEmptyText }).strict();
const uniqueOptionsSchema = (maximum: number) => z.array(optionSchema).min(2).max(maximum).superRefine((options, context) => {
  for (const field of ['value', 'label'] as const) {
    const normalized = options.map((option) => option[field].trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `option ${field}s must be unique after normalization` });
    }
  }
});
export const GENERATED_ACTIVITY_PAYLOAD_SCHEMAS = Object.freeze({
  'choice.single': z.object({ prompt: nonEmptyText, options: uniqueOptionsSchema(8) }).strict(),
  'choice.multi': z.object({ prompt: nonEmptyText, options: uniqueOptionsSchema(10) }).strict(),
  'text.short': z.object({ prompt: nonEmptyText, placeholder: z.string().max(120).optional() }).strict(),
  'text.long': z.object({ prompt: nonEmptyText, placeholder: z.string().max(200).optional() }).strict(),
  'ordering.sequence': z.object({
    prompt: nonEmptyText,
    items: z.array(nonEmptyText).min(2).max(10).superRefine((items, context) => {
      const normalized = items.map((item) => item.trim().toLowerCase());
      if (new Set(normalized).size !== normalized.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'ordering items must be unique after normalization' });
      }
    }),
  }).strict(),
  'matching.pairs': z.object({
    prompt: nonEmptyText,
    left: uniqueOptionsSchema(10),
    right: uniqueOptionsSchema(10),
  }).strict(),
} as const satisfies Record<GeneratedResponseKind, z.ZodTypeAny>);

export type GeneratedSlideIssueSeverity = 'error' | 'warning';
export type GeneratedSlideIssueCode =
  | 'schema.invalid'
  | 'hierarchy.stage-order'
  | 'hierarchy.step-count'
  | 'hierarchy.module-count'
  | 'hierarchy.duplicate-id'
  | 'timing.stage-step-mismatch'
  | 'timing.lesson-stage-mismatch'
  | 'layout.unregistered-template'
  | 'layout.unregistered-slot'
  | 'layout.slot-reused'
  | 'layout.occupancy-overlap'
  | 'layout.registry-out-of-bounds'
  | 'size.unregistered'
  | 'size.incompatible-slot'
  | 'module.unsupported-class'
  | 'module.unsupported-response-kind'
  | 'module.activity-contract-invalid'
  | 'module.payload-invalid'
  | 'module.table-shape-invalid'
  | 'metadata.role-unsafe'
  | 'text.suggested-budget-exceeded';

export interface GeneratedSlideIssueLocation {
  stage?: BopppsStage | string;
  stageIndex?: number;
  stepId?: string;
  stepIndex?: number;
  moduleId?: string;
  moduleIndex?: number;
  path?: readonly (string | number)[];
}

export interface GeneratedSlideValidationIssue {
  code: GeneratedSlideIssueCode;
  severity: GeneratedSlideIssueSeverity;
  message: string;
  location: GeneratedSlideIssueLocation;
}

export interface GeneratedSlideValidationResult {
  valid: boolean;
  contentHash: string;
  issues: GeneratedSlideValidationIssue[];
}

const CONTENT_CLASS_SET = new Set<string>(GENERATED_CONTENT_CLASSES);
const RESPONSE_KIND_SET = new Set<string>(GENERATED_RESPONSE_KINDS);
const SIZE_ID_SET = new Set<string>(Object.keys(GENERATED_SLIDE_SIZE_REGISTRY));

export function computeGeneratedSlideContentHash(value: unknown): string {
  return `sha256:${sha256(canonicalJson(value))}`;
}

export function validateGeneratedSlideManifest(value: unknown): GeneratedSlideValidationResult {
  const contentHash = computeGeneratedSlideContentHash(value);
  const parsed = generatedSlideManifestSchema.safeParse(value);
  if (!parsed.success) {
    return {
      valid: false,
      contentHash,
      issues: parsed.error.issues.map((issue) => ({
        code: 'schema.invalid',
        severity: 'error',
        message: issue.message,
        location: locationFromPath(value, issue.path),
      })),
    };
  }

  const manifest = parsed.data;
  const issues: GeneratedSlideValidationIssue[] = [];
  const add = (
    code: GeneratedSlideIssueCode,
    severity: GeneratedSlideIssueSeverity,
    message: string,
    location: GeneratedSlideIssueLocation,
  ) => issues.push({ code, severity, message, location });

  if (manifest.stages.length !== BOPPPS_STAGES.length
    || manifest.stages.some((stage, index) => stage.stage !== BOPPPS_STAGES[index])) {
    add('hierarchy.stage-order', 'error', 'All six BOPPPS stages must appear exactly once in canonical order.', {});
  }

  const steps = manifest.stages.flatMap((stage) => stage.steps);
  if (steps.length < 6 || steps.length > GENERATED_SLIDE_MAX_STEPS) {
    add('hierarchy.step-count', 'error', `A complete manifest must contain 6 through ${GENERATED_SLIDE_MAX_STEPS} steps.`, {});
  }

  const seenStepIds = new Set<string>();
  const seenModuleIds = new Set<string>();
  let stageDurationTotal = 0;

  manifest.stages.forEach((stage, stageIndex) => {
    const stageLocation = { stage: stage.stage, stageIndex };
    const stepDurationTotal = stage.steps.reduce((total, step) => total + step.durationSeconds, 0);
    if (stepDurationTotal !== stage.durationSeconds) {
      add('timing.stage-step-mismatch', 'error', 'Step durations must sum exactly to their stage duration.', stageLocation);
    }
    stageDurationTotal += stage.durationSeconds;

    stage.steps.forEach((step, stepIndex) => {
      const stepLocation = { ...stageLocation, stepId: step.id, stepIndex };
      if (seenStepIds.has(step.id)) {
        add('hierarchy.duplicate-id', 'error', `Duplicate step id: ${step.id}.`, stepLocation);
      }
      seenStepIds.add(step.id);

      if (step.modules.length < 1 || step.modules.length > 3) {
        add('hierarchy.module-count', 'error', 'Every step must contain 1 through 3 modules.', stepLocation);
      }

      const layout = layoutFor(step.layoutId);
      if (!layout) {
        add('layout.unregistered-template', 'error', `Unregistered layout template: ${step.layoutId}.`, stepLocation);
      } else {
        validateRegisteredLayout(layout, stepLocation, add);
      }

      const occupiedCells = new Map<string, string>();
      const occupiedSlots = new Set<string>();
      step.modules.forEach((manifestModule, moduleIndex) => {
        const moduleLocation = { ...stepLocation, moduleId: manifestModule.id, moduleIndex };
        if (seenModuleIds.has(manifestModule.id)) {
          add('hierarchy.duplicate-id', 'error', `Duplicate module id: ${manifestModule.id}.`, moduleLocation);
        }
        seenModuleIds.add(manifestModule.id);

        const slot = layout?.slots.find((candidate) => candidate.id === manifestModule.slotId);
        if (!slot) {
          add('layout.unregistered-slot', 'error', `Layout ${step.layoutId} has no slot ${manifestModule.slotId}.`, moduleLocation);
        } else {
          if (occupiedSlots.has(slot.id)) {
            add('layout.slot-reused', 'error', `Slot ${slot.id} is assigned more than once.`, moduleLocation);
          }
          occupiedSlots.add(slot.id);
          for (const cell of slot.cells) {
            const owner = occupiedCells.get(cell);
            if (owner) {
              add('layout.occupancy-overlap', 'error', `Cell ${cell} is occupied by ${owner} and ${manifestModule.id}.`, moduleLocation);
              break;
            }
            occupiedCells.set(cell, manifestModule.id);
          }
          if (slot.sizeId !== manifestModule.sizeId) {
            add('size.incompatible-slot', 'error', `Size ${manifestModule.sizeId} is incompatible with slot ${slot.id}.`, moduleLocation);
          }
        }

        if (!SIZE_ID_SET.has(manifestModule.sizeId)) {
          add('size.unregistered', 'error', `Unregistered size: ${manifestModule.sizeId}.`, moduleLocation);
        }

        validateModule(manifestModule, moduleLocation, add);
      });
    });
  });

  if (stageDurationTotal !== manifest.durationSeconds) {
    add('timing.lesson-stage-mismatch', 'error', 'Stage durations must sum exactly to the lesson duration.', {});
  }

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    contentHash,
    issues,
  };
}

export function adaptGeneratedSlideManifestToInteractiveRuntime(
  generatedManifest: GeneratedSlideManifest,
): GeneratedSlideRuntimeAdapterResult {
  const validation = validateGeneratedSlideManifest(generatedManifest);
  if (!validation.valid) {
    const codes = validation.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.code)
      .join(', ');
    throw new Error(`Cannot adapt invalid generated slide manifest: ${codes}`);
  }

  const generatedSteps = generatedManifest.stages.flatMap((stage) => stage.steps);
  const runtimeManifest = normalizeInteractiveRuntimeManifest({
    lesson_id: generatedManifest.lessonId,
    course_title: generatedManifest.title,
    course_route_segment: generatedManifest.lessonId,
    preview_mode: {},
    media_policy: {},
    telemetry_strategy: 'manifest',
    teacher_insight_strategy: 'manifest',
    required_step_fields: [],
    steps: Object.fromEntries(generatedSteps.map((step) => [step.id, runtimeStepInput(step)])),
  });
  if (!runtimeManifest) {
    throw new Error('Failed to normalize generated slide runtime manifest.');
  }

  const runtimeStepsById = new Map(runtimeManifest.steps.map((step) => [step.id, step]));
  const stepMappings = generatedSteps.map((generatedStep) => {
    const runtimeStep = runtimeStepsById.get(generatedStep.id);
    if (!runtimeStep) {
      throw new Error(`Normalized runtime manifest is missing generated step ${generatedStep.id}.`);
    }
    return { generatedStep, runtimeStep };
  });

  return { generatedManifest, runtimeManifest, stepMappings };
}

function runtimeStepInput(step: GeneratedSlideManifestStep): Record<string, unknown> {
  const activityModules = step.modules.filter(isGeneratedActivityModule);
  const activityCards = activityModules.map(activityCardInput);
  const evidencePaths = activityModules.map((module) => module.evidencePath);
  const layout = layoutFor(step.layoutId);

  return {
    title: step.title,
    layout: {
      template: step.layoutId,
      regions: (layout?.slots ?? []).map((slot, order) => ({
        id: slot.id,
        width: runtimeRegionWidth(slot.sizeId),
        order,
      })),
    },
    modules: step.modules.map(runtimeModuleInput),
    content_blocks: {},
    evidence_sequence: evidencePaths,
    interaction_spec: {
      interaction_kind: activityCards.length > 0 ? 'activity_cards' : 'display',
      student_task: activityCards[0]?.prompt,
      activity_cards: activityCards,
      submit_fields: evidencePaths,
    },
    teacher_controls: {
      release_activity: activityCards.length > 0 ? 'teacher_toggle' : 'not_applicable',
      open_browse: 'not_applicable',
      teacher_step_reveal: 'not_applicable',
      reveal_reference_answer: activityCards.length > 0 ? 'teacher_toggle' : 'not_applicable',
    },
    student_access: {},
    teacher_insight_spec: { widgets: [] },
    telemetry_spec: { summary_fields: evidencePaths, misconception_tags: [] },
    ai_context_spec: { page_goal: step.title, delivery_mode: 'generated-slide' },
    interactive_figure_spec: {},
    preview_contract: { demo_path: '' },
    acceptance_checks: [],
  };
}

function runtimeModuleInput(module: GeneratedSlideModule): InteractiveRuntimeModuleManifest {
  const activity = isGeneratedActivityModule(module);
  const response = activity ? resolveInteractiveResponseKind(module.responseKind) : undefined;
  const payload = module.canonicalClass === 'content.cardSet'
    ? {
      items: (module.payload.items as Array<{ title: string; body: string }>)
        .map((item) => `${item.title}：${item.body}`),
    }
    : module.payload;
  return {
    id: module.id,
    region: module.slotId,
    kind: module.canonicalClass,
    mustBeVisible: true,
    payload: {
      ...payload,
      ...(response ? { responseKind: response.kind } : {}),
    },
  };
}

function activityCardInput(module: GeneratedSlideModule): InteractiveRuntimeActivityCardManifest {
  if (!isGeneratedActivityModule(module)) {
    throw new Error(`Generated module ${module.id} is not an activity panel.`);
  }
  const response = resolveInteractiveResponseKind(module.responseKind);
  const payload = module.payload as Record<string, unknown>;
  return {
    id: module.id,
    prompt: String(payload.prompt),
    responseKind: response.kind,
    responseCategory: response.category,
    responseScoringMode: response.scoring,
    submitScope: 'per_card',
    layoutSpan: runtimeRegionWidth(module.sizeId),
    options: activityOptions(response.kind, payload),
    ...(response.kind === 'matching.pairs' ? {
      matchItems: optionList(payload.left),
      matchOptions: optionList(payload.right),
    } : {}),
  };
}

function activityOptions(
  responseKind: InteractiveResponseKind,
  payload: Record<string, unknown>,
): Array<{ value: string; label: string }> {
  if (responseKind === 'choice.single' || responseKind === 'choice.multi') {
    return optionList(payload.options);
  }
  if (responseKind === 'ordering.sequence') {
    return optionList(payload.items);
  }
  return [];
}

function optionList(value: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return { value: item, label: item };
    const option = item as { value: string; label: string };
    return { value: option.value, label: option.label };
  });
}

function isGeneratedActivityModule(
  module: GeneratedSlideModule,
): module is GeneratedSlideModule & {
  canonicalClass: typeof GENERATED_ACTIVITY_CLASS;
  responseKind: GeneratedResponseKind;
  evidencePath: string;
} {
  return module.canonicalClass === GENERATED_ACTIVITY_CLASS
    && typeof module.responseKind === 'string'
    && typeof module.evidencePath === 'string';
}

function runtimeRegionWidth(sizeId: string): 'full' | 'half' {
  const size = sizeFor(sizeId);
  return size && size.columns > CANVAS_COLUMNS / 2 ? 'full' : 'half';
}

function validateModule(
  manifestModule: GeneratedSlideModule,
  location: GeneratedSlideIssueLocation,
  add: (code: GeneratedSlideIssueCode, severity: GeneratedSlideIssueSeverity, message: string, location: GeneratedSlideIssueLocation) => void,
): void {
  const isContent = CONTENT_CLASS_SET.has(manifestModule.canonicalClass);
  const isActivity = manifestModule.canonicalClass === GENERATED_ACTIVITY_CLASS;
  if (!isContent && !isActivity) {
    add('module.unsupported-class', 'error', `Unsupported generated module class: ${manifestModule.canonicalClass}.`, location);
    return;
  }

  if (isActivity) {
    if (!manifestModule.responseKind || !RESPONSE_KIND_SET.has(manifestModule.responseKind)) {
      add('module.unsupported-response-kind', 'error', `Unsupported generated response kind: ${manifestModule.responseKind ?? '<missing>'}.`, location);
    } else {
      const payloadSchema = GENERATED_ACTIVITY_PAYLOAD_SCHEMAS[manifestModule.responseKind as GeneratedResponseKind];
      if (!payloadSchema.safeParse(manifestModule.payload).success) {
        add('module.payload-invalid', 'error', `Payload does not match ${manifestModule.responseKind}.`, location);
      }
    }
    if (!manifestModule.evidencePath) {
      add('module.activity-contract-invalid', 'error', 'Generated activities require a canonical evidencePath.', location);
    }
    if (!manifestModule.roleMetadata.studentVisible
      || manifestModule.roleMetadata.referenceAnswerVisibility !== 'teacher-only') {
      add('metadata.role-unsafe', 'error', 'Activities must be student-visible and keep reference answers teacher-only.', location);
    }
  } else {
    if (manifestModule.responseKind || manifestModule.evidencePath) {
      add('module.activity-contract-invalid', 'error', 'Content modules cannot declare response or evidence metadata.', location);
    }
    if (manifestModule.roleMetadata.referenceAnswerVisibility !== 'none') {
      add('metadata.role-unsafe', 'error', 'Content modules cannot expose reference-answer metadata.', location);
    }
    const payloadSchema = GENERATED_CONTENT_PAYLOAD_SCHEMAS[manifestModule.canonicalClass as GeneratedContentClass];
    if (!payloadSchema.safeParse(manifestModule.payload).success) {
      add('module.payload-invalid', 'error', `Payload does not match ${manifestModule.canonicalClass}.`, location);
    }
    if (manifestModule.canonicalClass === 'content.table') {
      const table = tablePayloadSchema.safeParse(manifestModule.payload);
      if (table.success && table.data.rows.some((row) => row.length !== table.data.columns.length)) {
        add('module.table-shape-invalid', 'error', 'Every table row must match the registered column count.', location);
      }
    }
  }

  const size = sizeFor(manifestModule.sizeId);
  if (!size) return;
  const budget = GENERATED_SLIDE_TEXT_BUDGET_REGISTRY[manifestModule.canonicalClass as GeneratedModuleClass];
  const suggestedCharacters = Math.floor(budget.suggestedCharactersAtFullSize * size.textCapacity);
  const actualCharacters = countPayloadCharacters(manifestModule.payload);
  if (actualCharacters > suggestedCharacters) {
    add(
      'text.suggested-budget-exceeded',
      'warning',
      `Payload has ${actualCharacters} characters; the suggested budget is ${suggestedCharacters}.`,
      location,
    );
  }
}

function validateRegisteredLayout(
  layout: (typeof GENERATED_SLIDE_LAYOUT_REGISTRY)[GeneratedSlideLayoutId],
  location: GeneratedSlideIssueLocation,
  add: (code: GeneratedSlideIssueCode, severity: GeneratedSlideIssueSeverity, message: string, location: GeneratedSlideIssueLocation) => void,
): void {
  const occupied = new Set<string>();
  for (const slot of layout.slots) {
    for (const cell of slot.cells) {
      const [column, row] = cell.split(':').map(Number);
      if (!Number.isInteger(column) || !Number.isInteger(row)
        || column < 0 || column >= layout.columns || row < 0 || row >= layout.rows) {
        add('layout.registry-out-of-bounds', 'error', `Registered slot ${slot.id} is outside the canvas.`, location);
        return;
      }
      if (occupied.has(cell)) {
        add('layout.occupancy-overlap', 'error', `Registered layout slots overlap at cell ${cell}.`, location);
        return;
      }
      occupied.add(cell);
    }
  }
}

function layoutFor(value: string): (typeof GENERATED_SLIDE_LAYOUT_REGISTRY)[GeneratedSlideLayoutId] | undefined {
  return Object.hasOwn(GENERATED_SLIDE_LAYOUT_REGISTRY, value)
    ? GENERATED_SLIDE_LAYOUT_REGISTRY[value as GeneratedSlideLayoutId]
    : undefined;
}

function sizeFor(value: string): (typeof GENERATED_SLIDE_SIZE_REGISTRY)[GeneratedSlideSizeId] | undefined {
  return Object.hasOwn(GENERATED_SLIDE_SIZE_REGISTRY, value)
    ? GENERATED_SLIDE_SIZE_REGISTRY[value as GeneratedSlideSizeId]
    : undefined;
}

function countPayloadCharacters(value: unknown): number {
  if (typeof value === 'string') return Array.from(value.trim()).length;
  if (Array.isArray(value)) return value.reduce((total, item) => total + countPayloadCharacters(item), 0);
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((total, item) => total + countPayloadCharacters(item), 0);
  }
  return 0;
}

function locationFromPath(value: unknown, path: readonly (string | number)[]): GeneratedSlideIssueLocation {
  const location: GeneratedSlideIssueLocation = { path };
  if (!isRecord(value) || !Array.isArray(value.stages)) return location;
  const stageIndex = typeof path[1] === 'number' && path[0] === 'stages' ? path[1] : undefined;
  if (stageIndex === undefined) return location;
  const stage = value.stages[stageIndex];
  location.stageIndex = stageIndex;
  if (!isRecord(stage)) return location;
  if (typeof stage.stage === 'string') location.stage = stage.stage;
  const stepIndex = typeof path[3] === 'number' && path[2] === 'steps' ? path[3] : undefined;
  if (stepIndex === undefined || !Array.isArray(stage.steps)) return location;
  const step = stage.steps[stepIndex];
  location.stepIndex = stepIndex;
  if (!isRecord(step)) return location;
  if (typeof step.id === 'string') location.stepId = step.id;
  const moduleIndex = typeof path[5] === 'number' && path[4] === 'modules' ? path[5] : undefined;
  if (moduleIndex === undefined || !Array.isArray(step.modules)) return location;
  const manifestModule = step.modules[moduleIndex];
  location.moduleIndex = moduleIndex;
  if (isRecord(manifestModule) && typeof manifestModule.id === 'string') location.moduleId = manifestModule.id;
  return location;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (value === undefined) return 'null';
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function sha256(text: string): string {
  const source = new TextEncoder().encode(text);
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(source);
  bytes[source.length] = 0x80;
  const view = new DataView(bytes.buffer);
  const bitLength = source.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15];
      const previous2 = words[index - 2];
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    const state = Array.from(hash);
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rotateRight(state[4], 6) ^ rotateRight(state[4], 11) ^ rotateRight(state[4], 25);
      const choice = (state[4] & state[5]) ^ (~state[4] & state[6]);
      const first = (state[7] + sigma1 + choice + SHA256_ROUND_CONSTANTS[index] + words[index]) >>> 0;
      const sigma0 = rotateRight(state[0], 2) ^ rotateRight(state[0], 13) ^ rotateRight(state[0], 22);
      const majority = (state[0] & state[1]) ^ (state[0] & state[2]) ^ (state[1] & state[2]);
      const second = (sigma0 + majority) >>> 0;
      state[7] = state[6];
      state[6] = state[5];
      state[5] = state[4];
      state[4] = (state[3] + first) >>> 0;
      state[3] = state[2];
      state[2] = state[1];
      state[1] = state[0];
      state[0] = (first + second) >>> 0;
    }
    for (let index = 0; index < hash.length; index += 1) hash[index] = (hash[index] + state[index]) >>> 0;
  }

  return Array.from(hash, (word) => word.toString(16).padStart(8, '0')).join('');
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
