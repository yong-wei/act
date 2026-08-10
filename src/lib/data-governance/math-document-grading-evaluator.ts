import { generateText } from 'ai';
import { z } from 'zod';

import { createAIProviderFromConfig } from '@/lib/ai/provider-registry';
import { resolveConfiguredAIProviderConfig } from '@/lib/ai/provider-settings';
import {
  hasAtMostOneDecimal,
  roundUpToOneDecimal,
} from '@/lib/assignments/assignment-rubric-contract';
import {
  buildPipelineDedupeKey,
  buildScopedGradingPrompt,
  evaluateExternalProcessingPolicy,
  isPromptInjectionLike,
  redactProviderError,
  sha256,
  validateEvidenceAnchor,
  type ExternalProcessingPolicy,
  type FrozenQuestionContract,
  type NormalizedAnswerEvidence,
} from './math-document-grading-contracts';

export interface GradingAnchor {
  blockId: string;
  precision: 'span' | 'block' | 'page';
  excerpt: string;
  pageNumber?: number | null;
  spanStart?: number | null;
  spanEnd?: number | null;
  bbox?: [number, number, number, number] | null;
}

export interface ProviderCriterionAssessment {
  criterionId: string;
  levelId: string | null;
  score: number;
  rationale: string;
  confidence: number;
  anchors: GradingAnchor[];
  limitationState: string;
  annotations?: Array<{
    comment: string;
    anchor: GradingAnchor;
  }>;
}

export interface ProviderGradingOutput {
  evaluatorId: string;
  evaluatorVersion: string;
  assessments: ProviderCriterionAssessment[];
  limitations: string[];
  overallComment: string;
}

export interface ProviderRuntimeResult {
  output: unknown;
  provider: string;
  providerRequestId: string | null;
  deletionHandle: string | null;
  providerRequestedAt: Date | null;
  providerProcessedAt: Date | null;
}

export interface ValidatedGradingDraft extends ProviderGradingOutput {
  inputHash: string;
  dedupeKey: string;
  state: 'awaiting-review' | 'blocked' | 'retryable';
  blockedReasons: string[];
  promptInjectionDetected: boolean;
  provider: string;
  providerRequestId: string | null;
  deletionHandle: string | null;
  providerRequestedAt: Date | null;
  providerProcessedAt: Date | null;
}

export interface GradingProviderRuntime {
  id: string;
  version: string;
  provider?: string;
  evaluate(input: {
    system: string;
    user: string;
    idempotencyKey?: string;
    signal?: AbortSignal;
  }): Promise<unknown | ProviderRuntimeResult>;
}

const providerOutputSchema = z.object({
  evaluatorId: z.string().trim().min(1).max(160),
  evaluatorVersion: z.string().trim().min(1).max(160),
  assessments: z.array(z.object({
    criterionId: z.string().trim().min(1).max(100),
    levelId: z.string().trim().min(1).max(100).nullable().optional().default(null),
    score: z.number().finite(),
    rationale: z.string().trim().min(12).max(4_000),
    confidence: z.number().finite(),
    anchors: z.array(z.object({
      blockId: z.string().trim().min(1).max(160),
      precision: z.enum(['span', 'block', 'page']),
      excerpt: z.string().trim().min(1).max(600),
      pageNumber: z.number().int().positive().nullable().optional(),
      spanStart: z.number().int().nonnegative().nullable().optional(),
      spanEnd: z.number().int().nonnegative().nullable().optional(),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
    }).strict()).min(1).max(20),
    limitationState: z.string().trim().min(1).max(120),
    annotations: z.array(z.object({
      comment: z.string().trim().min(1).max(4_000),
      anchor: z.object({
        blockId: z.string().trim().min(1).max(160),
        precision: z.enum(['span', 'block', 'page']),
        excerpt: z.string().trim().min(1).max(600),
        pageNumber: z.number().int().positive().nullable().optional(),
        spanStart: z.number().int().nonnegative().nullable().optional(),
        spanEnd: z.number().int().nonnegative().nullable().optional(),
        bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
      }).strict(),
    }).strict()).max(20).optional(),
  }).strict()).min(1).max(100),
  limitations: z.array(z.string().trim().min(1).max(240)).max(50),
  overallComment: z.string().trim().min(12).max(4_000),
}).strict();

export async function createProviderRuntimeGradingAdapter(input: {
  provider?: GradingProviderRuntime;
  policy: ExternalProcessingPolicy | null | undefined;
  classId: string;
}): Promise<GradingProviderRuntime> {
  const decision = evaluateExternalProcessingPolicy({
    policy: input.policy,
    provider: input.provider ? 'ai-evaluator' : input.policy?.provider ?? 'ai-evaluator',
    purpose: 'rubric-grading',
    classId: input.classId,
  });
  if (!decision.allowed) throw new Error(`provider-policy-blocked:${decision.reasons.join(',')}`);
  if (input.provider) return input.provider;
  if (!input.policy?.model || !input.policy.endpoint) throw new Error('provider-policy-identity-missing');
  const config = await resolveConfiguredAIProviderConfig(input.policy.provider, input.policy.model);
  if (!config.enabled) throw new Error('provider-disabled');
  if (config.provider !== input.policy.provider) throw new Error('provider-policy-provider-mismatch');
  if (config.model !== input.policy.model) throw new Error('provider-policy-model-mismatch');
  if (config.secretRef !== input.policy.credentialRef) throw new Error('provider-policy-credential-mismatch');
  if (normalizeEndpoint(config.baseURL) !== normalizeEndpoint(input.policy.endpoint)) throw new Error('provider-policy-endpoint-mismatch');
  const provider = createAIProviderFromConfig(config);
  return {
    id: config.provider,
    version: config.model,
    provider: config.provider,
    async evaluate(prompt) {
      const providerRequestedAt = new Date();
      const result = await generateText({
        model: provider.getModel(),
        system: prompt.system,
        prompt: prompt.user,
        temperature: 0,
        maxOutputTokens: 4_000,
        abortSignal: prompt.signal,
      });
      const response = result.response as { id?: unknown; headers?: Headers | Record<string, string> } | undefined;
      const providerRequestId = typeof response?.id === 'string' && response.id.trim() ? response.id.trim() : null;
      const deletionHandle = readProviderDeletionHandle(response?.headers);
      return { output: parseJsonResponse(result.text), provider: config.provider, providerRequestId, deletionHandle, providerRequestedAt, providerProcessedAt: new Date() } satisfies ProviderRuntimeResult;
    },
  };
}

export async function evaluateWithProvider(input: {
  question: FrozenQuestionContract;
  evidence: NormalizedAnswerEvidence;
  classId: string;
  policy: ExternalProcessingPolicy | null | undefined;
  provider?: GradingProviderRuntime;
  idempotencyKey?: string;
  signal?: AbortSignal;
}): Promise<ValidatedGradingDraft> {
  const decision = evaluateExternalProcessingPolicy({
    policy: input.policy,
    provider: input.provider ? 'ai-evaluator' : input.policy?.provider ?? 'ai-evaluator',
    purpose: 'rubric-grading',
    classId: input.classId,
  });
  if (!decision.allowed) {
    return blockedDraft(input, decision.reasons, null);
  }
  try {
    const provider = await createProviderRuntimeGradingAdapter(input);
    const prompt = buildScopedGradingPrompt({ question: input.question, evidence: input.evidence, evaluator: { id: provider.id, version: provider.version } });
    const raw = await provider.evaluate({ system: prompt.system, user: prompt.user, idempotencyKey: input.idempotencyKey, signal: input.signal });
    const runtimeResult = normalizeProviderRuntimeResult(raw, provider);
    const draft = buildValidatedDraft({
      question: input.question,
      evidence: input.evidence,
      output: runtimeResult.output,
      evaluatorId: provider.id,
      evaluatorVersion: provider.version,
      provider: runtimeResult.provider,
      providerRequestId: runtimeResult.providerRequestId,
      deletionHandle: runtimeResult.deletionHandle,
      providerRequestedAt: runtimeResult.providerRequestedAt,
      providerProcessedAt: runtimeResult.providerProcessedAt,
    });
    if (input.policy && input.policy.providerRetentionSeconds > 0 && !runtimeResult.providerRequestId && !runtimeResult.deletionHandle) {
      return { ...draft, state: 'blocked', blockedReasons: [...new Set([...draft.blockedReasons, 'provider-deletion-locator-missing'])] };
    }
    return draft;
  } catch (error) {
    const reason = `provider-${redactProviderError(error)}`;
    return isRetryableProviderError(error)
      ? retryableDraft(input, [reason])
      : blockedDraft(input, [reason], null);
  }
}

export function buildValidatedDraft(input: {
  question: FrozenQuestionContract;
  evidence: NormalizedAnswerEvidence;
  output: unknown;
  evaluatorId?: string;
  evaluatorVersion?: string;
  provider?: string;
  providerRequestId?: string | null;
  deletionHandle?: string | null;
  providerRequestedAt?: Date | null;
  providerProcessedAt?: Date | null;
}): ValidatedGradingDraft {
  const parsed = providerOutputSchema.safeParse(input.output);
  const inputHash = sha256(JSON.stringify({
    question: input.question.contentHash,
    answer: input.evidence.sourceHash,
    evidence: input.evidence.anchorVersion,
    evaluator: [input.evaluatorId, input.evaluatorVersion],
  }));
  const dedupeKey = buildPipelineDedupeKey('grading-run', {
    question: input.question.questionId,
    answer: input.evidence.sourceHash,
    rubric: input.question.rubric.version,
    evaluator: input.evaluatorVersion ?? parsed.data?.evaluatorVersion ?? 'unknown',
  });
  const normalizedOutput = parsed.success
    ? normalizeProviderScores(parsed.data, input.question)
    : null;
  const reasons = parsed.success
    ? validateGradingOutput(normalizedOutput!, input.question, input.evidence)
    : parsed.error.issues.map((issue) => `schema:${issue.path.join('.')}:${issue.message}`);
  if (parsed.success && input.evaluatorId && parsed.data.evaluatorId !== input.evaluatorId) reasons.push('evaluator-id-mismatch');
  if (parsed.success && input.evaluatorVersion && parsed.data.evaluatorVersion !== input.evaluatorVersion) reasons.push('evaluator-version-mismatch');
  if (reasons.length > 0 || !parsed.success) {
    return {
      evaluatorId: parsed.data?.evaluatorId ?? input.evaluatorId ?? 'unknown',
      evaluatorVersion: parsed.data?.evaluatorVersion ?? input.evaluatorVersion ?? 'unknown',
      assessments: [],
      limitations: parsed.data?.limitations ?? [],
      overallComment: parsed.data?.overallComment ?? '',
      inputHash,
      dedupeKey,
      state: 'blocked',
      blockedReasons: [...new Set(reasons)],
      promptInjectionDetected: evidenceHasPromptInjection(input.evidence),
      provider: input.provider ?? input.evaluatorId ?? 'unknown',
      providerRequestId: input.providerRequestId ?? null,
      deletionHandle: input.deletionHandle ?? null,
      providerRequestedAt: input.providerRequestedAt ?? null,
      providerProcessedAt: input.providerProcessedAt ?? null,
    };
  }
  return {
    ...normalizedOutput!,
    inputHash,
    dedupeKey,
    state: 'awaiting-review',
    blockedReasons: [],
    promptInjectionDetected: evidenceHasPromptInjection(input.evidence),
    provider: input.provider ?? input.evaluatorId ?? 'unknown',
    providerRequestId: input.providerRequestId ?? null,
    deletionHandle: input.deletionHandle ?? null,
    providerRequestedAt: input.providerRequestedAt ?? null,
    providerProcessedAt: input.providerProcessedAt ?? null,
  };
}

export function validateGradingOutput(
  output: ProviderGradingOutput,
  question: FrozenQuestionContract,
  evidence: NormalizedAnswerEvidence,
): string[] {
  const reasons: string[] = [];
  const criteria = new Map(question.rubric.criteria.map((criterion) => [criterion.id, criterion]));
  const blocks = new Map(evidence.blocks.map((block) => [block.id, block]));
  const seen = new Set<string>();
  if (output.assessments.length !== criteria.size) reasons.push('criterion-count-mismatch');
  if (output.assessments.reduce((sum, assessment) => sum + assessment.score, 0) > question.rubric.maxScore) reasons.push('score-total-overflow');
  for (const assessment of output.assessments) {
    const criterion = criteria.get(assessment.criterionId);
    if (!criterion) {
      reasons.push('unknown-criterion');
      continue;
    }
    if (seen.has(assessment.criterionId)) reasons.push('duplicate-criterion');
    seen.add(assessment.criterionId);
    const detailedRubricEnabled = question.rubric.schemaVersion === 'assignment-analytic-rubric.v1'
      || criterion.detailedRubricEnabled === true;
    const level = assessment.levelId
      ? criterion.levels.find((candidate) => candidate.id === assessment.levelId)
      : undefined;
    if (detailedRubricEnabled && !level) reasons.push('unknown-level');
    if (!detailedRubricEnabled && assessment.levelId !== null) reasons.push('standard-only-level-not-allowed');
    if (assessment.score < 0 || assessment.score > criterion.maxPoints || assessment.score > question.rubric.maxScore) reasons.push('score-overflow');
    if (question.rubric.schemaVersion === 'assignment-scoring-rubric.v2' && !hasAtMostOneDecimal(assessment.score)) reasons.push('score-must-use-0.1-quantum');
    if (question.rubric.schemaVersion === 'assignment-analytic-rubric.v1' && level
      && (assessment.score < level.minPoints || assessment.score > level.maxPoints)) reasons.push('score-level-range-mismatch');
    if (assessment.rationale.length < 12) reasons.push('rationale-missing');
    if (!Number.isFinite(assessment.confidence) || assessment.confidence < 0 || assessment.confidence > 1) reasons.push('confidence-out-of-range');
    if (assessment.anchors.length === 0) reasons.push('evidence-anchor-missing');
    for (const anchor of assessment.anchors) reasons.push(...validateOutputAnchor(anchor, blocks));
    for (const annotation of assessment.annotations ?? []) {
      if (!annotation.comment.trim()) reasons.push('annotation-comment-missing');
      reasons.push(...validateOutputAnchor(annotation.anchor, blocks));
    }
    if (!assessment.limitationState.trim()) reasons.push('limitation-state-missing');
    if (isUnsafeGeneratedText(assessment.rationale) || isUnsafeGeneratedText(assessment.annotations?.map((item) => item.comment).join(' '))) reasons.push('unsafe-generated-text');
  }
  for (const criterion of criteria.keys()) if (!seen.has(criterion)) reasons.push('criterion-assessment-missing');
  if (output.overallComment.length < 12) reasons.push('overall-comment-missing');
  if (isUnsafeGeneratedText(output.overallComment)) reasons.push('unsafe-overall-comment');
  return [...new Set(reasons)];
}

export function createDeterministicFixtureEvaluator(input: {
  evaluatorId?: string;
  evaluatorVersion?: string;
} = {}): GradingProviderRuntime {
  return {
    id: input.evaluatorId ?? 'fixture-deterministic-grading',
    version: input.evaluatorVersion ?? 'fixture.v1',
    async evaluate(prompt) {
      const question = extractFrozenQuestion(prompt.user);
      const evidence = extractEvidence(prompt.user);
      if (!question || !evidence) throw new Error('fixture-prompt-shape-invalid');
      return {
        evaluatorId: input.evaluatorId ?? 'fixture-deterministic-grading',
        evaluatorVersion: input.evaluatorVersion ?? 'fixture.v1',
        assessments: question.rubric.criteria.map((criterion) => {
          const block = evidence.blocks.find((candidate) => candidate.text.toLowerCase().includes(criterion.evidenceDescription.toLowerCase())) ?? evidence.blocks[0];
          const detailedRubricEnabled = question.rubric.schemaVersion === 'assignment-analytic-rubric.v1'
            || criterion.detailedRubricEnabled === true;
          const level = detailedRubricEnabled
            ? criterion.levels[criterion.levels.length - 1]
            : null;
          return {
            criterionId: criterion.id,
            levelId: level?.id ?? null,
            score: level?.maxPoints ?? criterion.maxPoints,
            rationale: `Fixture evaluation for ${criterion.label} cites a supplied evidence block.`,
            confidence: block ? 0.75 : 0,
            anchors: block ? [{ blockId: block.id, precision: block.precision, excerpt: block.text.slice(0, 180), pageNumber: block.pageNumber ?? null, spanStart: block.spanStart ?? null, spanEnd: block.spanEnd ?? null }] : [],
            limitationState: block ? 'none' : 'missing-evidence',
            annotations: [],
          };
        }),
        limitations: [],
        overallComment: 'Fixture output is available only for tests and explicit deterministic fixtures.',
      };
    },
  };
}

function normalizeProviderScores(
  output: ProviderGradingOutput,
  question: FrozenQuestionContract,
): ProviderGradingOutput {
  if (question.rubric.schemaVersion !== 'assignment-scoring-rubric.v2') return output;
  const criteria = new Map(question.rubric.criteria.map((criterion) => [criterion.id, criterion]));
  return {
    ...output,
    assessments: output.assessments.map((assessment) => {
      const criterion = criteria.get(assessment.criterionId);
      if (!criterion) return assessment;
      if (!criterion.detailedRubricEnabled) return assessment;
      const rounded = roundUpToOneDecimal(assessment.score);
      if (!assessment.levelId) return { ...assessment, score: rounded };
      const level = criterion.levels.find((candidate) => candidate.id === assessment.levelId);
      if (!level) return { ...assessment, score: rounded };
      return {
        ...assessment,
        score: Math.min(level.maxPoints, Math.max(level.minPoints, rounded)),
      };
    }),
  };
}

function normalizeProviderRuntimeResult(raw: unknown, provider: GradingProviderRuntime): ProviderRuntimeResult {
  if (raw && typeof raw === 'object' && 'output' in raw && ('provider' in raw || 'providerRequestId' in raw || 'deletionHandle' in raw)) {
    const result = raw as Partial<ProviderRuntimeResult>;
    return {
      output: result.output,
      provider: typeof result.provider === 'string' && result.provider.trim() ? result.provider.trim() : provider.provider ?? provider.id,
      providerRequestId: typeof result.providerRequestId === 'string' && result.providerRequestId.trim() ? result.providerRequestId.trim() : null,
      deletionHandle: typeof result.deletionHandle === 'string' && result.deletionHandle.trim() ? result.deletionHandle.trim() : null,
      providerRequestedAt: normalizeProviderTimestamp(result.providerRequestedAt),
      providerProcessedAt: normalizeProviderTimestamp(result.providerProcessedAt),
    };
  }
  return { output: raw, provider: provider.provider ?? provider.id, providerRequestId: null, deletionHandle: null, providerRequestedAt: null, providerProcessedAt: null };
}

function normalizeProviderTimestamp(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function readProviderDeletionHandle(headers: Headers | Record<string, string> | undefined): string | null {
  if (!headers) return null;
  const value = headers instanceof Headers ? headers.get('x-provider-deletion-handle') : headers['x-provider-deletion-handle'];
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 512) : null;
}

function blockedDraft(input: {
  question: FrozenQuestionContract;
  evidence: NormalizedAnswerEvidence;
}, reasons: string[], provider: GradingProviderRuntime | null): ValidatedGradingDraft {
  const inputHash = sha256(`${input.question.contentHash}:${input.evidence.sourceHash}`);
  return {
    evaluatorId: provider?.id ?? 'blocked-provider',
    evaluatorVersion: provider?.version ?? 'blocked',
    assessments: [],
    limitations: input.evidence.limitations,
    overallComment: '',
    inputHash,
    dedupeKey: buildPipelineDedupeKey('grading-run', { question: input.question.questionId, answer: input.evidence.sourceHash, rubric: input.question.rubric.version, evaluator: provider?.version ?? 'blocked' }),
    state: 'blocked',
    blockedReasons: [...new Set(reasons)],
    promptInjectionDetected: evidenceHasPromptInjection(input.evidence),
    provider: provider?.provider ?? provider?.id ?? 'blocked-provider',
    providerRequestId: null,
    deletionHandle: null,
    providerRequestedAt: null,
    providerProcessedAt: null,
  };
}

function retryableDraft(input: {
  question: FrozenQuestionContract;
  evidence: NormalizedAnswerEvidence;
}, reasons: string[]): ValidatedGradingDraft {
  const inputHash = sha256(`${input.question.contentHash}:${input.evidence.sourceHash}`);
  return {
    evaluatorId: 'retryable-provider',
    evaluatorVersion: 'retryable',
    assessments: [],
    limitations: input.evidence.limitations,
    overallComment: '',
    inputHash,
    dedupeKey: buildPipelineDedupeKey('grading-run', { question: input.question.questionId, answer: input.evidence.sourceHash, rubric: input.question.rubric.version, evaluator: 'retryable' }),
    state: 'retryable',
    blockedReasons: [...new Set(reasons)],
    promptInjectionDetected: evidenceHasPromptInjection(input.evidence),
    provider: 'retryable-provider',
    providerRequestId: null,
    deletionHandle: null,
    providerRequestedAt: null,
    providerProcessedAt: null,
  };
}

function isRetryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network|fetch|unavailable|provider[-_ ]?(?:down|error)|rate[-_ ]?limit|quota|429|5\d\d|ECONN|ETIMEDOUT|EAI_AGAIN/i.test(message);
}

function normalizeEndpoint(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

function validateOutputAnchor(anchor: GradingAnchor, blocks: Map<string, NormalizedAnswerEvidence['blocks'][number]>): string[] {
  const block = blocks.get(anchor.blockId);
  if (!block) return ['unknown-anchor'];
  const reasons = validateEvidenceAnchor({ block, requestedPrecision: anchor.precision, excerpt: anchor.excerpt });
  if (anchor.precision === 'span') {
    if (anchor.spanStart === null || anchor.spanStart === undefined || anchor.spanEnd === null || anchor.spanEnd === undefined) reasons.push('unsupported-span-anchor');
    else if (anchor.spanEnd <= anchor.spanStart || anchor.spanStart < (block.spanStart ?? 0) || anchor.spanEnd > (block.spanEnd ?? anchor.spanEnd)) reasons.push('span-anchor-out-of-bounds');
  }
  if (anchor.pageNumber !== null && anchor.pageNumber !== undefined && anchor.pageNumber < 1) reasons.push('page-anchor-invalid');
  if (anchor.pageNumber !== null && anchor.pageNumber !== undefined && block.pageNumber !== null && block.pageNumber !== undefined && anchor.pageNumber !== block.pageNumber) reasons.push('page-anchor-mismatch');
  if (anchor.bbox !== null && anchor.bbox !== undefined) {
    if (!isValidBbox(anchor.bbox)) reasons.push('anchor-bbox-invalid');
    else if (!block.bbox) reasons.push('anchor-bbox-unsupported');
    else if (isValidBbox(block.bbox) && (anchor.bbox[0] < block.bbox[0] || anchor.bbox[1] < block.bbox[1] || anchor.bbox[2] > block.bbox[2] || anchor.bbox[3] > block.bbox[3])) reasons.push('anchor-bbox-outside-parent');
  }
  return [...new Set(reasons)];
}

function isValidBbox(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value)
    && value.length === 4
    && value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate) && coordinate >= 0)
    && value[0] <= value[2]
    && value[1] <= value[3];
}

function evidenceHasPromptInjection(evidence: NormalizedAnswerEvidence): boolean {
  return evidence.blocks.some((block) => isPromptInjectionLike(block.text));
}

function isUnsafeGeneratedText(value: string | undefined): boolean {
  return Boolean(value && /(?:sk-[A-Za-z0-9_-]+|Bearer\s+\S+|api[_-]?key\s*[=:])/i.test(value));
}

function parseJsonResponse(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error('provider-output-not-json');
  }
}

function extractFrozenQuestion(prompt: string): FrozenQuestionContract | null {
  const match = prompt.match(/<frozen-question>\n([\s\S]*?)\n<\/frozen-question>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as FrozenQuestionContract;
  } catch {
    return null;
  }
}

function extractEvidence(prompt: string): NormalizedAnswerEvidence | null {
  const match = prompt.match(/<answer-evidence>\n([\s\S]*?)\n<\/answer-evidence>/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as Pick<NormalizedAnswerEvidence, 'sourceHash' | 'precision' | 'limitations' | 'blocks'>;
    return {
      sourceKind: 'document',
      sourceHash: parsed.sourceHash,
      canonicalMarkdown: '',
      anchorVersion: 'fixture.v1',
      precision: parsed.precision,
      readiness: 'ready',
      limitationState: 'none',
      limitations: parsed.limitations,
      blocks: parsed.blocks,
    };
  } catch {
    return null;
  }
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
