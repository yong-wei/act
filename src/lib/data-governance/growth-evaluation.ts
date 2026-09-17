import { generateText } from 'ai';
import { createHash } from 'node:crypto';

import { getConfiguredAIProviderRuntime } from '@/lib/ai/provider-runtime';
import { presentStudentVisibleEvidenceTitle } from '@/lib/student-visible-text';
import {
  COMPETENCY_DIMENSIONS,
  getCompetencyLabel,
  type CompetencyVector,
} from './competency-model';

type GrowthRecordDelegate = {
  findUnique(args: { where: { businessKey: string } }): Promise<{ id: string; evidenceJson: unknown; sourceSnapshotAt?: Date | null } | null>;
  findFirst(args: {
    where: { userId: string; recordType: string; courseId: string };
    orderBy?: { occurredAt: 'desc' };
  }): Promise<{ id: string; evidenceJson: unknown } | null>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
};

type UserDelegate = {
  findUnique(args: {
    where: { id: string };
    select: { name: true; profile: { select: { studentNumber: true } } };
  }): Promise<{ name: string | null; profile: { studentNumber: string | null } | null } | null>;
};

export interface GrowthEvaluationSnapshot {
  id: string;
  userId: string;
  snapshotAt: Date;
  factCount: number;
  competencyVector: unknown;
  evidenceSummary: unknown;
  factInputDigest?: string;
}

export interface GrowthEvaluationDb {
  user: UserDelegate;
  growthRecord: GrowthRecordDelegate;
  studentProfile?: { findUnique(args: Record<string, unknown>): Promise<{ classId: string | null } | null> };
  gradingProviderPolicy?: {
    findFirst(args: any): Promise<GrowthProviderPolicy | null>;
  };
}

export interface GrowthProviderPolicy {
  id: string;
  provider: string;
  model: string | null;
  processingRegion: string;
  endpoint: string | null;
  credentialRef: string;
  purpose: string;
  dataCategories: string[];
  minimizedScope: string[];
  institutionScope: string | null;
  classScope: string[];
  agreementVersion: string;
  noTraining: boolean;
  providerRetentionSeconds: number;
  deletionCapability: boolean;
  version: string;
  enabled: boolean;
  disabledAt: Date | null;
}

export type QualitativeTextGenerator = (prompt: string) => Promise<string>;
type GrowthPolicySnapshot = Omit<GrowthProviderPolicy, 'disabledAt'> & { disabledAt: string | null };
type PreparedGrowthDescription = { description: string; source: 'generated' | 'fallback'; inputDigest: string; templateVersion: string; modelVersion: string; requestedAt: string; targetContext?: { classId: string | null; institutionId: string | null }; authorizationBranch?: 'class' | 'institution'; policySnapshot?: GrowthPolicySnapshot; policyHash?: string; providerRequestId?: string | null; deletionHandle?: string | null };

const RECORD_TYPE = 'competency_evaluation';
const RECORD_COURSE_ID = 'profile:growth-evaluation';
const growthBusinessKey = (userId: string) => `competency-evaluation:${userId}`;
const DEFAULT_LLM_TIMEOUT_MS = 15_000;
const GROWTH_TEMPLATE_VERSION = 'growth-evaluation.v2';
const GROWTH_MODEL_VERSION = 'configured-ai-policy.v1';

export function growthEvaluationInputDigest(snapshot: GrowthEvaluationSnapshot): string {
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: digesting the vector preserves compatibility identity, not authority.
  return createHash('sha256').update(JSON.stringify({ userId: snapshot.userId, factCount: snapshot.factCount, factInputDigest: snapshot.factInputDigest ?? null, competencyVector: snapshot.competencyVector, evidenceSummary: snapshot.evidenceSummary, templateVersion: GROWTH_TEMPLATE_VERSION })).digest('hex');
}

export function preparedGrowthEvaluationMatches(
  prepared: { inputDigest: string } | null | undefined,
  snapshot: GrowthEvaluationSnapshot,
): boolean {
  return Boolean(prepared && prepared.inputDigest === growthEvaluationInputDigest(snapshot));
}

export async function deleteExpiredGrowthEvaluations(db: { growthRecord: { deleteMany(args: unknown): Promise<{ count: number }> } }, now = new Date()): Promise<number> {
  const result = await db.growthRecord.deleteMany({ where: { recordType: RECORD_TYPE, expiresAt: { lte: now } } });
  return result.count;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readSnapshotAt(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record.snapshotAt === 'string' ? record.snapshotAt : null;
}

function toVector(value: unknown): CompetencyVector {
  return value as CompetencyVector;
}

function strongestAndWeakest(vector: CompetencyVector) {
  const ranked = COMPETENCY_DIMENSIONS
    .map((dimension) => ({
      dimension,
      label: getCompetencyLabel(dimension),
      score: vector[dimension]?.score ?? 0,
      evidenceCount: vector[dimension]?.evidenceCount ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
  const coveredRanked = ranked.filter((item) => item.evidenceCount > 0);
  const uncovered = ranked.filter((item) => item.evidenceCount === 0);
  const weakestCandidates = coveredRanked.length > 0 ? coveredRanked : ranked;

  return {
    strongest: coveredRanked[0] ?? ranked[0],
    weakest: weakestCandidates[weakestCandidates.length - 1],
    ranked,
    coveredRanked,
    uncovered,
  };
}

function compactEvidence(evidenceSummary: unknown) {
  const summary = asRecord(evidenceSummary);
  return COMPETENCY_DIMENSIONS.flatMap((dimension) => {
    const items = Array.isArray(summary[dimension]) ? summary[dimension] as Array<Record<string, unknown>> : [];
    return items.slice(0, 2).map((item) => ({
      dimension: getCompetencyLabel(dimension),
      title: presentStudentVisibleEvidenceTitle({
        evidenceTitle: typeof item.evidenceTitle === 'string' ? item.evidenceTitle : null,
        factType: typeof item.factType === 'string' ? item.factType : null,
      }),
      outcome: typeof item.outcome === 'string' ? item.outcome : 'unknown',
      score: typeof item.score === 'number' ? item.score : null,
    }));
  }).slice(0, 6);
}

export function buildGrowthEvaluationPrompt(input: {
  studentName: string;
  studentNumber?: string | null;
  snapshot: GrowthEvaluationSnapshot;
}): string {
  const vector = toVector(input.snapshot.competencyVector);
  const { strongest, weakest, ranked, uncovered } = strongestAndWeakest(vector);
  const evidence = compactEvidence(input.snapshot.evidenceSummary);

  return [
    '你是自动控制原理课程的学习评价助教。请基于平台学习数据，为学生生成一段个性化成长档案定性评价。',
    '要求：中文，80字以内；必须指出一个已表现出的能力证据、一个最需要改进的方向、一个具体下一步行动；不要使用空泛鼓励语。',
    '重要规则：证据数为0的维度只是未采集或未覆盖，不能写成能力薄弱、缺乏、需要补强；改进方向只能来自已有证据维度中的相对低分项。',
    '对象：该学习者（去标识化画像）',
    `事实数量：${input.snapshot.factCount}`,
    `能力得分：${ranked.map((item) => `${item.label}${Math.round(item.score)}分/证据${item.evidenceCount}条`).join('；')}`,
    `相对优势：${strongest.label}`,
    `优先补强：${weakest.label}`,
    `未覆盖维度：${uncovered.map((item) => item.label).join('；') || '无'}`,
    `主要证据：${evidence.map((item) => `${item.dimension}-${item.title}-${item.outcome}${item.score === null ? '' : `-${item.score}分`}`).join('；') || '暂无可读证据'}`,
  ].join('\n');
}

export function buildFallbackGrowthEvaluation(input: {
  studentName: string;
  snapshot: GrowthEvaluationSnapshot;
}) {
  const vector = toVector(input.snapshot.competencyVector);
  const { strongest, weakest } = strongestAndWeakest(vector);
  return `该学习者当前在${strongest.label}上证据较多，${weakest.label}的已有证据相对较弱。下一步应选择一条课堂证据，写清判断依据和改进动作。`;
}

function removeDirectIdentifiers(text: string, identifiers: Array<string | null | undefined>): string {
  return identifiers.reduce<string>((safe, identifier) => {
    const value = identifier?.trim();
    return value ? safe.split(value).join('该学习者') : safe;
  }, text).replace(/该学习者（该学习者）/g, '该学习者');
}

export function validateGrowthProviderPolicyBinding(policy: GrowthProviderPolicy, binding: { provider: string; model: string; endpoint: string; credentialRef: string }): boolean {
  const normalized = (value: string | null | undefined) => {
    try {
      const url = new URL(value?.trim() ?? '');
      const port = (url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80') ? '' : url.port;
      return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase()}${port ? `:${port}` : ''}${url.pathname.replace(/\/+$/, '')}${url.search}`;
    } catch { return ''; }
  };
  return policy.provider === binding.provider
    && policy.model === binding.model
    && normalized(policy.endpoint) === normalized(binding.endpoint)
    && policy.credentialRef === binding.credentialRef;
}

function isGovernedGrowthPolicy(policy: GrowthProviderPolicy | null | undefined): policy is GrowthProviderPolicy {
  return Boolean(policy?.enabled && !policy.disabledAt && policy.purpose === 'growth-evaluation'
    && policy.id && policy.version && policy.provider && policy.model && policy.processingRegion
    && policy.endpoint && policy.endpoint.startsWith('https://') && policy.credentialRef
    && policy.agreementVersion && (policy.institutionScope || policy.classScope.length > 0)
    && policy.dataCategories.includes('competency-profile') && policy.dataCategories.includes('learning-evidence-summary')
    && policy.minimizedScope.includes('competency-vector') && policy.minimizedScope.includes('evidence-summary')
    && policy.noTraining && Number.isInteger(policy.providerRetentionSeconds) && policy.providerRetentionSeconds >= 0
    && policy.deletionCapability);
}

function policyCoversTarget(policy: GrowthProviderPolicy, target: { classId: string | null; institutionId: string | null }): boolean {
  const classAllowed = Boolean(target.classId && (policy.classScope.includes('*') || policy.classScope.includes(target.classId)));
  const institutionAllowed = Boolean(target.institutionId && policy.institutionScope === target.institutionId);
  return classAllowed || institutionAllowed;
}

function growthPolicySnapshot(policy: GrowthProviderPolicy): GrowthPolicySnapshot {
  return { ...policy, dataCategories: [...policy.dataCategories], minimizedScope: [...policy.minimizedScope], classScope: [...policy.classScope], disabledAt: policy.disabledAt?.toISOString() ?? null };
}

function policySnapshotHash(snapshot: GrowthPolicySnapshot): string {
  const stable = (value: unknown): string => value && typeof value === 'object'
    ? Array.isArray(value) ? `[${value.map(stable).join(',')}]` : `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(',')}}`
    : JSON.stringify(value);
  return createHash('sha256').update(stable(snapshot)).digest('hex');
}

async function generateWithConfiguredModel(prompt: string, policy: GrowthProviderPolicy) {
  if (policy.providerRetentionSeconds > 0) return null;
  const runtime = await getConfiguredAIProviderRuntime(policy.provider, policy.model!);
  if (!validateGrowthProviderPolicyBinding(policy, runtime.binding) || !runtime.configured) {
    return null;
  }

  const timeoutMs = Number.parseInt(
    process.env.GROWTH_EVALUATION_LLM_TIMEOUT_MS || `${DEFAULT_LLM_TIMEOUT_MS}`,
    10,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_LLM_TIMEOUT_MS);

  try {
    const result = await generateText({
      model: runtime.model,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 220,
      abortSignal: controller.signal,
    });

    const response = result.response as { id?: unknown; headers?: Headers | Record<string, string> } | undefined;
    const providerRequestId = typeof response?.id === 'string' && response.id.trim() ? response.id.trim() : null;
    return { text: result.text.trim(), providerRequestId, deletionHandle: null };
  } catch (error) {
    if (controller.signal.aborted) {
      console.error('[GrowthEvaluation] qualitative generation timed out, using fallback');
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveGrowthProviderPolicy(db: GrowthEvaluationDb): Promise<GrowthProviderPolicy | null> {
  const policy = await db.gradingProviderPolicy?.findFirst({
    where: { enabled: true, disabledAt: null, purpose: 'growth-evaluation' },
    orderBy: { createdAt: 'desc' },
  });
  return isGovernedGrowthPolicy(policy) ? policy : null;
}

export async function prepareGrowthEvaluationDescription(
  db: GrowthEvaluationDb,
  input: { snapshot: GrowthEvaluationSnapshot; targetContext?: { classId: string | null; institutionId: string | null }; generateQualitativeText?: QualitativeTextGenerator },
): Promise<PreparedGrowthDescription | null> {
  if (input.snapshot.factCount <= 0) return null;
  const user = await db.user.findUnique({
    where: { id: input.snapshot.userId },
    select: { name: true, profile: { select: { studentNumber: true } } },
  });
  const studentName = user?.name?.trim() || '该学生';
  const identifiers = [studentName, user?.profile?.studentNumber];
  const prompt = removeDirectIdentifiers(buildGrowthEvaluationPrompt({
    studentName,
    studentNumber: user?.profile?.studentNumber,
    snapshot: input.snapshot,
  }), identifiers);
  const profile = await db.studentProfile?.findUnique({ where: { userId: input.snapshot.userId }, select: { classId: true } });
  const actualTarget = { classId: profile?.classId ?? null, institutionId: process.env.ACT_INSTITUTION_ID?.trim() || null };
  const suppliedTargetMatches = !input.targetContext || (input.targetContext.classId === actualTarget.classId && input.targetContext.institutionId === actualTarget.institutionId);
  const candidatePolicy = input.generateQualitativeText ? null : await resolveGrowthProviderPolicy(db);
  const policy = suppliedTargetMatches && candidatePolicy && policyCoversTarget(candidatePolicy, actualTarget) && candidatePolicy.providerRetentionSeconds === 0 ? candidatePolicy : null;
  const authorizationBranch = policy
    ? actualTarget.classId && (policy.classScope.includes('*') || policy.classScope.includes(actualTarget.classId)) ? 'class' : 'institution'
    : undefined;
  const requestedAt = new Date().toISOString();
  try {
    const generated = input.generateQualitativeText
      ? { text: await input.generateQualitativeText(prompt), providerRequestId: null, deletionHandle: null }
      : policy ? await generateWithConfiguredModel(prompt, policy) : null;
    const description = removeDirectIdentifiers(
      generated?.text.trim() || buildFallbackGrowthEvaluation({ studentName, snapshot: input.snapshot }),
      identifiers,
    ).slice(0, 240);
    const snapshot = policy ? growthPolicySnapshot(policy) : undefined;
    return { description, source: generated?.text.trim() ? 'generated' : 'fallback', inputDigest: growthEvaluationInputDigest(input.snapshot), templateVersion: GROWTH_TEMPLATE_VERSION, modelVersion: policy?.model ?? GROWTH_MODEL_VERSION, requestedAt, targetContext: actualTarget, authorizationBranch, ...(snapshot ? { policySnapshot: snapshot, policyHash: policySnapshotHash(snapshot), providerRequestId: generated?.providerRequestId ?? null, deletionHandle: generated?.deletionHandle ?? null } : {}) } as PreparedGrowthDescription;
  } catch (error) {
    console.error('[GrowthEvaluation] qualitative generation failed, using fallback', error);
    return { description: removeDirectIdentifiers(buildFallbackGrowthEvaluation({ studentName, snapshot: input.snapshot }), identifiers).slice(0, 240), source: 'fallback', inputDigest: growthEvaluationInputDigest(input.snapshot), templateVersion: GROWTH_TEMPLATE_VERSION, modelVersion: GROWTH_MODEL_VERSION, requestedAt };
  }
}

export async function refreshStudentGrowthEvaluation(
  db: GrowthEvaluationDb,
  input: {
    snapshot: GrowthEvaluationSnapshot;
    generateQualitativeText?: QualitativeTextGenerator;
    preparedDescription?: PreparedGrowthDescription;
  },
) {
  if (input.snapshot.factCount <= 0) {
    return { action: 'skipped_no_evidence' as const, description: null };
  }

  const businessKey = growthBusinessKey(input.snapshot.userId);
  const existing = await db.growthRecord.findUnique({ where: { businessKey } });
  const existingSnapshotAt = readSnapshotAt(existing?.evidenceJson);
  if (existingSnapshotAt && new Date(existingSnapshotAt).getTime() >= input.snapshot.snapshotAt.getTime()) {
    return { action: 'skipped' as const, description: null };
  }

  const prepared = input.preparedDescription ?? await prepareGrowthEvaluationDescription(db, input);
  const description = prepared?.description ?? null;
  const snapshotAt = input.snapshot.snapshotAt.toISOString();
  const evidenceJson = {
    summaryVersion: 'growth-evaluation-evidence.v1',
    source: prepared?.source ?? 'fallback',
    snapshotId: input.snapshot.id,
    snapshotAt,
    factCount: input.snapshot.factCount,
    inputDigest: prepared?.inputDigest ?? growthEvaluationInputDigest(input.snapshot),
    requestHash: prepared?.inputDigest ?? growthEvaluationInputDigest(input.snapshot),
    templateVersion: prepared?.templateVersion ?? GROWTH_TEMPLATE_VERSION,
    modelVersion: prepared?.modelVersion ?? GROWTH_MODEL_VERSION,
    requestedAt: prepared?.requestedAt ?? snapshotAt,
    policySnapshot: prepared?.policySnapshot ?? null,
    policyHash: prepared?.policyHash ?? null,
    providerRequestId: prepared?.providerRequestId ?? null,
    deletionHandle: prepared?.deletionHandle ?? null,
    targetContext: prepared?.targetContext ?? null,
    authorizationBranch: prepared?.authorizationBranch ?? null,
    retention: { policy: 'growth-evaluation-minimal-provenance', providerRetentionSeconds: prepared?.policySnapshot?.providerRetentionSeconds ?? 0, deletionCapability: prepared?.policySnapshot?.deletionCapability ?? false, expiresAt: new Date(input.snapshot.snapshotAt.getTime() + 365 * 24 * 60 * 60_000).toISOString() },
  };

  const data = {
    userId: input.snapshot.userId,
    businessKey,
    recordType: RECORD_TYPE,
    title: '阶段性能力画像评价',
    description,
    evidenceJson,
    mediaUrls: [],
    occurredAt: input.snapshot.snapshotAt,
    courseId: RECORD_COURSE_ID,
    isPublic: false,
    expiresAt: new Date(input.snapshot.snapshotAt.getTime() + 365 * 24 * 60 * 60_000),
    sourceSnapshotAt: input.snapshot.snapshotAt,
    sourceInputDigest: evidenceJson.inputDigest,
  };

  if (existing) {
    const updated = await db.growthRecord.updateMany({
      where: { businessKey, sourceSnapshotAt: { lt: input.snapshot.snapshotAt } },
      data,
    });
    return updated.count === 1
      ? { action: 'updated' as const, description }
      : { action: 'skipped_fenced' as const, description: null };
  }

  try {
    await db.growthRecord.create({ data });
    return { action: 'created' as const, description };
  } catch (error) {
    if (!error || typeof error !== 'object' || (error as { code?: unknown }).code !== 'P2002') throw error;
    const updated = await db.growthRecord.updateMany({ where: { businessKey, sourceSnapshotAt: { lt: input.snapshot.snapshotAt } }, data });
    return updated.count === 1 ? { action: 'updated' as const, description } : { action: 'skipped_fenced' as const, description: null };
  }
}
