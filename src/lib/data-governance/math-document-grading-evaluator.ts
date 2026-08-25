import { generateText, Output } from 'ai';
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

const PROVIDER_REQUEST_TIMEOUT_MS = 60_000;

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
  maxScore?: number;
  rationale: string;
  confidence: number;
  anchors: GradingAnchor[];
  limitationState: string;
  annotations?: Array<{
    comment: string;
    anchor: GradingAnchor;
  }>;
}

export interface ProviderOverallFeedback {
  strengths: string[];
  problems: string[];
  suggestions: string[];
}

export interface ProviderGradingOutput {
  evaluatorId: string;
  evaluatorVersion: string;
  assessments: ProviderCriterionAssessment[];
  limitations: string[];
  overallComment: string;
  overallFeedback?: ProviderOverallFeedback;
}

export interface ProviderRuntimeResult {
  output: unknown;
  provider: string;
  providerRequestId: string | null;
  deletionHandle: string | null;
  providerRequestedAt: Date | null;
  providerProcessedAt: Date | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  telemetryComplete?: boolean;
}

export interface GradingEvidenceAttachment {
  kind: 'image' | 'document';
  mediaType: string;
  data: Uint8Array;
  checksum: string;
  fileName?: string;
  questionId?: string | null;
}

export interface ValidatedGradingDraft extends ProviderGradingOutput {
  inputHash: string;
  evaluationIdentity?: string | null;
  dedupeKey: string;
  state: 'awaiting-review' | 'blocked' | 'retryable';
  blockedReasons: string[];
  promptInjectionDetected: boolean;
  provider: string;
  providerRequestId: string | null;
  deletionHandle: string | null;
  providerRequestedAt: Date | null;
  providerProcessedAt: Date | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  telemetryComplete?: boolean;
}

export interface GradingProviderRuntime {
  id: string;
  version: string;
  provider?: string;
  capabilities?: { vision?: boolean };
  evaluate(input: {
    system: string;
    user: string;
    attachments?: readonly GradingEvidenceAttachment[];
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
    maxScore: z.number().finite().optional(),
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
  overallFeedback: z.object({
    strengths: z.array(z.string().trim().min(1).max(1_000)).min(1).max(10),
    problems: z.array(z.string().trim().min(1).max(1_000)).min(1).max(10),
    suggestions: z.array(z.string().trim().min(1).max(1_000)).min(1).max(10),
  }).strict().optional(),
}).strict();

export async function createProviderRuntimeGradingAdapter(input: {
  provider?: GradingProviderRuntime;
  policy: ExternalProcessingPolicy | null | undefined;
  classId: string;
  purpose?: ExternalProcessingPolicy['purpose'];
  requireVision?: boolean;
}): Promise<GradingProviderRuntime> {
  const purpose = input.purpose ?? 'rubric-grading';
  const decision = evaluateExternalProcessingPolicy({
    policy: input.policy,
    provider: input.provider ? 'ai-evaluator' : input.policy?.provider ?? 'ai-evaluator',
    purpose,
    classId: input.classId,
  });
  if (!decision.allowed) throw new Error(`provider-policy-blocked:${decision.reasons.join(',')}`);
  if (input.provider) {
    if (input.requireVision) {
      const providerIdentity = input.provider.provider ?? input.provider.id;
      if (input.policy && providerIdentity !== input.policy.provider) throw new Error('provider-policy-provider-mismatch');
      if (input.policy?.model && input.provider.version !== input.policy.model) throw new Error('provider-policy-model-mismatch');
      if (input.provider.capabilities?.vision !== true) throw new Error('provider-vision-not-enabled');
    }
    return input.provider;
  }
  if (!input.policy?.model || !input.policy.endpoint) throw new Error('provider-policy-identity-missing');
  const config = await resolveConfiguredAIProviderConfig(input.policy.provider, input.policy.model);
  if (!config.enabled) throw new Error('provider-disabled');
  if (config.provider !== input.policy.provider) throw new Error('provider-policy-provider-mismatch');
  if (config.model !== input.policy.model) throw new Error('provider-policy-model-mismatch');
  if (config.secretRef !== input.policy.credentialRef) throw new Error('provider-policy-credential-mismatch');
  if (normalizeEndpoint(config.baseURL) !== normalizeEndpoint(input.policy.endpoint)) throw new Error('provider-policy-endpoint-mismatch');
  if (input.requireVision && config.capabilities?.vision !== true) throw new Error('provider-vision-not-enabled');
  const provider = createAIProviderFromConfig(config);
  return {
    id: config.provider,
    version: config.model,
    provider: config.provider,
    async evaluate(prompt) {
      const providerRequestedAt = new Date();
      const attachments = normalizeGradingAttachments(prompt.attachments)
        .filter((attachment) => attachment.kind === 'image');
      const requestTimeout = createProviderRequestTimeout(prompt.signal);
      let result: Awaited<ReturnType<typeof generateText>>;
      try {
        result = await generateText({
          model: provider.getModel(),
          ...(input.purpose === 'visual-description' ? {} : { output: Output.json({ name: 'teacher_ai_grading_draft' }) }),
          system: prompt.system,
          ...(attachments.length === 0
            ? { prompt: prompt.user }
            : {
                messages: [{
                  role: 'user' as const,
                  content: [
                    { type: 'text' as const, text: prompt.user },
                    ...attachments.map((attachment) => attachment.kind === 'image'
                      ? { type: 'image' as const, image: attachment.data, mediaType: attachment.mediaType }
                      : { type: 'file' as const, data: attachment.data, mediaType: attachment.mediaType, filename: attachment.fileName }),
                  ],
                }],
              }),
          temperature: 0,
          maxOutputTokens: 4_000,
          abortSignal: requestTimeout.signal,
        });
      } catch (error) {
        if (requestTimeout.timedOut()) {
          throw Object.assign(new Error('provider-timeout'), { cause: error, retryable: true });
        }
        throw error;
      } finally {
        requestTimeout.dispose();
      }
      const response = result.response as { id?: unknown; headers?: Headers | Record<string, string> } | undefined;
      const providerRequestId = typeof response?.id === 'string' && response.id.trim() ? response.id.trim() : null;
      const deletionHandle = readProviderDeletionHandle(response?.headers);
      const inputTokens = normalizeTokenCount(result.usage?.inputTokens);
      const outputTokens = normalizeTokenCount(result.usage?.outputTokens);
      return {
        output: typeof result.output === 'string'
          ? parseJsonResponse(result.output)
          : result.output ?? parseJsonResponse(result.text),
        provider: config.provider,
        providerRequestId,
        deletionHandle,
        providerRequestedAt,
        providerProcessedAt: new Date(),
        inputTokens,
        outputTokens,
        telemetryComplete: inputTokens !== null && outputTokens !== null,
      } satisfies ProviderRuntimeResult;
    },
  };
}

export async function evaluateFrozenQuestionEvidence(input: {
  question: FrozenQuestionContract;
  evidence: NormalizedAnswerEvidence;
  classId: string;
  policy: ExternalProcessingPolicy | null | undefined;
  provider?: GradingProviderRuntime;
  attachments?: readonly GradingEvidenceAttachment[];
  idempotencyKey?: string;
  onProviderResult?: (result: ProviderRuntimeResult) => void | Promise<void>;
  onProviderAttempt?: (attempt: {
    status: 'succeeded' | 'failed';
    result?: ProviderRuntimeResult;
    error?: unknown;
  }) => void | Promise<void>;
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
    const attachments = normalizeGradingAttachments(
      selectGradingAttachmentsForQuestion(input.attachments, input.question.questionId),
    );
    const provider = await createProviderRuntimeGradingAdapter(input);
    const prompt = buildScopedGradingPrompt({ question: input.question, evidence: input.evidence, evaluator: { id: provider.id, version: provider.version } });
    let raw: unknown;
    try {
      raw = await provider.evaluate({ system: prompt.system, user: prompt.user, attachments, idempotencyKey: input.idempotencyKey, signal: input.signal });
    } catch (error) {
      await input.onProviderAttempt?.({ status: 'failed', error });
      throw error;
    }
    const runtimeResult = normalizeProviderRuntimeResult(raw, provider);
    await input.onProviderAttempt?.({ status: 'succeeded', result: runtimeResult });
    await input.onProviderResult?.(runtimeResult);
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
      inputTokens: runtimeResult.inputTokens,
      outputTokens: runtimeResult.outputTokens,
      telemetryComplete: runtimeResult.telemetryComplete,
      attachmentHashes: attachments.map((attachment) => attachment.checksum),
      evaluationIdentity: input.idempotencyKey ?? null,
    });
    if (draft.state === 'blocked' && isRetryableProviderOutputError(draft.blockedReasons)) {
      return retryableDraft(input, draft.blockedReasons);
    }
    if (input.policy && input.policy.providerRetentionSeconds > 0 && !runtimeResult.providerRequestId && !runtimeResult.deletionHandle) {
      return { ...draft, state: 'blocked', blockedReasons: [...new Set([...draft.blockedReasons, 'provider-deletion-locator-missing'])] };
    }
    return draft;
  } catch (error) {
    const attachmentError = error instanceof Error && /^grading-attachments?-/u.test(error.message)
      ? error.message
      : null;
    if (attachmentError) return blockedDraft(input, [attachmentError], null);
    const reason = `provider-${redactProviderError(error)}`;
    return isRetryableProviderError(error)
      ? retryableDraft(input, [reason])
      : blockedDraft(input, [reason], null);
  }
}

export const evaluateWithProvider = evaluateFrozenQuestionEvidence;

export function selectGradingAttachmentsForQuestion(
  attachments: readonly GradingEvidenceAttachment[] | undefined,
  questionId: string,
): GradingEvidenceAttachment[] {
  return (attachments ?? []).filter((attachment) => attachment.questionId == null || attachment.questionId === questionId);
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
  inputTokens?: number | null;
  outputTokens?: number | null;
  telemetryComplete?: boolean;
  attachmentHashes?: readonly string[];
  evaluationIdentity?: string | null;
}): ValidatedGradingDraft {
  const parsed = providerOutputSchema.safeParse(normalizeProviderOutputForSchema(input.output));
  const inputHash = buildGradingInputHash(input);
  const dedupeKey = buildPipelineDedupeKey('grading-run', {
    question: input.question.questionId,
    answer: input.evidence.sourceHash,
    rubric: input.question.rubric.version,
    evaluator: input.evaluatorVersion ?? parsed.data?.evaluatorVersion ?? 'unknown',
    attachments: [...(input.attachmentHashes ?? [])].sort(),
  });
  const normalizedOutput = parsed.success
    ? normalizeProviderScores(repairProviderOutputAnchors(parsed.data, input.evidence), input.question)
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
      evaluationIdentity: input.evaluationIdentity ?? null,
      dedupeKey,
      state: 'blocked',
      blockedReasons: [...new Set(reasons)],
      promptInjectionDetected: evidenceHasPromptInjection(input.evidence),
      provider: input.provider ?? input.evaluatorId ?? 'unknown',
      providerRequestId: input.providerRequestId ?? null,
      deletionHandle: input.deletionHandle ?? null,
      providerRequestedAt: input.providerRequestedAt ?? null,
      providerProcessedAt: input.providerProcessedAt ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      telemetryComplete: input.telemetryComplete === true,
    };
  }
  return {
    ...normalizedOutput!,
    inputHash,
    evaluationIdentity: input.evaluationIdentity ?? null,
    dedupeKey,
    state: 'awaiting-review',
    blockedReasons: [],
    promptInjectionDetected: evidenceHasPromptInjection(input.evidence),
    provider: input.provider ?? input.evaluatorId ?? 'unknown',
    providerRequestId: input.providerRequestId ?? null,
    deletionHandle: input.deletionHandle ?? null,
    providerRequestedAt: input.providerRequestedAt ?? null,
    providerProcessedAt: input.providerProcessedAt ?? null,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    telemetryComplete: input.telemetryComplete === true,
  };
}

export function buildGradingInputHash(input: {
  question: FrozenQuestionContract;
  evidence: NormalizedAnswerEvidence;
  evaluatorId?: string;
  evaluatorVersion?: string;
  attachmentHashes?: readonly string[];
}): string {
  return sha256(JSON.stringify({
    question: input.question.contentHash,
    answer: input.evidence.sourceHash,
    evidence: input.evidence.anchorVersion,
    evaluator: [input.evaluatorId, input.evaluatorVersion],
    attachments: [...(input.attachmentHashes ?? [])].sort(),
  }));
}

function normalizeGradingAttachments(
  attachments: readonly GradingEvidenceAttachment[] | undefined,
): GradingEvidenceAttachment[] {
  const normalized = [...(attachments ?? [])];
  if (normalized.length > 24) throw new Error('grading-attachments-count-exceeded');
  let totalBytes = 0;
  for (const attachment of normalized) {
    if (attachment.kind === 'image' && !/^image\/(?:png|jpeg|webp)$/u.test(attachment.mediaType)) {
      throw new Error('grading-attachment-media-type-unsupported');
    }
    if (attachment.kind === 'document' && attachment.mediaType !== 'application/pdf') {
      throw new Error('grading-attachment-media-type-unsupported');
    }
    if (sha256(attachment.data) !== attachment.checksum) throw new Error('grading-attachment-checksum-mismatch');
    totalBytes += attachment.data.byteLength;
  }
  if (totalBytes > 32 * 1024 * 1024) throw new Error('grading-attachments-size-exceeded');
  return normalized;
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
    if (assessment.maxScore !== criterion.maxPoints) reasons.push('score-max-mismatch');
    if (assessment.score < 0 || (assessment.maxScore !== undefined && assessment.score > assessment.maxScore) || assessment.score > criterion.maxPoints || assessment.score > question.rubric.maxScore) reasons.push('score-overflow');
    if (question.rubric.schemaVersion === 'assignment-analytic-rubric.v1' && !usesHalfPointQuantum(assessment.score)) reasons.push('score-must-use-0.5-quantum');
    if (question.rubric.schemaVersion === 'assignment-scoring-rubric.v2' && !hasAtMostOneDecimal(assessment.score)) reasons.push('score-must-use-0.1-quantum');
    if (question.rubric.schemaVersion === 'assignment-analytic-rubric.v1' && level) {
      const scoreLevelTolerance = 1e-9;
      if (assessment.score < level.minPoints - scoreLevelTolerance || assessment.score > level.maxPoints + scoreLevelTolerance) reasons.push('score-level-range-mismatch');
    }
    if (assessment.rationale.length < 12) reasons.push('rationale-missing');
    if (!Number.isFinite(assessment.confidence) || assessment.confidence < 0 || assessment.confidence > 1) reasons.push('confidence-out-of-range');
    if (assessment.anchors.length === 0) reasons.push('evidence-anchor-missing');
    for (const anchor of assessment.anchors) reasons.push(...validateOutputAnchor(anchor, blocks));
    const annotations = assessment.annotations ?? [];
    if (assessment.score < criterion.maxPoints && annotations.length === 0) reasons.push('deduction-annotation-missing');
    if (assessment.score >= criterion.maxPoints && annotations.length > 0) reasons.push('annotation-without-deduction');
    for (const annotation of annotations) {
      if (!annotation.comment.trim()) reasons.push('annotation-comment-missing');
      reasons.push(...validateOutputAnchor(annotation.anchor, blocks));
    }
    if (!assessment.limitationState.trim()) reasons.push('limitation-state-missing');
    if (isUnsafeGeneratedText(assessment.rationale) || isUnsafeGeneratedText(assessment.annotations?.map((item) => item.comment).join(' '))) reasons.push('unsafe-generated-text');
  }
  for (const criterion of criteria.keys()) if (!seen.has(criterion)) reasons.push('criterion-assessment-missing');
  if (output.overallComment.length < 12) reasons.push('overall-comment-missing');
  if (isUnsafeGeneratedText(output.overallComment) || containsInternalFeedbackTerm(output.overallComment)) reasons.push('unsafe-overall-comment');
  if (!output.overallFeedback) {
    reasons.push('overall-feedback-missing');
  } else {
    const overallFeedback = [
      ...output.overallFeedback.strengths,
      ...output.overallFeedback.problems,
      ...output.overallFeedback.suggestions,
    ];
    if (overallFeedback.some((item) => isUnsafeGeneratedText(item) || containsInternalFeedbackTerm(item))) reasons.push('unsafe-overall-feedback');
  }
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
          const score = level?.maxPoints ?? criterion.maxPoints;
          const anchor = block
            ? { blockId: block.id, precision: block.precision, excerpt: block.text.slice(0, 180), pageNumber: block.pageNumber ?? null, spanStart: block.spanStart ?? null, spanEnd: block.spanEnd ?? null }
            : null;
          return {
            criterionId: criterion.id,
            levelId: level?.id ?? null,
            score,
            maxScore: criterion.maxPoints,
            rationale: `Fixture evaluation for ${criterion.label} cites a supplied evidence block.`,
            confidence: block ? 0.75 : 0,
            anchors: anchor ? [anchor] : [],
            limitationState: block ? 'none' : 'missing-evidence',
            annotations: anchor && score < criterion.maxPoints
              ? [{ comment: `Review the missing support for ${criterion.label}.`, anchor }]
              : [],
          };
        }),
        limitations: [],
        overallComment: 'Fixture output is available only for tests and explicit deterministic fixtures.',
        overallFeedback: {
          strengths: ['The supplied evidence is present.'],
          problems: ['Review any missing support before final submission.'],
          suggestions: ['State the supporting evidence directly.'],
        },
      };
    },
  };
}

function createProviderRequestTimeout(upstream: AbortSignal | undefined): {
  signal: AbortSignal;
  timedOut: () => boolean;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timeoutTriggered = false;
  const forwardUpstreamAbort = () => controller.abort(upstream?.reason);
  if (upstream?.aborted) forwardUpstreamAbort();
  else upstream?.addEventListener('abort', forwardUpstreamAbort, { once: true });
  const timer = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort(new Error('provider-timeout'));
  }, PROVIDER_REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    timedOut: () => timeoutTriggered,
    dispose: () => {
      clearTimeout(timer);
      upstream?.removeEventListener('abort', forwardUpstreamAbort);
    },
  };
}

function normalizeProviderOutputForSchema(output: unknown): unknown {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return output;
  const source = output as Record<string, unknown>;
  if (!Array.isArray(source.assessments)) return output;
  return {
    ...source,
    limitations: Array.isArray(source.limitations)
      ? source.limitations.map((limitation) => (
        typeof limitation === 'string' && limitation.trim().length > 240
          ? 'provider-limitation-truncated'
          : limitation
      ))
      : source.limitations,
    assessments: source.assessments.map((assessment) => {
      if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) return assessment;
      const candidate = assessment as Record<string, unknown>;
      const limitationState = candidate.limitationState;
      if (typeof limitationState !== 'string' || limitationState.trim().length <= 120) return assessment;
      return { ...candidate, limitationState: 'provider-limitation-state-truncated' };
    }),
  };
}

function normalizeProviderScores(
  output: ProviderGradingOutput,
  question: FrozenQuestionContract,
): ProviderGradingOutput {
  const criteria = new Map(question.rubric.criteria.map((criterion) => [criterion.id, criterion]));
  return {
    ...output,
    assessments: output.assessments.map((assessment) => {
      const criterion = criteria.get(assessment.criterionId);
      if (!criterion) return assessment;
      if (question.rubric.schemaVersion === 'assignment-analytic-rubric.v1') {
        const scoreLevelTolerance = 1e-9;
        const matchingLevels = criterion.levels.filter((level) => assessment.score >= level.minPoints - scoreLevelTolerance && assessment.score <= level.maxPoints + scoreLevelTolerance);
        if (matchingLevels.length === 1 && !matchingLevels.some((level) => level.id === assessment.levelId)) {
          return { ...assessment, levelId: matchingLevels[0].id };
        }
        return assessment;
      }
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

export function normalizeProviderRuntimeResult(raw: unknown, provider: GradingProviderRuntime): ProviderRuntimeResult {
  if (raw && typeof raw === 'object' && 'output' in raw && ('provider' in raw || 'providerRequestId' in raw || 'deletionHandle' in raw)) {
    const result = raw as Partial<ProviderRuntimeResult>;
    return {
      output: result.output,
      provider: typeof result.provider === 'string' && result.provider.trim() ? result.provider.trim() : provider.provider ?? provider.id,
      providerRequestId: typeof result.providerRequestId === 'string' && result.providerRequestId.trim() ? result.providerRequestId.trim() : null,
      deletionHandle: typeof result.deletionHandle === 'string' && result.deletionHandle.trim() ? result.deletionHandle.trim() : null,
      providerRequestedAt: normalizeProviderTimestamp(result.providerRequestedAt),
      providerProcessedAt: normalizeProviderTimestamp(result.providerProcessedAt),
      inputTokens: normalizeTokenCount(result.inputTokens),
      outputTokens: normalizeTokenCount(result.outputTokens),
      telemetryComplete: result.telemetryComplete === true,
    };
  }
  return {
    output: raw,
    provider: provider.provider ?? provider.id,
    providerRequestId: null,
    deletionHandle: null,
    providerRequestedAt: null,
    providerProcessedAt: null,
    inputTokens: null,
    outputTokens: null,
    telemetryComplete: false,
  };
}

function normalizeTokenCount(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
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
  idempotencyKey?: string;
}, reasons: string[], provider: GradingProviderRuntime | null): ValidatedGradingDraft {
  const inputHash = sha256(`${input.question.contentHash}:${input.evidence.sourceHash}`);
  return {
    evaluatorId: provider?.id ?? 'blocked-provider',
    evaluatorVersion: provider?.version ?? 'blocked',
    assessments: [],
    limitations: input.evidence.limitations,
    overallComment: '',
    inputHash,
    evaluationIdentity: input.idempotencyKey ?? null,
    dedupeKey: buildPipelineDedupeKey('grading-run', { question: input.question.questionId, answer: input.evidence.sourceHash, rubric: input.question.rubric.version, evaluator: provider?.version ?? 'blocked' }),
    state: 'blocked',
    blockedReasons: [...new Set(reasons)],
    promptInjectionDetected: evidenceHasPromptInjection(input.evidence),
    provider: provider?.provider ?? provider?.id ?? 'blocked-provider',
    providerRequestId: null,
    deletionHandle: null,
    providerRequestedAt: null,
    providerProcessedAt: null,
    inputTokens: null,
    outputTokens: null,
    telemetryComplete: false,
  };
}

function retryableDraft(input: {
  question: FrozenQuestionContract;
  evidence: NormalizedAnswerEvidence;
  idempotencyKey?: string;
}, reasons: string[]): ValidatedGradingDraft {
  const inputHash = sha256(`${input.question.contentHash}:${input.evidence.sourceHash}`);
  return {
    evaluatorId: 'retryable-provider',
    evaluatorVersion: 'retryable',
    assessments: [],
    limitations: input.evidence.limitations,
    overallComment: '',
    inputHash,
    evaluationIdentity: input.idempotencyKey ?? null,
    dedupeKey: buildPipelineDedupeKey('grading-run', { question: input.question.questionId, answer: input.evidence.sourceHash, rubric: input.question.rubric.version, evaluator: 'retryable' }),
    state: 'retryable',
    blockedReasons: [...new Set(reasons)],
    promptInjectionDetected: evidenceHasPromptInjection(input.evidence),
    provider: 'retryable-provider',
    providerRequestId: null,
    deletionHandle: null,
    providerRequestedAt: null,
    providerProcessedAt: null,
    inputTokens: null,
    outputTokens: null,
    telemetryComplete: false,
  };
}

function isRetryableProviderError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'retryable' in error && (error as { retryable?: unknown }).retryable === true) return true;
  if (error && typeof error === 'object' && 'cause' in error && isRetryableProviderError((error as { cause?: unknown }).cause)) return true;
  const status = error && typeof error === 'object'
    ? (error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status
    : undefined;
  if (typeof status === 'number') return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network|fetch|unavailable|no[-_ ]?(?:output|object)[-_ ]?generated|provider[-_ ]?(?:down|error)|rate[-_ ]?limit|quota|429|5\d\d|ECONN|ETIMEDOUT|EAI_AGAIN|siliconflow.*failed after retries/i.test(message);
}

function usesHalfPointQuantum(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value * 2 - Math.round(value * 2)) <= 1e-9;
}

function repairProviderOutputAnchors(
  output: ProviderGradingOutput,
  evidence: NormalizedAnswerEvidence,
): ProviderGradingOutput {
  const blocks = new Map(evidence.blocks.map((block) => [block.id, block]));
  const canonicalize = (anchor: GradingAnchor): GradingAnchor => {
    const block = blocks.get(anchor.blockId);
    const reasons = validateOutputAnchor(anchor, blocks);
    if (!block || reasons.length === 0 || !reasons.every((reason) => [
      'anchor-precision-unsupported',
      'anchor-excerpt-mismatch',
      'page-anchor-mismatch',
      'span-coordinates-missing',
      'unsupported-span-anchor',
    ].includes(reason))) return anchor;
    const excerpt = block.text.trim().slice(0, 600);
    if (!excerpt) return anchor;
    return {
      blockId: block.id,
      precision: block.precision ?? 'block',
      excerpt,
      ...(block.pageNumber == null ? {} : { pageNumber: block.pageNumber }),
      ...(block.precision === 'span' && block.spanStart != null && block.spanEnd != null
        ? { spanStart: block.spanStart, spanEnd: block.spanEnd }
        : {}),
      ...(block.bbox == null ? {} : { bbox: block.bbox }),
    };
  };
  return {
    ...output,
    assessments: output.assessments.map((assessment) => ({
      ...assessment,
      anchors: assessment.anchors.map(canonicalize),
      ...(assessment.annotations
        ? { annotations: assessment.annotations.map((annotation) => ({ ...annotation, anchor: canonicalize(annotation.anchor) })) }
        : {}),
    })),
  };
}

function isRetryableProviderOutputError(reasons: readonly string[]): boolean {
  return reasons.length > 0;
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

function containsInternalFeedbackTerm(value: string): boolean {
  return /(?:\b(?:criterion|rubric|anchor|evidence block|confidence|model|provider|prompt)\b|评分标准|评分项|锚点|证据块|置信(?:度)?|模型|提供商|提示词|内部术语)/i.test(value);
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
