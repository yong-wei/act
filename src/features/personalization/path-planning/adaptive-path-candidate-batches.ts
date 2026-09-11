import { createHash } from 'node:crypto';

import {
  buildSerializablePathOptions,
  type AdaptiveLearningPathPlan,
} from '@/features/personalization/path-planning/public-api';
import {
  computeAdaptivePathPairDifferentiation,
  evaluateAdaptivePathHardDiversity,
  type AdaptivePathDifferentiationCandidate,
  type AdaptivePathHardDiversityResult,
  type AdaptivePathPairDifferentiationMetrics,
} from '@/features/personalization/path-planning/adaptive-path-differentiation';
import type { AdaptivePathNodeRuntimeBinding } from '@/features/personalization/path-planning/adaptive-path-runtime-binding';

export interface AdaptivePathCandidateSnapshot {
  id: string;
  fingerprint: string;
  ordinal: number;
  styleId: string;
  policyFamily: string | null;
  label: string;
  snapshot: Record<string, unknown>;
}

export interface AdaptivePathCandidateBatchView {
  id: string;
  userId: string;
  goalId: string;
  classId: string | null;
  generationRequestId: string;
  sourcePathId: string;
  plannerVersion: string | null;
  status: 'succeeded';
  createdAt: string;
  metadata: Record<string, unknown>;
  candidates: AdaptivePathCandidateSnapshot[];
}

export interface AdaptivePathCandidateBatchDerivation {
  kind: 'adjustment';
  sourceBatchId: string;
  sourceCandidateId: string;
  sourceCandidateFingerprint: string;
  activeProgressVersion: string;
  requestSnapshot: Record<string, unknown>;
  differenceSummary: AdaptivePathCandidateDifferenceSummary;
}

export interface AdaptivePathCandidateBatchPersistenceInput {
  generationRequestId: string;
  plan: AdaptiveLearningPathPlan;
  classId?: string | null;
  derivation?: AdaptivePathCandidateBatchDerivation;
  /** 批次定稿时的 OSS 对象键读取验证记录（#2033），由调用方经 runtime manifest/store 产出。 */
  objectKeyReadRecords?: Array<{
    objectKey: string;
    resourceId: string;
    candidateStyleId: string;
    nodeNodeId: string;
    state: 'verified' | 'index-verified' | 'missing' | 'forbidden' | 'checksum-mismatch' | 'unverified';
    contentSha256: string | null;
    verifiedAt: string;
  }>;
  /** 批次定稿时的逐节点 Runtime 资源绑定记录（#2055），含失败状态与原因。 */
  runtimeResourceBindings?: AdaptivePathNodeRuntimeBinding[];
  /** 绑定层限制码（#2055）：零绑定时显式受限，不静默空记录。 */
  runtimeBindingLimitationCodes?: string[];
  /** 规划开始前已加载的活发布索引快照（#2077）。 */
  planningResourceSnapshot?: AdaptivePathPlanningResourceSnapshot | null;
}

export interface AdaptivePathPlanningResourceSnapshot {
  indexId: string;
  projectionId: string;
  projectionHash: string;
  runtimeReleaseId: string | null;
  recommendable: Array<{
    resourceId: string;
    resourceVersion: string;
    sourcePath: string | null;
    type: string;
  }>;
}

export interface AdaptivePathCandidateDifferenceSummary {
  sourceCandidateId: string;
  sourceCandidateFingerprint: string;
  material: boolean;
  candidates: Array<{
    ordinal: number;
    styleId: string;
    changedFields: string[];
  }>;
}

export type AdaptivePathCandidateSelectionResolution =
  | { status: 'selected'; batchId: string; candidateId: string; candidate: AdaptivePathCandidateSnapshot }
  | { status: 'clarification_required'; batchId: string; alternatives: Array<{ candidateId: string; label: string }>; question: string }
  | { status: 'unresolved'; batchId: string }
  | { status: 'unavailable' };

interface CandidateBatchRecord {
  id: string;
  userId: string;
  goalId: string;
  classId: string | null;
  generationRequestId: string;
  sourcePathId: string;
  plannerVersion: string | null;
  status: string;
  createdAt: Date;
  metadata: unknown;
  candidates: Array<{
    id: string;
    ordinal: number;
    styleId: string;
    policyFamily: string | null;
    label: string;
    snapshot: unknown;
  }>;
}

export interface AdaptivePathCandidateBatchDb {
  adaptivePathCandidateBatch: {
    findUnique(args: unknown): Promise<CandidateBatchRecord | null>;
    findFirst(args: unknown): Promise<CandidateBatchRecord | null>;
    create(args: unknown): Promise<CandidateBatchRecord>;
  };
  $transaction?<T>(callback: (tx: AdaptivePathCandidateBatchDb) => Promise<T>): Promise<T>;
}

export class AdaptivePathCandidateBatchConflictError extends Error {}
export class AdaptivePathCandidateBatchValidationError extends Error {}

export async function persistAdaptivePathCandidateBatch(
  db: AdaptivePathCandidateBatchDb,
  input: AdaptivePathCandidateBatchPersistenceInput,
): Promise<AdaptivePathCandidateBatchView> {
  validatePersistenceInput(input.generationRequestId, input.plan);
  const existing = await findByGenerationRequest(db, input.generationRequestId);
  if (existing) return assertMatchingExisting(existing, input);

  const create = async (tx: AdaptivePathCandidateBatchDb) => {
    const raced = await findByGenerationRequest(tx, input.generationRequestId);
    if (raced) return assertMatchingExisting(raced, input);
    const batchId = stableId('path-candidate-batch', input.generationRequestId);
    const gated = buildGatedCandidateSnapshots(input.plan, batchId);
    const candidates = gated.candidates;
    // 只对实际持久化（门禁去重后）的候选计算两两指标。
    const differentiation = computeAdaptivePathBatchDifferentiation(input.plan, {
      objectKeyReadRecords: input.objectKeyReadRecords,
      styleIds: candidates.map((candidate) => candidate.styleId),
    });
    const limitations = uniqueStrings([
      ...(differentiation?.insufficientVerifiedResources
        ? [...gated.limitations, 'insufficient-verified-resources']
        : gated.limitations),
      ...(!(differentiation?.hardDiversity.passed) || candidates.length !== 3
        ? ['insufficient-candidate-diversity']
        : []),
      ...(input.runtimeBindingLimitationCodes ?? []),
    ]);
    const record = await tx.adaptivePathCandidateBatch.create({
      data: {
        id: batchId,
        userId: input.plan.userId,
        goalId: input.plan.goal.id,
        classId: input.classId ?? null,
        generationRequestId: input.generationRequestId,
        sourcePathId: input.plan.id,
        plannerVersion: input.plan.stage,
        status: 'succeeded',
        candidateCount: candidates.length,
        metadata: jsonSnapshot({
          planStatus: input.plan.status,
          stage: input.plan.stage,
          policyFamily: input.plan.policyFamily,
          confidence: input.plan.confidence,
          excludedPolicyFamilies: input.plan.excludedPolicyFamilies,
          policyBundleStatus: input.plan.policyBundle?.status ?? null,
          policyBundleFallbackReasons: input.plan.policyBundle?.fallbackReasons ?? [],
          decisionEvidence: input.plan.policyBundle?.decisionEvidence ?? null,
          diversityLimitations: limitations,
          differentiation,
          objectKeyReadRecords: input.objectKeyReadRecords ?? [],
          runtimeResourceBindings: input.runtimeResourceBindings ?? [],
          runtimeBindingLimited: (input.runtimeBindingLimitationCodes ?? []).length > 0,
          runtimeBindingLimitationCodes: input.runtimeBindingLimitationCodes ?? [],
          planningResourceSnapshot: input.planningResourceSnapshot ?? null,
          ...(input.derivation ? {
            derivation: {
              ...input.derivation,
              requestSnapshot: jsonSnapshot(input.derivation.requestSnapshot),
              requestFingerprint: fingerprintAdjustmentRequestSnapshot(input.derivation.requestSnapshot),
            },
          } : {}),
        }),
        candidates: {
          create: candidates.map((candidate) => ({
            id: candidate.id,
            ordinal: candidate.ordinal,
            styleId: candidate.styleId,
            policyFamily: candidate.policyFamily,
            label: candidate.label,
            snapshot: candidate.snapshot,
          })),
        },
      },
      include: { candidates: { orderBy: { ordinal: 'asc' } } },
    });
    return toBatchView(record);
  };

  try {
    return db.$transaction ? await db.$transaction(create) : await create(db);
  } catch (error) {
    const raced = await findByGenerationRequest(db, input.generationRequestId);
    if (raced) return assertMatchingExisting(raced, input);
    throw error;
  }
}

export interface AdaptivePathBatchDifferentiation {
  pairs: Array<{
    leftStyleId: string;
    rightStyleId: string;
    metrics: AdaptivePathPairDifferentiationMetrics;
  }>;
  /** 仅当恰好 3 条且 #2077 硬门禁通过、且无空资源候选时允许标记高区分度。 */
  highDifferentiation: boolean;
  hardDiversity: AdaptivePathHardDiversityResult;
  /** 读验证失败而被剔除出统计的对象键（去重排序），供审计对照读取记录。 */
  unreadableObjectKeys: string[];
  /** 存在核心资源被全部剔除（空资源）的候选：资源不足或验证失败，不得声称高区分度。 */
  insufficientVerifiedResources: boolean;
}

/** 从候选批次可序列化选项计算两两量化区分度（#2033）。候选少于 2 条时返回 null。 */
export function computeAdaptivePathBatchDifferentiation(
  plan: AdaptiveLearningPathPlan,
  options: {
    objectKeyReadRecords?: AdaptivePathCandidateBatchPersistenceInput['objectKeyReadRecords'];
    /** 仅对实际持久化的候选计算（门禁去重后的 styleId 集合）。 */
    styleIds?: string[];
  } = {},
): AdaptivePathBatchDifferentiation | null {
  const styleIdFilter = options.styleIds ? new Set(options.styleIds) : null;
  const serialized = buildSerializablePathOptions(plan)
    .filter((candidate) => candidate.nodeIds.length > 0)
    .filter((candidate) => !styleIdFilter || styleIdFilter.has(candidate.styleId));
  if (serialized.length < 2) return null;

  const unreadableObjectKeys = new Set(
    (options.objectKeyReadRecords ?? [])
      .filter((record) => record.state !== 'verified' && record.state !== 'index-verified')
      .map((record) => record.objectKey)
  );
  const unreadableNodeIds = new Set((options.objectKeyReadRecords ?? [])
    .filter((record) => record.state !== 'verified' && record.state !== 'index-verified').map((record) => record.nodeNodeId));
  const indexedNodeIds = new Set((options.objectKeyReadRecords ?? [])
    .filter((record) => record.state === 'index-verified').map((record) => record.nodeNodeId));
  // #2033 复审修复：按候选自己的 planNodes 解析节点（策略候选可含主推荐路径之外的节点）。
  const planNodeById = new Map(plan.mainPath.map((node) => [node.nodeId, node]));
  const nodesByCandidate = serialized.map((candidate) => {
    const planNodes = candidate.planNodes;
    if (Array.isArray(planNodes) && planNodes.length > 0) return planNodes;
    return candidate.nodeIds
      .map((nodeId) => planNodeById.get(nodeId))
      .filter(Boolean) as NonNullable<ReturnType<typeof planNodeById.get>>[];
  });
  // 共享剔除仅限"统一先修节点"与"统一终结验证节点"：被其他节点声明为先修、
  // 或承载 terminal-validation 的共有节点不算候选差异；普通共享教学资源保留。
  const sharedNodeIds = new Set(
    serialized[0].nodeIds.filter((nodeId) =>
      serialized.every((candidate) => candidate.nodeIds.includes(nodeId))),
  );
  const declaredPrerequisiteIds = new Set(
    nodesByCandidate.flatMap((nodes) => nodes.flatMap((node) => node.prerequisiteNodeIds ?? [])),
  );
  const sharedExcludedNodeIds = new Set(
    [...sharedNodeIds].filter((nodeId) => {
      const node = nodesByCandidate
        .map((nodes) => nodes.find((item) => item.nodeId === nodeId))
        .find(Boolean);
      if (!node) return false;
      if (node.terminalConstraints?.includes('terminal-validation')) return true;
      return declaredPrerequisiteIds.has(nodeId);
    }),
  );
  const inputs: AdaptivePathDifferentiationCandidate[] = serialized.map((candidate, index) => {
    const countedNodes = (nodesByCandidate[index] ?? []).filter((node) => {
      if (sharedExcludedNodeIds.has(node.nodeId) || unreadableNodeIds.has(node.nodeId)) return false;
      // 读验证失败（missing/forbidden/checksum-mismatch/unverified）的对象键资源不进入统计；
      // 对象键来自节点 runtime 绑定字段（#2055），不再从导航 target 反解。
      const objectKey = node.runtimeResourceBinding?.objectKey ?? null;
      return !(objectKey && unreadableObjectKeys.has(objectKey));
    });
    // 复审修复：候选核心资源中必须存在可验证的 Runtime 对象键资源；
    // 无 OSS 来源面（未绑定）的候选无法提供读取证明，视为资源不足。
    const hasVerifiableRuntimeResource = countedNodes.some((node) =>
      node.runtimeResourceBinding?.objectKey != null
      || Boolean(node.resourceFeatureRef)
      || (node.sourceKind === 'teaching_projection' && indexedNodeIds.has(node.nodeId)));
    const objectKeys = new Set<string>();
    const typeCounts: Record<string, number> = {};
    const checkpointSignature: string[] = [];
    let estimatedMinutes = 0;
    const total = countedNodes.length;
    countedNodes.forEach((node, index) => {
      const objectKey = node.runtimeResourceBinding?.objectKey ?? null;
      if (objectKey) objectKeys.add(objectKey);
      typeCounts[node.type] = (typeCounts[node.type] ?? 0) + 1;
      // 检查点签名编码归一化相对位置（前半程/后半程），区分安排差异。
      if (node.terminalConstraints?.includes('terminal-validation')) checkpointSignature.push('terminal');
      else if (node.checkpoint) checkpointSignature.push(index / Math.max(total, 1) < 0.5 ? 'inline-head' : 'inline-tail');
      estimatedMinutes += node.estimatedTimeMinutes ?? 0;
    });
    const totalResources = countedNodes.length || 1;
    const resourceTypeShares = Object.fromEntries(
      Object.entries(typeCounts).map(([type, count]) => [type, count / totalResources]),
    );
    return {
      styleId: candidate.styleId,
      coreNodeIds: countedNodes.map((node) => node.nodeId),
      coreObjectKeys: Array.from(objectKeys),
      resourceTypeShares,
      estimatedMinutes,
      checkpointSignature,
      hasVerifiableRuntimeResource,
    };
  });

  const pairs: AdaptivePathBatchDifferentiation['pairs'] = [];
  const insufficientVerifiedResources = inputs.some((input) =>
    input.coreNodeIds.length === 0 || input.hasVerifiableRuntimeResource === false);
  for (let left = 0; left < inputs.length; left += 1) {
    for (let right = left + 1; right < inputs.length; right += 1) {
      const metrics = computeAdaptivePathPairDifferentiation(inputs[left], inputs[right]);
      pairs.push({ leftStyleId: inputs[left].styleId, rightStyleId: inputs[right].styleId, metrics });
    }
  }
  const hardDiversity = evaluateAdaptivePathHardDiversity(serialized.map((candidate, index) => {
    const strategy = candidate.strategy;
    const preferredTypes = new Set(
      strategy?.generic === true ? [] : strategy?.portraitBasis ?? [],
    );
    const countedNodes = (nodesByCandidate[index] ?? []).filter((node) => {
      if (sharedExcludedNodeIds.has(node.nodeId) || unreadableNodeIds.has(node.nodeId)) return false;
      const objectKey = node.runtimeResourceBinding?.objectKey ?? null;
      return !(objectKey && unreadableObjectKeys.has(objectKey));
    });
    return {
      styleId: candidate.styleId,
      policyFamily: candidate.policyFamily,
      identities: countedNodes.flatMap((node) => {
        const id = node.resourceFeatureRef?.resourceId
          ?? node.runtimeResourceBinding?.objectKey
          ?? (node.sourceKind === 'teaching_projection' ? node.sourceRef : null);
        return id ? [{
          id,
          type: node.type,
          preferred: preferredTypes.has(node.type),
        }] : [];
      }),
      strategy,
    };
  }));
  return {
    pairs,
    highDifferentiation: !insufficientVerifiedResources && hardDiversity.passed,
    hardDiversity,
    unreadableObjectKeys: [...unreadableObjectKeys].sort(),
    insufficientVerifiedResources,
  };
}

export function buildCandidateSnapshots(
  plan: AdaptiveLearningPathPlan,
  batchId: string,
): AdaptivePathCandidateSnapshot[] {
  return buildGatedCandidateSnapshots(plan, batchId).candidates;
}

export function buildGatedCandidateSnapshots(
  plan: AdaptiveLearningPathPlan,
  batchId: string,
): { candidates: AdaptivePathCandidateSnapshot[]; limitations: string[] } {
  const serializedCandidates = buildSerializablePathOptions(plan)
    .filter((candidate) => candidate.nodeIds.length > 0);
  const executableCandidates = serializedCandidates.length > 0
    ? serializedCandidates
    : buildSerializablePathOptions({ ...plan, policyBundle: undefined });
  const candidates = executableCandidates
    .map((candidate) => ({
      styleId: candidate.styleId,
      policyFamily: candidate.policyFamily,
      label: candidate.label,
      snapshot: candidate as unknown as Record<string, unknown>,
    }));
  if (candidates.length === 0) {
    throw new AdaptivePathCandidateBatchValidationError('Candidate batch requires at least one executable candidate');
  }
  const ungated = candidates.map((candidate, index) => {
    const ordinal = index + 1;
    const snapshot = candidate.snapshot as Record<string, unknown>;
    return {
      id: stableId('path-candidate', `${batchId}:${candidate.styleId}:${ordinal}`),
      fingerprint: fingerprintAdaptivePathCandidateSnapshot(snapshot),
      ordinal,
      styleId: candidate.styleId,
      policyFamily: candidate.policyFamily,
      label: candidate.label,
      snapshot: jsonSnapshot({
        ...snapshot,
        optionId: typeof snapshot.optionId === 'string'
          ? snapshot.optionId
          : `path-option-${ordinal}`,
      }),
    };
  });
  return gateMateriallyDistinctCandidates(ungated);
}

export function gateMateriallyDistinctCandidates(
  candidates: AdaptivePathCandidateSnapshot[],
): { candidates: AdaptivePathCandidateSnapshot[]; limitations: string[] } {
  const seen = new Set<string>();
  const kept: AdaptivePathCandidateSnapshot[] = [];
  let duplicateCount = 0;
  for (const candidate of candidates) {
    if (seen.has(candidate.fingerprint)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(candidate.fingerprint);
    kept.push({
      ...candidate,
      ordinal: kept.length + 1,
    });
  }
  const limitations = limitationsForReduction(duplicateCount, candidates.length, kept.length);
  return {
    candidates: kept.map((candidate) => ({
      ...candidate,
      snapshot: {
        ...candidate.snapshot,
        limitations: uniqueStrings([
          ...stringArray(candidate.snapshot.limitations),
          ...limitations,
        ]),
      },
    })),
    limitations,
  };
}

function limitationsForReduction(duplicateCount: number, originalCount: number, keptCount: number): string[] {
  const limitations: string[] = [];
  if (duplicateCount > 0) limitations.push('title-or-score-only-duplicates-removed');
  if (keptCount < 2) limitations.push('insufficient-distinct-resources');
  if (originalCount > 0 && keptCount < originalCount && !limitations.includes('title-or-score-only-duplicates-removed')) {
    limitations.push('insufficient-distinct-resources');
  }
  return limitations;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function toBatchView(record: CandidateBatchRecord): AdaptivePathCandidateBatchView {
  if (record.status !== 'succeeded') {
    throw new AdaptivePathCandidateBatchValidationError('Only successful candidate batches can be projected');
  }
  return {
    id: record.id,
    userId: record.userId,
    goalId: record.goalId,
    classId: record.classId,
    generationRequestId: record.generationRequestId,
    sourcePathId: record.sourcePathId,
    plannerVersion: record.plannerVersion,
    status: 'succeeded',
    createdAt: record.createdAt.toISOString(),
    metadata: jsonSnapshot(record.metadata),
    candidates: [...record.candidates]
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((candidate) => ({
        id: candidate.id,
        fingerprint: fingerprintAdaptivePathCandidateSnapshot(candidate.snapshot),
        ordinal: candidate.ordinal,
        styleId: candidate.styleId,
        policyFamily: candidate.policyFamily,
        label: candidate.label,
        snapshot: jsonSnapshot(candidate.snapshot),
      })),
  };
}

export function fingerprintAdaptivePathCandidateSnapshot(snapshot: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(readMaterialCandidateFacts(snapshot)))
    .digest('hex');
}

export function buildAdaptivePathCandidateDifferenceSummary(
  sourceCandidate: AdaptivePathCandidateSnapshot,
  plan: AdaptiveLearningPathPlan,
): AdaptivePathCandidateDifferenceSummary {
  const sourceFacts = readMaterialCandidateFacts(sourceCandidate.snapshot);
  const candidates = buildCandidateSnapshots(plan, 'adjustment-preview').map((candidate) => {
    const candidateFacts = readMaterialCandidateFacts(candidate.snapshot);
    const changedFields = (Object.keys(sourceFacts) as Array<keyof typeof sourceFacts>)
      .filter((field) => JSON.stringify(sourceFacts[field]) !== JSON.stringify(candidateFacts[field]));
    return {
      ordinal: candidate.ordinal,
      styleId: candidate.styleId,
      changedFields,
    };
  });
  return {
    sourceCandidateId: sourceCandidate.id,
    sourceCandidateFingerprint: sourceCandidate.fingerprint,
    material: candidates.some((candidate) => candidate.changedFields.length > 0),
    candidates,
  };
}

async function findByGenerationRequest(
  db: AdaptivePathCandidateBatchDb,
  generationRequestId: string,
): Promise<CandidateBatchRecord | null> {
  return db.adaptivePathCandidateBatch.findUnique({
    where: { generationRequestId },
    include: { candidates: { orderBy: { ordinal: 'asc' } } },
  });
}

export async function readAdaptivePathCandidateBatch(
  db: AdaptivePathCandidateBatchDb,
  batchId: string,
): Promise<AdaptivePathCandidateBatchView | null> {
  const record = await db.adaptivePathCandidateBatch.findUnique({
    where: { id: batchId },
    include: { candidates: { orderBy: { ordinal: 'asc' } } },
  });
  return record ? toBatchView(record) : null;
}

export async function readAdaptivePathCandidateBatchByGenerationRequest(
  db: AdaptivePathCandidateBatchDb,
  generationRequestId: string,
): Promise<AdaptivePathCandidateBatchView | null> {
  const record = await findByGenerationRequest(db, generationRequestId);
  return record ? toBatchView(record) : null;
}

export async function readLatestAdaptivePathCandidateBatch(
  db: AdaptivePathCandidateBatchDb,
  input: { userId: string; goalId: string; classId?: string | null },
): Promise<AdaptivePathCandidateBatchView | null> {
  const record = await db.adaptivePathCandidateBatch.findFirst({
    where: {
      userId: input.userId,
      goalId: input.goalId,
      status: 'succeeded',
      ...(input.classId ? { classId: input.classId } : {}),
    },
    include: { candidates: { orderBy: { ordinal: 'asc' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return record ? toBatchView(record) : null;
}

export function resolveAdaptivePathCandidateSelection(
  batch: AdaptivePathCandidateBatchView | null,
  input: { candidateId?: string | null; naturalLanguageIntent?: string | null },
): AdaptivePathCandidateSelectionResolution {
  if (!batch) return { status: 'unavailable' };
  if (input.candidateId) {
    const candidate = batch.candidates.find((item) => item.id === input.candidateId);
    return candidate
      ? { status: 'selected', batchId: batch.id, candidateId: candidate.id, candidate }
      : { status: 'unresolved', batchId: batch.id };
  }

  const intent = normalizeSelectionText(input.naturalLanguageIntent);
  if (!intent) return { status: 'unresolved', batchId: batch.id };
  const matches = batch.candidates.filter((candidate) => {
    const label = normalizeSelectionText(candidate.label);
    return Boolean(label && (intent === label || intent.includes(label)));
  });
  if (matches.length === 1) {
    const candidate = matches[0]!;
    return { status: 'selected', batchId: batch.id, candidateId: candidate.id, candidate };
  }
  if (matches.length > 1 || isAmbiguousSelectionIntent(intent)) {
    return {
      status: 'clarification_required',
      batchId: batch.id,
      alternatives: batch.candidates.map((candidate) => ({ candidateId: candidate.id, label: candidate.label })),
      question: '你想选择哪一条学习路径？',
    };
  }
  return { status: 'unresolved', batchId: batch.id };
}

function normalizeSelectionText(value: string | null | undefined): string {
  return value?.normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s，。！？、,.!?]/gu, '') ?? '';
}

function isAmbiguousSelectionIntent(value: string): boolean {
  return [
    '这个', '那个', '这条', '那条', '推荐的', '你推荐的', '就它', '就这个', '选一个',
    '选第一个', '随便哪一个', '选你推荐的那条', '我都可以',
  ].includes(value);
}

function assertMatchingExisting(
  record: CandidateBatchRecord,
  input: AdaptivePathCandidateBatchPersistenceInput,
): AdaptivePathCandidateBatchView {
  assertAdaptivePathCandidateBatchMatchesInput(record, input);
  return toBatchView(record);
}

export function assertAdaptivePathCandidateBatchMatchesInput(
  record: Pick<
    AdaptivePathCandidateBatchView,
    'userId' | 'goalId' | 'classId' | 'generationRequestId' | 'sourcePathId'
  > & { metadata: unknown },
  input: AdaptivePathCandidateBatchPersistenceInput,
): void {
  if (
    record.generationRequestId !== input.generationRequestId ||
    record.userId !== input.plan.userId ||
    record.goalId !== input.plan.goal.id ||
    record.classId !== (input.classId ?? null) ||
    record.sourcePathId !== input.plan.id
  ) {
    throw new AdaptivePathCandidateBatchConflictError(
      'Generation request identity is already bound to another candidate batch',
    );
  }
  const existing = jsonSnapshot(jsonSnapshot(record.metadata).derivation);
  if (!input.derivation && Object.keys(existing).length === 0) return;
  const requestFingerprint = input.derivation
    ? fingerprintAdjustmentRequestSnapshot(input.derivation.requestSnapshot)
    : null;
  const existingRequestFingerprint = typeof existing.requestFingerprint === 'string'
    ? existing.requestFingerprint
    : null;
  const existingSnapshotFingerprint = fingerprintAdjustmentRequestSnapshot(existing.requestSnapshot);
  if (
    !input.derivation ||
    existing.kind !== input.derivation.kind ||
    existing.sourceBatchId !== input.derivation.sourceBatchId ||
    existing.sourceCandidateId !== input.derivation.sourceCandidateId ||
    existing.sourceCandidateFingerprint !== input.derivation.sourceCandidateFingerprint ||
    existing.activeProgressVersion !== input.derivation.activeProgressVersion ||
    !existingRequestFingerprint ||
    existingRequestFingerprint !== existingSnapshotFingerprint ||
    existingRequestFingerprint !== requestFingerprint
  ) {
    throw new AdaptivePathCandidateBatchConflictError(
      'Adjustment request identity is already bound to another candidate source or request',
    );
  }
}

function fingerprintAdjustmentRequestSnapshot(snapshot: unknown): string {
  return createHash('sha256').update(stableJson(snapshot)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function validatePersistenceInput(generationRequestId: string, plan: AdaptiveLearningPathPlan): void {
  if (!generationRequestId || generationRequestId.length > 160) {
    throw new AdaptivePathCandidateBatchValidationError('Generation request identity is invalid');
  }
  if (!plan.id || !plan.userId || !plan.goal?.id || plan.mainPath.length === 0) {
    throw new AdaptivePathCandidateBatchValidationError('Planner output is not persistable');
  }
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
}

function jsonSnapshot(value: unknown): Record<string, unknown> {
  const serialized = JSON.stringify(value);
  if (!serialized) return {};
  const normalized = JSON.parse(serialized) as unknown;
  return normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    ? normalized as Record<string, unknown>
    : {};
}

function readMaterialCandidateFacts(value: unknown) {
  const snapshot = jsonSnapshot(value);
  return {
    nodeIds: stringArray(snapshot.nodeIds),
    estimatedMinutes: finiteNumber(snapshot.estimatedMinutes),
    resourceMix: sortedNumberRecord(snapshot.resourceMix),
    checkpointNodeIds: stringArray(snapshot.checkpointNodeIds),
    terminalValidationNodeIds: stringArray(snapshot.terminalValidationNodeIds),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sortedNumberRecord(value: unknown): Record<string, number> {
  const record = jsonSnapshot(value);
  return Object.fromEntries(Object.entries(record)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    .sort(([left], [right]) => left.localeCompare(right)));
}
