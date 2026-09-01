import { createHash, randomUUID } from 'node:crypto';

export const GENERATED_CANDIDATE_GOVERNANCE_VERSION = 'adaptive-assessment-generated-candidate.v1';
export const TEMPLATE_PROMPT_TEMPLATE_VERSION = 'adaptive-question-template.v1';

export type GeneratedAssessmentKind = 'template' | 'ai' | 'human';
export type GeneratedCandidateStatus =
  | 'draft'
  | 'precheck-failed'
  | 'awaiting-human-review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'retired';
export type GeneratedCandidateReviewOutcome = 'approved' | 'rejected' | 'needs-revision';
export type GeneratedPublicationStatus = 'published' | 'retired' | 'rolled-back';

export interface GeneratedCandidateContent {
  stem: string;
  options: Array<{
    label: string;
    text: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  knowledgeTags: string[];
  learningGoalIds: string[];
  graphNodeIds: string[];
  difficulty: number;
  intendedStage: 'low-stakes-practice' | 'readiness' | 'checkpoint' | 'remediation' | 'terminal-validation';
}

export interface GeneratedCandidateEnvelopeInput {
  generationKind: GeneratedAssessmentKind;
  createdByUserId: string;
  generationServiceId?: string;
  provider?: string | null;
  model?: string | null;
  providerConfig?: Record<string, string | number | boolean | null>;
  promptTemplateVersion: string;
  promptText?: string;
  modelResponseText?: string;
  knowledgeSourceRefs: Array<{ ref: string; hash: string }>;
  generationParams: Record<string, string | number | boolean | null>;
  parentRevisionId?: string | null;
  content: GeneratedCandidateContent;
}

export interface GeneratedCandidatePublicEnvelope {
  generationKind: GeneratedAssessmentKind;
  promptTemplateVersion: string;
  provider: string | null;
  model: string | null;
  providerConfigDigest: string;
  promptHash: string | null;
  modelResponseHash: string | null;
  knowledgeSourceRefs: Array<{ ref: string; hash: string }>;
  generationParams: Record<string, string | number | boolean | null>;
  contentHash: string;
  parentRevisionId: string | null;
  createdByUserId: string;
  generationServiceId: string | null;
  governanceVersion: typeof GENERATED_CANDIDATE_GOVERNANCE_VERSION;
}

export interface GeneratedCandidateRevision {
  revisionId: string;
  candidateId: string;
  envelope: GeneratedCandidatePublicEnvelope;
  content: GeneratedCandidateContent;
  privatePayload?: {
    promptText?: string;
    modelResponseText?: string;
  };
  createdAt: string;
}

export interface GeneratedCandidateRecord {
  candidateId: string;
  generationKind: GeneratedAssessmentKind;
  status: GeneratedCandidateStatus;
  currentRevisionId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedCandidateEvent {
  eventId: string;
  candidateId: string;
  revisionId: string;
  status: GeneratedCandidateStatus;
  actorUserId: string | null;
  reason: string;
  createdAt: string;
}

export interface GeneratedCandidateReviewDecision {
  reviewId: string;
  candidateId: string;
  revisionId: string;
  reviewerUserId: string;
  reviewerRole: 'teacher' | 'admin' | 'assessment-content-reviewer';
  outcome: GeneratedCandidateReviewOutcome;
  rationale: string;
  itemDecisions: Record<string, 'accept' | 'reject'>;
  contentHash: string;
  reviewSourceHash: string;
  stale: boolean;
  createdAt: string;
}

export interface GeneratedPublicationReceipt {
  receiptId: string;
  candidateId: string;
  revisionId: string;
  reviewId: string;
  catalogItemId: string;
  contentHash: string;
  catalogReleaseId: string;
  receiptHash: string;
  generationKind: GeneratedAssessmentKind;
  status: GeneratedPublicationStatus;
  createdAt: string;
  retiredAt: string | null;
}

export interface GeneratedCandidateStore {
  candidates: GeneratedCandidateRecord[];
  revisions: GeneratedCandidateRevision[];
  events: GeneratedCandidateEvent[];
  reviews: GeneratedCandidateReviewDecision[];
  receipts: GeneratedPublicationReceipt[];
}

export interface GeneratedPrecheckFinding {
  code: string;
  severity: 'error' | 'warning';
  message: string;
}

export class GeneratedCandidateGovernanceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'GeneratedCandidateGovernanceError';
  }
}

export function createGeneratedCandidateStore(): GeneratedCandidateStore {
  return {
    candidates: [],
    revisions: [],
    events: [],
    reviews: [],
    receipts: [],
  };
}

export function serializeGeneratedCandidateStore(store: GeneratedCandidateStore): string {
  return JSON.stringify({
    ...store,
    revisions: store.revisions.map((revision) => ({
      ...revision,
      privatePayload: undefined,
    })),
  });
}

export function restoreGeneratedCandidateStore(serialized: string): GeneratedCandidateStore {
  const parsed = JSON.parse(serialized) as GeneratedCandidateStore;
  return {
    candidates: parsed.candidates ?? [],
    revisions: parsed.revisions ?? [],
    events: parsed.events ?? [],
    reviews: parsed.reviews ?? [],
    receipts: parsed.receipts ?? [],
  };
}

export function publicGeneratedCandidateSummary(record: GeneratedCandidateRecord, revision: GeneratedCandidateRevision) {
  return {
    candidateId: record.candidateId,
    status: record.status,
    generationKind: record.generationKind,
    currentRevisionId: record.currentRevisionId,
    contentHash: revision.envelope.contentHash,
    promptHash: revision.envelope.promptHash,
    provider: revision.envelope.provider,
    model: revision.envelope.model,
    knowledgeSourceRefs: revision.envelope.knowledgeSourceRefs,
    createdAt: record.createdAt,
  };
}

export function contentHashForGeneratedCandidate(content: GeneratedCandidateContent): string {
  return sha256({
    stem: content.stem,
    options: content.options.map((option) => ({
      label: option.label,
      text: option.text,
      isCorrect: option.isCorrect,
      explanation: option.explanation,
    })),
    knowledgeTags: [...content.knowledgeTags].sort(),
    learningGoalIds: [...content.learningGoalIds].sort(),
    graphNodeIds: [...content.graphNodeIds].sort(),
    difficulty: content.difficulty,
    intendedStage: content.intendedStage,
  });
}

export function runGeneratedCandidatePrecheck(content: GeneratedCandidateContent): GeneratedPrecheckFinding[] {
  const findings: GeneratedPrecheckFinding[] = [];
  if (!content.stem.trim()) findings.push(errorFinding('empty-stem', '题干不能为空。'));
  if (content.options.length < 2) findings.push(errorFinding('insufficient-options', '至少需要两个选项。'));
  const labels = content.options.map((option) => option.label.trim());
  if (new Set(labels).size !== labels.length) findings.push(errorFinding('duplicate-option-labels', '选项标签必须唯一。'));
  const texts = content.options.map((option) => option.text.trim());
  if (texts.some((text) => !text)) findings.push(errorFinding('empty-option-text', '选项文本不能为空。'));
  if (new Set(texts).size !== texts.length) findings.push(errorFinding('duplicate-distractors', '干扰项文本必须唯一。'));
  const correct = content.options.filter((option) => option.isCorrect);
  if (correct.length !== 1) findings.push(errorFinding('invalid-answer-key', '必须恰好有一个正确答案。'));
  if (content.learningGoalIds.length === 0) findings.push(errorFinding('missing-learning-goal', '必须绑定至少一个学习目标。'));
  if (!(content.difficulty >= 0.1 && content.difficulty <= 1)) findings.push(errorFinding('invalid-difficulty', '难度必须落在 0.1 到 1。'));
  const stem = content.stem.toLowerCase();
  if (correct.some((option) => option.text.trim() && stem.includes(option.text.trim().toLowerCase()))) {
    findings.push(errorFinding('answer-leaked-in-stem', '题干不得直接泄露正确答案文本。'));
  }
  if (/<script|javascript:/i.test([content.stem, ...texts].join('\n'))) {
    findings.push(errorFinding('unsafe-markup', '题面不得包含可执行标记。'));
  }
  const dollarCount = (content.stem.match(/\$/g) ?? []).length;
  if (dollarCount % 2 === 1) findings.push(errorFinding('unbalanced-formula-delimiters', '公式分隔符必须成对。'));
  return findings;
}

export function createGeneratedCandidate(
  store: GeneratedCandidateStore,
  input: GeneratedCandidateEnvelopeInput,
  now = new Date(),
): { record: GeneratedCandidateRecord; revision: GeneratedCandidateRevision; findings: GeneratedPrecheckFinding[] } {
  assertNoSensitivePublicLeak(input);
  const contentHash = contentHashForGeneratedCandidate(input.content);
  const findings = runGeneratedCandidatePrecheck(input.content);
  const candidateId = `generated-candidate:${randomUUID()}`;
  const revisionId = `generated-revision:${contentHash.slice(0, 16)}:${randomUUID().slice(0, 8)}`;
  const createdAt = now.toISOString();
  const envelope = toPublicEnvelope(input, contentHash);
  const status: GeneratedCandidateStatus = findings.some((finding) => finding.severity === 'error')
    ? 'precheck-failed'
    : 'awaiting-human-review';
  const revision: GeneratedCandidateRevision = {
    revisionId,
    candidateId,
    envelope,
    content: cloneContent(input.content),
    privatePayload: input.promptText || input.modelResponseText
      ? { promptText: input.promptText, modelResponseText: input.modelResponseText }
      : undefined,
    createdAt,
  };
  const record: GeneratedCandidateRecord = {
    candidateId,
    generationKind: input.generationKind,
    status,
    currentRevisionId: revisionId,
    createdByUserId: input.createdByUserId,
    createdAt,
    updatedAt: createdAt,
  };
  store.revisions.push(revision);
  store.candidates.push(record);
  store.events.push({
    eventId: `generated-event:${randomUUID()}`,
    candidateId,
    revisionId,
    status,
    actorUserId: input.createdByUserId,
    reason: status === 'precheck-failed' ? findings.map((finding) => finding.code).join(',') : 'awaiting-human-review',
    createdAt,
  });
  return { record, revision, findings };
}

export function reviseGeneratedCandidate(
  store: GeneratedCandidateStore,
  candidateId: string,
  input: Omit<GeneratedCandidateEnvelopeInput, 'generationKind' | 'createdByUserId'> & {
    createdByUserId?: string;
  },
  now = new Date(),
): { record: GeneratedCandidateRecord; revision: GeneratedCandidateRevision; findings: GeneratedPrecheckFinding[] } {
  const record = requireCandidate(store, candidateId);
  const parent = requireRevision(store, record.currentRevisionId);
  assertNoSensitivePublicLeak({
    ...input,
    generationKind: record.generationKind,
    createdByUserId: input.createdByUserId ?? record.createdByUserId,
  });
  const contentHash = contentHashForGeneratedCandidate(input.content);
  const findings = runGeneratedCandidatePrecheck(input.content);
  const createdAt = now.toISOString();
  const revisionId = `generated-revision:${contentHash.slice(0, 16)}:${randomUUID().slice(0, 8)}`;
  const envelope = toPublicEnvelope({
    generationKind: record.generationKind,
    createdByUserId: input.createdByUserId ?? record.createdByUserId,
    generationServiceId: input.generationServiceId,
    provider: input.provider,
    model: input.model,
    providerConfig: input.providerConfig,
    promptTemplateVersion: input.promptTemplateVersion,
    promptText: input.promptText,
    modelResponseText: input.modelResponseText,
    knowledgeSourceRefs: input.knowledgeSourceRefs,
    generationParams: input.generationParams,
    parentRevisionId: parent.revisionId,
    content: input.content,
  }, contentHash);
  const revision: GeneratedCandidateRevision = {
    revisionId,
    candidateId: record.candidateId,
    envelope,
    content: cloneContent(input.content),
    privatePayload: input.promptText || input.modelResponseText
      ? { promptText: input.promptText, modelResponseText: input.modelResponseText }
      : undefined,
    createdAt,
  };
  const status: GeneratedCandidateStatus = findings.some((finding) => finding.severity === 'error')
    ? 'precheck-failed'
    : 'awaiting-human-review';
  store.revisions.push(revision);
  record.currentRevisionId = revisionId;
  record.status = status;
  record.updatedAt = createdAt;
  store.events.push({
    eventId: `generated-event:${randomUUID()}`,
    candidateId: record.candidateId,
    revisionId,
    status,
    actorUserId: envelope.createdByUserId,
    reason: 'revised',
    createdAt,
  });
  markReviewsStale(store, record.candidateId, contentHash);
  return { record, revision, findings };
}

export function reviewGeneratedCandidate(
  store: GeneratedCandidateStore,
  input: {
    candidateId: string;
    reviewerUserId: string;
    reviewerRole: GeneratedCandidateReviewDecision['reviewerRole'];
    outcome: GeneratedCandidateReviewOutcome;
    rationale: string;
    itemDecisions: Record<string, 'accept' | 'reject'>;
  },
  now = new Date(),
): GeneratedCandidateReviewDecision {
  const record = requireCandidate(store, input.candidateId);
  const revision = requireRevision(store, record.currentRevisionId);
  if (record.status === 'precheck-failed') {
    throw new GeneratedCandidateGovernanceError('precheck-incomplete', '预检未通过的候选不能进入人工审核。');
  }
  if (input.reviewerUserId === record.createdByUserId) {
    throw new GeneratedCandidateGovernanceError('self-review-forbidden', '生成者不能批准自己的候选。');
  }
  if (revision.envelope.generationServiceId && input.reviewerUserId === revision.envelope.generationServiceId) {
    throw new GeneratedCandidateGovernanceError('model-review-forbidden', '生成服务不能批准自己的候选。');
  }
  if (!input.rationale.trim()) {
    throw new GeneratedCandidateGovernanceError('missing-rationale', '人工审核必须提供 rationale。');
  }
  if (input.outcome === 'approved') {
    const requiredKeys = ['answer', 'distractors', 'semantics', 'stage', 'source'] as const;
    const missing = requiredKeys.filter((key) => input.itemDecisions[key] !== 'accept');
    if (missing.length > 0) {
      throw new GeneratedCandidateGovernanceError(
        'incomplete-item-decisions',
        `批准前必须逐项接受 answer、distractors、semantics、stage 和 source，缺少：${missing.join(', ')}。`,
      );
    }
  }
  const createdAt = now.toISOString();
  const reviewSourceHash = sha256({
    candidateId: record.candidateId,
    revisionId: revision.revisionId,
    contentHash: revision.envelope.contentHash,
    reviewerUserId: input.reviewerUserId,
    outcome: input.outcome,
    itemDecisions: input.itemDecisions,
    rationale: input.rationale.trim(),
  });
  const review: GeneratedCandidateReviewDecision = {
    reviewId: `generated-review:${randomUUID()}`,
    candidateId: record.candidateId,
    revisionId: revision.revisionId,
    reviewerUserId: input.reviewerUserId,
    reviewerRole: input.reviewerRole,
    outcome: input.outcome,
    rationale: input.rationale.trim(),
    itemDecisions: { ...input.itemDecisions },
    contentHash: revision.envelope.contentHash,
    reviewSourceHash,
    stale: false,
    createdAt,
  };
  store.reviews.push(review);
  record.status = input.outcome === 'approved' ? 'approved' : input.outcome === 'rejected' ? 'rejected' : 'awaiting-human-review';
  record.updatedAt = createdAt;
  store.events.push({
    eventId: `generated-event:${randomUUID()}`,
    candidateId: record.candidateId,
    revisionId: revision.revisionId,
    status: record.status,
    actorUserId: input.reviewerUserId,
    reason: `human-review:${input.outcome}`,
    createdAt,
  });
  return review;
}

export function publishGeneratedCandidate(
  store: GeneratedCandidateStore,
  input: {
    candidateId: string;
    publisherUserId: string;
    catalogReleaseId: string;
  },
  now = new Date(),
): GeneratedPublicationReceipt {
  const record = requireCandidate(store, input.candidateId);
  const revision = requireRevision(store, record.currentRevisionId);
  const review = currentApprovedReview(store, record.candidateId, revision);
  if (record.status !== 'approved' || !review) {
    throw new GeneratedCandidateGovernanceError('not-approved', '只有当前人工批准且预检有效的候选才能发布。');
  }
  if (input.publisherUserId === record.createdByUserId) {
    throw new GeneratedCandidateGovernanceError('publisher-conflict', '生成者不能发布自己的候选。');
  }
  const findings = runGeneratedCandidatePrecheck(revision.content);
  if (findings.some((finding) => finding.severity === 'error')) {
    throw new GeneratedCandidateGovernanceError('precheck-stale', '发布前预检必须仍然有效。');
  }
  const createdAt = now.toISOString();
  const catalogItemId = `adaptive-assessment-item:generated-adaptive-question:${revision.revisionId}`;
  const receiptHash = sha256({
    candidateId: record.candidateId,
    revisionId: revision.revisionId,
    reviewId: review.reviewId,
    catalogItemId,
    contentHash: revision.envelope.contentHash,
    catalogReleaseId: input.catalogReleaseId,
    reviewSourceHash: review.reviewSourceHash,
  });
  const receipt: GeneratedPublicationReceipt = {
    receiptId: `generated-receipt:${randomUUID()}`,
    candidateId: record.candidateId,
    revisionId: revision.revisionId,
    reviewId: review.reviewId,
    catalogItemId,
    contentHash: revision.envelope.contentHash,
    catalogReleaseId: input.catalogReleaseId,
    receiptHash,
    generationKind: record.generationKind,
    status: 'published',
    createdAt,
    retiredAt: null,
  };
  store.receipts.push(receipt);
  record.status = 'published';
  record.updatedAt = createdAt;
  store.events.push({
    eventId: `generated-event:${randomUUID()}`,
    candidateId: record.candidateId,
    revisionId: revision.revisionId,
    status: 'published',
    actorUserId: input.publisherUserId,
    reason: `published:${receipt.receiptHash}`,
    createdAt,
  });
  return receipt;
}

export function retireGeneratedPublication(
  store: GeneratedCandidateStore,
  input: { receiptId: string; actorUserId: string; reason: string },
  now = new Date(),
): GeneratedPublicationReceipt {
  return closePublication(store, input.receiptId, 'retired', input.actorUserId, input.reason, now);
}

export function rollbackGeneratedPublication(
  store: GeneratedCandidateStore,
  input: { receiptId: string; actorUserId: string; reason: string },
  now = new Date(),
): GeneratedPublicationReceipt {
  return closePublication(store, input.receiptId, 'rolled-back', input.actorUserId, input.reason, now);
}

export function currentPublishedReceipts(store: GeneratedCandidateStore): GeneratedPublicationReceipt[] {
  return store.receipts.filter((receipt) => receipt.status === 'published');
}

export function isCurrentPublicationReceipt(
  store: GeneratedCandidateStore,
  receipt: GeneratedPublicationReceipt,
): boolean {
  if (receipt.status !== 'published') return false;
  const record = store.candidates.find((candidate) => candidate.candidateId === receipt.candidateId);
  const revision = store.revisions.find((item) => item.revisionId === receipt.revisionId);
  const review = store.reviews.find((item) => item.reviewId === receipt.reviewId);
  return Boolean(
    record
    && revision
    && review
    && !review.stale
    && review.outcome === 'approved'
    && review.contentHash === revision.envelope.contentHash
    && receipt.contentHash === revision.envelope.contentHash
    && receipt.revisionId === record.currentRevisionId
  );
}

function closePublication(
  store: GeneratedCandidateStore,
  receiptId: string,
  status: Exclude<GeneratedPublicationStatus, 'published'>,
  actorUserId: string,
  reason: string,
  now: Date,
): GeneratedPublicationReceipt {
  const receipt = store.receipts.find((item) => item.receiptId === receiptId);
  if (!receipt) throw new GeneratedCandidateGovernanceError('receipt-missing', '发布回执不存在。');
  const createdAt = now.toISOString();
  receipt.status = status;
  receipt.retiredAt = createdAt;
  const record = requireCandidate(store, receipt.candidateId);
  record.status = 'retired';
  record.updatedAt = createdAt;
  store.events.push({
    eventId: `generated-event:${randomUUID()}`,
    candidateId: record.candidateId,
    revisionId: receipt.revisionId,
    status: 'retired',
    actorUserId,
    reason: `${status}:${reason}`,
    createdAt,
  });
  return receipt;
}

function toPublicEnvelope(
  input: GeneratedCandidateEnvelopeInput,
  contentHash: string,
): GeneratedCandidatePublicEnvelope {
  return {
    generationKind: input.generationKind,
    promptTemplateVersion: input.promptTemplateVersion,
    provider: input.provider ?? null,
    model: input.model ?? null,
    providerConfigDigest: sha256(input.providerConfig ?? {}),
    promptHash: input.promptText ? sha256(input.promptText) : null,
    modelResponseHash: input.modelResponseText ? sha256(input.modelResponseText) : null,
    knowledgeSourceRefs: [...input.knowledgeSourceRefs].sort((left, right) => left.ref.localeCompare(right.ref)),
    generationParams: { ...input.generationParams },
    contentHash,
    parentRevisionId: input.parentRevisionId ?? null,
    createdByUserId: input.createdByUserId,
    generationServiceId: input.generationServiceId ?? null,
    governanceVersion: GENERATED_CANDIDATE_GOVERNANCE_VERSION,
  };
}

function currentApprovedReview(
  store: GeneratedCandidateStore,
  candidateId: string,
  revision: GeneratedCandidateRevision,
): GeneratedCandidateReviewDecision | null {
  return [...store.reviews].reverse().find((review) => (
    review.candidateId === candidateId
    && review.revisionId === revision.revisionId
    && review.outcome === 'approved'
    && review.stale === false
    && review.contentHash === revision.envelope.contentHash
  )) ?? null;
}

function markReviewsStale(store: GeneratedCandidateStore, candidateId: string, currentContentHash: string) {
  for (const review of store.reviews) {
    if (review.candidateId === candidateId && review.contentHash !== currentContentHash) {
      review.stale = true;
    }
  }
}

function requireCandidate(store: GeneratedCandidateStore, candidateId: string): GeneratedCandidateRecord {
  const record = store.candidates.find((candidate) => candidate.candidateId === candidateId);
  if (!record) throw new GeneratedCandidateGovernanceError('candidate-missing', '候选不存在。');
  return record;
}

function requireRevision(store: GeneratedCandidateStore, revisionId: string): GeneratedCandidateRevision {
  const revision = store.revisions.find((item) => item.revisionId === revisionId);
  if (!revision) throw new GeneratedCandidateGovernanceError('revision-missing', '候选修订不存在。');
  return revision;
}

function cloneContent(content: GeneratedCandidateContent): GeneratedCandidateContent {
  return {
    ...content,
    options: content.options.map((option) => ({ ...option })),
    knowledgeTags: [...content.knowledgeTags],
    learningGoalIds: [...content.learningGoalIds],
    graphNodeIds: [...content.graphNodeIds],
  };
}

function assertNoSensitivePublicLeak(input: GeneratedCandidateEnvelopeInput) {
  const publicProbe = JSON.stringify({
    generationKind: input.generationKind,
    promptTemplateVersion: input.promptTemplateVersion,
    knowledgeSourceRefs: input.knowledgeSourceRefs,
    generationParams: input.generationParams,
  });
  if (input.promptText && publicProbe.includes(input.promptText)) {
    throw new GeneratedCandidateGovernanceError('prompt-leak', '公开包络不得包含 prompt 原文。');
  }
}

function errorFinding(code: string, message: string): GeneratedPrecheckFinding {
  return { code, severity: 'error', message };
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}
