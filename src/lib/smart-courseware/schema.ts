import { z } from 'zod';

import { generatedSlideManifestSchema } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { sourceBindingSchema } from '@/lib/smart-lesson-plan/schema';

export const COURSEWARE_AUTHORING_SCHEMA_VERSION = 'smart-courseware-authoring.v1' as const;

export const coursewareSourceStateSchema = z.enum([
  'verified',
  'ai_generated_source_pending',
  'teacher_created_source_pending',
]);

export const coursewareProvenanceSchema = z.enum([
  'ai_generated',
  'ai_generated_teacher_edited',
  'teacher_created',
]);

export const coursewareTeacherFieldsSchema = z.object({
  referenceAnswer: z.string().trim().min(1).max(5_000).optional(),
  explanation: z.string().trim().min(1).max(5_000).optional(),
  expectedOutput: z.string().trim().min(1).max(5_000).optional(),
  reviewPoints: z.array(z.string().trim().min(1).max(2_000)).min(1).max(50).optional(),
  scoring: z.record(z.unknown()).refine((value) => Object.keys(value).length > 0, 'scoring must not be empty').optional(),
  inclusionRationale: z.string().trim().min(1).max(2_000).optional(),
}).strict();

const coursewareModuleMetadataInputObjectSchema = z.object({
  moduleId: z.string().trim().min(1).max(96),
  sourceState: coursewareSourceStateSchema,
  sourceBindings: z.array(sourceBindingSchema).max(100),
  teacherFields: coursewareTeacherFieldsSchema.default({}),
}).strict();

function requireVerifiedInclusionRationale(
  value: { sourceState: z.infer<typeof coursewareSourceStateSchema>; teacherFields: z.infer<typeof coursewareTeacherFieldsSchema> },
  context: z.RefinementCtx,
) {
  if (value.sourceState === 'verified' && !value.teacherFields.inclusionRationale) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'verified source state requires an inclusion rationale',
      path: ['teacherFields', 'inclusionRationale'],
    });
  }
}

export const coursewareModuleMetadataInputSchema = coursewareModuleMetadataInputObjectSchema
  .superRefine(requireVerifiedInclusionRationale);

const coursewareCompositionModuleMetadataInputSchema = coursewareModuleMetadataInputObjectSchema.extend({
  copiedFromModuleId: z.string().trim().min(1).max(96).optional(),
}).strict().superRefine(requireVerifiedInclusionRationale);

export const coursewareCompositionInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  runtimeManifest: generatedSlideManifestSchema,
  moduleMetadata: z.array(coursewareCompositionModuleMetadataInputSchema).max(72),
}).strict();

export const coursewareApprovedPlanAlignmentSchema = z.object({
  goalIds: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
  goalSetHash: z.string().regex(/^[a-f0-9]{64}$/),
  stageContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  stageOutlineTitles: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
}).strict();

export const coursewareApprovedStepBindingSchema = z.object({
  generatedStepId: z.string().trim().min(1).max(96),
  approvedStageStepIndex: z.number().int().nonnegative().max(29),
  approvedOutlineIndex: z.number().int().nonnegative().max(99),
  approvedTitle: z.string().trim().min(1).max(500),
  approvedDurationSeconds: z.number().int().positive().max(7_200),
  goalIds: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
}).strict();

const coursewareGeneratedStageSchema = generatedSlideManifestSchema.shape.stages.element;

export const legacyCoursewareGeneratedStageOutputSchema = z.object({
  stage: coursewareGeneratedStageSchema,
  moduleMetadata: z.array(coursewareModuleMetadataInputSchema).min(1).max(12),
}).strict().superRefine((value, context) => {
  requireUniqueOrderingItems(
    value.stage.steps.flatMap((step) => step.modules),
    context,
    ['stage'],
  );
});

export const coursewareGeneratedStageOutputSchema = z.object({
  stage: coursewareGeneratedStageSchema,
  moduleMetadata: z.array(coursewareModuleMetadataInputSchema).min(1).max(72),
  approvedPlanAlignment: coursewareApprovedPlanAlignmentSchema,
  stepPlanBindings: z.array(coursewareApprovedStepBindingSchema).min(1).max(30),
}).strict().superRefine((value, context) => {
  requireUniqueOrderingItems(
    value.stage.steps.flatMap((step) => step.modules),
    context,
    ['stage'],
  );
});

export const coursewareModuleCandidateOutputSchema = z.object({
  runtimeModule: generatedSlideManifestSchema.shape.stages.element.shape.steps.element.shape.modules.element,
  moduleMetadata: coursewareModuleMetadataInputSchema,
}).strict().superRefine((value, context) => {
  requireUniqueOrderingItems([value.runtimeModule], context, ['runtimeModule']);
});

function requireUniqueOrderingItems(
  modules: Array<{ responseKind?: string; payload: unknown }>,
  context: z.RefinementCtx,
  path: Array<string | number>,
) {
  modules.forEach((module, index) => {
    if (!module.payload || typeof module.payload !== 'object') return;
    const payload = module.payload as { items?: unknown; options?: unknown; left?: unknown; right?: unknown };
    if (module.responseKind === 'ordering.sequence' && hasNormalizedDuplicates(payload.items)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ordering items must be unique after normalization',
        path: [...path, index, 'payload', 'items'],
      });
    }
    const optionGroups = module.responseKind === 'choice.single' || module.responseKind === 'choice.multi'
      ? [['options', payload.options] as const]
      : module.responseKind === 'matching.pairs'
        ? [['left', payload.left] as const, ['right', payload.right] as const]
        : [];
    for (const [group, options] of optionGroups) {
      if (!Array.isArray(options)) continue;
      for (const field of ['value', 'label'] as const) {
        const values = options.map((option) => option && typeof option === 'object' ? (option as Record<string, unknown>)[field] : undefined);
        if (!hasNormalizedDuplicates(values)) continue;
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `option ${field}s must be unique after normalization`,
          path: [...path, index, 'payload', group],
        });
      }
    }
  });
}

function hasNormalizedDuplicates(values: unknown): boolean {
  if (!Array.isArray(values) || !values.every((value) => typeof value === 'string')) return false;
  const normalized = values.map((value) => value.trim().toLowerCase());
  return new Set(normalized).size !== normalized.length;
}

export const coursewareModuleMetadataSchema = coursewareModuleMetadataInputObjectSchema.extend({
  moduleInstanceLineage: z.string().trim().min(1).max(200),
  moduleContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceBindingSetHash: z.string().regex(/^[a-f0-9]{64}$/),
  gapIdentity: z.string().trim().min(1).max(200).nullable(),
  provenance: coursewareProvenanceSchema,
  originalAttemptId: z.string().trim().min(1).max(200).nullable(),
}).strict().superRefine(requireVerifiedInclusionRationale);

export const coursewareTeacherProjectionSchema = z.object({
  schemaVersion: z.literal(COURSEWARE_AUTHORING_SCHEMA_VERSION),
  draftId: z.string().trim().min(1),
  version: z.number().int().positive(),
  planRevisionId: z.string().trim().min(1),
  planContentHash: z.string().trim().min(1),
  runtimeManifest: generatedSlideManifestSchema,
  moduleMetadata: z.array(coursewareModuleMetadataSchema),
  planLimitations: z.array(z.string().trim().min(1).max(2_000)).max(100),
  aiReview: z.object({
    findings: z.array(z.object({
      category: z.string().trim().min(1).max(100),
      severity: z.string().trim().min(1).max(100),
      message: z.string().trim().min(1).max(2_000),
      path: z.string().trim().min(1).max(500).nullable(),
    }).strict()).max(100),
    suggestions: z.array(z.string().trim().min(1).max(2_000)).max(100),
  }).strict().nullable(),
  generationAudit: z.array(z.object({
    jobId: z.string().trim().min(1),
    mode: z.string().trim().min(1),
    state: z.string().trim().min(1),
    attempts: z.array(z.object({
      attemptNumber: z.number().int().positive(),
      serviceId: z.string().trim().min(1),
      providerKind: z.string().trim().min(1),
      model: z.string().trim().min(1),
      outcome: z.string().trim().min(1),
    }).strict()).max(100),
  }).strict()).max(20),
  validation: z.object({
    valid: z.boolean(),
    contentHash: z.string().trim().min(1),
    issues: z.array(z.unknown()),
  }).passthrough(),
}).strict();

export const coursewareStudentProjectionSchema = z.object({
  schemaVersion: z.literal(COURSEWARE_AUTHORING_SCHEMA_VERSION),
  draftId: z.string().trim().min(1),
  version: z.number().int().positive(),
  runtimeManifest: z.unknown(),
  notice: z.literal('ai-assisted-teacher-reviewed'),
}).strict();

export type CoursewareCompositionInput = z.infer<typeof coursewareCompositionInputSchema>;
export type CoursewareModuleMetadataInput = z.infer<typeof coursewareModuleMetadataInputSchema>;
export type CoursewareModuleMetadata = z.infer<typeof coursewareModuleMetadataSchema>;
