import { z } from 'zod';

import { sourceBindingSchema } from './schema';
import { confirmedTextbookRangeSchema } from './textbook-range';

export const idSchema = z.string().trim().min(1).max(200);
export const idempotencySchema = z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/);

export const sourceStateInputSchema = z.enum([
  'verified',
  'no_reliable_source',
  'ai_generated_source_pending',
  'teacher_created_source_pending',
]).transform((value) => {
  // VERIFIED is server-owned. Accept the round-tripped public value for edits,
  // but treat it only as a pending hint until service-side evidence validation.
  if (value === 'verified') return 'AI_GENERATED_SOURCE_PENDING' as const;
  if (value === 'no_reliable_source') return 'NO_RELIABLE_SOURCE' as const;
  if (value === 'ai_generated_source_pending') return 'AI_GENERATED_SOURCE_PENDING' as const;
  return 'TEACHER_CREATED_SOURCE_PENDING' as const;
});

const canonicalItemSchema = z.object({
  id: idSchema.optional(),
  lineageId: idSchema.optional(),
  content: z.string().trim().min(1).max(2000),
  sourceState: sourceStateInputSchema,
  sourceBindings: z.array(sourceBindingSchema).max(100),
  sourceConfirmed: z.boolean().optional(),
  gapReason: z.string().trim().min(1).max(500).nullable().optional(),
}).strict();

const knowledgePointOriginSchema = z.enum(['SUGGESTED', 'TEACHER_CREATED', 'ai_generated']).transform((value) => (
  value === 'ai_generated' ? 'SUGGESTED' as const : value
));

export const createTaskSchema = z.object({
  courseBasisId: idSchema,
  topic: z.string().trim().min(1).max(500),
  audience: z.string().trim().min(1).max(1000),
  prerequisites: z.string().trim().max(5000).optional(),
  durationMinutes: z.number().int().min(30).max(120).refine((value) => value % 5 === 0),
  outlineConfirmationRequired: z.boolean().optional(),
  sourceVersionIds: z.array(idSchema).min(1).max(500),
  textbookRanges: z.array(confirmedTextbookRangeSchema).max(20).optional(),
  knowledgePoints: z.array(canonicalItemSchema.extend({
    title: z.string().trim().min(1).max(500).optional(),
    origin: knowledgePointOriginSchema,
    supersedesIds: z.array(idSchema).max(100).optional(),
  }).strict()).min(1).max(100),
  goals: z.array(canonicalItemSchema.extend({
    standardsMappings: z.array(z.object({ standardId: idSchema, label: z.string().trim().min(1).max(500) }).strict()).max(100).optional(),
  }).strict()).min(1).max(100),
  selectedClassId: idSchema.nullable().optional(),
  confirmScope: z.boolean().optional(),
  confirmGoals: z.boolean().optional(),
}).strict();

export const updateTaskSchema = createTaskSchema.extend({
  courseBasisId: idSchema.optional(),
  selectedClassId: idSchema.nullable().optional(),
  expectedRevision: z.number().int().min(1),
  confirmingTurnId: idSchema,
  agentSessionId: idSchema.optional(),
}).strict();
