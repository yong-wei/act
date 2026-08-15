import { Prisma } from '@prisma/client';
import { z } from 'zod';

import {
  assessPromptQuality,
  trackConsistency,
  type AssessPromptRequest,
  type AssessPromptResponse,
  type PromptAuditTaskContext,
  type TrackConsistencyRequest,
  type TrackConsistencyResponse,
} from '@/features/evaluation/prompt-quality';
import { prisma } from '@/lib/prisma';

const MAX_VERSION_RETRIES = 3;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]/;

export class PromptAssessmentHistoryError extends Error {
  constructor(readonly code: 'PROMPT_ASSESSMENT_NOT_FOUND') {
    super(code);
  }
}

interface StoredPromptAssessment {
  userId: string;
  sessionId: string;
  promptContent: string;
  structuredData: unknown;
  auditTaskContext: unknown;
  consistencyResult: unknown;
  overallScore: number;
  completenessScore: number;
  precisionScore: number;
  structurizationScore: number;
  executabilityScore: number;
  suggestions: unknown;
  version: number;
  createdAt: Date;
}

export interface PromptAssessmentHistoryEntry {
  userId: string;
  sessionId: string;
  promptContent: string;
  auditTaskContext?: PromptAuditTaskContext;
  assessment: AssessPromptResponse;
  consistency?: TrackConsistencyResponse;
  version: number;
  createdAt: number;
}

export interface ParsedPromptAssessmentRequest {
  sessionId?: string;
  request: AssessPromptRequest;
}

export interface ParsedPromptConsistencyRequest {
  sessionId: string;
  version: number;
  request: TrackConsistencyRequest;
}

interface CreatePromptAssessmentAttemptInput {
  userId: string;
  sessionId: string;
  request: AssessPromptRequest;
}

interface AttachPromptConsistencyResultInput {
  userId: string;
  sessionId: string;
  version: number;
  request: TrackConsistencyRequest;
}

function boundedDescriptorString(maxLength = 160) {
  return z.string()
    .min(1)
    .max(maxLength)
    .refine((value) => !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value), {
      message: 'descriptor cannot contain control characters',
    })
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(maxLength));
}

function boundedPromptText(maxLength: number) {
  return z.string()
    .min(1)
    .max(maxLength)
    .refine((value) => !CONTROL_CHARACTERS.test(value), {
      message: 'prompt text contains unsupported control characters',
    })
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(maxLength));
}

const auditTaskContextSchema = z.object({
  source: boundedDescriptorString().optional(),
  assignment: boundedDescriptorString().optional(),
  intent: boundedDescriptorString().optional(),
  outputTarget: z.enum(['answer', 'prompt-history', 'practice-candidate', 'portfolio-draft']).optional(),
}).strict();

const structuredDataSchema = z.record(
  boundedDescriptorString(80),
  boundedPromptText(2000),
).refine((value) => Object.keys(value).length <= 12, {
  message: 'structured data contains too many fields',
});

const assessPromptRequestSchema = z.object({
  // Compatibility only; authenticated route identity is the sole owner selector.
  userId: z.string().optional(),
  sessionId: boundedDescriptorString().optional(),
  prompt: boundedPromptText(12000),
  structuredData: structuredDataSchema.optional(),
  auditTaskContext: auditTaskContextSchema.optional(),
  context: z.object({
    taskType: z.enum(['pid-tuning', 'controller-design', 'system-analysis']),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  }).strict(),
}).strict();

const trackConsistencyRequestSchema = z.object({
  // Compatibility only; authenticated route identity is the sole owner selector.
  userId: z.string().optional(),
  designSessionId: boundedDescriptorString(),
  promptVersion: z.number().int().positive(),
  promptContent: boundedPromptText(12000),
  auditTaskContext: auditTaskContextSchema.optional(),
  designActions: z.array(z.object({
    timestamp: z.number().finite(),
    action: boundedDescriptorString(80),
    params: z.record(boundedDescriptorString(80), z.number().finite()),
  }).strict()).max(100),
  finalResult: z.record(boundedDescriptorString(80), z.number().finite().optional()),
}).strict();

const suggestionSchema = z.object({
  dimension: z.string(),
  issue: z.string(),
  suggestion: z.string(),
  example: z.string().optional(),
}).strict();

const consistencyResultSchema = z.object({
  consistencyScore: z.number(),
  alignmentAnalysis: z.object({
    statedGoals: z.array(z.string()),
    actualOptimization: z.array(z.string()),
    mismatches: z.array(z.string()),
  }).strict(),
  processQuality: z.object({
    iterationCount: z.number(),
    convergencePattern: z.enum(['steady', 'oscillating', 'diverging']),
    explorationBreadth: z.number(),
  }).strict(),
}).strict();

export function parsePromptAssessmentRequest(value: unknown): ParsedPromptAssessmentRequest | null {
  const parsed = assessPromptRequestSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return {
    sessionId: parsed.data.sessionId,
    request: {
      prompt: parsed.data.prompt,
      structuredData: parsed.data.structuredData,
      auditTaskContext: parsed.data.auditTaskContext,
      context: parsed.data.context,
    },
  };
}

export function parsePromptConsistencyRequest(value: unknown): ParsedPromptConsistencyRequest | null {
  const parsed = trackConsistencyRequestSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return {
    sessionId: parsed.data.designSessionId,
    version: parsed.data.promptVersion,
    request: {
      promptContent: parsed.data.promptContent,
      auditTaskContext: parsed.data.auditTaskContext,
      designActions: parsed.data.designActions,
      finalResult: parsed.data.finalResult,
    },
  };
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toStructuredData(value: unknown): Record<string, string> | undefined {
  const parsed = structuredDataSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function toAssessment(record: StoredPromptAssessment): AssessPromptResponse {
  const recalculated = assessPromptQuality({
    prompt: record.promptContent,
    structuredData: toStructuredData(record.structuredData),
    context: { taskType: 'system-analysis', difficulty: 'intermediate' },
  });
  const suggestions = z.array(suggestionSchema).safeParse(record.suggestions);

  return {
    overallScore: record.overallScore,
    dimensionScores: {
      completeness: record.completenessScore,
      precision: record.precisionScore,
      structurization: record.structurizationScore,
      executability: record.executabilityScore,
    },
    suggestions: suggestions.success ? suggestions.data : [],
    metaPromptAnalysis: recalculated.metaPromptAnalysis,
  };
}

function toHistoryEntry(record: StoredPromptAssessment): PromptAssessmentHistoryEntry {
  const auditTaskContext = auditTaskContextSchema.safeParse(record.auditTaskContext);
  const consistency = consistencyResultSchema.safeParse(record.consistencyResult);

  return {
    userId: record.userId,
    sessionId: record.sessionId,
    promptContent: record.promptContent,
    auditTaskContext: auditTaskContext.success ? auditTaskContext.data : undefined,
    assessment: toAssessment(record),
    consistency: consistency.success ? consistency.data : undefined,
    version: record.version,
    createdAt: record.createdAt.getTime(),
  };
}

function isRetryableVersionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  return error.code === 'P2002' || error.code === 'P2034';
}

async function retryVersionConflict<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_VERSION_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableVersionConflict(error) || attempt === MAX_VERSION_RETRIES - 1) {
        throw error;
      }
    }
  }

  throw new Error('Prompt assessment retry exhausted');
}

export async function createPromptAssessmentAttempt({
  userId,
  sessionId,
  request,
}: CreatePromptAssessmentAttemptInput): Promise<PromptAssessmentHistoryEntry> {
  const assessment = assessPromptQuality(request);
  const record = await retryVersionConflict(() => prisma.$transaction(async (tx) => {
    const latest = await tx.promptAssessment.findFirst({
      where: { userId, sessionId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return tx.promptAssessment.create({
      data: {
        userId,
        sessionId,
        promptContent: request.prompt,
        structuredData: request.structuredData ? toInputJson(request.structuredData) : undefined,
        auditTaskContext: request.auditTaskContext ? toInputJson(request.auditTaskContext) : undefined,
        overallScore: assessment.overallScore,
        completenessScore: assessment.dimensionScores.completeness,
        precisionScore: assessment.dimensionScores.precision,
        structurizationScore: assessment.dimensionScores.structurization,
        executabilityScore: assessment.dimensionScores.executability,
        suggestions: assessment.suggestions.map(toInputJson),
        version: (latest?.version ?? 0) + 1,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  return toHistoryEntry(record);
}

export async function attachPromptConsistencyResult({
  userId,
  sessionId,
  version,
  request,
}: AttachPromptConsistencyResultInput): Promise<TrackConsistencyResponse> {
  const attempt = await prisma.promptAssessment.findFirst({
    where: { userId, sessionId, version },
    select: { promptContent: true },
  });
  if (!attempt) {
    throw new PromptAssessmentHistoryError('PROMPT_ASSESSMENT_NOT_FOUND');
  }

  const consistency = trackConsistency({
    ...request,
    promptContent: attempt.promptContent,
  });
  const updated = await prisma.promptAssessment.updateMany({
    where: { userId, sessionId, version },
    data: { consistencyResult: toInputJson(consistency) },
  });

  if (updated.count === 0) {
    throw new PromptAssessmentHistoryError('PROMPT_ASSESSMENT_NOT_FOUND');
  }

  return consistency;
}

export async function listPromptAssessmentHistory(userId: string): Promise<PromptAssessmentHistoryEntry[]> {
  const records = await prisma.promptAssessment.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { version: 'asc' }],
  });

  return records.map(toHistoryEntry);
}
