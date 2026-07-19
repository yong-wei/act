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

export const coursewareModuleMetadataInputSchema = z.object({
  moduleId: z.string().trim().min(1).max(96),
  sourceState: coursewareSourceStateSchema,
  sourceBindings: z.array(sourceBindingSchema).max(100),
  teacherFields: coursewareTeacherFieldsSchema.default({}),
}).strict();

export const coursewareCompositionInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  runtimeManifest: generatedSlideManifestSchema,
  moduleMetadata: z.array(coursewareModuleMetadataInputSchema).max(72),
}).strict();

export const coursewareGeneratedStageOutputSchema = z.object({
  stage: generatedSlideManifestSchema.shape.stages.element,
  moduleMetadata: z.array(coursewareModuleMetadataInputSchema).min(1).max(12),
}).strict();

export const coursewareModuleCandidateOutputSchema = z.object({
  runtimeModule: generatedSlideManifestSchema.shape.stages.element.shape.steps.element.shape.modules.element,
  moduleMetadata: coursewareModuleMetadataInputSchema,
}).strict();

export const coursewareModuleMetadataSchema = coursewareModuleMetadataInputSchema.extend({
  moduleInstanceLineage: z.string().trim().min(1).max(200),
  moduleContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceBindingSetHash: z.string().regex(/^[a-f0-9]{64}$/),
  gapIdentity: z.string().trim().min(1).max(200).nullable(),
  provenance: coursewareProvenanceSchema,
  originalAttemptId: z.string().trim().min(1).max(200).nullable(),
}).strict();

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
