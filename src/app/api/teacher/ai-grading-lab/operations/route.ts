import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getServerAuthSession } from '@/lib/auth';
import {
  createProductionTeacherAiGradingLabCore,
  type TeacherAiGradingLabCore,
  type TeacherAiGradingLabCoreOperation,
} from '@/lib/data-governance/teacher-ai-grading-lab-core';
import { readTeacherAiGradingLabConfig } from '@/lib/data-governance/teacher-ai-grading-lab-contracts';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

const operationSchema = z.object({
  operation: z.enum([
    'validate-package', 'import-package', 'create-split', 'freeze-configuration', 'run-evaluation',
    'resume-evaluation', 'reveal-hidden-acceptance', 'record-human-judgment', 'build-report', 'export-pdf-verification-checklist',
  ]),
  input: z.unknown(),
}).strict();

const token = z.string().trim().min(1).max(256);
const checksum = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const component = z.object({ id: token, version: token, contentHash: checksum }).strict();
const dataset = z.object({ datasetId: token, datasetVersion: token }).strict();
const split = dataset.extend({ splitId: token, splitVersion: token, contentHash: checksum }).strict();
const configuration = z.object({ configurationVersion: token }).strict();
const evaluationRun = z.object({ evaluationRunId: token }).strict();
const packageInput = z.object({ packageBase64: z.string().min(4).max(70_000_000) }).strict();

type Session = { user?: { id?: string; role?: string } } | null;

interface TeacherAiGradingLabRouteDependencies {
  getSession(): Promise<Session>;
  readConfig(): { ownerTeacherUserId: string };
  createCore(): Promise<{ core: TeacherAiGradingLabCore; disconnect(): Promise<void> }>;
}

export function createTeacherAiGradingLabOperationsHandler(dependencies: TeacherAiGradingLabRouteDependencies) {
  return async function POST(request: Request) {
    const session = await dependencies.getSession();
    if (!session?.user?.id) return failure('UNAUTHENTICATED', 401);

    let config: { ownerTeacherUserId: string };
    try {
      config = dependencies.readConfig();
    } catch {
      return failure('LAB_UNAVAILABLE', 503);
    }
    if (session.user.role !== 'TEACHER' || session.user.id !== config.ownerTeacherUserId) {
      return failure('FORBIDDEN', 403);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch (error) {
      rethrowIfNextDynamicError(error);
      return failure('INVALID_INPUT', 400);
    }
    const parsed = operationSchema.safeParse(payload);
    if (!parsed.success) return failure('INVALID_INPUT', 400);

    let operation: TeacherAiGradingLabCoreOperation;
    try {
      operation = parseOperation(parsed.data.operation, parsed.data.input, session.user.id);
    } catch {
      return failure('INVALID_INPUT', 400);
    }

    let runtime: { core: TeacherAiGradingLabCore; disconnect(): Promise<void> } | undefined;
    try {
      runtime = await dependencies.createCore();
      const result = await runtime.core.execute(operation);
      return NextResponse.json({ operation: parsed.data.operation, result });
    } catch (error) {
      rethrowIfNextDynamicError(error);
      return failure('OPERATION_FAILED', 409);
    } finally {
      await runtime?.disconnect().catch(() => undefined);
    }
  };
}

export const POST = createTeacherAiGradingLabOperationsHandler({
  getSession: getServerAuthSession,
  readConfig: () => readTeacherAiGradingLabConfig(process.env),
  createCore: () => createProductionTeacherAiGradingLabCore(),
});

function parseOperation(kind: z.infer<typeof operationSchema>['operation'], input: unknown, operatorUserId: string): TeacherAiGradingLabCoreOperation {
  switch (kind) {
    case 'validate-package': return { kind, input: { packageBytes: decodePackage(packageInput.parse(input).packageBase64) } };
    case 'import-package': return { kind, input: { packageBytes: decodePackage(packageInput.parse(input).packageBase64) } };
    case 'create-split': return { kind, input: z.object({ ...dataset.shape, randomSeed: token, tuningRatio: z.number().gt(0).lt(1) }).strict().parse(input) };
    case 'freeze-configuration': return {
      kind,
      input: z.object({ split, idempotencyKey: token, seed: z.number().int(), prompt: component, model: component.extend({ parameters: z.record(z.unknown()) }).strict(), processor: component, metric: component }).strict().parse(input),
    };
    case 'run-evaluation': return {
      kind,
      input: z.object({ configuration, partition: z.enum(['tuning', 'hidden']), idempotencyKey: token, acceptanceId: token.optional(), maxAttempts: z.number().int().min(1).max(10).optional() }).strict().parse(input),
    };
    case 'resume-evaluation': return { kind, input: z.object({ run: evaluationRun }).strict().parse(input) };
    case 'reveal-hidden-acceptance': return { kind, input: z.object({ acceptanceId: token, configuration }).strict().parse(input) };
    case 'record-human-judgment': return { kind, input: parseJudgment(input, operatorUserId) };
    case 'build-report': return { kind, input: z.object({ configuration, partition: z.enum(['tuning', 'hidden']) }).strict().parse(input) };
    case 'export-pdf-verification-checklist': return {
      kind,
      input: z.object({ acceptanceId: token, items: z.array(z.object({ sampleId: token, sourceConversionId: token, selectedReviewVersionIds: z.array(token).min(1).max(64) }).strict()).min(1).max(50) }).strict().parse(input),
    };
  }
}

function parseJudgment(input: unknown, operatorUserId: string) {
  const annotationCorrection = z.discriminatedUnion('action', [
    z.object({ action: z.literal('add'), annotationKey: token, criterionId: token, reason: z.string().trim().min(1).max(4_000), comment: z.string().trim().min(1).max(4_000), location: z.record(z.unknown()) }).strict(),
    z.object({ action: z.literal('delete'), sourceAnnotationId: token }).strict(),
    z.object({ action: z.literal('revise-text'), sourceAnnotationId: token, comment: z.string().trim().min(1).max(4_000) }).strict(),
    z.object({ action: z.literal('revise-location'), sourceAnnotationId: token, location: z.record(z.unknown()) }).strict(),
  ]);
  const base = z.discriminatedUnion('judgmentKind', [
    z.object({ judgmentKind: z.literal('blind-annotation'), executionId: token, gradingAnnotationId: token, locationCorrect: z.boolean(), reasonCorrect: z.boolean(), suggestionCorrect: z.boolean(), seriouslyMisleading: z.boolean() }).strict(),
    z.object({ judgmentKind: z.literal('blind-visual-evidence'), executionId: token, visualEvidenceId: token, evidenceContentHash: checksum, faithful: z.boolean(), sufficientForScoring: z.boolean(), misattributed: z.boolean() }).strict(),
    z.object({ judgmentKind: z.literal('structured-review'), executionId: token, parentVersionId: token.nullable(), decision: z.enum(['accept', 'correct']), scoreCorrections: z.array(z.object({ criterionId: token, score: z.number().finite() }).strict()).max(128), annotationCorrections: z.array(annotationCorrection).max(128) }).strict(),
    z.object({ judgmentKind: z.literal('pdf-verification'), acceptanceId: token, sampleId: token, derivativeId: token, expectedRevision: z.number().int().min(0), checks: z.object({ originalLayoutComplete: z.boolean(), pageMarksComplete: z.boolean(), nativeAnnotationsComplete: z.boolean(), positioningCorrect: z.boolean(), summaryPageCorrect: z.boolean() }).strict(), blockingDefect: z.boolean(), defectCode: token.nullable().optional() }).strict(),
  ]).parse(input);
  return { ...base, operatorUserId };
}

function decodePackage(value: string): Buffer {
  const normalized = value.replace(/^data:application\/zip;base64,/i, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) throw new Error('invalid-package-encoding');
  const bytes = Buffer.from(normalized, 'base64');
  if (bytes.byteLength === 0 || bytes.byteLength > 50 * 1024 * 1024) throw new Error('invalid-package-size');
  return bytes;
}

function failure(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status });
}
