import { z } from 'zod';

export const SMART_LESSON_PLAN_SCHEMA_VERSION = 'smart-lesson-plan.boppps.v1';

export const sourceBindingSchema = z.object({
  citationId: z.string().trim().min(1).max(1000),
  sourceVersionId: z.string().trim().min(1).max(200),
  anchor: z.string().trim().min(1).max(500),
  contentHash: z.string().trim().min(16).max(128),
  sourceKind: z.enum(['upload', 'textbook']).optional(),
  title: z.string().trim().min(1).max(500).optional(),
  structuralPath: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  snippet: z.string().trim().min(1).max(1000).optional(),
  href: z.string().trim().min(1).max(2000).optional(),
}).strict();

export const sourceStateSchema = z.enum([
  'VERIFIED',
  'NO_RELIABLE_SOURCE',
  'AI_GENERATED_SOURCE_PENDING',
  'TEACHER_CREATED_SOURCE_PENDING',
]);

export const lessonGoalSchema = z.object({
  id: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(2000),
  sourceState: sourceStateSchema,
  sourceBindings: z.array(sourceBindingSchema).max(100),
  gapIdentity: z.string().trim().min(16).max(200).nullable(),
  standardsMappings: z.array(z.object({
    standardId: z.string().trim().min(1).max(200),
    label: z.string().trim().min(1).max(500),
  }).strict()).max(100),
}).strict();

export const lessonKnowledgePointSchema = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  sourceState: sourceStateSchema,
  sourceBindings: z.array(sourceBindingSchema).max(100),
  gapIdentity: z.string().trim().min(16).max(200).nullable(),
}).strict();

export const smartLessonAdvisoryReviewSchema = z.object({
  goalCoverage: z.string().trim().min(1).max(5000),
  sourceConsistency: z.string().trim().min(1).max(5000),
  bopppsStructure: z.string().trim().min(1).max(5000),
  findings: z.array(z.object({
    category: z.enum(['GOAL_COVERAGE', 'SOURCE_CONSISTENCY', 'BOPPPS_STRUCTURE', 'CONTENT_QUALITY']),
    severity: z.enum(['INFO', 'SUGGESTION', 'WARNING']),
    message: z.string().trim().min(1).max(2000),
    path: z.string().trim().min(1).max(500).nullable(),
    proposedReplacement: z.string().trim().min(1).max(10_000).nullable().optional(),
  }).strict()).max(100),
  suggestions: z.array(z.string().trim().min(1).max(2000)).max(100),
}).strict();

export const smartLessonReviewProviderAuditSchema = z.object({
  serviceId: z.string().trim().min(1).max(200),
  providerKind: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(300),
  promptVersion: z.string().trim().min(1).max(100),
  schemaVersion: z.string().trim().min(1).max(100),
  normalizedResponseId: z.string().trim().min(1).max(300).nullable(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  costMicros: z.string().regex(/^\d+$/).nullable(),
}).strict();

export const smartLessonOutlineOutputSchema = z.object({
  keyContent: z.array(z.string().trim().min(1).max(2000)).min(1).max(100),
  difficultContent: z.array(z.string().trim().min(1).max(2000)).max(100),
  limitations: z.array(z.string().trim().min(1).max(2000)).max(100),
  classAdaptation: z.object({
    aggregateContextRef: z.string().trim().min(1).max(200).nullable(),
    emphasis: z.array(z.string().trim().min(1).max(1000)).max(50),
  }).strict().nullable(),
  coursewareStepOutline: z.array(z.object({
    title: z.string().trim().min(1).max(500),
    bopppsStage: z.enum(['bridgeIn', 'objectives', 'preAssessment', 'participatoryLearning', 'postAssessment', 'summary']),
    minutes: z.number().int().positive().max(120),
  }).strict()).min(6).max(100),
}).strict();

function createTimedStepSchema(sourceBinding: z.ZodTypeAny) {
  return z.object({
    title: z.string().trim().min(1).max(500),
    minutes: z.number().int().positive().max(120),
    teacherActivity: z.string().trim().min(1).max(10_000),
    studentActivity: z.string().trim().min(1).max(10_000),
    assessment: z.string().trim().min(1).max(5000),
    sourceBindings: z.array(sourceBinding).max(100),
  }).strict();
}

function createBopppsStageSchema(sourceBinding: z.ZodTypeAny) {
  return z.object({
    minutes: z.number().int().positive().max(120),
    teacherActivity: z.string().trim().min(1).max(20_000),
    studentActivity: z.string().trim().min(1).max(20_000),
    assessment: z.string().trim().min(1).max(10_000),
    steps: z.array(createTimedStepSchema(sourceBinding)).min(1).max(30),
  }).strict().superRefine((stage, context) => {
  const stepMinutes = stage.steps.reduce((total, step) => total + step.minutes, 0);
  if (stepMinutes !== stage.minutes) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['steps'],
      message: `stage-step-duration-mismatch:${stepMinutes}:${stage.minutes}`,
    });
  }
  });
}

export const bopppsStageSchema = createBopppsStageSchema(sourceBindingSchema);

export function createSourceBindingSchemaForAllowedBindings(bindings: Array<z.infer<typeof sourceBindingSchema>>) {
  const variants = [...new Map(bindings.map((binding) => [
    `${binding.sourceVersionId}\u0000${binding.anchor}\u0000${binding.contentHash}\u0000${binding.citationId}`,
    z.object({
      citationId: z.literal(binding.citationId),
      sourceVersionId: z.literal(binding.sourceVersionId),
      anchor: z.literal(binding.anchor),
      contentHash: z.literal(binding.contentHash),
      ...(binding.sourceKind === undefined ? {} : { sourceKind: z.literal(binding.sourceKind) }),
      ...(binding.title === undefined ? {} : { title: z.literal(binding.title) }),
      ...(binding.structuralPath === undefined ? {} : {
        structuralPath: z.array(z.string()).length(binding.structuralPath.length),
      }),
      ...(binding.snippet === undefined ? {} : { snippet: z.literal(binding.snippet) }),
      ...(binding.href === undefined ? {} : { href: z.literal(binding.href) }),
    }).strict(),
  ])).values()];
  const bindingSchema = variants.length === 0
    ? sourceBindingSchema
    : variants.length === 1
      ? variants[0]
      : z.union(variants as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  return bindingSchema;
}

export function createBopppsStageSchemaForAllowedBindings(bindings: Array<z.infer<typeof sourceBindingSchema>>) {
  const bindingSchema = createSourceBindingSchemaForAllowedBindings(bindings);
  return createBopppsStageSchema(bindingSchema);
}

export const BOPPPS_STAGE_KEYS = [
  'bridgeIn',
  'objectives',
  'preAssessment',
  'participatoryLearning',
  'postAssessment',
  'summary',
] as const;

export const smartLessonPlanSchema = z.object({
  schemaVersion: z.literal(SMART_LESSON_PLAN_SCHEMA_VERSION),
  course: z.string().trim().min(1).max(500),
  topic: z.string().trim().min(1).max(500),
  audience: z.string().trim().min(1).max(1000),
  durationMinutes: z.number().int().min(30).max(120).refine((value) => value % 5 === 0, 'duration-step-invalid'),
  prerequisites: z.string().trim().max(5000),
  goals: z.array(lessonGoalSchema).min(1).max(100),
  knowledgePoints: z.array(lessonKnowledgePointSchema).min(1).max(100),
  keyContent: z.array(z.string().trim().min(1).max(2000)).min(1).max(100),
  difficultContent: z.array(z.string().trim().min(1).max(2000)).max(100),
  boppps: z.object({
    bridgeIn: bopppsStageSchema,
    objectives: bopppsStageSchema,
    preAssessment: bopppsStageSchema,
    participatoryLearning: bopppsStageSchema,
    postAssessment: bopppsStageSchema,
    summary: bopppsStageSchema,
  }).strict(),
  sources: z.array(sourceBindingSchema).max(500),
  limitations: z.array(z.string().trim().min(1).max(2000)).max(100),
  classAdaptation: z.object({
    aggregateContextRef: z.string().trim().min(1).max(200).nullable(),
    emphasis: z.array(z.string().trim().min(1).max(1000)).max(50),
  }).strict().nullable(),
  coursewareStepOutline: z.array(z.object({
    title: z.string().trim().min(1).max(500),
    bopppsStage: z.enum(BOPPPS_STAGE_KEYS),
    minutes: z.number().int().positive().max(120),
  }).strict()).min(1).max(100),
}).strict().superRefine((plan, context) => {
  const stageMinutes = BOPPPS_STAGE_KEYS.reduce((total, key) => total + plan.boppps[key].minutes, 0);
  if (stageMinutes !== plan.durationMinutes) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['boppps'],
      message: `boppps-duration-mismatch:${stageMinutes}:${plan.durationMinutes}`,
    });
  }
  const outlineMinutes = plan.coursewareStepOutline.reduce((total, step) => total + step.minutes, 0);
  if (outlineMinutes !== plan.durationMinutes) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['coursewareStepOutline'],
      message: `courseware-duration-mismatch:${outlineMinutes}:${plan.durationMinutes}`,
    });
  }
  for (const goal of plan.goals) {
    if (goal.sourceState === 'VERIFIED' && (goal.sourceBindings.length === 0 || goal.gapIdentity !== null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['goals'], message: `verified-goal-source-invalid:${goal.id}` });
    }
    if (goal.sourceState !== 'VERIFIED' && !goal.gapIdentity) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['goals'], message: `pending-goal-gap-required:${goal.id}` });
    }
  }
  for (const point of plan.knowledgePoints) {
    if (point.sourceState === 'VERIFIED' && (point.sourceBindings.length === 0 || point.gapIdentity !== null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['knowledgePoints'], message: `verified-knowledge-source-invalid:${point.id}` });
    }
    if (point.sourceState !== 'VERIFIED' && !point.gapIdentity) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['knowledgePoints'], message: `pending-knowledge-gap-required:${point.id}` });
    }
  }
  for (const stageKey of BOPPPS_STAGE_KEYS) {
    const outlineStageMinutes = plan.coursewareStepOutline
      .filter((step) => step.bopppsStage === stageKey)
      .reduce((total, step) => total + step.minutes, 0);
    if (outlineStageMinutes !== plan.boppps[stageKey].minutes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['coursewareStepOutline'],
        message: `courseware-stage-duration-mismatch:${stageKey}:${outlineStageMinutes}:${plan.boppps[stageKey].minutes}`,
      });
    }
  }
});

export type SmartLessonPlan = z.infer<typeof smartLessonPlanSchema>;

export function validateSmartLessonPlan(value: unknown, expectedDurationMinutes?: number): SmartLessonPlan {
  const plan = smartLessonPlanSchema.parse(value);
  if (expectedDurationMinutes !== undefined && plan.durationMinutes !== expectedDurationMinutes) {
    throw new Error(`task-duration-mismatch:${plan.durationMinutes}:${expectedDurationMinutes}`);
  }
  return plan;
}
